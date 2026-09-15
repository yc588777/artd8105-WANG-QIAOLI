import type { TurtleSeg } from "../grow/turtleRenderer";
import { IDLE_MOTION, type MotionSample } from "./speech/motion";
import {
  randomMix,
  type DrivenParams,
  type MixParams,
  type MixState,
} from "./mixRecipe";
import { SeededRandom } from "../../utils/seededRandom";

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(v: number) {
  return clamp(v, 0, 1);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

export type WanderState = {
  t: number;
  hold: number;
  from: MixParams;
  to: MixState;
  morph: number;
};

export function createWander(mix: MixState, rng: SeededRandom): WanderState {
  return {
    t: 0,
    hold: 3.6 + rng.next() * 5.4,
    from: { ...mix.params },
    to: randomMix(rng),
    morph: 0,
  };
}

export function lerpParams(a: MixParams, b: MixParams, u: number): MixParams {
  const k = smooth(clamp01(u));
  return {
    flockCount: k > 0.94 ? b.flockCount : a.flockCount,
    flockSpeed: lerp(a.flockSpeed, b.flockSpeed, k),
    growIters: k > 0.94 ? b.growIters : a.growIters,
    growAngle: k > 0.92 ? b.growAngle : a.growAngle,
    growPreset: k > 0.5 ? b.growPreset : a.growPreset,
    F: lerp(a.F, b.F, k),
    K: lerp(a.K, b.K, k),
    mutation: lerp(a.mutation, b.mutation, k),
    auraSize: lerp(a.auraSize, b.auraSize, k),
    auraGlow: lerp(a.auraGlow, b.auraGlow, k),
  };
}

export function breatheParams(p: MixParams, t: number): MixParams {
    const s = Math.sin(t * 0.37);
    const s2 = Math.sin(t * 0.19);
    return {
      ...p,
      flockSpeed: clamp(p.flockSpeed + s * 32, 40, 220),
      F: clamp(p.F + s2 * 0.007, 0.02, 0.08),
    K: clamp(p.K + Math.sin(t * 0.29) * 0.0035, 0.04, 0.07),
    auraSize: clamp(p.auraSize + Math.sin(t * 0.81) * 4.2, 6, 48),
    auraGlow: clamp(p.auraGlow + (0.5 + 0.5 * Math.sin(t * 1.07)) * 0.28, 0.2, 2),
    mutation: clamp(p.mutation + (0.5 + 0.5 * Math.sin(t * 0.41)) * 0.05, 0, 0.4),
  };
}

function sameLayers(a: MixState, b: MixState) {
  return (
    a.layers.gene === b.layers.gene &&
    a.layers.flock === b.layers.flock &&
    a.layers.cell === b.layers.cell &&
    a.layers.grow === b.layers.grow &&
    a.layers.diff === b.layers.diff
  );
}

export function stepWander(
  state: WanderState,
  current: MixState,
  dt: number,
  rng: SeededRandom,
): { state: WanderState; mix: MixState; commit: boolean } {
  const t = state.t + dt;
  const morph = Math.min(1, state.morph + dt / Math.max(1.35, state.hold * 0.6));
  const params = breatheParams(lerpParams(state.from, state.to.params, morph), t);
  const snap = morph >= 0.34;
  const mix: MixState = {
    layers: snap ? state.to.layers : current.layers,
    couples: snap ? state.to.couples : current.couples,
    params,
  };
  const flipped = snap && !sameLayers(mix, current);

  if (t >= state.hold) {
    return {
      state: {
        t: 0,
        hold: 3.4 + rng.next() * 5.8,
        from: { ...params },
        to: randomMix(rng),
        morph: 0,
      },
      mix,
      commit: true,
    };
  }

  return { state: { ...state, t, morph }, mix, commit: flipped };
}

export function wanderPath(t: number): MotionSample {
  const a = t * 0.31;
  const b = t * 0.19;
  const c = t * 0.47;
  return {
    energy: 0.3 + 0.24 * (0.5 + 0.5 * Math.sin(c)),
    cx: 0.5 + 0.38 * Math.sin(a) + 0.1 * Math.sin(t * 1.27),
    cy: 0.5 + 0.33 * Math.cos(b) + 0.08 * Math.cos(t * 0.91),
    vx: 0.13 * Math.cos(a),
    vy: -0.11 * Math.sin(b),
  };
}

export function blendDrives(cam: MotionSample, wander: MotionSample, wanderAmt: number): MotionSample {
  const w = clamp01(wanderAmt);
  return {
    energy: clamp01(cam.energy + wander.energy * w * 0.7),
    cx: cam.cx * (1 - w * 0.48) + wander.cx * w * 0.48,
    cy: cam.cy * (1 - w * 0.48) + wander.cy * w * 0.48,
    vx: cam.vx + wander.vx * w,
    vy: cam.vy + wander.vy * w,
  };
}

/** Camera owns audio. Wander only reshapes the picture unless the camera is off. */
export function visualDriveOf(camOn: boolean, cam: MotionSample, wanderOn: boolean, t: number): MotionSample {
  if (!wanderOn && !camOn) return IDLE_MOTION;
  if (wanderOn && !camOn) return wanderPath(t);
  if (camOn && !wanderOn) return cam;
  return blendDrives(cam, wanderPath(t), 0.46);
}

export function overlayDriveParams(p: DrivenParams, drive: MotionSample, loud: number): DrivenParams {
  const e = clamp01(drive.energy);
  const sp = Math.hypot(drive.vx, drive.vy);
  return {
    ...p,
    flockSpeed: clamp(p.flockSpeed * (1 + e * 1.35 + sp * 4.4 + loud * 0.35), 28, 460),
    flockSep: clamp(p.flockSep * (0.65 + e * 1.25), 0.25, 3.4),
    flockCoh: clamp(p.flockCoh * (1.2 - e * 0.78), 0.12, 2.4),
    F: clamp(p.F + (drive.cx - 0.5) * 0.018 + e * 0.014 + drive.vx * 0.025, 0.018, 0.086),
    K: clamp(p.K + (drive.cy - 0.5) * 0.013 + e * 0.007, 0.037, 0.078),
  };
}

export function flockPointer(drive: MotionSample, w: number, h: number) {
  if (drive.energy < 0.028) return null;
  const swirl = Math.hypot(drive.vx, drive.vy);
  return {
    x: drive.cx * w,
    y: drive.cy * h,
    down: true as const,
    tool: drive.energy > 0.46 || swirl > 0.085 ? ("repel" as const) : ("attract" as const),
  };
}

export function warpGrow(segs: TurtleSeg[], drive: MotionSample, t: number, wanderWind = 0): TurtleSeg[] {
  if (!segs.length) return segs;
  const e = drive.energy;
  const wind = (drive.cx - 0.5) * 58 + drive.vx * 210 + Math.sin(t * 1.55) * (10 + e * 42) + wanderWind;
  const lift = (drive.cy - 0.5) * 34 + drive.vy * 120 + Math.cos(t * 1.12) * (6 + e * 22);
  const twist = (drive.cx - 0.5) * 0.22 + e * 0.16 * Math.sin(t * 2.05);
  return segs.map((s) => {
    const h = (Math.abs(s.y1) + Math.abs(s.y2)) * 0.5;
    const k = 0.0022 + h * 0.0064;
    const ang = twist * k * 48;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const x1 = s.x1 * ca - s.y1 * sa + wind * k;
    const y1 = s.x1 * sa + s.y1 * ca + lift * k;
    const x2 = s.x2 * ca - s.y2 * sa + wind * (k + 0.01);
    const y2 = s.x2 * sa + s.y2 * ca + lift * (k + 0.01);
    return { ...s, x1, y1, x2, y2 };
  });
}

export function stampMotionCells(
  grid: Uint8Array,
  cols: number,
  rows: number,
  drive: MotionSample,
  frameN: number,
) {
  const e = drive.energy;
  if (e < 0.03 && frameN % 16 !== 0) return;
  const mx = Math.max(0, Math.min(cols - 1, Math.round(drive.cx * (cols - 1))));
  const my = Math.max(0, Math.min(rows - 1, Math.round(drive.cy * (rows - 1))));
  const r = 1 + Math.floor(e * 8 + Math.hypot(drive.vx, drive.vy) * 22);
  const kill = e > 0.64;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = (mx + dx + cols) % cols;
      const y = (my + dy + rows) % rows;
      const i = y * cols + x;
      grid[i] = kill && ((dx + dy + frameN) & 1) === 0 ? 0 : 1;
    }
  }
  const sparks = 4 + Math.floor(e * 24);
  for (let k = 0; k < sparks; k++) {
    const x = (mx + (((frameN * 13 + k * 29) % 21) - 10) + cols) % cols;
    const y = (my + (((frameN * 17 + k * 31) % 15) - 7) + rows) % rows;
    grid[y * cols + x] = (frameN + k) % 3 === 0 ? 0 : 1;
  }
}

export function sparkCells(grid: Uint8Array, n: number, frameN: number) {
  for (let k = 0; k < n; k++) {
    const i = Math.abs((frameN * 131 + k * 977) * 1103515245) % grid.length;
    grid[i] = grid[i] ? 0 : 1;
  }
}

export function motionSplatPlan(drive: MotionSample, n: number, frameN: number) {
  const e = drive.energy;
  const period = e > 0.4 ? 2 : e > 0.14 ? 3 : 8;
  if (frameN % period !== 0 && e < 0.08) return [] as { x: number; y: number; r: number; erase: boolean }[];
  const cx = drive.cx * n;
  const cy = drive.cy * n;
  const out = [{ x: cx, y: cy, r: 1.4 + e * 9, erase: e > 0.74 && frameN % 9 === 0 }];
  out.push({
    x: cx + drive.vx * n * 6,
    y: cy + drive.vy * n * 6,
    r: 1.1 + e * 5,
    erase: false,
  });
  const a = frameN * 0.41;
  const arm = 7 + e * 26;
  out.push({ x: cx + Math.cos(a) * arm, y: cy + Math.sin(a) * arm, r: 1.6 + e * 3.4, erase: false });
  out.push({
    x: cx + Math.cos(a + 2.15) * (arm * 0.7),
    y: cy + Math.sin(a + 2.15) * (arm * 0.7),
    r: 1.2 + e * 2.2,
    erase: false,
  });
  if (e > 0.35) {
    out.push({
      x: cx + Math.cos(a + 4.1) * arm * 1.15,
      y: cy + Math.sin(a + 4.1) * arm * 1.15,
      r: 2 + e * 4,
      erase: false,
    });
  }
  return out;
}

export function cellStepInterval(drive: MotionSample) {
  return Math.max(0.026, 0.12 * (1 - drive.energy * 0.8));
}

export function rdSteps(drive: MotionSample) {
  if (drive.energy > 0.45) return 7;
  if (drive.energy > 0.16) return 5;
  return 4;
}

export function genePose(drive: MotionSample, w: number, h: number) {
  return {
    x1: w * 0.5 - 90 + (drive.cx - 0.5) * w * 0.46,
    y1: 140 + (drive.cy - 0.5) * h * 0.32,
    x2: w * 0.5 + 90 + drive.vx * w * 0.55,
    y2: 140 + drive.vy * h * 0.55 + (drive.cy - 0.5) * 80,
    angle: Math.atan2(drive.vy, drive.vx || 0.001),
    mutant: drive.energy > 0.24,
    sizeMul: 1 + drive.energy * 1.05,
    glowMul: 1 + drive.energy * 1.2,
  };
}

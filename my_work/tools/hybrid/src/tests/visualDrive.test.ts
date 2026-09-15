import { describe, expect, it } from "vitest";
import { SeededRandom } from "../utils/seededRandom";
import { scorePhonemes } from "../labs/hybrid/speech/score";
import { cardsToFrames, modulateTract, tapeRate } from "../labs/hybrid/speech/tract";
import { defaultMix } from "../labs/hybrid/mixRecipe";
import {
  createWander,
  lerpParams,
  motionSplatPlan,
  overlayDriveParams,
  stepWander,
  visualDriveOf,
  warpGrow,
} from "../labs/hybrid/visualDrive";
import { IDLE_MOTION } from "../labs/hybrid/speech/motion";

describe("motion modulates pitch duration and tract", () => {
  const frame = cardsToFrames(scorePhonemes(["AH"], { sing: false, rate: 1, pitch: 120 }))[0]!;

  it("raises pitch when motion sits to the right", () => {
    const left = modulateTract(frame, { energy: 0.4, cx: 0.08, cy: 0.5, vx: 0, vy: 0, t: 0 });
    const right = modulateTract(frame, { energy: 0.4, cx: 0.92, cy: 0.5, vx: 0, vy: 0, t: 0 });
    expect(right.pitch).toBeGreaterThan(left.pitch);
  });

  it("opens F1 / tongue when motion is lower in the frame", () => {
    const high = modulateTract(frame, { energy: 0.35, cx: 0.5, cy: 0.12, vx: 0, vy: 0, t: 0 });
    const low = modulateTract(frame, { energy: 0.35, cx: 0.5, cy: 0.88, vx: 0, vy: 0, t: 0 });
    expect(low.f1).toBeGreaterThan(high.f1);
    expect(low.tongueOpen).toBeGreaterThan(high.tongueOpen);
  });

  it("fronts F2 when motion is to the right", () => {
    const back = modulateTract(frame, { energy: 0.3, cx: 0.1, cy: 0.5, vx: 0, vy: 0, t: 0 });
    const front = modulateTract(frame, { energy: 0.3, cx: 0.9, cy: 0.5, vx: 0, vy: 0, t: 0 });
    expect(front.f2).toBeGreaterThan(back.f2);
    expect(front.tongueFront).toBeGreaterThan(back.tongueFront);
  });

  it("shortens duration via faster tape rate as energy rises", () => {
    const slow = tapeRate({ energy: 0.05, cx: 0.5, cy: 0.5, vx: 0, vy: 0 });
    const fast = tapeRate({ energy: 0.9, cx: 0.5, cy: 0.5, vx: 0.1, vy: 0 });
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThan(1.2);
  });

  it("leaves the scored frame nearly intact when the camera is idle", () => {
    const idle = modulateTract(frame, { ...IDLE_MOTION, t: 0 });
    expect(idle.pitch).toBeCloseTo(frame.pitch, 5);
    expect(idle.f1).toBeCloseTo(frame.f1, 5);
    expect(idle.durScale).toBe(1);
    expect(tapeRate(IDLE_MOTION)).toBe(1);
  });

  it("energy lifts buzz, hiss and loudness", () => {
    const quiet = modulateTract(frame, { energy: 0.08, cx: 0.5, cy: 0.5, vx: 0, vy: 0, t: 0 });
    const loud = modulateTract(frame, { energy: 0.9, cx: 0.5, cy: 0.5, vx: 0.05, vy: 0, t: 0 });
    expect(loud.loud).toBeGreaterThan(quiet.loud);
    expect(loud.hiss + loud.buzz).toBeGreaterThan(quiet.hiss + quiet.buzz);
  });
});

describe("random visual wander", () => {
  it("lerps numeric mix params toward a target", () => {
    const a = defaultMix().params;
    const b = { ...a, flockSpeed: 200, F: 0.06, auraGlow: 1.8 };
    const mid = lerpParams(a, b, 0.5);
    expect(mid.flockSpeed).toBeGreaterThan(a.flockSpeed);
    expect(mid.flockSpeed).toBeLessThan(b.flockSpeed);
    expect(mid.F).toBeGreaterThan(a.F);
  });

  it("keeps rewriting params across a hold window", () => {
    const start = defaultMix();
    const rng = new SeededRandom(42);
    let wander = createWander(start, rng);
    let mix = start;
    const speeds = new Set<number>();
    for (let i = 0; i < 80; i++) {
      const step = stepWander(wander, mix, 0.25, rng);
      wander = step.state;
      mix = step.mix;
      speeds.add(Number(mix.params.flockSpeed.toFixed(1)));
    }
    expect(speeds.size).toBeGreaterThan(8);
  });

  it("wander-only visual drive never sits still", () => {
    const a = visualDriveOf(false, IDLE_MOTION, true, 0.2);
    const b = visualDriveOf(false, IDLE_MOTION, true, 1.7);
    expect(a.energy).toBeGreaterThan(0.2);
    expect(Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy)).toBeGreaterThan(0.05);
  });

  it("camera drive still dominates when both wander and camera are on", () => {
    const cam = { energy: 0.8, cx: 0.1, cy: 0.2, vx: 0.04, vy: -0.03 };
    const mixed = visualDriveOf(true, cam, true, 0);
    expect(mixed.cx).toBeLessThan(0.4);
    expect(mixed.energy).toBeGreaterThan(0.7);
  });
});

describe("visual motion plans", () => {
  it("warps grow segments when the centroid moves", () => {
    const segs = [{ x1: 0, y1: -40, x2: 0, y2: -80, gen: 1, symbol: "F", parent: -1 }];
    const left = warpGrow(segs, { energy: 0.5, cx: 0.1, cy: 0.5, vx: 0, vy: 0 }, 0);
    const right = warpGrow(segs, { energy: 0.5, cx: 0.9, cy: 0.5, vx: 0, vy: 0 }, 0);
    expect(right[0]!.x2).toBeGreaterThan(left[0]!.x2);
  });

  it("emits several reaction-diffusion splats from one motion sample", () => {
    const plan = motionSplatPlan({ energy: 0.5, cx: 0.4, cy: 0.6, vx: 0.05, vy: -0.02 }, 160, 4);
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.some((p) => p.r > 2)).toBe(true);
  });

  it("overlays motion onto flock speed and Gray–Scott F/K", () => {
    const p = overlayDriveParams(
      {
        flockCount: 64,
        flockSpeed: 100,
        flockSep: 1.4,
        flockCoh: 0.9,
        growIters: 4,
        growAngle: 22,
        F: 0.037,
        K: 0.06,
      },
      { energy: 0.7, cx: 0.8, cy: 0.2, vx: 0.05, vy: 0 },
      0.4,
    );
    expect(p.flockSpeed).toBeGreaterThan(100);
    expect(p.F).toBeGreaterThan(0.037);
  });
});

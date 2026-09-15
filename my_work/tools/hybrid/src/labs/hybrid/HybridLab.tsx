import { useEffect, useMemo, useRef, useState } from "react";
import { PresetSelector, Toggle } from "../../components/ControlPanel/Controls";
import { ParameterSlider } from "../../components/ControlPanel/ParameterSlider";
import { ExportDialog } from "../../components/ExportDialog/ExportDialog";
import { LabLayout } from "../../components/LabLayout/LabLayout";
import { Transport } from "../../components/Timeline/Transport";
import { useAnimationFrame, useLatest } from "../../hooks/useAnimationFrame";
import { sizeCanvas, useCanvasResize } from "../../hooks/useCanvasResize";
import { useInfiniteView } from "../../hooks/useInfiniteView";
import { ViewPanel } from "../../components/ControlPanel/ViewPanel";
import { useAppStore } from "../../store/appStore";
import { loadLab, useLabPersist } from "../../store/labPersist";
import { C } from "../../utils/color";
import { SeededRandom } from "../../utils/seededRandom";
import { AURA, drawAuraFilament, drawPyrocystis, worldInView } from "../../render/pyrocystis";
import { auraLevel, setAuraEngine, setAuraTempo } from "../../utils/auraAudio";
import type { LabMode } from "../../types";
import { SpeechPanel, DEFAULT_SPEECH, type SpeechSettings } from "./SpeechPanel";
import { SpeechEngine, compileLyrics } from "./speech/engine";
import { IDLE_MOTION, MotionTracker } from "./speech/motion";
import { drawSpeechOverlay } from "./speech/overlay";
import { FlockWorld } from "../flock/boidsEngine";
import { FLOCK_DEFAULT } from "../flock/flockPresets";
import { RDEngine } from "../diff/reactionDiffusion";
import { stepLife, placePattern, GLIDER } from "../cell/gameOfLife";
import { expandLSystem } from "../grow/lsystemEngine";
import { turtleWalk, type TurtleSeg } from "../grow/turtleRenderer";
import { GROW_PRESETS } from "../grow/growPresets";
import { parseGeneCode, mapGeneToWorld, encodeGeneCode, type GeneCode } from "../gene/geneticsEngine";
import { GENE_PRESETS } from "../gene/genePresets";
import {
  LAYER_DEFS,
  COUPLE_DEFS,
  MIX_SHORTCUTS,
  MIX_WORLD_W,
  MIX_WORLD_H,
  MIX_CA_COLS,
  MIX_CA_ROWS,
  MIX_CA_CELL,
  MIX_RD_N,
  activeCouples,
  applyShortcut,
  allOnMix,
  coupleReady,
  defaultMix,
  drivenParams,
  injectDensity,
  mixExplain,
  mixLabel,
  normalizeMix,
  randomMix,
  toggleCouple,
  toggleLayer,
  visualCount,
  type MixState,
} from "./mixRecipe";
import {
  cellStepInterval,
  createWander,
  flockPointer,
  genePose,
  motionSplatPlan,
  overlayDriveParams,
  rdSteps,
  sparkCells,
  stampMotionCells,
  stepWander,
  visualDriveOf,
  warpGrow,
  type WanderState,
} from "./visualDrive";

type GrowCache = { key: string; segs: TurtleSeg[]; ox: number; oy: number };

function clampGrid(v: number, n: number) {
  return Math.max(0, Math.min(n - 1, v | 0));
}

function fallbackCode(seed: number): GeneCode {
  return {
    version: 1,
    seed,
    mutationRate: 0.08,
    inheritance: GENE_PRESETS[0]!.code.inheritance,
    parents: GENE_PRESETS[0]!.code.parents,
  };
}

function seedCA(grid: Uint8Array, next: Uint8Array, cols: number, rows: number, rng: SeededRandom) {
  grid.fill(0);
  next.fill(0);
  placePattern(grid, cols, rows, 14, 12, GLIDER);
  placePattern(grid, cols, rows, 68, 36, GLIDER);
  placePattern(grid, cols, rows, 96, 58, GLIDER);
  for (let i = 0; i < 160; i++) grid[rng.int(0, cols * rows - 1)] = 1;
}

function liveAt(grid: Uint8Array, cols: number, rows: number, wx: number, wy: number) {
  const mx = Math.floor(wx / MIX_CA_CELL);
  const my = Math.floor(wy / MIX_CA_CELL);
  if (mx < 0 || my < 0 || mx >= cols || my >= rows) return false;
  return grid[my * cols + mx] === 1;
}

export function HybridLab() {
  const lang = useAppStore((s) => s.lang);
  const seed = useAppStore((s) => s.seed);
  const running = useAppStore((s) => s.running);
  const setLog = useAppStore((s) => s.setLog);
  const setFps = useAppStore((s) => s.setFps);
  const [mode, setMode] = useState<LabMode>("experiment");
  const [step, setStep] = useState(0);
  const [mix, setMix] = useState<MixState>(() => normalizeMix(loadLab("hybrid", defaultMix())));
  const [bootKey, setBootKey] = useState(0);
  const [didRandom, setDidRandom] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [codeText, setCodeText] = useState(() => encodeGeneCode(fallbackCode(seed)));
  const [speech, setSpeech] = useState<SpeechSettings>(() => loadLab("hybridSpeech", DEFAULT_SPEECH));
  const [cameraOn, setCameraOn] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [tapeOn, setTapeOn] = useState(false);
  const [wanderOn, setWanderOn] = useState(() => Boolean(loadLab("hybridWander", { on: false }).on));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engine = useRef(new SpeechEngine());
  const tracker = useRef(new MotionTracker());
  const snapRef = useRef(engine.current.advance(0, IDLE_MOTION));
  const motionRef = useRef(IDLE_MOTION);
  const wanderRef = useRef<WanderState | null>(null);
  const liveMix = useRef(mix);
  const wanderRng = useRef(new SeededRandom((seed ^ 0x9e3779b9) >>> 0));
  const wanderT = useRef(0);
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const [snapUi, setSnapUi] = useState(() => snapRef.current);
  const [motionUi, setMotionUi] = useState(IDLE_MOTION);
  const flock = useRef(new FlockWorld(seed));
  const rd = useRef(new RDEngine(MIX_RD_N));
  const ca = useRef({
    grid: new Uint8Array(MIX_CA_COLS * MIX_CA_ROWS),
    next: new Uint8Array(MIX_CA_COLS * MIX_CA_ROWS),
    cols: MIX_CA_COLS,
    rows: MIX_CA_ROWS,
  });
  const growCache = useRef<GrowCache | null>(null);
  const caAcc = useRef(0);
  const frameN = useRef(0);
  const lastUi = useRef(0);
  const booted = useRef(false);
  const pendingStep = useRef(false);
  const size = useCanvasResize(canvasRef);
  const view = useInfiniteView(canvasRef, size.w);

  const mapped = useMemo(() => {
    const parsed = parseGeneCode(codeText) ?? fallbackCode(seed);
    return mapGeneToWorld({ ...parsed, seed, mutationRate: mix.params.mutation });
  }, [codeText, seed, mix.params.mutation]);

  const compiled = useMemo(
    () => compileLyrics(speech.text, { sing: speech.sing, rate: speech.rate, pitch: speech.pitch }),
    [speech],
  );

  const rec = useLatest({ mix, mapped, running, mode, cameraOn, compiled, wanderOn });

  const frameView = () => {
    const c = canvasRef.current;
    if (!c) return;
    const k = Math.min(c.width / MIX_WORLD_W, c.height / MIX_WORLD_H) * 1.08;
    view.lookAt(MIX_WORLD_W / 2, MIX_WORLD_H / 2, c.width, c.height, k);
  };

  const commitMix = (next: MixState) => {
    const n = normalizeMix(next);
    setMix(n);
    useLabPersist.getState().setLab("hybrid", n);
  };

  const reboot = () => setBootKey((k) => k + 1);

  useEffect(() => {
    useLabPersist.getState().setLab("hybridSpeech", speech);
  }, [speech]);

  useEffect(() => {
    useLabPersist.getState().setLab("hybridWander", { on: wanderOn });
    if (wanderOn) {
      liveMix.current = mixRef.current;
      wanderRef.current = createWander(mixRef.current, wanderRng.current);
    } else {
      if (wanderRef.current) {
        const n = normalizeMix(liveMix.current);
        setMix(n);
        useLabPersist.getState().setLab("hybrid", n);
      }
      wanderRef.current = null;
    }
  }, [wanderOn]);

  useEffect(() => {
    engine.current.load(compiled);
  }, [compiled]);

  useEffect(() => {
    tracker.current.attachPreview(videoRef.current);
    if (!cameraOn) {
      tracker.current.stop();
      setCamReady(false);
      setCamError(null);
      motionRef.current = IDLE_MOTION;
      return;
    }
    let live = true;
    void tracker.current.start().then((ok) => {
      if (!live) return;
      setCamReady(ok);
      setCamError(tracker.current.error);
    });
    return () => {
      live = false;
      tracker.current.stop();
    };
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      engine.current.stop();
      tracker.current.stop();
    };
  }, []);

  useEffect(() => {
    const m = rec.current.mix;
    flock.current = new FlockWorld(seed);
    flock.current.resize(MIX_WORLD_W, MIX_WORLD_H);
    flock.current.seed(m.params.flockCount);
    const g = ca.current;
    g.cols = MIX_CA_COLS;
    g.rows = MIX_CA_ROWS;
    g.grid = new Uint8Array(MIX_CA_COLS * MIX_CA_ROWS);
    g.next = new Uint8Array(MIX_CA_COLS * MIX_CA_ROWS);
    seedCA(g.grid, g.next, g.cols, g.rows, new SeededRandom(seed));
    const rdRng = new SeededRandom(seed ^ 17);
    rd.current.reset(() => rdRng.next());
    growCache.current = null;
    caAcc.current = 0;
    frameN.current = 0;
    booted.current = false;
  }, [seed, bootKey, rec]);

  useEffect(() => {
    const layers = visualCount(mix.layers) >= 3;
    const couple = activeCouples(mix).length >= 1;
    setDone((d) => {
      const next = { ...d };
      if (layers) next["hybrid-layers"] = true;
      if (couple) next["hybrid-couple"] = true;
      if (didRandom) next["hybrid-random"] = true;
      return next;
    });
  }, [mix, didRandom]);

  useAnimationFrame((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeCanvas(canvas);
    if (!booted.current && w > 180 && h > 180) {
      frameView();
      booted.current = true;
    }
    const {
      mix: mixState,
      mapped: geneMap,
      running: run,
      mode: labMode,
      cameraOn: camOn,
      compiled: lyric,
      wanderOn: drifting,
    } = rec.current;
    wanderT.current += dt;
    if (drifting) {
      if (!wanderRef.current) wanderRef.current = createWander(liveMix.current, wanderRng.current);
      const stepped = stepWander(wanderRef.current, liveMix.current, dt, wanderRng.current);
      wanderRef.current = stepped.state;
      liveMix.current = stepped.mix;
    } else {
      liveMix.current = mixState;
    }
    const m = liveMix.current;
    const baseDrive = drivenParams(m, geneMap);
    const tick = run || pendingStep.current;
    pendingStep.current = false;
    frameN.current += 1;
    const motion = camOn ? tracker.current.poll() : IDLE_MOTION;
    motionRef.current = motion;
    const vis = visualDriveOf(camOn, motion, drifting, wanderT.current);
    const audioDrive = camOn ? motion : IDLE_MOTION;
    const shot = engine.current.advance(dt, audioDrive);
    snapRef.current = shot;
    const drive = overlayDriveParams(baseDrive, vis, shot.frame?.loud ?? 0);
    const idle = 0.12 + 0.08 * Math.sin(performance.now() * 0.002);
    const pulse = Math.max(idle, auraLevel(), engine.current.level(), vis.energy * 0.95, (shot.frame?.loud ?? 0) * 0.6);

    if (tick && m.layers.flock) {
      flock.current.step(
        dt,
        {
          ...FLOCK_DEFAULT,
          count: drive.flockCount,
          maxSpeed: drive.flockSpeed,
          sep: drive.flockSep,
          coh: drive.flockCoh,
          ali: FLOCK_DEFAULT.ali * (1.18 - vis.energy * 0.6),
          vis: FLOCK_DEFAULT.vis * (1 + vis.energy * 0.4),
          protect: FLOCK_DEFAULT.protect * (1 + vis.energy * 0.45),
        },
        flockPointer(vis, MIX_WORLD_W, MIX_WORLD_H),
      );
      if (vis.energy > 0.04) {
        const wx = vis.cx * MIX_WORLD_W;
        const wy = vis.cy * MIX_WORLD_H;
        for (const b of flock.current.boids) {
          b.vx += vis.vx * MIX_WORLD_W * 0.2 * vis.energy;
          b.vy += vis.vy * MIX_WORLD_H * 0.2 * vis.energy;
          const dx = b.x - wx;
          const dy = b.y - wy;
          b.vx += -dy * 0.0012 * vis.energy;
          b.vy += dx * 0.0012 * vis.energy;
        }
      }
    }

    const g = ca.current;
    if (m.layers.cell) {
      if (tick) {
        caAcc.current += dt;
        if (caAcc.current > cellStepInterval(vis) || !run) {
          caAcc.current = 0;
          stepLife(g.grid, g.next, g.cols, g.rows, [3], [2, 3], true);
          const t = g.grid;
          g.grid = g.next;
          g.next = t;
        }
      }
      stampMotionCells(g.grid, g.cols, g.rows, vis, frameN.current);
      if (drifting && frameN.current % 12 === 0) sparkCells(g.grid, 10 + ((vis.energy * 18) | 0), frameN.current);
    }

    if (tick && m.layers.flock && m.layers.cell && m.couples.flockPaintCell) {
      for (const b of flock.current.boids) {
        const mx = Math.floor((((b.x % MIX_WORLD_W) + MIX_WORLD_W) % MIX_WORLD_W) / MIX_CA_CELL);
        const my = Math.floor((((b.y % MIX_WORLD_H) + MIX_WORLD_H) % MIX_WORLD_H) / MIX_CA_CELL);
        if (mx >= 0 && my >= 0 && mx < g.cols && my < g.rows && (frameN.current + mx + my) % 3 === 0) {
          g.grid[my * g.cols + mx] = 1;
        }
      }
    }

    if (tick && m.layers.diff) {
      rd.current.step(
        { Du: 0.16 + vis.energy * 0.05, Dv: Math.max(0.04, 0.08 - vis.energy * 0.028), F: drive.F, K: drive.K, dt: 1 },
        rdSteps(vis),
      );
    }

    let growSegs: TurtleSeg[] = [];
    const ox = MIX_WORLD_W * 0.5;
    const oy = MIX_WORLD_H * 0.82;
    if (m.layers.grow) {
      const preset = GROW_PRESETS.find((p) => p.id === m.params.growPreset) ?? GROW_PRESETS[0]!;
      const key = `${preset.id}|${drive.growIters}|${drive.growAngle.toFixed(0)}|${seed}|${bootKey}`;
      if (!growCache.current || growCache.current.key !== key) {
        const rng = new SeededRandom(seed ^ 91);
        const exp = expandLSystem(preset.axiom, preset.rules, drive.growIters, () => rng.next());
        const geo = turtleWalk(exp.str, {
          angle: drive.growAngle,
          step: 14,
          wind: 0,
          light: 0,
          obstacles: [],
          jitter: 0,
          rnd: () => 0.5,
        });
        growCache.current = { key, segs: geo.segs, ox, oy };
      }
      growSegs = warpGrow(
        growCache.current.segs,
        vis,
        wanderT.current,
        drifting ? Math.sin(wanderT.current * 0.88) * 26 : 0,
      );
      if (m.layers.cell && m.couples.cellsMaskGrow) {
        growSegs = growSegs.filter((s) => liveAt(g.grid, g.cols, g.rows, s.x2 + ox, s.y2 + oy));
      }
    }

    if (tick && m.layers.diff && m.layers.flock && m.couples.trailsToDiff && frameN.current % Math.max(6, 28 - ((vis.energy * 20) | 0)) === 0) {
      const dens = flock.current.trailDensity(96, 64);
      injectDensity(rd.current.U, rd.current.V, rd.current.n, dens, 96, 64, 0.18 + vis.energy * 0.28);
    }

    if (tick && m.layers.diff && m.layers.cell && m.couples.cellsSeedDiff && frameN.current % Math.max(6, 18 - ((vis.energy * 12) | 0)) === 0) {
      const n = rd.current.n;
      for (let k = 0; k < 28; k++) {
        const i = (frameN.current * 17 + k * 97) % g.grid.length;
        if (!g.grid[i]) continue;
        const x = i % g.cols;
        const y = Math.floor(i / g.cols);
        rd.current.splat(clampGrid((x / g.cols) * n, n), clampGrid((y / g.rows) * n, n), 2, false);
      }
    }

    if (tick && m.layers.diff && m.layers.grow && m.couples.tipsFeedDiff && frameN.current % Math.max(4, 10 - ((vis.energy * 6) | 0)) === 0) {
      const n = rd.current.n;
      const tips = growSegs.slice(-14);
      for (const s of tips) {
        const nx = clampGrid(((s.x2 + ox) / MIX_WORLD_W) * n, n);
        const ny = clampGrid(((s.y2 + oy) / MIX_WORLD_H) * n, n);
        rd.current.splat(nx, ny, 3, false);
      }
    }

    if (m.layers.diff && vis.energy > 0.03) {
      const n = rd.current.n;
      for (const s of motionSplatPlan(vis, n, frameN.current)) {
        rd.current.splat(clampGrid(s.x, n), clampGrid(s.y, n), s.r, s.erase);
      }
    }
    if (drifting && m.layers.diff && frameN.current % 15 === 0) {
      const n = rd.current.n;
      const rx = ((frameN.current * 47) % n) + vis.cx * 8;
      const ry = ((frameN.current * 29) % n) + vis.cy * 8;
      rd.current.splat(clampGrid(rx, n), clampGrid(ry, n), 1.6 + vis.energy * 4, false);
    }

    if (tick && m.layers.diff && shot.playing && shot.frame && shot.frame.loud > 0.55 && frameN.current % 22 === 0) {
      const n = rd.current.n;
      const nx = clampGrid((shot.frame.f2 / 3000) * n, n);
      const ny = clampGrid((1 - shot.frame.f1 / 900) * n, n);
      rd.current.splat(nx, ny, 1.2, false);
    }

    if (tick && m.layers.flock && m.layers.diff && m.couples.diffSteerFlock) {
      const n = rd.current.n;
      for (const b of flock.current.boids) {
        const nx = clampGrid((b.x / MIX_WORLD_W) * n, n);
        const ny = clampGrid((b.y / MIX_WORLD_H) * n, n);
        const s = rd.current.sampleCPU(nx, ny);
        b.vx += s.gx * (420 + vis.energy * 520);
        b.vy += s.gy * (420 + vis.energy * 520);
      }
    }

    if (tick && m.layers.flock && m.layers.grow && m.couples.tipsPullFlock && growSegs.length) {
      const tips = growSegs.slice(-18);
      for (const b of flock.current.boids) {
        let fx = 0;
        let fy = 0;
        for (const s of tips) {
          const dx = s.x2 + ox - b.x;
          const dy = s.y2 + oy - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 220 * 220 || d2 < 16) continue;
          const d = Math.sqrt(d2);
          fx += (dx / d) * (70 + vis.energy * 90);
          fy += (dy / d) * (70 + vis.energy * 90);
        }
        b.vx += fx * dt;
        b.vy += fy * dt;
      }
    }

    ctx.fillStyle = AURA.ocean;
    ctx.fillRect(0, 0, w, h);
    view.apply(ctx);
    const cam = view.cam.current;
    const k = cam.k;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.16)";
    ctx.lineWidth = 1 / k;
    ctx.strokeRect(0, 0, MIX_WORLD_W, MIX_WORLD_H);

    if (m.layers.diff) {
      const sprite = rd.current.fieldSprite("combo");
      if (sprite) {
        ctx.imageSmoothingEnabled = true;
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.52 + vis.energy * 0.48 + 0.12 * Math.sin(wanderT.current * 1.4);
        ctx.drawImage(sprite, 0, 0, MIX_WORLD_W, MIX_WORLD_H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    if (m.layers.cell) {
      ctx.fillStyle = `rgba(0, 240, 255, ${0.14 + vis.energy * 0.38 + (shot.frame?.loud ?? 0) * 0.12})`;
      for (let y = 0; y < g.rows; y++) {
        for (let x = 0; x < g.cols; x++) {
          if (!g.grid[y * g.cols + x]) continue;
          const wx = x * MIX_CA_CELL;
          const wy = y * MIX_CA_CELL;
          if (!worldInView(wx, wy, cam, w, h, MIX_CA_CELL)) continue;
          ctx.fillRect(wx, wy, MIX_CA_CELL - 1, MIX_CA_CELL - 1);
        }
      }
    }

    if (m.layers.grow) {
      const stride = k < 0.22 ? 3 : k < 0.45 ? 2 : 1;
      ctx.lineWidth = 1.15;
      for (let i = 0; i < growSegs.length; i += stride) {
        const s = growSegs[i]!;
        const x1 = s.x1 + ox;
        const y1 = s.y1 + oy;
        const x2 = s.x2 + ox;
        const y2 = s.y2 + oy;
        if (!worldInView((x1 + x2) * 0.5, (y1 + y2) * 0.5, cam, w, h, 40)) continue;
        drawAuraFilament(ctx, x1, y1, x2, y2, pulse, i > growSegs.length - 24);
      }
    }

    if (m.layers.flock) {
      const list = flock.current.boids;
      const sz = m.params.auraSize * (1 + vis.energy * 0.85 + (shot.frame?.loud ?? 0) * 0.28);
      const glow = m.params.auraGlow * (1 + vis.energy * 0.95 + (shot.playing ? 0.18 : 0));
      const detail = sz >= 18 || (k > 0.9 && list.length < 90) ? "body" : "spark";
      for (let i = 0; i < list.length; i++) {
        const b = list[i]!;
        if (!worldInView(b.x, b.y, cam, w, h, Math.max(40, sz * 2.5))) continue;
        drawPyrocystis(ctx, b.x, b.y, sz, Math.atan2(b.vy, b.vx) + Math.PI / 2, pulse, {
          core: i % 7 === 0,
          detail,
          gain: glow,
        });
      }
    }

    if (shot.playing && shot.frame) {
      const f = shot.frame;
      const follow = vis.energy > 0.035;
      const sx = follow ? vis.cx * MIX_WORLD_W : MIX_WORLD_W * 0.5;
      const sy = follow ? vis.cy * MIX_WORLD_H : MIX_WORLD_H * 0.36;
      const singer = m.params.auraSize * (1.7 + f.tongueOpen * 1.55 + vis.energy * 0.9);
      drawPyrocystis(ctx, sx, sy, singer, (f.tongueFront - 0.5) * 0.9 + vis.vx * 2.5, pulse, {
        core: true,
        highlight: true,
        detail: k > 0.35 ? "full" : "body",
        gain: m.params.auraGlow * (0.7 + f.loud * 1.15 + vis.energy * 0.55),
        mutant: vis.energy > 0.55,
      });
    }

    if (m.layers.gene) {
      const pose = genePose(vis, MIX_WORLD_W, MIX_WORLD_H);
      const sz = m.params.auraSize * 1.55 * pose.sizeMul;
      const glow = m.params.auraGlow * pose.glowMul;
      const mutant = m.params.mutation > 0.18 || pose.mutant;
      drawPyrocystis(ctx, pose.x1, pose.y1, sz, pose.angle - Math.PI / 2, pulse, { core: true, detail: "body", gain: glow });
      drawPyrocystis(ctx, pose.x2, pose.y2, sz * (1 + m.params.mutation), pose.angle - Math.PI / 2, pulse, {
        core: true,
        highlight: true,
        detail: "body",
        mutant,
        gain: glow,
      });
    }

    view.identity(ctx);
    ctx.fillStyle = C.paper;
    ctx.font = "12px IBM Plex Mono";
    ctx.fillText((drifting ? "WANDER · " : "") + mixLabel(m), 12, 22);
    const couples = activeCouples(m);
    ctx.fillStyle = C.ash;
    ctx.font = "11px IBM Plex Mono";
    ctx.fillText(couples.length ? couples.map((c) => c.zh).join(" · ") : "NO COUPLE — overlay only", 12, 42);
    if (labMode === "analyze") {
      ctx.fillText(`F ${drive.F.toFixed(3)}  K ${drive.K.toFixed(3)}  speed ${drive.flockSpeed.toFixed(0)}  angle ${drive.growAngle.toFixed(1)}`, 12, 62);
    }
    drawSpeechOverlay(ctx, w, h, lyric, shot, engine.current.waveform(), vis);
    if (performance.now() - lastUi.current > 400) {
      lastUi.current = performance.now();
      setFps(60);
      const ph = shot.ph === "SIL" ? "" : ` // ${shot.ph}`;
      const tag = drifting ? "WANDER" : mixLabel(m);
      setLog(`HYBRID // ${tag} // ${lyric.kelly || "NO LYRIC"}${ph}`);
      setAuraTempo(112 + audioDrive.energy * 95 + (shot.playing ? shot.rate * 24 : 0));
      setSnapUi(shot);
      setMotionUi(vis);
      if (drifting) {
        const n = normalizeMix(liveMix.current);
        setMix(n);
        useLabPersist.getState().setLab("hybrid", n);
        setDidRandom(true);
        setDone((d) => (d["hybrid-wander"] ? d : { ...d, "hybrid-wander": true }));
      }
      if (camOn && motion.energy > 0.08) {
        setDone((d) => (d["hybrid-camera"] ? d : { ...d, "hybrid-camera": true }));
      }
    }
  }, true);

  const readyCouples = COUPLE_DEFS.filter((c) => coupleReady(mix.layers, c));
  const explain = wanderOn ? `随机视觉正在持续改写层与参数。${mixExplain(mix)}` : mixExplain(mix);

  return (
    <LabLayout
      id="hybrid"
      lang={lang}
      mode={mode}
      onMode={setMode}
      explain={explain}
      step={step}
      onStep={setStep}
      done={done}
      summary={mixLabel(mix)}
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="跨算法混成观测窗"
          onPointerDown={(e) => {
            if (view.beginPan(e)) return;
            if (!mix.layers.diff) return;
            const pt = view.worldFromEvent(e);
            const nx = clampGrid((pt.x / MIX_WORLD_W) * rd.current.n, rd.current.n);
            const ny = clampGrid((pt.y / MIX_WORLD_H) * rd.current.n, rd.current.n);
            rd.current.splat(nx, ny, 6, e.shiftKey);
          }}
          onPointerMove={(e) => view.movePan(e)}
          onPointerUp={view.endPan}
          onPointerCancel={view.endPan}
        />
      }
      inspector={
        <>
          <SpeechPanel
            settings={speech}
            onSettings={setSpeech}
            compiled={compiled}
            snap={snapUi}
            playing={tapeOn}
            onPlay={() => {
              engine.current.load(compiled);
              engine.current.unlock();
              useAppStore.getState().setSound(true);
              void setAuraEngine(true);
              setTapeOn(true);
              void engine.current.start().then(() => {
                setDone((d) => ({ ...d, "hybrid-lyric": true }));
              });
            }}
            onStop={() => {
              engine.current.stop();
              setTapeOn(false);
            }}
            cameraOn={cameraOn}
            onCamera={setCameraOn}
            camReady={camReady}
            camError={camError}
            motion={motionUi}
            videoRef={videoRef}
          />
          <h3>算法层</h3>
          <p className="muted">五套算法可单独开关，也可随机拼出未曾设计过的叠加。随机视觉会持续改写层、参数与耦合。</p>
          <div className="layer-grid">
            {LAYER_DEFS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={mix.layers[l.id] ? "active" : ""}
                onClick={() => commitMix(toggleLayer(mix, l.id, !mix.layers[l.id]))}
              >
                {l.code} {l.zh}
              </button>
            ))}
          </div>
          <div className="seg">
            <button
              type="button"
              className={wanderOn ? "active" : ""}
              onClick={() => setWanderOn((on) => !on)}
            >
              {wanderOn ? "随机视觉 ON" : "随机视觉"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = randomMix();
                commitMix(next);
                liveMix.current = next;
                if (wanderOn) wanderRef.current = createWander(next, wanderRng.current);
                setDidRandom(true);
                reboot();
              }}
            >
              RANDOM MIX
            </button>
            <button
              type="button"
              onClick={() => {
                commitMix(allOnMix(mix));
                reboot();
              }}
            >
              ALL
            </button>
          </div>
          <h3>配方捷径</h3>
          <div className="seg">
            {MIX_SHORTCUTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  commitMix(applyShortcut(s.id, mix));
                  reboot();
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="muted">捷径只是起点，仍可继续开关层与耦合。</p>
          <h3>耦合</h3>
          {readyCouples.length === 0 ? (
            <p className="muted">开启至少两个可配对的算法，才会出现跨尺度耦合。</p>
          ) : (
            readyCouples.map((c) => (
              <div key={c.id}>
                <Toggle label={c.zh} on={mix.couples[c.id]} onChange={(on) => commitMix(toggleCouple(mix, c.id, on))} />
                <p className="hint">{c.hint}</p>
              </div>
            ))
          )}
          {mix.layers.flock && (
            <>
              <h3>FLOCK</h3>
              <ParameterSlider
                label="个体数"
                value={mix.params.flockCount}
                min={24}
                max={120}
                step={1}
                recMin={40}
                recMax={90}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, flockCount: v } })}
              />
              <ParameterSlider
                label="最大速度"
                value={mix.params.flockSpeed}
                min={40}
                max={220}
                step={1}
                recMin={80}
                recMax={180}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, flockSpeed: v } })}
              />
            </>
          )}
          {(mix.layers.flock || mix.layers.gene) && (
            <>
              <h3>梭梨甲藻</h3>
              <ParameterSlider
                label="大小"
                value={mix.params.auraSize}
                min={6}
                max={48}
                step={1}
                recMin={10}
                recMax={28}
                hint="个体梭形尺寸"
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, auraSize: v } })}
              />
              <ParameterSlider
                label="发光"
                value={mix.params.auraGlow}
                min={0}
                max={2}
                step={0.05}
                recMin={0.6}
                recMax={1.4}
                hint="0 熄灭，1 默认，>1 外晕加强"
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, auraGlow: v } })}
              />
            </>
          )}
          {mix.layers.grow && (
            <>
              <h3>GROW</h3>
              <PresetSelector
                value={mix.params.growPreset}
                options={GROW_PRESETS.map((p) => ({ id: p.id, label: p.zh }))}
                onChange={(id) => commitMix({ ...mix, params: { ...mix.params, growPreset: id } })}
              />
              <ParameterSlider
                label="迭代"
                value={mix.params.growIters}
                min={2}
                max={6}
                step={1}
                recMin={3}
                recMax={5}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, growIters: v } })}
              />
              <ParameterSlider
                label="转角"
                value={mix.params.growAngle}
                min={8}
                max={42}
                step={0.5}
                recMin={16}
                recMax={32}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, growAngle: v } })}
              />
            </>
          )}
          {mix.layers.diff && (
            <>
              <h3>DIFF</h3>
              <ParameterSlider
                label="进料 F"
                value={mix.params.F}
                min={0.02}
                max={0.08}
                step={0.001}
                recMin={0.03}
                recMax={0.05}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, F: v } })}
              />
              <ParameterSlider
                label="消除 K"
                value={mix.params.K}
                min={0.04}
                max={0.07}
                step={0.001}
                recMin={0.05}
                recMax={0.065}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, K: v } })}
              />
              <p className="muted">在化学层上单击注料，Shift 单击擦除。</p>
            </>
          )}
          {mix.layers.gene && (
            <>
              <h3>GENE</h3>
              <ParameterSlider
                label="突变率"
                value={mix.params.mutation}
                min={0}
                max={0.4}
                step={0.01}
                recMin={0.02}
                recMax={0.2}
                onChange={(v) => commitMix({ ...mix, params: { ...mix.params, mutation: v } })}
              />
              <label className="param">
                GEN-CODE
                <textarea rows={4} value={codeText} onChange={(e) => setCodeText(e.target.value)} />
              </label>
            </>
          )}
          <ViewPanel zoom={view.zoom} onReset={frameView} />
          <ExportDialog
            module="hybrid"
            canvasRef={canvasRef}
            params={{ mix, seed, mapped, speech, note: mixLabel(mix) }}
          />
        </>
      }
      timeline={
        <>
          <Transport
            onReset={reboot}
            onStep={() => {
              pendingStep.current = true;
            }}
          />
          <p>
            {LAYER_DEFS.map((l, i) => (
              <span key={l.id} className={mix.layers[l.id] ? "lime" : "muted"}>
                {i ? " · " : ""}
                {l.code.split(".")[0]}
              </span>
            ))}
          </p>
        </>
      }
    />
  );
}

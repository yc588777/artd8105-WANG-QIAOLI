import { GROW_PRESETS } from "../grow/growPresets";
import { SeededRandom } from "../../utils/seededRandom";

export const MIX_WORLD_W = 2400;
export const MIX_WORLD_H = 1600;
export const MIX_CA_COLS = 120;
export const MIX_CA_ROWS = 80;
export const MIX_CA_CELL = 20;
export const MIX_RD_N = 160;

export type LayerId = "gene" | "flock" | "cell" | "grow" | "diff";
export type CoupleId =
  | "geneDrive"
  | "trailsToDiff"
  | "cellsMaskGrow"
  | "diffSteerFlock"
  | "tipsFeedDiff"
  | "flockPaintCell"
  | "cellsSeedDiff"
  | "tipsPullFlock";
export type MixShortcutId = "A" | "B" | "C";

export type MixLayers = Record<LayerId, boolean>;
export type MixCouples = Record<CoupleId, boolean>;

export type MixParams = {
  flockCount: number;
  flockSpeed: number;
  growIters: number;
  growAngle: number;
  growPreset: string;
  F: number;
  K: number;
  mutation: number;
  auraSize: number;
  auraGlow: number;
};

export type MixState = {
  layers: MixLayers;
  couples: MixCouples;
  params: MixParams;
};

export const VISUAL_LAYERS: LayerId[] = ["flock", "cell", "grow", "diff"];

export const LAYER_DEFS: { id: LayerId; code: string; zh: string }[] = [
  { id: "gene", code: "GENE.01", zh: "遗传" },
  { id: "flock", code: "FLOCK.02", zh: "蜂群" },
  { id: "cell", code: "CELL.03", zh: "细胞" },
  { id: "grow", code: "GROW.04", zh: "生长" },
  { id: "diff", code: "DIFF.05", zh: "化学" },
];

export const COUPLE_DEFS: { id: CoupleId; need: LayerId[]; zh: string; hint: string }[] = [
  { id: "geneDrive", need: ["gene"], zh: "基因驱动参数", hint: "等位基因改写速度、转角与进料" },
  { id: "trailsToDiff", need: ["flock", "diff"], zh: "轨迹→化学种子", hint: "蜂群尾迹持续注入物质 B" },
  { id: "diffSteerFlock", need: ["diff", "flock"], zh: "化学场→蜂群转向", hint: "浓度梯度推动个体" },
  { id: "cellsMaskGrow", need: ["cell", "grow"], zh: "活细胞→生长界", hint: "L-system 只在活细胞上分枝" },
  { id: "tipsFeedDiff", need: ["grow", "diff"], zh: "枝尖→注料", hint: "龟图端点向反应扩散泼溅" },
  { id: "flockPaintCell", need: ["flock", "cell"], zh: "蜂群→点亮细胞", hint: "个体所在格子变为活细胞" },
  { id: "cellsSeedDiff", need: ["cell", "diff"], zh: "活细胞→化学斑", hint: "活格子向反应扩散注入物质 B" },
  { id: "tipsPullFlock", need: ["grow", "flock"], zh: "枝尖→蜂群吸引", hint: "龟图端点成为临时吸引子" },
];

export const MIX_SHORTCUTS: { id: MixShortcutId; label: string; note: string }[] = [
  { id: "A", label: "A 轨迹成纹", note: "蜂群尾迹持续注入反应扩散，化学场再把个体推离高浓度。" },
  { id: "B", label: "B 细胞生态", note: "活细胞划定生长界，枝尖又把物质送回化学场。" },
  { id: "C", label: "C 基因全尺度", note: "五层同开，GEN-CODE 驱动参数，所有可用耦合同时接通。" },
];

export function emptyLayers(): MixLayers {
  return { gene: false, flock: false, cell: false, grow: false, diff: false };
}

export function emptyCouples(): MixCouples {
  return {
    geneDrive: false,
    trailsToDiff: false,
    cellsMaskGrow: false,
    diffSteerFlock: false,
    tipsFeedDiff: false,
    flockPaintCell: false,
    cellsSeedDiff: false,
    tipsPullFlock: false,
  };
}

export function defaultParams(): MixParams {
  return {
    flockCount: 64,
    flockSpeed: 130,
    growIters: 4,
    growAngle: 22,
    growPreset: "tree",
    F: 0.037,
    K: 0.06,
    mutation: 0.08,
    auraSize: 16,
    auraGlow: 1,
  };
}

export function defaultMix(): MixState {
  return {
    layers: { gene: false, flock: true, cell: false, grow: true, diff: true },
    couples: { ...emptyCouples(), trailsToDiff: true, tipsFeedDiff: true },
    params: defaultParams(),
  };
}

export function visualCount(layers: MixLayers) {
  return VISUAL_LAYERS.reduce((n, id) => n + (layers[id] ? 1 : 0), 0);
}

export function coupleReady(layers: MixLayers, def: { id?: CoupleId; need: LayerId[] }) {
  if (!def.need.every((id) => layers[id])) return false;
  if (def.id === "geneDrive") return visualCount(layers) > 0;
  return true;
}

export function pruneCouples(layers: MixLayers, couples: MixCouples): MixCouples {
  const next = { ...couples };
  for (const def of COUPLE_DEFS) {
    if (!coupleReady(layers, def)) next[def.id] = false;
  }
  return next;
}

export function normalizeMix(raw: {
  layers?: Partial<MixLayers>;
  couples?: Partial<MixCouples>;
  params?: Partial<MixParams>;
} | null | undefined): MixState {
  const base = defaultMix();
  const layers = { ...emptyLayers(), ...base.layers, ...raw?.layers };
  const couples = { ...emptyCouples(), ...raw?.couples };
  const params = { ...defaultParams(), ...raw?.params };
  if (visualCount(layers) < 1) layers.flock = true;
  return { layers, couples: pruneCouples(layers, couples), params };
}

export function toggleLayer(mix: MixState, id: LayerId, on: boolean): MixState {
  const layers = { ...mix.layers, [id]: on };
  if (visualCount(layers) < 1) return mix;
  return { ...mix, layers, couples: pruneCouples(layers, mix.couples) };
}

export function toggleCouple(mix: MixState, id: CoupleId, on: boolean): MixState {
  const def = COUPLE_DEFS.find((c) => c.id === id);
  if (!def || (on && !coupleReady(mix.layers, def))) return mix;
  return { ...mix, couples: { ...mix.couples, [id]: on } };
}

export function allOnMix(prev: MixState): MixState {
  const layers: MixLayers = { gene: true, flock: true, cell: true, grow: true, diff: true };
  const couples = emptyCouples();
  for (const def of COUPLE_DEFS) couples[def.id] = true;
  return { ...prev, layers, couples };
}

export function applyShortcut(id: MixShortcutId, prev: MixState): MixState {
  if (id === "A") {
    const layers: MixLayers = { gene: false, flock: true, cell: false, grow: false, diff: true };
    return {
      ...prev,
      layers,
      couples: pruneCouples(layers, { ...emptyCouples(), trailsToDiff: true, diffSteerFlock: true }),
    };
  }
  if (id === "B") {
    const layers: MixLayers = { gene: false, flock: false, cell: true, grow: true, diff: true };
    return {
      ...prev,
      layers,
      couples: pruneCouples(layers, { ...emptyCouples(), cellsMaskGrow: true, tipsFeedDiff: true, cellsSeedDiff: true }),
    };
  }
  return allOnMix(prev);
}

function shuffleInPlace<T>(rng: SeededRandom, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function randomMix(rng?: SeededRandom): MixState {
  const r = rng ?? new SeededRandom((Math.random() * 2 ** 32) >>> 0);
  const visuals = shuffleInPlace(r, [...VISUAL_LAYERS]);
  const n = r.int(2, 4);
  const layers = emptyLayers();
  for (let i = 0; i < n; i++) layers[visuals[i]!] = true;
  layers.gene = r.next() > 0.42;
  const couples = emptyCouples();
  const ready = COUPLE_DEFS.filter((c) => coupleReady(layers, c));
  for (const c of ready) {
    if (r.next() > 0.34) couples[c.id] = true;
  }
  if (ready.length && !ready.some((c) => couples[c.id])) {
    couples[r.pick(ready).id] = true;
  }
  const growPool = GROW_PRESETS.filter((p) => p.id !== "param");
  const gp = r.pick(growPool.length ? growPool : GROW_PRESETS);
  return {
    layers,
    couples,
    params: {
      flockCount: r.int(36, 96),
      flockSpeed: r.range(70, 200),
      growIters: r.int(3, 5),
      growAngle: r.range(14, 36),
      growPreset: gp.id,
      F: r.range(0.022, 0.062),
      K: r.range(0.045, 0.066),
      mutation: r.range(0.02, 0.28),
      auraSize: r.range(10, 30),
      auraGlow: r.range(0.45, 1.7),
    },
  };
}

export type MappedGene = {
  maxSpeed: number;
  caRule: number;
  angle: number;
  feed: number;
  kill: number;
  sep: number;
  cohesion: number;
};

export type DrivenParams = {
  flockCount: number;
  flockSpeed: number;
  flockSep: number;
  flockCoh: number;
  growIters: number;
  growAngle: number;
  F: number;
  K: number;
};

export function drivenParams(mix: MixState, mapped: MappedGene): DrivenParams {
  const drive = mix.layers.gene && mix.couples.geneDrive;
  const p = mix.params;
  return {
    flockCount: p.flockCount,
    flockSpeed: drive ? p.flockSpeed * 0.4 + mapped.maxSpeed * 0.6 : p.flockSpeed,
    flockSep: drive ? mapped.sep : 1.4,
    flockCoh: drive ? mapped.cohesion : 0.9,
    growIters: p.growIters,
    growAngle: drive ? p.growAngle * 0.35 + mapped.angle * 0.65 : p.growAngle,
    F: drive ? p.F * 0.45 + mapped.feed * 0.55 : p.F,
    K: drive ? p.K * 0.45 + mapped.kill * 0.55 : p.K,
  };
}

export function activeCouples(mix: MixState) {
  return COUPLE_DEFS.filter((c) => mix.couples[c.id] && coupleReady(mix.layers, c));
}

export function mixLabel(mix: MixState) {
  const on = LAYER_DEFS.filter((l) => mix.layers[l.id]).map((l) => l.code.split(".")[0]);
  const n = activeCouples(mix).length;
  return `${on.join("+") || "EMPTY"} · ${n} COUPLE`;
}

export function mixExplain(mix: MixState) {
  const parts = activeCouples(mix).map((c) => c.zh);
  if (!parts.length) return "点选算法层，或按 RANDOM MIX 让五种算法自行组合。至少保留一层可见形态。";
  return `当前耦合：${parts.join("；")}。关闭任一层会断开对应耦合。`;
}

export function injectDensity(
  U: Float32Array,
  V: Float32Array,
  n: number,
  grid: Float32Array,
  gw: number,
  gh: number,
  gain: number,
) {
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const gx = Math.floor((x / n) * gw);
      const gy = Math.floor((y / n) * gh);
      const d = grid[gy * gw + gx] ?? 0;
      if (d < 0.1) continue;
      const i = y * n + x;
      V[i] = Math.min(1, (V[i] ?? 0) + d * gain);
      U[i] = Math.max(0, (U[i] ?? 0) - d * gain * 0.35);
    }
  }
}

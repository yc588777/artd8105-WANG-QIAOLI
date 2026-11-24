export type WeaveParams = {
  pattern: string;
  t_min: number;
  t_max: number;
  allow_extra_thickness: boolean;
  rim_width: number;
  rim_depth?: number;
  ribbon_thickness?: number;
  contrast: number;
  dark_levels: number;
  smoothness: number;
  invert: boolean;
  density_u: number;
  density_v: number;
  strand_width_u: number;
  strand_width_v: number;
  relief: number;
  cell_aspect: number;
  stagger: number;
  weave_angle: number;
  frequency: number;
  amplitude: number;
  randomness: number;
  seed: number;
  blend_radius: number;
  target_height: number;
  frame_mm: number;
  geometry_lock: boolean;
  print_safe: boolean;
  show_master: boolean;
  diff_only: boolean;
  preset: string;
  layers: WeaveLayer[];
  crossing_locks: CrossingLock[];
  zones: Record<string, ZoneOverride>;
  polygons: PolygonRegion[];
  brush: number[] | null;
  support_level?: "off" | "light" | "even" | "firm";
  support_density?: number;
  support_motif?: "bar-h" | "bar-v" | "circle" | "dot" | "triangle" | "star";
  support_motifs?: Array<"bar-h" | "bar-v" | "circle" | "dot" | "triangle" | "star">;
  support_size?: number;
};

export type WeaveLayer = {
  id: string;
  name: string;
  enabled: boolean;
  visible: boolean;
  locked: boolean;
  solo: boolean;
  algorithm: string;
  seed: number;
  density: number;
  strip_width: number;
  base_z?: number;
  wave_amplitude?: number;
  crossing_lift?: number;
  priority?: number;
  tone?: string;
  rotation?: number;
  offset_x?: number;
  offset_y?: number;
  amplitude?: number;
  frequency?: number;
  pattern_angle?: number;
  spoke_count?: number;
  ring_count?: number;
  cell_aspect?: number;
  randomness?: number;
  accent_every?: number;
  bundle_count?: number;
  edge_compression?: number;
  radial_part?: string;
  ripple_part?: string;
  diamond_part?: string;
  include_basket?: boolean;
  modulate?: boolean;
  rotation_strength?: number;
  wave_phase?: number;
  center_spacing?: number;
  direction_a?: number;
  direction_b?: number;
  arc_a?: number;
  arc_b?: number;
  edge_spacing?: number;
  secondary_strength?: number;
  structural_strength?: number;
  binder_density?: number;
};

export type CrossingLock = { x: number; y: number; over: string };

export type LayerPreset = { id: string; name: string; pattern: string; seed: number; layers: WeaveLayer[] };

export type ZoneOverride = {
  enabled: boolean;
  density_u?: number | null;
  density_v?: number | null;
  strand_width_u?: number | null;
  strand_width_v?: number | null;
  relief?: number | null;
  stagger?: number | null;
  weave_angle?: number | null;
};

export type PolygonRegion = {
  points: number[][];
  density_u?: number | null;
  density_v?: number | null;
  strand_width_u?: number | null;
  relief?: number | null;
};

export type MeshPayload = {
  positions: Float32Array;
  indices: Uint32Array;
  colors: Float32Array | null;
  report: Record<string, unknown>;
};

export async function getBaseline() {
  const res = await fetch("/api/project/baseline");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchPlan(params: WeaveParams) {
  const res = await fetch("/api/weave/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, quality: "draft" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return URL.createObjectURL(await res.blob());
}

export async function fetchPreview(params: WeaveParams, quality: string): Promise<MeshPayload> {
  const res = await fetch("/api/weave/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, quality }),
  });
  if (!res.ok) throw new Error(await res.text());
  const buf = await res.arrayBuffer();
  const worker = new Worker(new URL("./meshWorker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<MeshPayload>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(event.error || new Error("mesh worker failed"));
    };
    worker.postMessage(buf, [buf]);
  });
}

export type Issue = { code: string; count: number };

export class ExportBlocked extends Error {
  constructor(public issues: Issue[], public quality: string, public reason: string) {
    super(reason || "export blocked");
  }
}

export async function generate(params: WeaveParams, quality: string, name: string) {
  const res = await fetch("/api/weave/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, quality, name }),
  });
  if (res.status === 422) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    if (detail?.blocked) throw new ExportBlocked(detail.issues ?? [], String(detail.quality ?? quality), String(detail.reason ?? ""));
    throw new Error(JSON.stringify(body));
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function savePng(res: Response, fallback: string) {
  if (!res.ok) throw new Error(await res.text());
  const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? fallback;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadEffectImage(params: WeaveParams) {
  const res = await fetch("/api/weave/effect.png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params }),
  });
  await savePng(res, "effect.png");
}

export async function downloadCraftDrawing(params: WeaveParams, title: string, lang: string) {
  const res = await fetch("/api/weave/craft-drawing.png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, title, lang }),
  });
  await savePng(res, "craft_drawing.png");
}

export async function downloadSessionDrawing(sessionId: string, params: WeaveParams, snapshot: string | null, final: boolean, lang: string) {
  const res = await fetch(`/api/sessions/${sessionId}/craft-drawing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, snapshot, final, lang }),
  });
  await savePng(res, "craft_drawing.png");
}

export type FixResult = {
  needed: boolean;
  found: boolean;
  issues: Issue[];
  tried: number;
  seconds: number;
  layer?: number;
  changes?: { key: string; from: unknown; to: unknown }[];
};

export async function fetchFix(params: WeaveParams, quality: string): Promise<FixResult> {
  const res = await fetch("/api/weave/fix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, quality }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validate(params: WeaveParams, quality: string) {
  const res = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, quality, printer: { nozzle_mm: 0.4, layer_mm: 0.16, material: "PLA", bed_x: 220, bed_y: 220, bed_z: 250 } }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function parseStl(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const positions = new Float32Array(count * 9);
  let offset = 84;
  for (let i = 0; i < count; i++) {
    offset += 12;
    for (let k = 0; k < 9; k++) {
      positions[i * 9 + k] = view.getFloat32(offset, true);
      offset += 4;
    }
    offset += 2;
  }
  return positions;
}

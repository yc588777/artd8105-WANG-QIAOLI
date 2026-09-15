import type { FlockParams } from "./boidsEngine";

export const FLOCK_DEFAULT: FlockParams = {
  sep: 1.4,
  ali: 1.0,
  coh: 0.9,
  vis: 72,
  protect: 22,
  maxSpeed: 140,
  maxForce: 280,
  count: 70,
  enableSep: true,
  enableAli: true,
  enableCoh: true,
};

export const FLOCK_PRESETS: { id: string; zh: string; en: string; params: Partial<FlockParams> }[] = [
  { id: "stable", zh: "稳定鸟群", en: "Stable flock", params: { sep: 1.2, ali: 1.4, coh: 1.0, vis: 80 } },
  { id: "school", zh: "平行鱼群", en: "School", params: { sep: 0.7, ali: 2.1, coh: 0.6, vis: 90 } },
  { id: "swarm", zh: "松散虫群", en: "Swarm", params: { sep: 1.8, ali: 0.3, coh: 1.4, vis: 60 } },
];

export type DiffPreset = { id: string; zh: string; en: string; F: number; K: number; Du: number; Dv: number };

export const DIFF_PRESETS: DiffPreset[] = [
  { id: "spots", zh: "斑点", en: "Spots", F: 0.035, K: 0.065, Du: 0.16, Dv: 0.08 },
  { id: "stripes", zh: "条纹", en: "Stripes", F: 0.035, K: 0.06, Du: 0.16, Dv: 0.08 },
  { id: "maze", zh: "迷宫", en: "Maze", F: 0.029, K: 0.057, Du: 0.16, Dv: 0.08 },
  { id: "coral", zh: "珊瑚", en: "Coral", F: 0.0545, K: 0.062, Du: 0.16, Dv: 0.08 },
  { id: "cells", zh: "细胞", en: "Cells", F: 0.0367, K: 0.0649, Du: 0.16, Dv: 0.08 },
];

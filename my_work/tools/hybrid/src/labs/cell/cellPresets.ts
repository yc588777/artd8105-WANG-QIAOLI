export const CELL_PRESETS = {
  wolfram: [
    { id: "r30", zh: "Rule 30 混沌", en: "Rule 30", rule: 30 },
    { id: "r90", zh: "Rule 90 三角", en: "Rule 90", rule: 90 },
    { id: "r110", zh: "Rule 110 计算", en: "Rule 110", rule: 110 },
  ],
  life: [
    { id: "conway", zh: "Conway B3/S23", en: "Conway", birth: [3], survive: [2, 3] },
    { id: "highlife", zh: "HighLife B36/S23", en: "HighLife", birth: [3, 6], survive: [2, 3] },
    { id: "seeds", zh: "Seeds B2/S", en: "Seeds", birth: [2], survive: [] as number[] },
  ],
};

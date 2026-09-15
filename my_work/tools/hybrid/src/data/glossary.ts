export type GlossaryTerm = {
  id: string;
  zh: string;
  en: string;
  defZh: string;
  defEn: string;
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "allele",
    zh: "等位基因",
    en: "allele",
    defZh: "同一基因位点上的不同版本。本实验室用 A/a 表示一对等位基因。",
    defEn: "Alternative versions of one locus. This lab writes them as A/a.",
  },
  {
    id: "genotype",
    zh: "基因型",
    en: "genotype",
    defZh: "个体携带的等位基因组合，如 AA、Aa、aa。它还不等于可见形态。",
    defEn: "The allele pair an organism carries, such as AA, Aa, aa — not yet the visible form.",
  },
  {
    id: "phenotype",
    zh: "表现型",
    en: "phenotype",
    defZh: "基因型在给定显性规则下呈现的性状。这里只用抽象植物，避免医学联想。",
    defEn: "The trait shown under a dominance rule. We draw abstract plants, not medical faces.",
  },
  {
    id: "punnett",
    zh: "潘尼特方格",
    en: "Punnett square",
    defZh: "把双亲配子排成表格，格子频率都是 1/4，用来读理论遗传比例。",
    defEn: "A 2×2 of parental gametes. Each cell is 1/4, giving theoretical ratios.",
  },
  {
    id: "separation",
    zh: "分离",
    en: "separation",
    defZh: "Boids 在保护半径内互相推开，避免重叠与碰撞。",
    defEn: "Boids steer away inside a protected radius so they do not occupy the same point.",
  },
  {
    id: "alignment",
    zh: "对齐",
    en: "alignment",
    defZh: "个体把速度靠向邻居平均航向，群体因此出现平行。",
    defEn: "Each agent matches mean neighbour heading, producing parallel motion.",
  },
  {
    id: "cohesion",
    zh: "凝聚",
    en: "cohesion",
    defZh: "个体转向邻居质心，使群体保持连接而不散成气体。",
    defEn: "Steer toward the local centroid so the group stays connected.",
  },
  {
    id: "neighbourhood",
    zh: "邻域",
    en: "neighbourhood",
    defZh: "元胞只读取周围格子的状态。没有超距作用，全局图案完全由局部产生。",
    defEn: "A cell reads only nearby sites. Global patterns are made of strictly local updates.",
  },
  {
    id: "glider",
    zh: "滑翔机",
    en: "glider",
    defZh: "生命游戏中平移的五细胞结构，是秩序与混沌边缘上的最小信使。",
    defEn: "A five-cell Life pattern that translates — the smallest messenger on the edge of chaos.",
  },
  {
    id: "axiom",
    zh: "公理",
    en: "axiom",
    defZh: "L-system 的种子字符串。每一轮所有符号同时按产生式改写。",
    defEn: "The L-system seed string. Every symbol rewrites at once each iteration.",
  },
  {
    id: "turtle",
    zh: "海龟绘图",
    en: "turtle graphics",
    defZh: "用前进与转角解释字符串。括号把姿态压栈，从而画出分枝。",
    defEn: "Interpret the string with step and turn. Brackets push pose to make branches.",
  },
  {
    id: "turing",
    zh: "图灵失稳",
    en: "Turing instability",
    defZh: "无扩散时稳定的反应，一旦两种物质扩散速度不同，均匀态会破裂成空间纹样。",
    defEn: "A reaction stable without diffusion can break into spatial pattern once diffusivities differ.",
  },
  {
    id: "grayscott",
    zh: "Gray–Scott",
    en: "Gray–Scott",
    defZh: "底物 U 被 V 自催化消耗，并以 F 补料、以 F+k 清除。同一方程可长出斑点、条纹与迷宫。",
    defEn: "U is consumed as V autocatalyses, with feed F and removal F+k. One equation, many textures.",
  },
  {
    id: "phoneme",
    zh: "音素",
    en: "phoneme",
    defZh: "Bell Labs 用字母卡片代替国际音标：H EE S AW DH UH K AE T 就是 He saw the cat。",
    defEn: "Bell Labs replaced IPA with letter cards: H EE S AW DH UH K AE T for He saw the cat.",
  },
  {
    id: "formant",
    zh: "共振峰",
    en: "formant",
    defZh: "声道的共鸣频率。F1 近似开口，F2 近似舌位前后，串联滤波器把嗡声与嘶声滤成语音。",
    defEn: "Vocal-tract resonances. F1 tracks openness, F2 tracks tongue frontness; cascaded filters shape buzz and hiss into speech.",
  },
];

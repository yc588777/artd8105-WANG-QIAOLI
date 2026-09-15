import type { LabId } from "../types";

export type LearnStep = {
  id: "observe" | "isolate" | "perturb" | "explain" | "create";
  zh: string;
  en: string;
  bodyZh: string;
  bodyEn: string;
};

export type ModuleContent = {
  code: string;
  zh: string;
  en: string;
  scaleZh: string;
  scaleEn: string;
  thesisZh: string;
  thesisEn: string;
  rulesZh: string[];
  rulesEn: string[];
  steps: LearnStep[];
  refs: { zh: string; en: string }[];
};

const steps = (
  items: [LearnStep["id"], string, string, string, string][],
): LearnStep[] =>
  items.map(([id, zh, en, bodyZh, bodyEn]) => ({ id, zh, en, bodyZh, bodyEn }));

export const MODULES: Record<LabId | "index", ModuleContent> = {
  index: {
    code: "M//05",
    zh: "形态系统 05",
    en: "MORPHOSYSTEM",
    scaleZh: "跨尺度",
    scaleEn: "cross-scale",
    thesisZh: "从基因、个体、细胞、植物到化学物质，探索简单规则如何生成复杂生命形态。",
    thesisEn: "From genes to chemistry: how simple rules grow complex form.",
    rulesZh: ["观察", "拆解", "扰动", "解释", "创作"],
    rulesEn: ["Observe", "Isolate", "Perturb", "Explain", "Create"],
    steps: [],
    refs: [],
  },
  gene: {
    code: "GENE.01",
    zh: "遗传规则",
    en: "Genetic rules",
    scaleZh: "信息与个体",
    scaleEn: "information / organism",
    thesisZh: "等位基因如何组合成基因型，再映射为抽象表现型。本模块是概念模拟，不是临床预测。",
    thesisEn: "Alleles combine into genotypes, then abstract phenotypes. Conceptual only — not clinical.",
    rulesZh: ["分离定律", "显性 / 隐性 / 共显性", "突变", "位点编辑模拟"],
    rulesEn: ["segregation", "dominance / codominance", "mutation", "locus edit sim"],
    steps: steps([
      ["observe", "观察", "Observe", "用孟德尔预设查看潘尼特方格与子代概率。", "Load Mendelian preset and read the Punnett grid."],
      ["isolate", "拆解", "Isolate", "单独切换某一性状的遗传模式，看表现型如何改写。", "Switch one trait’s inheritance mode."],
      ["perturb", "扰动", "Perturb", "提高突变率或进入 EDIT MODE 切割一个位点。", "Raise mutation or cut a locus in EDIT MODE."],
      ["explain", "解释", "Explain", "对照概率与样本，理解随机抽样不等于理论频率。", "Sampled offspring are not the theoretical frequencies."],
      ["create", "创作", "Create", "保存 GEN-CODE，供融合实验室映射到其他尺度。", "Save a GEN-CODE for HYBRID mapping."],
    ]),
    refs: [
      { zh: "孟德尔分离与独立分配是离散信息层。", en: "Mendelian segregation is the discrete information layer." },
      { zh: "Johannsen 区分基因型与表现型。", en: "Johannsen split genotype from phenotype." },
      { zh: "CRISPR 在此只作为“切割—修复—结果”教学隐喻。", en: "CRISPR appears only as a cut–repair–result metaphor." },
    ],
  },
  flock: {
    code: "FLOCK.02",
    zh: "Boids 群集",
    en: "Boids",
    scaleZh: "个体与群体",
    scaleEn: "agent / collective",
    thesisZh: "每个个体只看附近邻居。分离、对齐、凝聚三条局部力叠加后，全局队形自己出现。",
    thesisEn: "Each agent sees only nearby neighbours. Separation, alignment and cohesion yield a flock.",
    rulesZh: ["分离", "对齐", "凝聚"],
    rulesEn: ["separation", "alignment", "cohesion"],
    steps: steps([
      ["observe", "观察", "Observe", "加载稳定鸟群预设，看极化度上升。", "Load the stable-flock preset and watch polarity rise."],
      ["isolate", "拆解", "Isolate", "关闭其中一条规则，观察云团、平行或挤压。", "Disable one rule at a time."],
      ["perturb", "扰动", "Perturb", "用吸引 / 排斥 / 障碍改写局部信息。", "Attract, repel, or drop obstacles."],
      ["explain", "解释", "Explain", "ANALYZE 显示感知圆与三种力向量。", "ANALYZE draws range, neighbours and force vectors."],
      ["create", "创作", "Create", "轨迹可冻结为反应扩散的化学种子。", "Freeze trails as a reaction–diffusion seed."],
    ]),
    refs: [
      { zh: "Reynolds 1987：有朝向的粒子与优先级转向力。", en: "Reynolds 1987: oriented particles and prioritized steering." },
      { zh: "Vicsek：对齐噪声可触发有序—无序相变。", en: "Vicsek: alignment noise drives an order–disorder transition." },
      { zh: "数量较大时用空间哈希把邻居搜索从 O(n²) 降下来。", en: "Spatial hashing keeps neighbour search near linear." },
    ],
  },
  cell: {
    code: "CELL.03",
    zh: "元胞自动机",
    en: "Cellular automata",
    scaleZh: "离散细胞",
    scaleEn: "discrete cells",
    thesisZh: "格子只看邻居并同步更新。局部规则能长出稳定块、振荡器、滑翔机，甚至不可约的混沌。",
    thesisEn: "Cells update from neighbours in lockstep. Still lifes, oscillators, gliders and chaos appear.",
    rulesZh: ["邻域计数", "出生 / 存活", "同步更新"],
    rulesEn: ["neighbourhood", "birth / survive", "lockstep"],
    steps: steps([
      ["observe", "观察", "Observe", "从滑翔机种子或 Rule 30 单点开始。", "Start from a glider or a Rule 30 seed."],
      ["isolate", "拆解", "Isolate", "改出生与存活条件，或输入 0–255 规则号。", "Edit B/S rules or type a 0–255 rule."],
      ["perturb", "扰动", "Perturb", "绘制、擦除或随机播种。", "Paint, erase or randomize the lattice."],
      ["explain", "解释", "Explain", "点选细胞查看邻域与状态转移。", "Click a cell to see its neighbourhood transfer."],
      ["create", "创作", "Create", "活区可成为 L-system 的生长边界。", "Live cells can bound an L-system."],
    ]),
    refs: [
      { zh: "Wolfram 四类：匀死、周期、混沌、混沌边缘。", en: "Wolfram classes: uniform, periodic, chaotic, edge-of-chaos." },
      { zh: "Rule 110 图灵完备，说明极简规则仍可能计算不可约。", en: "Rule 110 is Turing-complete: no shortcut past stepping." },
      { zh: "生命游戏的滑翔机是可移动的信息。", en: "Life’s glider is mobile information." },
    ],
  },
  grow: {
    code: "GROW.04",
    zh: "L-system 生长",
    en: "L-system",
    scaleZh: "生长与拓扑",
    scaleEn: "growth / topology",
    thesisZh: "并行重写先产生字符串，海龟再把它走成枝条。文法很短，细节却指数增长。",
    thesisEn: "Parallel rewrite grows a string; a turtle walks it into branches.",
    rulesZh: ["公理", "产生式", "海龟绘图"],
    rulesEn: ["axiom", "productions", "turtle"],
    steps: steps([
      ["observe", "观察", "Observe", "用蕨类或分形树预设看数据库放大。", "Load fern or tree and watch database amplification."],
      ["isolate", "拆解", "Isolate", "只改转角或迭代，其它规则不动。", "Change only angle or iteration."],
      ["perturb", "扰动", "Perturb", "加风、光或障碍，让生长对环境作出反应。", "Add wind, light or obstacles."],
      ["explain", "解释", "Explain", "点击枝条查看符号、代数与父级。", "Click a branch for symbol, generation and parent."],
      ["create", "创作", "Create", "导出 SVG / 规则文本，或放入融合管线。", "Export SVG / rules, or send into HYBRID."],
    ]),
    refs: [
      { zh: "Lindenmayer：全量并行替换，模拟同步分裂。", en: "Lindenmayer: total parallel substitution." },
      { zh: "括号把姿态压栈，才能回到分叉点。", en: "Brackets push pose so side shoots can return." },
      { zh: "CityEngine 用改装 L-system 长路网。", en: "CityEngine grew streets from rewritten L-systems." },
    ],
  },
  diff: {
    code: "DIFF.05",
    zh: "反应扩散",
    en: "Reaction–diffusion",
    scaleZh: "连续物质场",
    scaleEn: "continuum field",
    thesisZh: "激活剂扩散慢、抑制剂扩散快时，均匀态会失稳，斑点与迷宫从噪声里结晶。",
    thesisEn: "Slow activator, fast inhibitor: uniform states break into spots and mazes.",
    rulesZh: ["激活", "抑制", "扩散"],
    rulesEn: ["activate", "inhibit", "diffuse"],
    steps: steps([
      ["observe", "观察", "Observe", "斑点预设下等待图灵斑块出现。", "Wait for Turing spots on the spots preset."],
      ["isolate", "拆解", "Isolate", "把 Du 与 Dv 拉近，看图案退回均匀。", "Equalize Du and Dv and watch the pattern die."],
      ["perturb", "扰动", "Perturb", "画笔注入或擦除物质 B。", "Paint or erase chemical B."],
      ["explain", "解释", "Explain", "ANALYZE 显示选中点的浓度与梯度。", "ANALYZE plots concentration and gradient."],
      ["create", "创作", "Create", "导出显微纹样，或接收鸟群轨迹作为种子。", "Export the micrograph, or seed from flock trails."],
    ]),
    refs: [
      { zh: "Turing 1952：扩散驱动的形态发生失稳。", en: "Turing 1952: diffusion-driven morphogenesis." },
      { zh: "Gray–Scott：进料 F 与消除 k 扫出模式动物园。", en: "Gray–Scott: F and k sweep a pattern zoo." },
      { zh: "短程激活—长程抑制（LALI）是斑点的几何原因。", en: "Local activation, lateral inhibition makes spots." },
    ],
  },
  hybrid: {
    code: "HYBRID.06",
    zh: "跨算法混成",
    en: "Hybrid mixer",
    scaleZh: "尺度之间",
    scaleEn: "between scales",
    thesisZh: "五种算法可开关、可随机持续变形；歌词按 Bell Labs 音素卡拆分后驱动声道合成，摄像头运动改写全部图层与音高、时长、TRACT。",
    thesisEn: "Five algorithms mix and can keep wandering. Lyrics split into Kelly–Gerstman phonemes; camera motion rewrites every layer plus pitch, duration and tract.",
    rulesZh: ["选择", "耦合", "随机视觉", "音素", "音画"],
    rulesEn: ["select", "couple", "wander", "phoneme", "A/V"],
    steps: steps([
      ["observe", "观察", "Observe", "默认混成是蜂群、生长与化学三层；默认歌词 He saw the cat 会拆成 H—EE—S—AW—DH—UH—K—AE—T。", "Default mix overlays flock, growth and chemistry. He saw the cat splits into H—EE—S—AW—DH—UH—K—AE—T."],
      ["isolate", "拆解", "Isolate", "关掉其中一层，只留一对算法；或只听朗诵、关掉演唱旋律。", "Turn layers off until a single coupling remains, or speak without singing."],
      ["perturb", "扰动", "Perturb", "打开随机视觉让画面自己走；或开摄像头挥手，让运动进入全部图层与音高、时长、声道。", "Turn on random vision so the mix keeps changing, or wave at the camera so motion enters every layer plus pitch, duration and tract."],
      ["explain", "解释", "Explain", "五步：文本 → 音素卡片 → 音高/时长 → 响度/舌位/共振峰 → 磁带成声。", "Five steps: text, phoneme cards, pitch/duration, tract controls, tape to sound."],
      ["create", "创作", "Create", "自己写一句歌词并演唱，导出一张被声道与动态改写的梭梨甲藻叠合。", "Write a lyric, sing it, and export the pyrocystis overlay."],
    ]),
    refs: [
      { zh: "Kelly & Gerstman：穿孔卡片音素码驱动串联共振峰合成器。", en: "Kelly & Gerstman: punched-card phonemes drive a tandem resonant synthesizer." },
      { zh: "Computer Speech（1963）把 He saw the cat 念成 Hee Saw Dhuh Kaet。", en: "Computer Speech (1963) reads He saw the cat as Hee Saw Dhuh Kaet." },
    ],
  },
};

export const NAV = [
  { to: "/", id: "index" as const, label: "M//05" },
  { to: "/lab/gene", id: "gene" as const, label: "GENE.01" },
  { to: "/lab/flock", id: "flock" as const, label: "FLOCK.02" },
  { to: "/lab/cell", id: "cell" as const, label: "CELL.03" },
  { to: "/lab/grow", id: "grow" as const, label: "GROW.04" },
  { to: "/lab/diff", id: "diff" as const, label: "DIFF.05" },
  { to: "/hybrid", id: "hybrid" as const, label: "HYBRID.06" },
  { to: "/archive", id: "archive" as const, label: "ARCHIVE" },
];

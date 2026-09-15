import type { LabId } from "../types";

export type Challenge = {
  id: string;
  module: LabId;
  zh: string;
  en: string;
  hintZh: string;
  hintEn: string;
};

export const CHALLENGES: Challenge[] = [
  { id: "gene-recessive", module: "gene", zh: "让尖叶理论概率 ≥ 50%", en: "Pointed-leaf probability ≥ 50%", hintZh: "两个亲本都携带隐性等位基因。", hintEn: "Both parents need the recessive allele." },
  { id: "gene-codominant", module: "gene", zh: "让某一性状进入共显性杂合", en: "Show a codominant heterozygote", hintZh: "切换共显性预设并查看嵌合表现型。", hintEn: "Load the codominance preset." },
  { id: "gene-mutate", module: "gene", zh: "捕获一次可见突变", en: "Catch a visible mutation", hintZh: "提高突变率后多次抽样子代。", hintEn: "Raise mutation and resample." },
  { id: "flock-stable", module: "flock", zh: "形成稳定鸟群", en: "Form a stable flock", hintZh: "极化度持续高于 0.72，平均邻居 > 3。", hintEn: "Hold polarity > 0.72 with > 3 neighbours." },
  { id: "flock-gap", module: "flock", zh: "穿越狭窄通道", en: "Pass a narrow gap", hintZh: "放置左右障碍，留出中央缝隙。", hintEn: "Place two obstacles and leave a central slit." },
  { id: "flock-predator", module: "flock", zh: "避开移动捕食者", en: "Avoid a moving predator", hintZh: "开启捕食者后保持低碰撞。", hintEn: "Turn the predator on and keep collisions low." },
  { id: "cell-glider", module: "cell", zh: "制造滑翔机", en: "Make a glider", hintZh: "使用滑翔机种子或自己画五细胞结构。", hintEn: "Use the glider seed or paint the five cells." },
  { id: "cell-100", module: "cell", zh: "维持 100 代", en: "Survive 100 generations", hintZh: "保持非零活细胞并运行到第 100 代。", hintEn: "Keep live cells and run to generation 100." },
  { id: "cell-chaos", module: "cell", zh: "从对称走向混沌", en: "Symmetry into chaos", hintZh: "一维 Rule 30 从中心单点开始。", hintEn: "Rule 30 from a single central 1." },
  { id: "grow-canopy", module: "grow", zh: "四代生成完整树冠", en: "Canopy in four iterations", hintZh: "分形树迭代到 4，枝条数足够铺开。", hintEn: "Fractal tree at iteration 4 with enough segments." },
  { id: "grow-wind", module: "grow", zh: "生成抗风结构", en: "Wind-ready structure", hintZh: "开启风向后图形仍保持在画布内。", hintEn: "Turn wind on without leaving the frame." },
  { id: "grow-bound", module: "grow", zh: "限制在边界内生长", en: "Grow inside a bound", hintZh: "添加障碍圆，让枝条绕开。", hintEn: "Add an obstacle circle the turtle must avoid." },
  { id: "diff-spots", module: "diff", zh: "从单点形成斑点群", en: "Spots from a point", hintZh: "斑点预设 + 单次注入后等待分裂。", hintEn: "Spots preset, one splat, wait for mitosis." },
  { id: "diff-maze", module: "diff", zh: "把条纹变成迷宫", en: "Stripes into maze", hintZh: "切换到迷宫预设并降低进料。", hintEn: "Switch to maze and ease the feed." },
  { id: "diff-edge", module: "diff", zh: "保持稳定边界", en: "Hold a stable edge", hintZh: "避免过度注入，让纹样填满但不爆。", hintEn: "Avoid overpainting so the field fills without blowing up." },
  { id: "hybrid-layers", module: "hybrid", zh: "同时打开三层可见算法", en: "Run three visual layers at once", hintZh: "蜂群 / 细胞 / 生长 / 化学中至少开三个。", hintEn: "Turn on at least three of flock, cell, grow, diff." },
  { id: "hybrid-couple", module: "hybrid", zh: "接通一组跨尺度耦合", en: "Enable a cross-scale coupling", hintZh: "先打开配对的两层，再打开对应耦合开关。", hintEn: "Enable two paired layers, then a coupling toggle." },
  { id: "hybrid-random", module: "hybrid", zh: "掷一次 RANDOM MIX", en: "Throw a RANDOM MIX", hintZh: "让五种算法自行抽签，再决定要不要微调。", hintEn: "Let the mixer pick, then decide what to keep." },
  { id: "hybrid-wander", module: "hybrid", zh: "打开随机视觉并看画面持续变形", en: "Turn on random vision and watch it wander", hintZh: "RANDOM MIX 旁边的随机视觉会一直改写层与参数。", hintEn: "The random-vision toggle next to RANDOM MIX keeps rewriting layers and parameters." },
  { id: "hybrid-lyric", module: "hybrid", zh: "把一句歌词拆成音素并放音", en: "Split a lyric and play the tape", hintZh: "输入 He saw the cat，确认 H—EE—S—AW—DH—UH—K—AE—T，再按 PLAY TAPE。", hintEn: "Type He saw the cat, check the Kelly cards, then PLAY TAPE." },
  { id: "hybrid-camera", module: "hybrid", zh: "用摄像头运动改写全部画面与声音", en: "Drive every layer and the voice with camera motion", hintZh: "打开捕捉动态，挥手应改写蜂群、细胞、生长、化学、基因，以及 PITCH / DUR / TRACT。", hintEn: "Enable motion capture and wave; flock, cells, growth, chemistry, genes, pitch, duration and tract should all follow." },
];

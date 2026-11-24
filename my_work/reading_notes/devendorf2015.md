---
title: "Being the Machine: Reconfiguring Agency and Control in Hybrid Fabrication"
authors: "Laura Devendorf, Kimiko Ryokai"
year: 2015
venue: "CHI 2015, Crossings, Seoul"
venue_type: "conference"
doi_or_url: "https://doi.org/10.1145/2702123.2702547"
verified: true
stream: "personal"
topic_tags: ["hybrid-fabrication", "agency", "digital-making"]
subconversation: ""
relevance: "adjacent"
date_read: 2026-11-24
---

# Being the Machine: Reconfiguring Agency and Control in Hybrid Fabrication

出版页核验：Laura Devendorf & Kimiko Ryokai，CHI 2015 *Crossings*（Seoul），ACM，DOI [10.1145/2702123.2702547](https://doi.org/10.1145/2702123.2702547)。作者单位 School of Information, University of California, Berkeley，不是发表处。正文判断仍是提交时的原文，不改写。

## 1 · Why this paper

我关注数字制造如何走出"创客实验室"这种特权空间、进入日常生活的问题。这篇论文提出的切入点很特别：它不追求让 3D 打印更快更准，而是反过来问——制造系统的设计本身配置了人、机器、材料与数字模型之间的关系，隐含着"谁该拥有能动性与控制权"的设计者意识形态。作者从艺术实践中借取价值，把 3D 打印机"降格"为只能输出一个激光点的被动引导者，让人的身体去"成为机器"。这种对既有工具假设的批判性重设，以及"有意保留人之不精确、保留失败可能"的设计立场，是我读它的主要原因。

## 2 · Summary

论文设计并评估了 Being the Machine：一套可携带的数字制造系统，把人从创客空间解放出来，在个人日常环境中用随手可得的材料完成制造。

解决的问题：数字制造系统在设计上隐含了未被研究的价值与假设，其对人、机器、材料、数字模型之间关系的配置会深刻影响人们制造时的感受与表达。传统 3D 打印被视为"质形论"（hylomorphic）式的——把预设形态强加于被刻意设计成被动、易塑的材料之上。论文要问的是：能不能换一种配置，让材料"活"起来，让制造过程本身成为可被反思的经验？

主要贡献：

1. 理论框架：将符号学（semiology，索绪尔式的能指/所指分析）与 Ingold 的"制造即对应"（making as correspondence）结合，用以描述艺术家的智识与体力工作。艺术的价值在于：把不同材料、语境、过程并置以探索符号学效应；同时理解媒介的象征与技术双重层面，即"打开 3D 打印的黑箱"，追问机器的机械动作还能象征什么。Ingold 反对质形论，主张制造是创作者意图与材料"意图"之间的对应——材料通过其物理属性"说话"，形态从人与材料力量的互动中涌现。
2. 三条设计原则：(a) 被动的机器 / 主动的材料——让人的身体与手，而非机器的"身体"，主动与材料打交道；(b) 引导而非指令——形态是涌现的而非预设的，系统不展示"正确"做法，机器只是引导；(c) 最小界面——只用单个激光点传递最少的必要信息，其余全部留给使用者自行诠释。
3. 技术实现：系统把 G-Code（3D 打印机的分步指令）转译为手可跟随的形式。硬件为装在两只舵机上的"云台式"激光指示器（Arduino 驱动），配无线按键遥控器前进/后退；配套 G-Code 可视化软件可让用户在 2D 和 3D 中查看路径与层序，并可判断结构（如树形支撑是否足够，不够则回 Slic3r 调整）。用户用 Slic3r 生成 G-Code，测量自己的材料尺寸并输入以生成对应参数。使用时如"3D 版的连线游戏"：激光点移动，人用材料连接前后两点，一层层直至模型完成；激光熄灭即表示一段路径结束。
4. 研究发现——机器被赋予的四种角色：通过 14 名背景各异的参与者、2–4 小时的一对一实验（含 15 分钟用铅笔跟随激光的热身），并依 Charmaz 的扎根理论方法分析转录与影像材料，作者归纳出四种角色：
  - 无所不知的助手（omniscient helper）：期待系统展示"正确"做法，愿把控制权交给系统，遇到困难就忽略激光；
  - 拥有独特才能的合作者（collaborator with unique talents）：追求共生关系——机器擅长抽象形状与计算，人擅长材料与应对意外，并不期待成品完美；
  - 生成性约束（generative constraint）：好奇这一特定过程如何让自己的既有艺术/工艺实践焕发新意，把机器视作"对话"对象；
  - 完美的象征（symbol of perfection）：把使用系统作为直面与处理自身不完美感的方式，在与"完美的机器"并置中接纳自己的不完美行动。

相较前人的推进：在混合工艺（hybrid craft）研究中，FreeD、Haptic Intelligensia、Sculpting by Numbers、Rivers 等人的桌面铣床都强调提升精度与效率，机器充当"帮手"以助人做出精确模型。本文反向操作：刻意不给人行动反馈，用极简界面（单激光点而非投影系统）把焦点从预设结果转向材料本身，从而提供更具反思性、可能带来惊喜的制造体验。在交互式制造（interactive fabrication）领域，既有研究让机器响应人的动作，而本文让机器"引导但不决定"人的动作。

## 3 · Critical thinking

- 术语系统的漂移与"角色"框架的稳定性：论文用"参与者把机器塑造为何种角色"来组织发现，但并未说明一位参与者是否可能在不同阶段切换角色。文中已有迹象——"有些参与者认为自己承担多重角色"，Matt 就自述既是追求效率的创客又是艺术家。四类角色因此更像分析性理想型，而非互斥的人群分类，论文未对此加以澄清。
- 失败/断裂被浪漫化：作者主张"保留人之不精确""保留失败可能"是一种价值，Brynn 的例证也支持这一立场。但"由技术带来的挣扎"与"由设计不完善带来的挫败"之间的界限并不清晰。当 Jack 因管道清洁器难以精确复现轮廓而烦躁、Anna 因必须来回移动激光点核对而对齐困难时，这些挫折是否也被归入了"有价值的挣扎"？论文对负面体验的甄别偏弱。
- 评估的证据基础单薄：样本为 14 人、单次 2–4 小时，且作者自己承认"艺术家们表示需要更多时间去探索这套系统与其自身实践的相关性"。这意味着最契合设计初衷的那类参与者的体验，恰恰是尚未充分展开的。结论中"能支持审美体验与批判性反思"这一判断，建立在此类短时体验之上。
- 激光可视性的实用局限：文中提到激光点"除了被看见几乎不提出任何要求"，但在户外或强光条件下的可见性、以及单点对新手身体跟随的认知负荷，论文未讨论。
- 缺乏对制造成品功能性/可持续性的评估：花朵花瓶会随时间凋谢、面包和花生酱做的松鼠喂给了狗，这些作为"作品"的材料稳定性问题被有意悬置，但论文未明确承认这一维度被排除在评价之外。

## 4 · Creative thinking

- 把"不要反馈"当设计参数：本文最反直觉的一点是主动"扣留"反馈，以保留意外与反思空间。这与工程界"越精确越好"的默认恰好相反。可以迁移的思路是：在协作或创作类工具中，是否也应有意留出未被量化的空隙？
- 与前三篇文献的对话：Carlile 的"边界物"（）在此有了一个直观的技术实例——激光点与 G-Code 可视化界面正是设计者与材料、数字模型与物理动作之间的边界物，不同的是本文的意图不是"协同转化知识"，而是"制造反思体验"。CoFabs（）让机器响应人的操作，本文则让机器引导人的动作，二者在"人机控制权分配"上恰好构成一组对照实验。而 FPP 测量（）与曲面编织（）都在追求更高的以机器为中心的精度，本文则提供了一个反问：精确本身是否被过度当作价值？
- 角色框架的复用：四种角色（助手/合作者/约束/象征）可作为人机协同设计的一种评估维度，用来诊断某一工具会让用户自发进入哪种关系模式，也可反过来作为设计目标——刻意引导用户走向"合作者"而非"无所不知的助手"。
- 跨域翻译作为创作方法：Josh 把 3D 模型转译为乐谱（层→音高、节奏、力度、发音法），这种把一个领域的结构映射到另一领域的做法，对任何"跨媒介创作"都很有启发。

## 5 · Form — read it as a genre, not just as content

- Length：CHI 全文，篇幅中等（正文约 8–10 页量级，含大量插图与引述）。
- Section proportions：
  - Abstract: ~3%
  - Introduction: ~8%
  - Background（Values in Art Practice + Correspondence with Materials）: ~18%
  - Related Work（设计工具/混合工艺/交互式制造/艺术中的人机/日常材料 3D 打印）: ~15%
  - Design Principles（被动机器主动材料、引导而非指令）: ~8%
  - Technical Implementation: ~12%
  - Study（方法）: ~12%
  - Findings（四类角色）: ~18%
  - Discussion: ~6%
- First Appearance of Contribution Claim：Introduction 接近末尾处，以三个圆点列出"Being the Machine 的三个目标"，随后紧接"By subverting an expected relationship between humans and machines in making, new roles for digital fabricators in physical making practices emerged. This paper contributes descriptions of these roles..."——贡献声明在此首次明确出现。
- Contribution Sentence："This paper contributes descriptions of these roles in order to expand the design space of hybrid-fabrication."
- Artifact Description vs. Analysis：以分析为主，描述服务于分析。技术实现部分相对简短、以功能性说明为主（Arduino、舵机云台、Slic3r、G-Code 可视化），重心放在 Findings 中对参与者体验的角色化解读。这符合 CHI 人机交互论文"系统是研究载体而非终点"的传统。
- Related Work：以"领域归类 + 定位差异"为主。作者把相关工作分为五类小节（设计工具、混合工艺、交互式制造、艺术中的人机关系、日常材料 3D 打印），在每一类中先概述他人在做什么，再点明本研究的差异（如"我们让机器引导但不决定人类动作"）。这是人机交互论文常见的写法。
- Process Evidence：以参与者引述 + 作者观察为主。大量使用直接引语（Clare、Vanessa、Matt、Brynn、Josh 等），并配有作品照片（Figure 1 玉兰叶眼镜、Figure 3 示例作品、Figure 4 树枝/常春藤/Easy Cheese 制作）。无定量指标、无对照条件。
- Figures：至少 4 幅图，均为使用场景与成品照片/系统示意（Figure 2 为系统总览的分面说明）。无数据图表——这与 HCI 定性研究一致。
- First Person or Passive? Tense：通篇第一人称复数"we"（"we invited", "we developed", "we found"），代表研究者团队的声音；描述参与者时用过去时，陈述设计理念与普遍结论时用现在时。全程无被动语态主导的工程腔。
- Limitations：未见独立的 Limitations 章节。对方法论限制的讨论散落在 Discussion 中（如"艺术家需要更多时间来探索系统与其实践的相关性"），未系统交代样本规模、单次时长、材料稳定性等局限。

## 6 · Venue signal

本文发表于 CHI 2015（ACM 人机交互领域顶会），属 "Digital & Materials Fabrication" 专题。该平台的文章取向明显：重视设计过程的批判性与反思性而非功能优越性，重视对参与者体验的质性刻画而非性能基准测试，允许以第一人称叙述设计与研究动机，并鼓励从艺术、设计等人文领域借取理论框架。图中的作品照片与大量参与者引语都是这一取向的表征。相对地，它对统计效力、可复现性与定量比较的要求很低。

## 7 · Take-home

- 个人收获：最大的收获是"工具设计即价值宣示"这一视角。一个系统的技术细节从来不是中性的——它内嵌着"谁该控制什么"的答案。Being the Machine 用一个激光点、不给反馈这样的极简选择，把制造从"追求正确结果"重新定义为"与材料协商的过程"。这对我审视任何工具设计都很有启发。
- 新知识：了解了 Ingold 的"制造即对应"与对质形论的批判；了解了"符号学 + 材料研究"作为设计理论框架的用法；掌握了"混合制造"中人机能动性分配这条研究脉络（FreeD、Haptic Intelligensia、Sculpting by Numbers 等）。
- 如何应用：四类角色框架可以直接用于评估人机协作工具——问"这个工具让用户把机器当成什么？"；"被动机器/主动材料"这一原则可以迁移到我参与的数字化生产流程设计中，考虑把某些决策权交还给操作者而非全部交给系统，以保留材料特性带来的意外价值。
- 写作模仿：值得学习的是"从艺术理论借框架 → 提炼设计原则 → 技术实现 → 质性研究 → 归纳角色类型学"这条完整链条的写法，尤其是把抽象的哲学概念（correspondence）落成具体设计决策（单个激光点、扣留反馈）的能力。同时要注意，本文未设独立 Limitations 章节、且结论依赖短时小样本，若撰写同类研究应补足这两点。

## 8 · Quotable

1. "The way a fabrication system is designed configures relationships between humans, machines, materials, and digital models, and reflects the ideology of the designers: ideas of who or what should have agency or control in the making process." (Introduction) —— 全文价值前提的凝练表述，适合用于讨论"工具即价值"的场合。
2. "I guess I like that the machine is the expert on the abstract shape and I'm the expert on the material. I feel like we have a nice division of roles and the machine isn't making me feel stupid. The machine is only making the suggestion, I'm the one realizing it."（Clare，Findings）—— 以参与者原话概括"合作者"角色的理想状态，引用性强。
3. "While interfaces that produce beautiful results with little effort may be initially exciting and motivating, our results suggest that people also value experiences with technology that require initial struggle but reveal paths towards virtuosity, much like learning to play musical instruments." (Discussion) —— 全文最具张力的一句结论，适合用于论证"有益的困难"这一设计立场。

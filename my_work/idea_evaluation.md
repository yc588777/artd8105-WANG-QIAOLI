---
student: "汪俏黎 / WANG QIALI"
date: 2026-10-13
version: 1
target_venue: "ACM DIS 2027"
target_track: "Papers"
word_limit: "typically 7,000–8,000 words excluding references, captions, appendices; desk reject below 4,000 or above 12,000"
format: "ACM Primary Article, single-column for review; TAPS camera-ready"
anonymisation: "dual anonymous, relaxed CHI model"
deadline: "title and abstract 11 January 2027 AoE; full paper 18 January 2027 AoE"
contribution_type: "method"
ethics_required: false
---

# Idea Evaluation

*Adapted from Wu Ziwei's Idea Evaluation Template, extended for this course.
Revise it — do not rewrite it from scratch — at sessions 8, 10 and 12. Keep every
version. The drift is data.*

**v1 组装说明。** 第 1–5、7 节的主张取自学生 week_7《参数化编织系统文献研究.docx》与项目名「海棠经纬」。句子按课程模板重排，不另外发明贡献。第 7 节必要性测试是把文档第 10–11 节的审稿人问题收成测试句，**请在答辩前用自己的话再读一遍**。会议事实来自 2026-10-13 打开的 DIS 官方页，见 `venue/dis-2027.md`。

---

## 1 · Introduction

**General background.**

计算编织、传统工艺数字化和面向非专业用户的织物设计界面，在图形学、计算设计和 HCI 里都已经有成熟工作。弹性条带可以在自由曲面上连续交织；提花织机路径可以织出三维浮雕；竹编可以被写成形状语法或交给建筑机器人。宏观概念本身不再新。

**General motivation for your work.**

真正还空着的，不是“再做一个竹编生成器”，而是：当编织必须停在一把**有厚度的闭合硬边框**里、并且必须被**桌面 3D 打印机**打出来时，连续性和可打印性还没有被当成同一条生成规则。海棠形团扇把这个问题收成一个可展览、可打印的物件。

**The specific problem you want to address.**

1. 在海棠形（以及可推广的非凸闭合轮廓）刚性边框内，生成压一挑一、两端进入边框、没有悬空碎线的连续编织。
2. 生成时就满足 3D 打印的最小线宽、间隙和悬垂，而不是先出漂亮网格再在切片器里失败。
3. 把上述计算收进一个非专业用户能拖滑块的 Web 系统（HAITANG WEAVE LAB），输出可进切片软件的网格。

若不能用这三句说明，问题就还不够窄。

---

## 2 · New problem or old problem?

**Old.** 计算编织和竹编参数化都不是新问题。Ren, Panetta et al. (2021) 已经用能量松弛做连续弯曲条带；Wu et al. (2020) 已经在矩形织机布边里做连续折返；Weavecraft 已经给非专家三维编织界面；Muslimin (2010) 已经把交织写成形状语法；Wang et al. (2025) 已经把数字竹编做到机器人建造的亭。

现有解法不够用，是因为边界和制造约束换了：开放曲面或矩形布边，变成非凸闭合硬框；激光切割后手工编织或织机纱线，变成桌面 FDM / SLA 必须一次打出的刚性几何。全屏铺网再布尔裁剪，会在海棠瓣边留下没有力学归属的短线。本项目要补的是这条缝，不是再证明“竹编可以参数化”。

---

## 3 · Methods

**What are your methods? List their major features.**

- 以源 STL 的海棠外轮廓为不可改边界；编织只发生在可编辑区内。
- 经纬（及旋转菱纹等）由标量参数生成：密度、篾宽、起伏、相位、角度。
- 每根母线与闭合外框求交；短于物理阈值的线段丢掉；合法端点嵌入边框网格，而不是布尔切断。
- 交点矩阵上做压一挑一的 Z 向分离，并写入打印间隙；默认厚度锁在源模型约 2 mm 外包络。
- 非法参数在界面上报警或锁死，不允许导出标成“可打印”的坏网格。
- 用 FDS 13-103 的树脂 / FDM 打印机做极限参数的实体验证，包括失败件。

**What are their novelties and advantages?**

相对布尔 Trim + Pipe：端点被重新计算进边界，而不是被切断。相对 Weavecraft：输出是带框的可打印实体，不是周期仿真。相对 Ren/Panetta：不跑离线有限元，把制造约束当成几何规则。相对 Wang et al.：尺度是手持个人制造，不是机械臂竹亭。

**Can your methods deliver results that could not be achieved before?**

不能声称“第一次做出三维编织”。能声称的是：在非凸硬边界 + 桌面打印约束下，同一套参数既实时可调、又不会在边界上碎线。这一点必须用并排图（布尔断头 vs 锚定端点）和打印成功 / 失败来证明。2026-10-13 系统已能改网格；切片和打印尚未做，所以这句话在打印之前仍是假设。

---

## 4 · Contribution type — declared

**Type:** Method contribution

**Why this type:**

缺口不是“从来没有人做过编织物”（那会是 existence proof），而是：别人做过，但没有一条**可跟随的方法**，把非凸硬边界锚定和 3D 打印约束写进生成。学生文献稿第 9 节把主要贡献标为 Method，并写明不要声称 existence proof，也不要声称 critical / speculative。本学期不做需要伦理审查的用户实验，所以也不是 empirical。

**What evidence this type requires:**

| Type | Evidence required |
|---|---|
| Existence proof | The artifact, documented so its properties are verifiable |
| Method contribution | Process account a stranger could follow, plus why it beats the obvious alternative |
| Annotated portfolio | The set of works, plus annotations that analyse across them rather than describe each |
| Intermediate concept | Your instance, plus a gesture toward others the concept also describes |
| Critical / speculative | Rigorous positioning against existing critical work |
| Empirical | A real study design, ethics approval, analysis — **plan by session 7 or choose another type** |

陌生人要能跟着做：交点如何求、碎线如何丢、端点如何嵌、间隙如何设。显而易见的替代是 Grasshopper 铺网 + 布尔。证据是那张对比图，加上至少一组因越界而失败、一组因约束而成功的打印。同一规则下的参数系列可以后来写成 annotated portfolio，但 v1 的类型是 method。

---

## 5 · Contributions

> The major contributions of this paper are:
> 1. **边界连续编织方法。** 问题：非凸闭合硬边框会把编织剪成碎线。方法：轮廓求交、短线剔除、端点嵌入边框，而不是布尔裁剪。好处：扇面在瓣角处仍连续、可承力、可打印。
> 2. **把制造约束写进生成。** 问题：滑块一密，Z 向起伏要么穿模，要么悬垂打不出来。方法：在交点上控制压挑、间隙和悬垂，越界则报警或锁死。好处：导出的网格与所选 FDM / SLA 公差一致，而不是只在屏幕上好看。
> 3. **端到端的个人制造系统（辅助）。** 问题：现有编织工具停在仿真或专业 CAD。方法：浏览器滑块 → 拓扑计算 → STL/3MF。好处：不写代码的人也可以从海棠扇走到可切片文件。系统本身不是主贡献；它是方法被执行过的证据。

每一条都含问题、方法、好处。第 3 条降为辅助，避免把 “做了一个网站” 说成贡献。

---

## 6 · Related work

Session 10 再写长。v1 只放已核验的五篇，批判见 `literature_verification.md`。

| Work | Venue, year | What it does | What it does not do | What you add |
|---|---|---|---|---|
| Ren, Panetta et al., 3D Weaving with Curved Ribbons | TOG / SIGGRAPH 2021 | 弯曲弹性条带的曲面逆向编织 | 闭合硬框、实时、3D 打印悬垂 | 刚性边界锚定 + 打印几何约束 |
| Wu et al., 3D Woven Relief | TOG / SIGGRAPH 2020 | 高度场 → 织机连续折返 | 非矩形刚性框、刚性条带 | 任意闭合硬边界上的修剪与嵌入 |
| Wu et al., Weavecraft | TOG 2020 | 非专家三维编织块仿真 | 带框可打印实体、打印公差 | 产品级端到端网格 |
| Muslimin, Interweaving Grammar | IJAC 2010 | 竹编 / 交织的形状语法 | 全局单线连续、打印文件 | 连续线段 + 边界求交，而不是模块拼接 |
| Wang et al., Digital Bamboo Weaving | CAADRIA 2025 | 机器人竹亭 | 手持尺度、Web 非专家工具 | Personal fabrication 的密编与硬框 |

**Works you build on.**

| Work | What you take from it |
|---|---|
| 传统竹编压一挑一 | 交点处的上下规则（几何转译，不是材料仿真） |
| Wu 2020 织机布边折返 | “封闭区域内必须连续、不能碎线” 这一要求 |
| FDS 13-103 树脂 / FDM 机器极限 | 最小线宽、间隙、悬垂——写进参数，而不是事后希望 |

---

## 7 · The necessity test

Both must fail for the project to be coherent.

- **Remove the making — is the finding still supported?**
  若只写算法、从不打印：找不到“布尔裁剪在瓣边悬空、锚定端点才能打出来”的证据。屏幕上的连续可以是假的。**所以必须做。** 2026-10-13 还没有打印，这一半目前是计划，不是已经通过的测试。

- **Remove the domain or site — is the method still a contribution?**
  若去掉海棠扇、非凸硬框、桌面打印，剩下的就是计算编织，Ren / Wu / Weavecraft 已经做过。方法之所以还是贡献，是因为它必须活在这把扇、这条边、这台打印机里。海棠是案例，用来证明该方法能处理这一类闭合硬边界；不是把扇面轮廓换成圆，论文就还能原样成立。**所以必须在这里做。**

**Result:** 两半都应该失败（即：不做、不在这里，贡献都不成立）。现在弱的是第一半——还没有失败件。答辩时不要假装已经打印过。

---

## 8 · Initial results — demo

**What you can show by the end of this semester / by 25 November.**

- 物件：参数化海棠形刚性手扇（整扇导出，不是折扇）。
- 系统：HAITANG WEAVE LAB，http://127.0.0.1:5173 。平纹 / 斜纹 / 波纹 / 蜂窝 / 旋转菱纹已能重算网格。
- 机器：DZ 13-103，树脂打印机（细密交织）或 FDM P2S（迭代）。FDS Booking System；**预约未做，本周要订。**
- 已有：源 STL 基准、数字流形检查、平面与正面导出图（`process_journal/2026-10-13_haitang-*.png`）。
- 还没有：切片、实体打印、边框锚定对布尔裁剪的并排证据图。

---

## 9 · Expected results — whole project

一篇 DIS 2027 Papers：方法可复述，对比图在，打印系列在，缺口对着五项已核验文献。展览上有一把（一组）打出来的扇。

---

## 10 · Discussion

待 session 10。已知限制：当前实现是 2.5D 厚度场，不是条带穿出 2 mm 外包络的真三维穿插；扇柄刻字未确认删除；装配未锁定。

---

## 11 · All expected figures

| # | Content | Purpose — what it proves | Status |
|---|---|---|---|
| 1 | 海棠扇参数界面 + 三维网格（5173） | 滑块改变的是几何，不是贴图 | 系统在跑；论文用图未定稿 |
| 2 | 布尔裁剪断头 vs 端点嵌入边框 | 方法不是 Trim+Pipe | planned |
| 3 | 压一挑一剖面 / 间隙标注 | Z 向分离是计算出来的 | planned |
| 4 | 越界报警 / 锁死截图 | 制造约束在生成里 | planned |
| 5 | 同规则多组参数的打印件（含失败） | 必要性测试的“做” | planned；未预约 |
| 6 | 与五项相关工作的矩阵 | 缺口有文献坐标 | 表已在 literature_verification |

---

## 12 · Remaining tasks

- **Unsolved major problems:** 边界求交是否已完全替代布尔；打印约束是否实时；尚无实物。
- **Workload:** 算法对照图、13-103 预约与打印、切片记录、论文按 DIS 单栏写。
- **Milestones:**

| Session | Milestone |
|---|---|
| 9 · 21 Oct | 13-103 完成预约；至少一次切片；一张布尔 vs 锚定对照图 |
| 10 · 28 Oct — idea evaluation revised | 相关工作写完；至少 1 件实体（成功或失败都要记录） |
| 11 · 4 Nov — draft v1 | DIS 单栏草稿：引言 + 方法 + 图 |
| 12 · 11 Nov — mock review; idea evaluation revised | 按 DIS 三条审稿问题改 |
| 14 · 25 Nov — submission package | 展览物件 + 论文包 |

---

## 13 · Section budget

DIS Papers 按 7,500 词估。比例待 Phase 2 量完 exemplar 再改。

| Section | Target words | Drafted |
|---|---|---|
| Introduction | 900 | notes |
| Related work | 1,200 | table only |
| Artifact / system | 1,200 | |
| Process / method | 1,800 | |
| Findings (prints) | 1,200 | |
| Discussion | 800 | |
| Limitations | 400 | |

---

## 14 · The skeptical reviewer

> **Objection 1:** This is just a weave grid Boolean-trimmed to a begonia outline and piped.
> *Response:* 方法章节必须展示交点重算与端点嵌入，并给出断头对照。若到 session 10 仍拿不出这张图，这条反对成立，项目需要改口或改算法。

> **Objection 2:** The Z-offset is a sine wave that cannot be printed, and dense strands will fuse.
> *Response:* 间隙和悬垂必须是生成参数，并用失败打印证明越界会被挡住。没有失败件，这条反对成立。

文献稿另外三条（算法只硬编码海棠；没有用户实验；假装仿真了竹材）的处理：海棠作为案例、本学期不做用户实验、只声称几何转译。不要在答辩里主动许诺 Likert 研究。

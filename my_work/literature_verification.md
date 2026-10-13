---
student: 汪俏黎 / WANG QIALI
date: 2026-10-13
source: e:\UM\UM-3\ATTICUS\homework\week_7\参数化编织系统文献研究.docx
project: 海棠经纬——面向数字制造的参数化竹编扇生成系统（HAITANG WEAVE LAB）
---

# Literature verification — 海棠经纬 / HAITANG WEAVE LAB

本文件是 Session 8 的文献核验作业。上半部分是核验后的结论；下半部分说明来源、纠正，以及检索之后项目必须改什么。

**来源。** 学生 week_7 文档《参数化编织系统文献研究.docx》（约 25,000 字）。体例对应课程 `projects/07_project_to_venue/gemini_deep_research.md` 的对抗式文献核验模板。原文未写明用了哪一个研究工具；按课程要求，该原文在未打开出版页之前一律视为 **UNVERIFIED**。

**本次核验日期。** 2026-10-13。打开的是出版商 / 作者页 / CUMINCAD / SAGE，不是第三方会议日历。

**缺口原句是学生文档第 7 节的原话，此处不改写。** 五项批判压缩自同一文档第 6 节与第 16 节；凡是我改过作者顺序或会议日期的地方，都标了 `[CORRECTION]`。

---

## 五项最接近的研究

| # | 作者、年 | 题名 | 发表处 | DOI / 官方页 | 状态 |
|---|---|---|---|---|---|
| 1 | Ren, Y., Panetta, J., Chen, T., Isvoranu, F., Poincloux, S., Brandt, C., Martin, A., & Pauly, M. (2021) | 3D Weaving with Curved Ribbons | *ACM Transactions on Graphics* 40(4), 127 (SIGGRAPH 2021) | https://doi.org/10.1145/3450626.3459788 | **VERIFIED 2026-10-13** · ACM DL + 作者页 julianpanetta.com |
| 2 | Wu, R., Harvey, C., Zhang, J. X., Kroszner, S., Hagan, B., & Marschner, S. (2020) | Automatic Structure Synthesis for 3D Woven Relief | *ACM Transactions on Graphics* 39(4), 102 (SIGGRAPH 2020) | https://doi.org/10.1145/3386569.3392449 | **VERIFIED 2026-10-13** · ACM 记录 |
| 3 | Wu, R., Zhang, J. X., Leaf, J., Hua, X., Qu, A., Harvey, C., Holtzman, E., Ko, J., Hagan, B., James, D., Guimbretière, F., & Marschner, S. (2020) | Weavecraft: An Interactive Design and Simulation Tool for 3D Weaving | *ACM Transactions on Graphics* 39(6), 210 | https://doi.org/10.1145/3414685.3417865 | **VERIFIED 2026-10-13** · ACM 记录 + Cornell 项目页 |
| 4 | Muslimin, R. (2010) | Interweaving Grammar: Reconfiguring Vernacular Structure through Parametric Shape Grammar | *International Journal of Architectural Computing* 8(2), 93–109 | https://doi.org/10.1260/1478-0771.8.2.93 | **VERIFIED 2026-10-13** · SAGE 期刊页（2010-09-01） |
| 5 | Wang, S., Zhang, Y., Liu, Y., Zheng, Y., Shrestha, N., Shi, B., Zhuo, X., & Yuan, P. F. (2025) | Digital Bamboo Weaving: A study on bamboo pavilion based on generative design and robotic fabrication | CAADRIA 2025 | https://papers.cumincad.org/data/works/att/caadria2025_357.pdf | **VERIFIED 2026-10-13** · CUMINCAD 全文 PDF |

`[CORRECTION]` 学生原稿把第 1 项写成 “Julian Panetta et al.”。出版页第一作者是 **Yingying Ren**；Panetta 是第二作者。下文按出版页引用。

### 1 · Ren, Panetta et al., 2021 — 3D Weaving with Curved Ribbons

**它做了什么。** 把任意光滑自由曲面的逆向编织，写成弯曲弹性条带的平面几何优化：多阶段求解器让交织装配在平衡态逼近目标曲面。ACM 摘要写明：传统篮编用最初是直的柔性条带；他们改用优化过的弯曲条带。有实体原型。制造路径是激光切割二维展开，再手工编织组装。

**它没有做什么。** 不处理与预设闭合刚性边框的自适应融合；边界是开放的，或靠外部夹具。计算是离线多阶段优化，不是浏览器里给非专业用户的实时生成。输出不是带悬垂约束的硬质 3D 打印水密网格。

**本项目加上什么。** 学生文档的规避策略：放弃“基于物理力学的形态生成”，改走“基于数字制造几何约束（最小支撑容差、悬垂角）的快速刚性几何相交与生成”；条带端点必须进入海棠边框。

### 2 · Wu et al., 2020 — Automatic Structure Synthesis for 3D Woven Relief

**它做了什么。** 把任意高度场变成提花织机可织的多层 3D 织物：沿相交平行平面切片，计算经纬纱路径，在切片内处理跳线，用织机布边折返保证连续。实体用聚酯纱在 Jacquard 织机上织出。

**它没有做什么。** 输出是细柔性纱线，不是有宽度的刚性条带。折返依附织机固有的矩形布边，不能自适应海棠形这类非凸刚性框的切割与锚固。

**本项目加上什么。** 学生文档：把准星转到“任意非凸闭合刚性边界下的交点精确计算、动态修剪与刚性锚定”。

### 3 · Wu et al., 2020 — Weavecraft

**它做了什么。** 面向多层 3D 编织的交互设计与仿真工具。用“编织块”和堆栈阵列让用户拼贴多层结构，弹簧–质点仿真在交互速率下预览几何并暴露缺陷。有成形性用户研究。项目页：https://www.cs.cornell.edu/projects/weavecraft/

**它没有做什么。** 周期性平铺，不处理与外部刚性框架的物理闭合。停在设计和仿真，没有把织物变成带整体边框、可自支撑的 3D 打印产品管线，也没有打印间隙 / 悬垂检测。

**本项目加上什么。** 学生文档：强调“面向特定数字制造的端到端产品级生成系统”，输出可直接进切片软件的水密网格。

### 4 · Muslimin, 2010 — Interweaving Grammar

**它做了什么。** 用参数化形状语法把传统交织工艺转成可生成的规则：荷载分布、模块平移旋转、用手可拿的刚性局部材料。SAGE 摘要：可在点、线、面三种空间维度上生成装饰–结构构件。

**它没有做什么。** 离散短模块搭接，不保证全局单线连续，也不处理任意闭合非凸边界。不输出 3D 打印文件。

**本项目加上什么。** 学生文档：摒弃形状语法模块拼接，改用“全局参数化方程映射与边界相交动态计算”的连续线段生成。因此**不能**再把“把竹编转成参数化规则”写成贡献——这一步 2010 年已经做过。

### 5 · Wang et al., 2025 — Digital Bamboo Weaving

**它做了什么。** 生成式设计 + 机器人建造的竹亭：AI 性能设计、ABB IRB4600、定制末端执行器、人机现场调整。CUMINCAD 全文确认作者为 Wang, Zhang, Liu, Zheng, Shrestha, Shi, Zhuo, Yuan。关键词是竹亭、机器人建造、现场施工。

**它没有做什么。** 建筑尺度、天然长竹条、工业机械臂。不解决手持团扇里密编单线与固定边框的微观融合，也没有面向非专业用户的 Web 生成器。

**本项目加上什么。** 学生文档：在引言里把尺度写成 Personal Fabrication / end-user tool，与建筑机器人竹编分开。

---

## 一句话研究缺口

> 现有计算编织系统缺乏面向非凸封闭边界的几何锚定算法，无法在非专业交互界面中实时生成无碎线、具真实 Z 轴起伏且严格匹配 3D 打印微观制造约束的单线连续竹编结构。

（学生文档第 7 节原文。第 16 节有一版更长的同义句，意思相同。）

**这条缺口在五项都打开之前是暂定的。** 2026-10-13 打开这五项之后，缺口仍然站得住：没有一项同时做（1）任意非凸闭合硬边界上的端点锚定、（2）给非专家的实时界面、（3）面向桌面 3D 打印的间隙 / 悬垂约束。它仍是**论证中的缺口**，不是已经用打印失败样本证明过的缺口——实体打印还没做。

---

## 文献检索之后，项目改了什么

来自学生文档第 11 节，对照 2026-10-13 本机 `HAITANG WEAVE LAB`（http://127.0.0.1:5173）的阶段记录：

1. **废弃全屏铺网再布尔裁剪。** 改为求每根母线与闭合外框的交点，丢掉短碎线，把合法端点嵌入边框。实验室阶段记录写的是：外轮廓来自源扇面投影，编织在保护轮廓之内。到 11 月必须能拿出“普通裁剪产生悬空断头 / 本方法端点嵌入边框”的并排图，否则审稿人会把方法说成 Pipe + Boolean Trim。
2. **把 3D 打印约束写进生成，而不是事后检查。** 文档要求：交点处压一挑一、打印间隙、悬垂角；滑块越界要报警。阶段记录：当前编织是 **2.5D 厚度场**，默认停在源模型 **2 mm** 外包络；超过 2 mm 必须用户勾选，最高 2.8 mm。数字网格检查有了，**切片和实体打印都还没有**。
3. **删掉材料拟真。** 文档明确：这是工艺拓扑的几何转译（压一挑一、视觉连续），不是竹材杨氏模量仿真。项目叙述按这条改。
4. **不要把 6–10 人可用性测试写成这学期的贡献。** 文档第 10 节建议做 Likert 实验。课程把 **empirical** 对本学期关闭（伦理与被试来不及）。11 月的证据是：参数系列、切片记录、成功 / 失败打印。用户研究留给以后的论文。
5. **海棠形是案例，不是算法的全部。** 文档第 10 节审稿人问题 3：若算法只硬编码海棠坐标，就没有普遍性。论述时把核心说成“任意二维闭合多边形 / 样条边界”；海棠扇是完整性案例。

---

## 贡献类型（由缺口推出，学生文档第 9 节已选）

**Method。** 文档原话：主要贡献是“面向任意非凸封闭边界的连续参数化编织图谱几何生成方法”。辅助贡献是 Web 系统 + 实体打印验证。文档明确**不要**声称 Existence proof（3D 打印织物和参数化竹编的物理存在性已被证明），也**不要**声称 Critical / speculative。

课程对照：Method 的证据是“陌生人能跟着做的过程 + 为什么优于显而易见的替代（布尔裁剪）”。Annotated portfolio 可以后来补：同一规则下多组极限参数的打印系列。Empirical 本学期不做。

---

## 形式，然后是会议

学生文档第 12 节：**优先 Full Paper**；若算法深度不够而视觉与造物更强，再改 Pictorial。Method 更贴 Full Paper。Pictorial 仍可作为同一会议的备选形式，不另开一条工作。

| 角色 | 会议 · 轨道 | 截稿 | 官方页 | 状态 |
|---|---|---|---|---|
| **主投** | ACM DIS 2027 · Papers（备选同一会议 Pictorials） | 标题摘要 2027-01-11 AoE；全文 2027-01-18 AoE | https://dis.acm.org/2027/call-for-papers/ · https://dis.acm.org/2027/pictorials/ | **VERIFIED 2026-10-13** 官方页 |
| **备份** | ACM C&C 2027 · Papers（备选 Pictorials） | 摘要 2027-01-19 AoE；全文 2027-01-25 AoE | https://cc.acm.org/2027/submit/papers · https://cc.acm.org/2027/submit/pictorials | **VERIFIED 2026-10-13** 官方页 |
| 学生原稿备份 | ACM TEI 2027 · Arts and Performances | **2026-10-26 AoE**（不是原稿写的 2027-01-25） | https://tei.acm.org/2027/cfp-arts-performances.html | **VERIFIED 2026-10-13** · **不采用**：课程禁止以物件本身为投稿的 artwork track；且截稿在课程结束前，来不及把造物做完。TEI Papers / Pictorials 已于 2026-08-06 截止。课程 briefing（2026-10-06）写：瞄准 TEI 2028。 |

学生原稿把 SIGGRAPH 2027 Technical Papers 列为第三候选，日期来自第三方日历。课程规则：在打开官方征稿之前标 `[UNVERIFIED]`。SIGGRAPH 更要求底层几何突破，学生文档自己的匹配分是 6.5/10。不列入本学期主备。

详细约束见 `my_work/venue/dis-2027.md` 与 `my_work/venue/cc-2027.md`。

---

## 当前造物与机器（文献缺口要靠它成立）

- **物件：** 一把可参数重算扇面纹样的海棠形刚性手扇（不是折扇），导出 STL / 3MF / GLB。默认约 180 mm 高、114 mm 宽、2.6 mm 厚，可平放 220×220 mm 热床。
- **系统：** HAITANG WEAVE LAB，本机 http://127.0.0.1:5173 （2026-10-13 本机探测 HTTP 200，页面标题含 HAITANG WEAVE LAB）。
- **机器：** 澳门大学设计学院 **DZ 13-103** 3D Printing & Laser Cutting Workshop。细密交织优先 **resin（Formlabs SLA + Wash & Cure）**；快速迭代用 **FDM P2S**。预约：FDS Booking System，09:00–12:00 与 14:00–18:00，最短一小时。管理员 Xin Liu。**预约尚未做。**
- **截至 2026-10-13：** 有参数化网格与数字流形检查；**没有切片，没有实体打印。** 没有打印，方法相对布尔裁剪的优势就还只是主张。

平面与旋转菱纹导出图已收入 `my_work/process_journal/2026-10-13_haitang-*.png`。

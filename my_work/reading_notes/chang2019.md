---
title: "CoFabs: An Interactive Fabrication Process Framework"
authors: "Teng-Wen Chang, Chi-Fu Hsiao, Chun-Yen Chen, Hsin-Yi Huang"
year: 2019
venue: "Proceedings of the 2019 DigitalFUTURES (CDRF 2019), Springer"
venue_type: "conference"
doi_or_url: "https://doi.org/10.1007/978-981-15-6568-7_17"
verified: true
stream: "personal"
topic_tags: ["digital-fabrication", "mixed-reality", "CoFabs"]
subconversation: ""
relevance: "adjacent"
date_read: 2026-11-22
---

# CoFabs: An Interactive Fabrication Process Framework

出版页核验：Springer 章节 *CoFabs: An Interactive Fabrication Process Framework*，DOI [10.1007/978-981-15-6568-7_17](https://doi.org/10.1007/978-981-15-6568-7_17)。作者全名按出版记录：Teng-Wen Chang, Chi-Fu Hsiao, Chun-Yen Chen, Hsin-Yi Huang。会议为 2019 DigitalFUTURES / CDRF 2019（上海）。笔记中的页码 272–291 按你读到的印本保留。同会议另有一篇 *Developing an Interactive Fabrication Process of Maker Based on “Seeing-Moving-Seeing” Model*（约 pp. 312–321）；正文判断仍是提交时的原文，不改写。

## 1 · Why this paper

我关注数字建造（digital fabrication）中「设计—制造」环节被割裂的问题：设计师完成数字建模后，必须把图纸交给制造单位，经历咨询、等待、加工、调整的长周期，才能看到实体原型。我尤其感兴趣的是，机器人臂作为一种同时整合虚拟计算与物理制造的设备，如何降低其使用门槛，使设计意图能在制造过程中被实时修改。这篇论文提出的「seeing-moving-seeing」设计模型与 CoFabs 系统框架，正是针对「如何缩短原型制作周期、让设计师在制造过程中持续参与观察与调整」这一问题，契合我对人机协作式数字建造工作流的研究兴趣。

## 2 · Summary

该论文解决的核心问题是：在创客（maker）实践中，设计者与自身产品之间往往存在割裂——数字模拟之后必须将图纸移交制造单位，原型的咨询、等待、制造与调整阶段耗时漫长；同时机器人臂虽具备实时控制、与真实世界对应、可重复、可编程等优势，但其学习门槛很高，创客难以介入数字制造过程。

论文的主要贡献包括：

1. **引入「seeing-moving-seeing」设计模型。** 将 Schön 与 Wiggins（1992）提出的设计认知模型引入数字制造流程，强调设计是「设计师与设计媒体之间的对话过程」，通过观察（seeing）—动作（moving）—再观察（seeing）的循环，使设计师能直观看到自身手势的结果并即时修正想法。
2. **提出 CoFabs（Co-existing Fabrication System）系统框架。** 构建一个虚拟与真实空间共存（co-existing）的交互式制造系统。该框架包含三个方面——人的特征（human features）、数字流（digital stream）、物理实体（physical entity），三者之间通过控制（control）、通信（communication）与计算（computation）三个要素相互交织。
3. **以 MR 界面降低机器人臂操作门槛。** 采用 Microsoft HoloLens 作为混合现实（MR）界面设备，让用户以手势在真实空间中规划切割路径、实时查看制造进度，通过沉浸式视觉界面与实时反馈简化解算系统与用户的沟通。
4. **通过机器人热丝切割（RHWC）实验验证。** 以 ABB IRB2600 机器人臂配合 HoloLens，制作「Fab Car」的构件，验证了虚拟与真实整合的实时制造流程，并观察到设计师角色在过程中被重新定义——不再需要等待成品出现才能判断可行性。

技术创新点：将 CoFabs 系统分为三层——HoloLens 作为 UI 界面、计算机服务器（MySQL 数据库）负责机器人臂 G-code 生成、以及通过 UDP/IP 通信与 Grasshopper 的 C# 脚本从数据库中下载 JSON 格式数据（包含几何数据、行为变量及机器人臂与 HoloLens UI 之间的重映射参数），最终借助 Taco ABB Rhino/Grasshopper 插件将模型边缘点转换为机器人臂的运动路径。

相比前人工作的进步：论文指出，在数字制造方法中，设计师常通过 CAD/CAM 设计虚拟模型再交由机器执行，但虚拟表征与对应实体在制造过程中是分离的。CoFabs 通过嵌入计算机、网络监控与控制机制建立反馈系统，使虚拟空间与现实之间呈现递归、重复与共存的特征。

## 3 · Critical thinking

**「seeing-moving-seeing」模型的适用范围未充分界定。** 该模型源自 Schön 与 Wiggins 针对手工设计与草图绘制的认知研究（原文发表于 *Design Studies*），其核心是设计师通过绘制草图来「看见」并反思自己的想法。论文将其直接迁移到机器人臂数字制造场景，但并未论证这一迁移的有效性——手工草图中的即时视觉反馈与机器人臂切割泡沫之间，在反馈延迟、可逆性、修改成本上存在本质差异，论文对此缺乏讨论。

**技术验证与理论宣称之间存在落差。** 论文以「Fab Car」构件制作作为实验，但实验过程描述较简略，且主要停留在可行性演示层面。论文未提供制造精度、效率提升幅度、用户操作难易度等定量评估数据，因此「降低门槛」「缩短周期」等核心宣称缺乏量化支撑。

**实验中出现的问题暴露设计缺陷。** 论文自述装配阶段未考虑机构（mechanism），导致机构与模型相互碰撞，最后需要用工具手工挖除部分设计机构才能使模型安装到位。作者由此承认「设计阶段应加入部分机构设计进行模拟」。这本是一个重要的方法论教训，但论文并未将其上升为提高流程可靠性的系统性建议。

**对「共存空间」的描述偏概念化。** 论文多次强调虚拟与真实空间的「共存」「递归」「震荡」，但缺乏对交互时序、数据同步精度、延迟与错位等工程问题的分析，这类概念表述更像是设计话语而非可验证的技术主张。

## 4 · Creative thinking

**把「seeing」的可逆性作为设计变量。** 如果将热丝切割（不可逆的材料去除）替换为增材制造或可重复擦写的材料（如可重构模块），「seeing-moving-seeing」循环的试错成本将大幅降低，模型的价值反而更能体现。这是一个值得探索的后续方向。

**用 MR 记录设计过程本身作为数据。** 论文提到通过 HoloLens 观察制造进度，但未记录设计师在过程中的手势与决策序列。若把这些交互轨迹作为设计过程数据采集，可用于分析「何时设计师改变了主意」，为设计认知研究提供实证材料。

**跨领域联系——与曲面制造 / 测量论文的互补。** 本文关注的「在物理空间中即时看到并修正制造结果」，与前两份文献（FPP 曲面多维信息感知、曲面半编织蒙皮路径规划）构成一条完整链条——规划曲面路径（第二篇）→ 精确制造 → 用 FPP 实时测量形貌与形变（第一篇）→ 通过 MR 界面即时反馈并修正（本篇）。CoFabs 的实时反馈机制若接入 FPP 测量结果，可形成「制造—测量—反馈—修正」的闭环。

**门槛降低的另一面。** 论文以「降低技术门槛」为目标，但当手势即可驱动机器人臂时，安全边界的划分与责任归属（是设计师还是系统）也成为新的问题，这超出了论文的讨论范围，但值得延伸思考。

## 5 · Form — read it as a genre, not just as content

- **Length**, excluding references: 约 20 页（正文页码 272–291，含参考文献）。
- **Section proportions** (rough % per section):
  - Abstract: ~2%
  - Introduction（含 1.1–1.2 两个子节）: ~13%
  - Related Work（含 2.1–2.4，为文献综述主体）: ~35%
  - Materials and Methods（含用户旅程图与系统架构）: ~20%
  - The Experiment: ~10%
  - Discussion: ~10%
  - Conclusion: ~5%
- **Where does the contribution claim first appear?** Introduction 倒数第二段，以 "After describing the 'seeing-moving-seeing' model, we propose the implementation of a Co-existing Fabrication System (CoFabs) to support an interactive process for makers..." 引出贡献声明。
- **The contribution sentence, verbatim:** "After describing the 'seeing-moving-seeing' model, we propose the implementation of a Co-existing Fabrication System (CoFabs) to support an interactive process for makers that allows for real-time modification and manufacturing in the design sequence." (p. 273)
- **Artifact description vs. analysis:** 文献综述与概念描述占据主导，而实验与结果分析相对简略。论文用大量篇幅（第 2 节）梳理制造流程、原型分类、机器人臂应用、MR/AR 技术等背景，第 4 节实验部分则以流程叙述和照片展示为主，缺乏定量分析与系统性评估。这符合会议论文「重概念框架与演示、轻严谨验证」的特点。
- **What does related work do:** 以「分层铺陈 + 概念引入」为主。论文并非围绕某一技术缺口逐一列举前人方法，而是按「人（技术门槛）—数字（界面）—物理（机器人臂）—总结」四个层面展开综述，最后在 2.4 节收束到「因此选用 HoloLens 作为 MR 界面设备」，带有为自身技术选型做铺垫的论证意图。
- **How is process evidenced?** 主要通过流程图与实物照片。论文提供了系统图（Fig. 1 三方面关系图、Fig. 11 系统架构图）、流程图（Fig. 9 系统流程、Fig. 10 用户旅程图）、以及制造过程与成品的照片（Fig. 12–17）。证据形式以过程展示为主，缺乏测量数据。
- **Figures:** 至少 17 张图（Fig. 1–17），无表格。图多为系统关系图、技术设备照片（Fig. 6 HoloLens Skype 场景）、制造过程照（Fig. 3 机器人臂 3D 打印、Fig. 4 热丝切割）、建模界面（Fig. 7 空间建模）与实验结果（Fig. 15 切割构件模拟与成品、Fig. 16 装配模拟）。Fig. 9、Fig. 10、Fig. 11 是理解系统运作的核心图。
- **First person or passive? Present or past tense?** 方法描述多用被动语态与过去时（如 "was used", "were conducted", "was implemented"），实验叙述部分混用第一人称复数（如 "we manufactured", "we observed"），体现作者作为参与式观察者介入研究过程的身份。
- **Limitations — present? How much space?** 未设专门的局限性讨论章节。论文在实验叙述中顺带承认了装配阶段机构碰撞、需手工修补的问题，并在未来改进方向（金属打印）中提及扩展意图，但未系统梳理框架在同步延迟、多材料适用性、安全与用户门槛等方面的局限。

## 6 · Venue signal

该论文收录于 *Proceedings of the 2019 DigitalFUTURES* (CDRF 2019)（Springer 出版），这是一个以数字建造、计算性设计与机器人制造为主题的会议论文集。这表明该平台重视概念框架的新颖性、设计方法论的创新与技术原型的演示说服力，而对严格的定量实验与统计学验证要求较低。论文「提出模型—搭建系统—演示案例」的结构，以及大量使用设计话语（如「共存空间」「看—动—看」）的表述方式，正符合这类建筑 / 设计计算领域的发表惯例。

## 7 · Take-home

- **个人收获。** 我了解到设计认知理论中的「seeing-moving-seeing」模型可以作为一种组织数字制造工作流的框架，其核心价值在于把「观察」重新放回制造过程中，而不再让设计止步于图纸交付。这对我理解人机协作式设计流程很有启发。
- **新知识。** 论文中「共存空间表征」（coexisting space representation）的概念，以及用 MR 界面作为「中介」来弥合虚拟模型与物理实体之间分离的具体实现路径（HoloLens + UDP/IP 通信 + MySQL 数据库 + Grasshopper/Taco ABB 生成 G-code），让我对 MR 与机器人臂的集成方式有了具体认识。
- **如何应用。** CoFabs 的系统架构分层思路（界面层—数据层—执行层）可以借鉴到我自己的原型系统设计中；尤其「用数据库作为虚拟与真实之间共享状态的中转站」这一做法，简单但有效。此外，用户旅程图（Fig. 10）作为一种分析操作流程瓶颈的工具，也很实用。
- **写作模仿。** 论文的文献综述采用「人—数字—物理」三维度分层的组织方式值得学习，读起来结构清晰。但它缺乏专门的 Limitations 章节，且核心宣称（降低门槛、缩短周期）没有量化证据，这是明显的短板——若我撰写同类论文，应在演示案例之外补充基本的效率与用户体验度量。
- **其他。** 论文的实验停留在单一案例（Fab Car 构件）的可行性演示，且过程中出现了因未预先模拟机构而导致碰撞的问题。这提醒我，「实时修改」的优势需要建立在「关键约束已被纳入模拟」的前提之上，否则实时性反而可能放大设计缺陷。

## 8 · Quotable

> "In order to allow the products to present the maker's ideas properly, CoFabs integrates digital and entity information with embedded computer, network monitoring, and control mechanisms to establish a feedback system. The cycle of this system appears as a recursive, repetitive, and coexisting feature between virtual space and reality." (p. 274)

准确概括了 CoFabs 的核心机制，是阐述系统设计动机的理想引文。

> "When the user acquired more powerful customized tools with an easy-to-operate interface, the designer no longer had to wait for his/her creation to emerge in the final form to determine whether it was feasible, since the results of the creation took effect earlier than expected." (p. 288)

点明了系统对设计师角色的重新定义，可用于说明「实时反馈」带来的工作方式变化。

> "The mechanism was not considered during assembly, which caused the mechanism and the model to collide with each other. ... Therefore, in the design phase, part of the mechanism design should be added for simulation to avoid any conflict between the model and the organization." (p. 288)

文中难得的一处自我反思，可作为讨论「实时制造流程的约束前提」时的直接证据。

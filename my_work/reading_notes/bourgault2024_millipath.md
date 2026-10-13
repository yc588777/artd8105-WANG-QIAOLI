---
title: "Millipath: Bridging Materialist Theory and System Development for Surface Texture Fabrication"
authors: "Samuelle Bourgault and Jennifer Jacobs"
year: 2024
venue: "ACM DIS 2024"
venue_type: "conference"
doi_or_url: "https://doi.org/10.1145/3643834.3661599"
verified: true
stream: "personal"
topic_tags: ["digital-craft", "DIS", "fabrication-system", "method"]
subconversation: ""
relevance: "core"
date_read: 2026-10-13
---

# Millipath: Bridging Materialist Theory and System Development for Surface Texture Fabrication

主投会议 DIS 的近年 Papers。全文来自 NSF 公开 PDF：https://par.nsf.gov/servlets/purl/10565482 （与 DOI 一致）。开会于 Copenhagen，session 名 “Digital Crafting and Computational Affordances”。

## 1 · Why this paper

选它，是因为它和海棠经纬是同一类 DIS 论文：不是纯理论，也不是只交一件工艺品，而是**把一台机器的动作写成可调系统**，再用做出来的物件说话。CNC 纹理对海棠扇，正如刀具路径对编织生成。

（这一节是你的判断。若你选这篇是因为 session 名字里有 Digital Crafting，也可以把那句留下。）

## 2 · Summary

- **What does this paper talk about?** 数字制造研究里，设计理论（物质主义、去人类中心）和系统开发常常各走各的。作者用 Dalsgaard & Dindler 的 **bridging concept**，把 **action**（工具与材料相遇的那一下）当成理论通往系统功能的桥。案例是木上 CNC 雕纹理。
- **What are its main contributions?** 引言末尾四条，原文见第 8 节。方法论；纹理设计空间（movement / grid / boundary）；系统 Millipath；用系统做物件时的自传式分析。
- **What problem does it address, and why is that problem important?** 若不把理论写进系统功能，数字制造工具就仍按“人完全主导、材料等待被形塑”来做。作者认为可持续、能保住技艺的工具需要另一套交互。
- **What is the innovation in the proposed solution, and what are its key benefits?** Millipath 让人编的是**刀具动作**（p5.js 工具路径 → OpenSBP），不是先做一个完成体再切片。动作在网格上重复，受边界约束。好处是：能响应材料行为，而不是只输出一个与机床无关的网格。
- **How does it advance the state of the art?** 先前 HCI 里，物质主义多用于民族志或探针；木工系统多用于榫卯和装配。表面纹理和“把 action 写成系统原语”是他们补的那一块。

## 3 · Critical thinking

作者承认证据是自传式制作，不是对照实验。DIS 收了它，说明本学期用打印系列当证据是对齐的。他们没承认的是：四条贡献里，(1) 方法论和 (3) 系统几乎是同一件事的两次命名——系统原语就叫 action，理论桥也叫 action。读完设计空间那一节，我仍分不清物质主义删掉了哪一个本会做进系统的功能。若把 Barad / Ingold 全部拿掉，movement–grid–boundary 大概还在。这是修辞性的桥，还是真约束，论文没有用一个“没有这个理论就不会有的功能”来证明。

Boundary 被写成“动作在其中重复的轮廓”。对一块矩形或简单外板，切断即可。海棠扇的瓣边是非凸硬框，切断就是碎线。Millipath 没有处理“轮廓把动作剪断之后，端点如何重新长回去”。这不是他们的任务，但它让我看清自己的缺口不是又一个纹理工具，而是边界被剪断之后怎么办。

## 4 · Creative thinking

他们的 triad 可以直接改写成编织：movement = 压挑起伏，grid = 经纬间距，boundary = 海棠框。若 triad 在减材雕纹和增材交织里都能用，它就接近课程说的 intermediate-level concept。我这学期不把贡献类型改成这个，只把它当方法叙述的架子。

他们编的是机床动作，我编的是可打印网格。DIS 的这篇更奖励“人–机–材在动作上相遇”。若我的论文只展示漂亮扇面，不展示打印头过不去的悬垂和间隙，审稿人会把它看成图形学移植，而不是 DIS 的系统论文。方法章节要写打印约束，而不是只写纹样公式。

## 5 · Form — read it as a genre, not just as content

- **Length**, excluding references: ACM 会议 PDF **19 页**（全文含附录三角形刀尖研究）。未做精确词数；session 10 若要填 venue 文件的比例表，再数一遍。
- **Section proportions** (rough, by structure not words): 1 Introduction（含四条贡献）→ 2 Background（理论、craft HCI、木工系统）→ 设计空间（movement / grid / boundary）→ 系统 Millipath → 用系统做的样品与三件成品 → 讨论自传数据 → 结论。附录是刀尖几何。
- **Where does the contribution claim first appear?** Paragraph number: 引言最后，编号列表 (1)–(4)。摘要里已经预告系统名和 RtD。
- **The contribution sentence, verbatim:** 见第 8 节完整四条。
- **Artifact description vs. analysis** — which gets more space? 系统界面、刀路、物件照片占大量图（PDF 中 23 个 figure）。分析是对制作过程的自传式讨论，不是用户实验表格。图在做证明，不只是装饰。
- **What does related work do** — list, or build a gap? **建缺口**：理论轨 vs 系统轨；木工 HCI 重榫卯、轻表面纹理。
- **How is process evidenced?** 自传式制作记录、样品、三件成品（托盘、陶杯、凳）、刀路与界面截图。
- **Figures:** 23。混合：概念图、界面、设计空间、物件照片、刀路几何。Figure 1 是论文的视觉摘要。
- **First person or passive? Present or past tense?** “We contribute / we follow / we used Millipath” — 第一人称、过去与现在混用，做的过程用过去。
- **Limitations — present? How much space?** 有讨论限制（自传方法、材料范围等）；不是一笔带过的 “future work” 句。精确篇幅 session 10 再量。

## 6 · Venue signal

DIS Papers 会收：真系统、真物件、把 HCI 含义写清楚的方法论文；自传式制作可以当数据。它看起来不要求开题时就有用户实验。海棠经纬若没有打印件、没有与布尔裁剪的对照图，就还低于这篇的证据密度。主题词 “sensuous knowing” 也要求材料是被做出来的，不是被渲染出来的。

## 7 · Take-home

贡献在引言末尾编号列出，答辩可以三条，但要同样干净。结构可模仿：先钉缺口，再给一个可操作的方法原语，再给系统和物件，最后回头说这个原语有没有改变做的过程。对我而言，那个原语应是“边界锚定”，不是“竹编文化”。

## 8 · Quotable

> “We focus on action as a bridging concept between abstract notions regarding human-machine-material relationships and concrete digital fabrication system features.” (Abstract)

> “We contribute: (1) A methodology that supports the implementation of materialist theories in system development, using action as a bridging concept. (2) A design space for carved and CNC-milled surface texture highlighting a set of inherent components – movement, grid, and boundary … (3) Millipath, a novel action-oriented system … (4) An analysis of autobiographical data collected during the creation of artifacts with Millipath …” (Introduction)

> 设计空间三元件：movement repeated across a grid within a specified boundary.（转述自引言对 carving action 的三条 articulations）

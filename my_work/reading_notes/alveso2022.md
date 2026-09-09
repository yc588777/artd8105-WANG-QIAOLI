---
title: "FLEXI: A Robust and Flexible Social Robot Embodiment Kit"
authors: "Patrícia Alves-Oliveira, Matthew Bavier, Samrudha Malandkar, Ryan Eldridge, Julie Sayigh, Elin A. Björling, Maya Cakmak"
year: 2022
venue: "ACM DIS 2022 — Designing Interactive Systems"
venue_type: "conference"
doi_or_url: "https://doi.org/10.1145/3532106.3534556"
verified: true
stream: "personal"
topic_tags: []
subconversation: ""
relevance: "core"
date_read:
---

# FLEXI: A Robust and Flexible Social Robot Embodiment Kit

手写笔记原件（Session 2，手写，第 2 节）：`alveso2022_handwritten_s2.jpg`

## 1 · Why this paper

我正在做的一项研究涉及 AI 机器人外观设计。这篇论文谈社交机器人的可定制外观与硬件套件，和这个方向直接相关。

## 2 · Summary

手写原件转录 / transcribed from handwritten note:

This paper presents FLEXI, a social robot embodiment kit entirely designed and developed from scratch by the University of Washington research team. The core motivation is to address the high cost, rigidity, and lack of hardware customization in existing social robot platforms. Through user interviews, the team identified three key "pain points" — Cost, Rigidity, and Specificity — and translated them into the design principles of Affordability, Customizability, and Flexibility.

FLEXI's innovative architecture separates a "robust robot core" from "customizable attachment parts." The core includes a 4-DOF neck-and-base mechanism, a smartphone for facial expressions, and a tablet for interaction. Attachments can be made from common materials like cardboard, foam, or 3D-printed parts, allowing users to radically alter the robot's appearance and function.

The software is an open-source, browser-based end-user programming interface that supports content creation, direct Wizard-of-Oz control, and autonomous behavior. The paper demonstrates FLEXI's adaptability and usability through three soft deployment case studies in community support, mental health, and education. Crucially, the team provides the complete open-source bill of materials and fabrication instructions. This work offers researchers and enthusiasts a low-cost, highly flexible, and easily reproducible social robot platform, significantly lowering the barrier to entry for social robotics R&B.

## 3 · Critical thinking

作者承认了当前版本用户感知能力有限（主要靠平板按钮交互），以及缺少与现有平台、长期 HRI 的对比。除此之外，还有几处他们没有正面讨论的局限。

**定制化的「天花板」。** FLEXI 的定制主要是「附加」而不是「重构」。核心 4-DOF 结构（底座旋转、前后倾斜、点头、面部倾斜）是固定的，因此所有由其做出的机器人，基本运动词汇和交互模式（屏幕 + 语音 + 触觉）都相似。需要行走、飞行、抓取等根本不同形态时，这套件做不到。「灵活性」只存在于核心架构划定的范围内。

**对用户「制造技能」的隐性要求。** 文中说学习曲线「低到中等」，但搭建 FLEXI 需要 3D 打印、激光切割、组装电子和走线。对没有工程背景的 HRI 研究者、教师或设计师，初始搭建仍可能是吓人的门槛。论文没有量化这个制造门槛实际挡掉了谁。

**附件设计「无指导」。** 纸板、泡沫、3D 打印都可以做附件，无限自由度也是负担。没有设计准则或案例说明材质、重量、形状如何影响电机负载、续航、重心和运动。用户可能做出「好看但不好用甚至不可用」的附件——那不一定是用户的问题。

**作者假设上的问题。** 核心假设是：高度可定制的硬件加上易用软件，就能缓解社交机器人市场失败和研究者困境。两个疑点：第一，「可定制」不等于「被定制」——用户未必愿意为硬件制造和附件设计投入时间；尤其当机器人只是用来问某个研究问题时，许多人更要开箱即用。论文里用户是被给予机器人并被指导去定制，不是自己从头选做。第二，过度定制伤害信效度：两个组都用 FLEXI 研究「外形对信任的影响」，一个用毛绒熊耳、一个用兔耳，结果很难比较。作者没有讨论这对研究严谨性的挑战。

**适用性、有效性、可扩展性。** 适用性高：三个软部署案例（社区、心理健康、教育）覆盖多种场景，成本约 2330 美元，适合预算有限的实验室和学校。有效性未充分验证：软部署主要是定性反馈，没有定量证明——例如教育场景里用 FLEXI 的儿童是否比不用或用别的机器人学得更好。可扩展性部分受限：开源文件使硬件易复制，但每个部署都是「独一无二」的，研究组之间难以横向比较和复现，妨碍它成为可推广的标准化平台。

## 4 · Creative thinking

**这激发了哪些新想法？**

- **外观作为功能接口。** FLEXI 的附件不只改外观，也改功能（如「电话保管」托盘）。能否把机身附件做成功能接口：换附件即切换核心服务，交互更物理，甚至变成一种解锁新功能的体验。
- **社区驱动的附件与行为生态。** 受开源理念和「Happy Mail」启发，可做线上平台分享 3D 附件、行为逻辑和交互脚本，形成「应用商店」和「附件集市」，价值随社区增长，而不只靠一个研究团队。

**这种方法能否用于其他问题？** 「稳健核心 + 可定制外设」可用于其他要快速适应的领域：家庭服务机器人换手臂或上半身模块；灾难救援换传感器和破拆工具。

**同一问题，能否用别的方法？** 针对「降低社交机器人研发门槛」，除硬件 DIY 外，可走软件/资产驱动的虚拟化：在高保真虚拟平台里设计外观与行为，再一键下发到少数标准化、坚固的实体机器人。把硬件定制从物理世界挪到数字世界，降低制造门槛，同时保住实验的标准化和可复现。

**还打开了哪些方向？** 开放在机器人研究里的两面性：降低门槛、促进创新，同时缺少标准化、难复现。如何在「开放定制」和「科学严谨」之间做平台和实验方法——例如为 FLEXI 设计标准测试协议或基准附件集，允许有限定制，又保证核心结果可比。

## 7 · Take-home

**个人学到什么。** 如何把用户研究（需求发现）和设计实践（概念、原型）绑在一起，做成有影响力的开源系统。「痛点–设计原则」表格把定性反馈收成可对照的技术指标和设计目标。

**有什么是新的。** 「中间层面知识」在 HRI 里的用法：故事板、概念图、案例研究本身就是知识产出，不只是最终产品的附件。探索性、设计导向的研究里，这些视觉产出可以指导下一步。「软部署」介于实验室和长期现场之间，在真实但可控的环境里快速收反馈、迭代，成本低。

**能用到自己研究里的。** 「需求研究–设计原则–概念设计–原型–软部署验证」这条循环可当项目路线图。为原型做开源物料清单和制造指南，让一次性作品变成社区能用的工具。早期用概念设计和故事板沟通，比长文更有效。

**结构上值不值得模仿。** 适合描述复杂系统如何从需求走到验证；若论文核心是展示新颖原型，这是好范本。但它「描述远多于分析」：若核心是假设检验和严格实验（例如证明 A 的治疗效果优于 B），应另找实验设计和数据分析更密的样本。

**还有。** 开源机器人平台的社会学影响：人人能造、能改，会带来设计伦理、责任归属、安全规范等问题。这篇没有深写，但给这个方向提供了一个起点和平台。

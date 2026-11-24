---
date: 2026-11-24
week: 14
step: "S14"
session_minutes:
artifacts:
  - "my_work/prints/b15_install.md"
  - "my_work/prints/haitang_a3_exhibition_board.jpg"
  - "my_work/prints/craft_drawing_diamond.jpg"
  - "my_work/prints/craft_drawing_radial.jpg"
  - "my_work/prints/craft_drawing_ripple.jpg"
  - "my_work/prints/craft_drawing_cellular.jpg"
  - "my_work/prints/haitang_print.jpg"
  - "my_work/prints/haitang_print_2.jpg"
entry_type: "constraint"
reconstructed: true
---

# B15：Web 可交互，但比本机算力慢

事后补记。布展约在 2026-11 中（安装清单署 11-17），原日未写日记，不倒填。

## What I set out to do

在学院 B15 用展板、iPad、工艺图和两把打印扇展出海棠经纬。

## What I expected to happen

iPad 打开可交互的 web 端，现场操作接近本机实验室。

## What actually happened

现场有：一张 A2 KT 展板；iPad 实时可交互 web 端能用，但效果不如本地算力，使用中有延迟。另打印了 4 张图案版块工艺图纸，让现场更丰富。两把 3D 打印实体扇。

## The gap

猜测：浏览器端和现场网络把网格计算放到远端或弱设备上，延迟是算力与链路的约束，不是图案规则失效。展览能演示「能改参数」，不能演示「和本机一样即时」。

## Numbers

- A2 KT 展板：1
- iPad：1（web 可交互，有延迟）
- 工艺图纸：4（四种图案）
- 实体扇：2
- 延迟毫秒、本机对照帧率：未测

## Alternatives I rejected, and why

没有改成只放预录视频。保留实时 web，接受延迟。补了四张图纸，不单靠屏幕。

## What this constrains going forward

论文若写「实时交互」，要分开本机与现场 web。展览证据是：能互动、有延迟、图纸和两把扇在场。

# 海棠织序 · HAITANG WEAVE LAB

> 课程仓副本。从 `C:\Users\汪俏黎\MorphogeneticSegmentedVase\haitang-weave-lab` **复制**，原工程未移动。未纳入：venv、node_modules、dist、exports、Pyodide vendor、大 STL。打印件见 `my_work/object_3d/`。

刚性海棠扇的扇面竹编可以按参数重算。这不是折扇，也不是换一张贴图。

默认导出是一整把团扇，扇面、灰边和扇柄在同一个 STL 里。默认总高 180 mm、宽约 114 mm、厚约 2.6 mm，可以平放在 220×220 mm 热床上。

外轮廓取自灰边团扇模板，再缩放到可打印尺寸。旧的分件扇面和扇柄 STL 仍留在 `assets/original/`，当前导出不再把它们拆开装配。

## 启动

Windows：

```powershell
cd haitang-weave-lab
.\start.ps1
```

- 网页：http://127.0.0.1:5173
- 接口：http://127.0.0.1:8787/api/health

网页生成网格时调用本机 Python，不需要 Cursor，也不需要一直开着 Blender MCP。Blender 用于开发期查看源模型和抽查导出件。

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

## 参数会改变什么

经纬密度、篾宽、起伏、角度、相位、对比、暗部层次、柔滑、反相、边缘宽度、最薄处和最厚处都会重算三角形。默认厚度停在原始 2 mm 外包络里。勾选允许超过 2 mm 之后，最厚处可以到 2.8 mm。

九宫格和左上自由分区只改对应区域。外轮廓来自源扇面投影，窄的角部凸起保持 2 mm 实体。约 9.2 mm 的独立小零件原样另存，不并入编织。

扇柄刻字是候选区。确认之前导出的是原始扇柄副本。

## 导出

生成后得到 STL、只含几何的 3MF、装配用 GLB、参数 JSON 和检查报告。3MF 不含切片配置。页面里的检查是数字网格检查，不是切片结果，也不是已经打印过的记录。

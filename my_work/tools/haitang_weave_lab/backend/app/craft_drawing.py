"""Craft drawing (F5): one PNG production sheet a weaver can work from.

A2 landscape at 150 dpi. Front view 1:1 with overall dimensions, a numbered
over/under view at 2:1, a 5:1 section through crossings, a frame-entry detail,
the fan's dimensions, a bill of strips by specification, a per-strip schedule
with its over/under order, weaving statistics, process notes and a title block.
"""
from __future__ import annotations

import io
import math
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DPI = 150
PX = DPI / 25.4
SHEET = (3508, 2480)
TUCK_MM = 4.0
R_MIN_MM = 15.0

INK = (28, 25, 21)
MUTED = (111, 103, 92)
LINE = (190, 178, 160)
PAPER = (253, 251, 247)
OVER = (44, 107, 102)
UNDER = (141, 59, 50)
FRAME = (186, 186, 190)
OPEN = (245, 240, 232)

TONES = (
    ("本色篾", (220, 193, 154)),
    ("白篾", (240, 232, 214)),
    ("碳化篾", (150, 110, 72)),
    ("深褐篾", (96, 68, 46)),
    ("赭紅篾", (178, 84, 60)),
    ("青篾", (110, 140, 110)),
    ("黑篾", (40, 40, 40)),
)

_FONT_CACHE: dict[tuple[int, bool], ImageFont.FreeTypeFont] = {}


def font(size: int, bold: bool = False):
    key = (size, bold)
    if key not in _FONT_CACHE:
        names = ("msjhbd.ttc", "msyhbd.ttc") if bold else ("msjh.ttc", "msyh.ttc", "NotoSansTC-VF.ttf", "simhei.ttf")
        chosen = None
        for name in names + ("msjh.ttc", "simhei.ttf"):
            path = Path("C:/Windows/Fonts") / name
            if path.exists():
                chosen = ImageFont.truetype(str(path), size)
                break
        if chosen is None:
            noto_name = "NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc"
            noto = Path("/usr/share/fonts/opentype/noto") / noto_name
            if not noto.exists():
                noto = Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
            if noto.exists():
                chosen = ImageFont.truetype(str(noto), size, index=3)
        _FONT_CACHE[key] = chosen or ImageFont.load_default()
    return _FONT_CACHE[key]


def sheet_lang(lang: str | None) -> str:
    value = (lang or "zh-Hant").strip().lower().replace("_", "-")
    if value in ("en", "english"):
        return "en"
    if value in ("zh-hans", "zh-cn", "zh", "cn", "chs"):
        return "zh-Hans"
    return "zh-Hant"


_COPY: dict[str, dict[str, str]] = {
    "zh-Hant": {
        "doc": "竹編團扇製作工藝圖",
        "brand": "海棠經緯",
        "view1": "① 正視圖  比例 1:1",
        "width_all": "總寬 {v}",
        "height_all": "總高 {v}",
        "handle": "扇柄 {v}",
        "open_h": "編織區高 {v}",
        "open_w": "編織區寬 {v}",
        "frame": "扇框",
        "rim_w": "寬 {v}",
        "rim_t": "厚 {v}",
        "unit_note": "單位：毫米 (mm)。列印時選「實際大小」，本視圖即為 1:1 樣板。",
        "detail_a": "② 詳圖 A  沿篾剖面（一上一下） 比例 5:1",
        "over_here": "此處在上",
        "under_here": "此處在下",
        "pitch": "間距 {v}",
        "section_note": "篾厚 t = {t}　交點抬升 h = {h}　篾寬 w = {w}",
        "detail_b": "③ 詳圖 B  篾端入框（下料預留） 比例 3:1",
        "embed": "嵌入至少 1.8",
        "allowance": "下料預留 {v}",
        "frame_t": "框厚 {v}",
        "strip": "篾條",
        "view4": "④ 挑壓編號圖  比例 {s}",
        "one_end": "（每根只標一端）",
        "leaders": "篾號沿四邊順序排開，引線平行不相交{extra}",
        "ends": "黑底＝起點端，白底＝終點端；圓點在對應的篾上",
        "cross_hint": "小字＝交點號；交點處連續的篾在上、斷開的在下",
        "n_strips": "竹篾總數",
        "n_strips_v": "{n} 根",
        "n_specs": "規格種類",
        "n_specs_v": "{n} 種",
        "n_cross": "交點總數",
        "n_cross_v": "{n} 個",
        "alt": "上下交替率",
        "float": "長浮（連續 {n} 次以上同側）",
        "float_v": "{n} 根",
        "cut_total": "下料總長",
        "col_item": "項目",
        "col_value": "數值",
        "head_stats": "⑤ 編織統計",
        "note1": "按材料表備料：篾寬、篾厚依規格劈篾、刮篾，下料長已含兩端各 4 mm 入框預留。",
        "note2": "編前浸水軟化；先固定扇框，再依篾號順序鋪第一組。",
        "note3": "每根篾從起點端（挑壓編號圖中的黑底篾號）按明細表「上下順序」穿編，與挑壓編號圖逐點核對。",
        "note3base": "底編只與底編挑壓；圖案篾整根在底編之上，只與另一向圖案篾挑壓。",
        "note3one": "每根篾從起點端（黑底篾號；白底篾號則從另一端起）按明細表「上下順序」穿編，與挑壓編號圖逐點核對。",
        "note4": "篾端壓入扇框槽內至少 1.8 mm，膠固後修齊。",
        "note5": "最小彎曲半徑暫定不小於 {n} mm，尚未經手藝人校準；彎得較急處先試彎。",
        "note6": "本圖由系統依當前參數自動生成，與匯出的 3D 模型為同一份設計。",
        "head_notes": "⑥ 工藝說明",
        "head_dims": "⑦ 扇體尺寸",
        "unit_mm": "單位 mm",
        "dim_overall": "總高 × 總寬",
        "dim_handle": "扇柄長",
        "dim_open": "編織區 寬 × 高",
        "dim_frame": "扇框 寬 × 厚",
        "dim_thick": "篾條厚度",
        "dim_lift": "交點抬升",
        "col_size": "尺寸",
        "head_bom": "⑧ 材料表",
        "bom_by": "按規格分組",
        "bom_spec": "規格",
        "bom_color": "顏色",
        "bom_section": "寬×厚",
        "bom_qty": "根數",
        "bom_cut": "下料長",
        "bom_total": "合計 m",
        "head_sched": "⑨ 篾條明細",
        "sched_note": "上＝在上 下＝在下，自黑底起點逐交讀",
        "sch_no": "篾號",
        "sch_spec": "規格",
        "sch_cut": "下料長",
        "sch_x": "交點",
        "sch_r": "最急彎R",
        "sch_seq": "上下順序",
        "sch_no_s": "號",
        "sch_spec_s": "規",
        "sch_cut_s": "長",
        "sch_x_s": "交",
        "footnote": "* 彎曲半徑小於暫定下限 {n} mm（未經手藝人校準），請先試彎。上下順序自黑底起點按交點依次讀完。",
        "blk_title": "圖名",
        "blk_no": "圖號",
        "blk_scale": "比例",
        "blk_by": "設計",
        "blk_date": "日期",
        "blk_unit": "單位",
        "blk_sheet": "張次",
        "blk_system": "系統",
        "straight": "直",
        "over": "上",
        "under": "下",
        "tone.natural": "本色篾",
        "tone.pale": "白篾",
        "tone.carbon": "碳化篾",
        "tone.dark": "深褐篾",
        "tone.cinnabar": "赭紅篾",
        "tone.green": "青篾",
        "tone.black": "黑篾",
    },
    "zh-Hans": {
        "doc": "竹编团扇制作工艺图",
        "brand": "海棠经纬",
        "view1": "① 正视图  比例 1:1",
        "width_all": "总宽 {v}",
        "height_all": "总高 {v}",
        "handle": "扇柄 {v}",
        "open_h": "编织区高 {v}",
        "open_w": "编织区宽 {v}",
        "frame": "扇框",
        "rim_w": "宽 {v}",
        "rim_t": "厚 {v}",
        "unit_note": "单位：毫米 (mm)。打印时选「实际大小」，本视图即为 1:1 样板。",
        "detail_a": "② 详图 A  沿篾剖面（一上一下） 比例 5:1",
        "over_here": "此处在上",
        "under_here": "此处在下",
        "pitch": "间距 {v}",
        "section_note": "篾厚 t = {t}　交点抬升 h = {h}　篾宽 w = {w}",
        "detail_b": "③ 详图 B  篾端入框（下料预留） 比例 3:1",
        "embed": "嵌入至少 1.8",
        "allowance": "下料预留 {v}",
        "frame_t": "框厚 {v}",
        "strip": "篾条",
        "view4": "④ 挑压编号图  比例 {s}",
        "one_end": "（每根只标一端）",
        "leaders": "篾号沿四边顺序排开，引线平行不相交{extra}",
        "ends": "黑底＝起点端，白底＝终点端；圆点在对应的篾上",
        "cross_hint": "小字＝交点号；交点处连续的篾在上、断开的在下",
        "n_strips": "竹篾总数",
        "n_strips_v": "{n} 根",
        "n_specs": "规格种类",
        "n_specs_v": "{n} 种",
        "n_cross": "交点总数",
        "n_cross_v": "{n} 个",
        "alt": "上下交替率",
        "float": "长浮（连续 {n} 次以上同侧）",
        "float_v": "{n} 根",
        "cut_total": "下料总长",
        "col_item": "项目",
        "col_value": "数值",
        "head_stats": "⑤ 编织统计",
        "note1": "按材料表备料：篾宽、篾厚依规格劈篾、刮篾，下料长已含两端各 4 mm 入框预留。",
        "note2": "编前浸水软化；先固定扇框，再依篾号顺序铺第一组。",
        "note3": "每根篾从起点端（挑压编号图中的黑底篾号）按明细表「上下顺序」穿编，与挑压编号图逐点核对。",
        "note3base": "底编只与底编挑压；图案篾整根在底编之上，只与另一向图案篾挑压。",
        "note3one": "每根篾从起点端（黑底篾号；白底篾号则从另一端起）按明细表「上下顺序」穿编，与挑压编号图逐点核对。",
        "note4": "篾端压入扇框槽内至少 1.8 mm，胶固后修齐。",
        "note5": "最小弯曲半径暂定不小于 {n} mm，尚未经手艺人校准；弯得较急处先试弯。",
        "note6": "本图由系统依当前参数自动生成，与导出的 3D 模型为同一份设计。",
        "head_notes": "⑥ 工艺说明",
        "head_dims": "⑦ 扇体尺寸",
        "unit_mm": "单位 mm",
        "dim_overall": "总高 × 总宽",
        "dim_handle": "扇柄长",
        "dim_open": "编织区 宽 × 高",
        "dim_frame": "扇框 宽 × 厚",
        "dim_thick": "篾条厚度",
        "dim_lift": "交点抬升",
        "col_size": "尺寸",
        "head_bom": "⑧ 材料表",
        "bom_by": "按规格分组",
        "bom_spec": "规格",
        "bom_color": "颜色",
        "bom_section": "宽×厚",
        "bom_qty": "根数",
        "bom_cut": "下料长",
        "bom_total": "合计 m",
        "head_sched": "⑨ 篾条明细",
        "sched_note": "上＝在上 下＝在下，自黑底起点逐交读",
        "sch_no": "篾号",
        "sch_spec": "规格",
        "sch_cut": "下料长",
        "sch_x": "交点",
        "sch_r": "最急弯R",
        "sch_seq": "上下顺序",
        "sch_no_s": "号",
        "sch_spec_s": "规",
        "sch_cut_s": "长",
        "sch_x_s": "交",
        "footnote": "* 弯曲半径小于暂定下限 {n} mm（未经手艺人校准），请先试弯。上下顺序自黑底起点按交点依次读完。",
        "blk_title": "图名",
        "blk_no": "图号",
        "blk_scale": "比例",
        "blk_by": "设计",
        "blk_date": "日期",
        "blk_unit": "单位",
        "blk_sheet": "张次",
        "blk_system": "系统",
        "straight": "直",
        "over": "上",
        "under": "下",
        "tone.natural": "本色篾",
        "tone.pale": "白篾",
        "tone.carbon": "碳化篾",
        "tone.dark": "深褐篾",
        "tone.cinnabar": "赭红篾",
        "tone.green": "青篾",
        "tone.black": "黑篾",
    },
    "en": {
        "doc": "Bamboo-fan production drawing",
        "brand": "Haitang Weave",
        "view1": "① Front view  1:1",
        "width_all": "Width {v}",
        "height_all": "Height {v}",
        "handle": "Handle {v}",
        "open_h": "Weave H {v}",
        "open_w": "Weave W {v}",
        "frame": "Frame",
        "rim_w": "W {v}",
        "rim_t": "T {v}",
        "unit_note": "Units: millimetres. Print at actual size; this view is the 1:1 template.",
        "detail_a": "② Detail A  Strip section, over then under  5:1",
        "over_here": "Over here",
        "under_here": "Under here",
        "pitch": "Pitch {v}",
        "section_note": "Thickness t = {t}    Lift h = {h}    Width w = {w}",
        "detail_b": "③ Detail B  End tucked into the frame  3:1",
        "embed": "Embed at least 1.8",
        "allowance": "Allowance {v}",
        "frame_t": "Frame T {v}",
        "strip": "Strip",
        "view4": "④ Over/under numbers  {s}",
        "one_end": " (one end only)",
        "leaders": "Numbers run around the four sides; leaders stay parallel{extra}",
        "ends": "Black = start, white = end; the dot sits on that strip",
        "cross_hint": "Small figures are crossing numbers. A continuous strip is over; a broken one is under",
        "n_strips": "Strips",
        "n_strips_v": "{n}",
        "n_specs": "Specifications",
        "n_specs_v": "{n}",
        "n_cross": "Crossings",
        "n_cross_v": "{n}",
        "alt": "Alternation",
        "float": "Long float (≥ {n} on one side)",
        "float_v": "{n}",
        "cut_total": "Total cut length",
        "col_item": "Item",
        "col_value": "Value",
        "head_stats": "⑤ Weave statistics",
        "note1": "Cut to the bill: width and thickness by spec. Length includes 4 mm of frame tuck at each end.",
        "note2": "Soak to soften. Fix the frame, then lay the first set in number order.",
        "note3": "From the black start number, weave each strip in the over/under order and check the numbered view.",
        "note3base": " Ground weave crosses only itself. Pattern strips sit above it and cross only the other pattern direction.",
        "note3one": "From the black start (or the white number, from the other end), follow the over/under order and check the numbered view.",
        "note4": "Press each end at least 1.8 mm into the frame, glue, then trim.",
        "note5": "Provisional minimum bend radius is {n} mm and is not yet calibrated. Try a tight bend first.",
        "note6": "This sheet is generated from the current parameters and matches the exported 3D model.",
        "head_notes": "⑥ Process notes",
        "head_dims": "⑦ Fan dimensions",
        "unit_mm": "mm",
        "dim_overall": "Height × width",
        "dim_handle": "Handle length",
        "dim_open": "Weave W × H",
        "dim_frame": "Frame W × T",
        "dim_thick": "Strip thickness",
        "dim_lift": "Crossing lift",
        "col_size": "mm",
        "head_bom": "⑧ Bill of materials",
        "bom_by": "By specification",
        "bom_spec": "Spec",
        "bom_color": "Colour",
        "bom_section": "W×T",
        "bom_qty": "Qty",
        "bom_cut": "Cut mm",
        "bom_total": "Total m",
        "head_sched": "⑨ Strip schedule",
        "sched_note": "O = over, U = under, from the black start",
        "sch_no": "No.",
        "sch_spec": "Spec",
        "sch_cut": "Cut",
        "sch_x": "Xing",
        "sch_r": "Min R",
        "sch_seq": "Over/under",
        "sch_no_s": "No",
        "sch_spec_s": "Sp",
        "sch_cut_s": "Cut",
        "sch_x_s": "X",
        "footnote": "* Bend radius under the provisional {n} mm limit is not yet calibrated; try it first. Read over/under from the black start.",
        "blk_title": "Title",
        "blk_no": "No.",
        "blk_scale": "Scale",
        "blk_by": "By",
        "blk_date": "Date",
        "blk_unit": "Unit",
        "blk_sheet": "Sheet",
        "blk_system": "System",
        "straight": "str",
        "over": "O",
        "under": "U",
        "tone.natural": "Natural",
        "tone.pale": "Pale",
        "tone.carbon": "Carbonised",
        "tone.dark": "Dark brown",
        "tone.cinnabar": "Cinnabar",
        "tone.green": "Green",
        "tone.black": "Black",
    },
}

_TONE_KEYS = ("natural", "pale", "carbon", "dark", "cinnabar", "green", "black")


def tr(lang: str, key: str, **values) -> str:
    pack = _COPY.get(lang) or _COPY["zh-Hant"]
    text = pack.get(key) or _COPY["zh-Hant"][key]
    return text.format(**values) if values else text


def tone_name(hex_color: str, lang: str = "zh-Hant") -> str:
    rgb = np.array([int(hex_color[i:i + 2], 16) for i in (1, 3, 5)], float)
    index = min(range(len(TONES)), key=lambda i: float(np.sum((rgb - np.array(TONES[i][1], float)) ** 2)))
    return tr(sheet_lang(lang), f"tone.{_TONE_KEYS[index]}")


def _rgb(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


class Sheet:
    def __init__(self):
        self.image = Image.new("RGB", SHEET, PAPER)
        self.draw = ImageDraw.Draw(self.image)

    def text(self, xy, value, size=22, fill=INK, bold=False, anchor="la"):
        self.draw.text(xy, str(value), font=font(size, bold), fill=fill, anchor=anchor)

    def width(self, value, size=22, bold=False) -> float:
        box = self.draw.textbbox((0, 0), str(value), font=font(size, bold))
        return box[2] - box[0]

    def fit(self, value, size, width, bold=False) -> str:
        """A label that stays inside `width` so it cannot run through a grid line."""
        text = str(value)
        if self.width(text, size, bold) <= width:
            return text
        while text and self.width(text + "…", size, bold) > width:
            text = text[:-1]
        return text + "…" if text else ""

    def arrow(self, tip, toward, size=14, fill=INK):
        tip = np.asarray(tip, float)
        direction = np.asarray(toward, float) - tip
        direction /= max(np.linalg.norm(direction), 1e-6)
        normal = np.array([-direction[1], direction[0]])
        base = tip + direction * size
        self.draw.polygon([tuple(tip), tuple(base + normal * size * 0.32), tuple(base - normal * size * 0.32)], fill=fill)

    def dim_h(self, x1, x2, y, ref_y, label, size=22):
        """Horizontal dimension at height y, extension lines from ref_y."""
        for x in (x1, x2):
            self.draw.line([(x, ref_y), (x, y + (8 if y > ref_y else -8))], fill=MUTED, width=1)
        self.draw.line([(x1, y), (x2, y)], fill=INK, width=2)
        self.arrow((x1, y), (x2, y))
        self.arrow((x2, y), (x1, y))
        w = self.width(label, size)
        self.draw.rectangle([(x1 + x2) / 2 - w / 2 - 6, y - size - 6, (x1 + x2) / 2 + w / 2 + 6, y - 4], fill=PAPER)
        self.text(((x1 + x2) / 2, y - 6), label, size, anchor="mb")

    def dim_v(self, y1, y2, x, ref_x, label, size=22):
        for y in (y1, y2):
            self.draw.line([(ref_x, y), (x + (8 if x > ref_x else -8), y)], fill=MUTED, width=1)
        self.draw.line([(x, y1), (x, y2)], fill=INK, width=2)
        self.arrow((x, y1), (x, y2))
        self.arrow((x, y2), (x, y1))
        layer = Image.new("RGBA", (int(self.width(label, size)) + 16, size + 14), PAPER + (255,))
        ImageDraw.Draw(layer).text((8, 4), label, font=font(size), fill=INK)
        layer = layer.rotate(90, expand=True)
        self.image.paste(layer, (int(x - layer.width / 2), int((y1 + y2) / 2 - layer.height / 2)), layer)

    def heading(self, x, y, label, note=""):
        self.text((x, y), label, 30, bold=True)
        if note:
            self.text((x + self.width(label, 30, True) + 16, y + 8), note, 20, MUTED)
        return y + 46

    def wrap(self, value, size, width) -> list[str]:
        """Break `value` into lines that stay inside `width`. English breaks on a space."""
        lines, line = [], ""
        for ch in str(value):
            if line and self.width(line + ch, size) > width:
                cut = line.rfind(" ")
                if cut > 0:
                    lines.append(line[:cut])
                    line = (line[cut + 1 :] + ch).lstrip()
                else:
                    lines.append(line)
                    line = ch
            else:
                line += ch
        if line:
            lines.append(line)
        return lines or [""]

    def table(self, x, y, columns, rows, row_h=34, size=21, head_fill=(240, 234, 224), row_heights=None):
        """columns: [(title, width, align)]; a cell may be ('swatch', hex) or ('wrap', [lines])."""
        heights = list(row_heights) if row_heights is not None else [row_h] * len(rows)
        total = sum(c[1] for c in columns)
        self.draw.rectangle([x, y, x + total, y + row_h], fill=head_fill)
        cx = x
        for title, width, _align in columns:
            self.text((cx + 8, y + row_h / 2), title, size, bold=True, anchor="lm")
            cx += width
        cursor = y + row_h
        for r, (row, height) in enumerate(zip(rows, heights)):
            top = cursor
            if r % 2:
                self.draw.rectangle([x, top, x + total, top + height], fill=(249, 246, 240))
            cx = x
            for (_title, width, align), cell in zip(columns, row):
                if isinstance(cell, tuple) and cell and cell[0] == "swatch":
                    self.draw.rectangle([cx + 8, top + 7, cx + 8 + min(height, row_h) - 14, top + height - 7], fill=_rgb(cell[1]), outline=MUTED)
                    if len(cell) > 2:
                        self.text((cx + row_h + 2, top + height / 2), self.fit(cell[2], size, width - row_h - 6), size, anchor="lm")
                elif isinstance(cell, tuple) and cell and cell[0] == "wrap":
                    lines = cell[1]
                    step = size + 3
                    block = len(lines) * step
                    ty = top + max(2, (height - block) / 2)
                    for i, line in enumerate(lines):
                        self.text((cx + 6, ty + i * step), line, size, anchor="lt")
                else:
                    label = self.fit(cell, size, width - 16)
                    if align == "r":
                        self.text((cx + width - 8, top + height / 2), label, size, anchor="rm")
                    else:
                        self.text((cx + 8, top + height / 2), label, size, anchor="lm")
                cx += width
            cursor += height
        bottom = cursor
        self.draw.rectangle([x, y, x + total, bottom], outline=LINE, width=2)
        cx = x
        for _title, width, _align in columns[:-1]:
            cx += width
            self.draw.line([(cx, y), (cx, bottom)], fill=LINE, width=1)
        return bottom


def tightest_bend(points_mm: np.ndarray, span_mm: float = 3.0, tuck_mm: float = 5.0) -> float | None:
    """Smallest radius of the circle through points about `span_mm` apart along the strip.

    The last `tuck_mm` at each end is pressed into the frame, not bent by hand.
    """
    if len(points_mm) < 3:
        return None
    seg = np.linalg.norm(np.diff(points_mm, axis=0), axis=1)
    arc = np.concatenate([[0.0], np.cumsum(seg)])
    if arc[-1] < (span_mm + tuck_mm) * 2:
        return None
    best = None
    for s in np.arange(span_mm + tuck_mm, arc[-1] - span_mm - tuck_mm, span_mm * 0.5):
        a, b, c = (np.array([np.interp(v, arc, points_mm[:, 0]), np.interp(v, arc, points_mm[:, 1])]) for v in (s - span_mm, s, s + span_mm))
        ab, bc, ca = np.linalg.norm(a - b), np.linalg.norm(b - c), np.linalg.norm(c - a)
        area2 = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
        if area2 < 1e-6:
            continue
        radius = ab * bc * ca / (2 * area2)
        best = radius if best is None else min(best, radius)
    return None if best is None else float(best)


def _bend_text(strand: dict, pitch: float, lang: str) -> str:
    radius = tightest_bend(np.asarray(strand["points"], np.float32) * pitch)
    if radius is None or radius > 999:
        return tr(lang, "straight")
    return f"{radius:.0f}" + ("*" if radius < R_MIN_MM else "")


def _with_sheet_colors(packed: list, strands: list[dict]) -> list:
    """The front view uses the same layer colors as the numbered view."""
    painted = []
    for row, strand in zip(packed, strands):
        rgb = np.array(_rgb(strand["color"]), np.uint8)
        painted.append((row[0], rgb, *row[2:]))
    return painted


def _sequence_text(marks: str, lang: str) -> str:
    """Every same-layer crossing, in order from the solid-filled start. Nothing is cut off."""
    return "".join(tr(lang, "over") if m == "O" else tr(lang, "under") for m in marks)


def _is_base_strand_view(strand: dict) -> bool:
    thick = float(strand.get("thick_mm") or 0)
    sign = float(strand.get("z_sign") or 0)
    return abs(thick - 0.75) < 0.05 or abs(sign + 0.35) < 0.08


def _strand_roles(strands: list[dict]) -> dict[int, tuple]:
    """Base under-weave, or a pattern family. Families split on color, then on thickness."""
    base = {s["id"] for s in strands if _is_base_strand_view(s)}
    rest = [s for s in strands if s["id"] not in base]
    colors = {s["color"] for s in rest}
    thicks = {round(float(s["thick_mm"]), 1) for s in rest}
    roles = {}
    for strand in strands:
        if strand["id"] in base:
            roles[strand["id"]] = ("base",)
        elif len(colors) >= 2:
            roles[strand["id"]] = ("weave", strand["color"])
        elif len(thicks) >= 2:
            roles[strand["id"]] = ("weave", round(float(strand["thick_mm"]), 1))
        else:
            roles[strand["id"]] = ("weave",)
    return roles


def apply_layer_colors(strands: list[dict]) -> None:
    """Keep each strip's own bamboo color. The sheet names it from that color.

    Role is recorded so a base weave can be drawn under the pattern. The color
    itself stays the one the pattern generated, the same tones as the reference sheets.
    """
    roles = _strand_roles(strands)
    for strand in strands:
        strand["role"] = "base" if roles[strand["id"]][0] == "base" else "weave"


def _specs(strands: list[dict], lang: str = "zh-Hant") -> tuple[dict, list[dict]]:
    groups: dict[tuple, list[dict]] = {}
    for s in strands:
        key = (s["color"], round(s["width_mm"], 1), round(s["thick_mm"], 1))
        groups.setdefault(key, []).append(s)
    order = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    labels = {}
    table = []
    for index, (key, items) in enumerate(order):
        code = chr(ord("A") + index) if index < 26 else f"S{index}"
        cut = [math.ceil(i["length_mm"] + 2 * TUCK_MM) for i in items]
        tone = items[0].get("layer_name") or tone_name(key[0], lang)
        table.append({"code": code, "color": key[0], "tone": tone, "width": key[1], "thick": key[2], "count": len(items),
                      "min": min(cut), "max": max(cut), "total_m": sum(cut) / 1000})
        for item in items:
            labels[item["id"]] = code
    return labels, table


def _ring(rect, offset: float) -> np.ndarray:
    """Clockwise outline of `rect` grown by `offset`, sampled about every 2 px, rounded at the corners."""
    x0, y0, x1, y1 = rect
    pieces = []

    def edge(a, b):
        n = max(2, int(math.dist(a, b) / 2))
        pieces.append(np.linspace(a, b, n, endpoint=False))

    def arc(cx, cy, a0, a1):
        n = max(2, int(abs(a1 - a0) * offset / 2))
        angles = np.linspace(a0, a1, n, endpoint=False)
        pieces.append(np.stack([cx + offset * np.cos(angles), cy + offset * np.sin(angles)], axis=1))

    edge((x0, y0 - offset), (x1, y0 - offset))
    arc(x1, y0, -math.pi / 2, 0)
    edge((x1 + offset, y0), (x1 + offset, y1))
    arc(x1, y1, 0, math.pi / 2)
    edge((x1, y1 + offset), (x0, y1 + offset))
    arc(x0, y1, math.pi / 2, math.pi)
    edge((x0 - offset, y1), (x0 - offset, y0))
    arc(x0, y0, math.pi, 1.5 * math.pi)
    return np.concatenate(pieces)


def _isotonic(values: np.ndarray) -> np.ndarray:
    blocks: list[list[float]] = []
    for v in values:
        blocks.append([float(v), 1])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            total, count = blocks.pop()
            blocks[-1][0] += total
            blocks[-1][1] += count
    return np.concatenate([np.full(int(c), s / c) for s, c in blocks])


def _segments_cross(a, b, c, d) -> bool:
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    d1, d2, d3, d4 = side(c, d, a), side(c, d, b), side(a, b, c), side(a, b, d)
    return d1 * d2 < 0 and d3 * d4 < 0


def _point_segment(p, a, b) -> float:
    p, a, b = (np.asarray(v, float) for v in (p, a, b))
    ab = b - a
    t = 0.0 if not ab.any() else float(np.clip(np.dot(p - a, ab) / np.dot(ab, ab), 0, 1))
    return float(np.linalg.norm(p - (a + t * ab)))


def _segment_distance(a, b, c, d) -> float:
    """Shortest distance between segments ab and cd."""
    a, b, c, d = (np.asarray(v, float) for v in (a, b, c, d))
    if _segments_cross(a, b, c, d):
        return 0.0
    return min(_point_segment(a, c, d), _point_segment(b, c, d), _point_segment(c, a, b), _point_segment(d, a, b))


def _space_1d(ideal: np.ndarray, gap: float, lo: float, hi: float) -> np.ndarray | None:
    """Increasing positions, at least `gap` apart, inside [lo, hi], as close to `ideal` as that allows."""
    n = len(ideal)
    if n == 0:
        return np.zeros(0)
    if (n - 1) * gap > hi - lo + 1e-3:
        return None
    if n == 1:
        return np.array([float(np.clip(ideal[0], lo, hi))])
    pos = _isotonic(np.asarray(ideal, float) - np.arange(n) * gap) + np.arange(n) * gap
    pos -= min(0.0, hi - pos[-1])
    pos += max(0.0, lo - pos[0])
    if pos[0] < lo - 1e-3 or pos[-1] > hi + 1e-3 or np.any(np.diff(pos) < gap - 1e-3):
        return None
    return pos


def place_labels(anchors, rect, centre, radius: float, offset: float | dict) -> list[dict] | None:
    """One balloon per anchor on the side it faces. The leader is a straight line.

    Balloons keep each strip's position along that side, so the line leaves the strip at
    right angles and never bends. When neighbours are closer than a balloon, later strips
    step out to the next row. Rows stay in order. None means the margin cannot hold the
    rows, two lines would cross, or a line would run into another balloon.
    """
    anchors = [np.asarray(a, float) for a in anchors]
    if not anchors:
        return []
    if isinstance(offset, dict):
        allowance = {s: float(offset[s]) for s in ("left", "right", "top", "bottom")}
    else:
        allowance = {s: float(offset) for s in ("left", "right", "top", "bottom")}
    reach = max(allowance.values())
    ring = _ring(rect, reach)
    length = float(np.linalg.norm(np.diff(np.vstack([ring, ring[:1]]), axis=0), axis=1).sum())
    if len(anchors) * (2 * radius + 6) > length * 0.95:
        return None
    x0, y0, x1, y1 = rect
    groups: dict[str, list[int]] = {"left": [], "right": [], "top": [], "bottom": []}
    for i, a in enumerate(anchors):
        groups[_side_name(a, centre)].append(i)

    row_pitch = 2 * radius + 4
    first = radius + 2
    out: list[dict] = []
    for side, idxs in groups.items():
        if not idxs:
            continue
        max_rows = int((allowance[side] - first) // row_pitch) + 1
        if max_rows < 1:
            return None
        horizontal = side in ("left", "right")
        coord = 1 if horizontal else 0
        idxs.sort(key=lambda i: (float(anchors[i][coord]), float(anchors[i][1 - coord])))
        along = [float(anchors[i][coord]) for i in idxs]
        lo, hi = (y0, y1) if horizontal else (x0, x1)
        if along[0] < lo - 1 or along[-1] > hi + 1:
            return None

        def balloon_at(anchor, row: int) -> np.ndarray:
            dist = first + row * row_pitch
            lane = float(anchor[1] if horizontal else anchor[0])
            if side == "left":
                return np.array([x0 - dist, lane], float)
            if side == "right":
                return np.array([x1 + dist, lane], float)
            if side == "top":
                return np.array([lane, y0 - dist], float)
            return np.array([lane, y1 + dist], float)

        rows: list[list[float]] = []
        assigned: list[int] = []
        centres: list[np.ndarray] = []
        clear = 2 * radius + 4
        for i, value in zip(idxs, along):
            anchor = anchors[i]
            row = None
            for k, placed in enumerate(rows):
                if value - placed[-1] < row_pitch - 0.1:
                    continue
                trial = balloon_at(anchor, k)
                if any(float(np.linalg.norm(trial - c)) < clear for c in centres):
                    continue
                row = k
                break
            if row is None:
                if len(rows) >= max_rows:
                    return None
                trial = balloon_at(anchor, len(rows))
                if any(float(np.linalg.norm(trial - c)) < clear for c in centres):
                    return None
                row = len(rows)
                rows.append([])
            rows[row].append(value)
            assigned.append(row)
            centres.append(balloon_at(anchor, row))

        def emit(rows_for: list[int]) -> list[dict]:
            items = []
            for i, row in zip(idxs, rows_for):
                anchor = anchors[i]
                dist = first + row * row_pitch
                lane = float(anchor[1] if horizontal else anchor[0])
                if side == "left":
                    elbow = np.array([x0 - 12, lane], float)
                    balloon = np.array([x0 - dist, lane], float)
                elif side == "right":
                    elbow = np.array([x1 + 12, lane], float)
                    balloon = np.array([x1 + dist, lane], float)
                elif side == "top":
                    elbow = np.array([lane, y0 - 12], float)
                    balloon = np.array([lane, y0 - dist], float)
                else:
                    elbow = np.array([lane, y1 + 12], float)
                    balloon = np.array([lane, y1 + dist], float)
                items.append({"index": int(i), "anchor": anchor, "elbow": elbow, "centre": balloon, "side": side})
            return items

        out.extend(emit(assigned))

    for i, a in enumerate(out):
        for b in out[i + 1:]:
            if np.linalg.norm(a["centre"] - b["centre"]) < 2 * radius - 0.1:
                return None
            if _segments_cross(a["anchor"], a["elbow"], b["anchor"], b["elbow"]) or \
                    _segments_cross(a["elbow"], a["centre"], b["elbow"], b["centre"]) or \
                    _segments_cross(a["anchor"], a["elbow"], b["elbow"], b["centre"]) or \
                    _segments_cross(b["anchor"], b["elbow"], a["elbow"], a["centre"]):
                return None
            if _point_segment(b["centre"], a["elbow"], a["centre"]) < radius * 0.85:
                return None
    return out


def _along(points: np.ndarray, dist_px: float, which: str) -> tuple[np.ndarray, np.ndarray, list]:
    """Point, inward tangent and the polyline from the tip, `dist_px` along `which` end."""
    pts = np.asarray(points, float)
    if which == "end":
        pts = pts[::-1]
    if len(pts) < 2:
        return pts[0], np.array([1.0, 0.0]), [pts[0]]
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    total = float(seg.sum())
    dist_px = float(np.clip(dist_px, 0.0, max(total, 0.0)))
    acc = 0.0
    trace = [pts[0]]
    for i, length in enumerate(seg):
        if acc + length >= dist_px - 1e-6 or i == len(seg) - 1:
            t = 0.0 if length < 1e-9 else float(np.clip((dist_px - acc) / length, 0.0, 1.0))
            point = pts[i] * (1 - t) + pts[i + 1] * t
            tangent = pts[i + 1] - pts[i]
            norm = float(np.linalg.norm(tangent))
            trace.append(point)
            return point, (tangent / norm if norm else np.array([1.0, 0.0])), trace
        acc += float(length)
        trace.append(pts[i + 1])
    return pts[-1], np.array([1.0, 0.0]), trace


def _side_name(point: np.ndarray, centre: np.ndarray) -> str:
    vector = np.asarray(point, float) - np.asarray(centre, float)
    if abs(vector[0]) >= abs(vector[1]):
        return "right" if vector[0] >= 0 else "left"
    return "bottom" if vector[1] >= 0 else "top"


def _rail_bounds(record: dict, pitch: float, coord: int) -> tuple[float, float]:
    """How far this end can slide along the frame side without leaving its own strip."""
    limit = 0.46 * record["width"] / pitch
    values = []
    for point, normal, _trace in record["samples"]:
        values.append(point[coord] - abs(normal[coord]) * limit)
        values.append(point[coord] + abs(normal[coord]) * limit)
    return float(min(values)), float(max(values))


def _separate_bounded(base: np.ndarray, lo: np.ndarray, hi: np.ndarray, gap: float) -> np.ndarray:
    """Push a sorted 1D sequence apart, up to `gap`, without leaving `[lo, hi]` or swapping order."""
    pos = np.clip(base.astype(float), lo, hi)
    for _ in range(len(pos) * 4):
        changed = False
        for i in range(len(pos) - 1):
            short = gap - (pos[i + 1] - pos[i])
            if short <= 1e-4:
                continue
            room_l = pos[i] - lo[i]
            room_r = hi[i + 1] - pos[i + 1]
            take = min(short, room_l + room_r)
            if take <= 1e-4:
                continue
            give_l = min(room_l, take / 2)
            give_r = min(room_r, take - give_l)
            give_l = min(room_l, take - give_r)
            pos[i] -= give_l
            pos[i + 1] += give_r
            changed = True
        if not changed:
            break
    return pos


def _place_on_strip(record: dict, target: float, coord: int, pitch: float) -> tuple[np.ndarray, list]:
    """Point on this strip's end whose frame-side coordinate is as close to `target` as the strip allows.

    Prefers the sample nearest the tip, so the dot stays by the frame entry.
    """
    limit = 0.46 * record["width"] / pitch
    best = None
    for rank, (point, normal, trace) in enumerate(record["samples"]):
        slope = float(normal[coord])
        across = 0.0 if abs(slope) < 1e-6 else (target - point[coord]) / slope
        across = float(np.clip(across, -limit, limit))
        cand = point + normal * across
        score = abs(float(cand[coord]) - target) + rank * 0.15
        if best is None or score < best[0]:
            best = (score, cand, trace)
    return best[1], best[2]


def spread_landings(strands: list[dict], pitch: float, centre=None, min_mm: float = 1.55) -> dict:
    """Where a strip meets the frame, and where its number dot sits.

    The dot stays on its own strip, a short way in from the tip. Ends that would share
    one leader line part across the strip, and inward along it, until each has its own
    line on the frame side. The strip itself is drawn straight through to the frame.
    """
    recs = []
    for strand in strands:
        pts = np.asarray(strand["points"], float)
        if len(pts) < 2:
            continue
        width = float(strand.get("width_mm", 1.6) or 1.6)
        for which in ("start", "end"):
            tip, tangent, _trace = _along(pts, 0.0, which)
            samples = []
            for dist in np.linspace(1.6, 5.0, 12):
                point, sample_tangent, trace = _along(pts, dist / pitch, which)
                normal = np.array([-sample_tangent[1], sample_tangent[0]])
                samples.append((point, normal, trace))
            recs.append({
                "sid": strand["id"], "which": which, "pts": pts, "tip": tip,
                "tip_tangent": tangent, "width": width, "samples": samples,
            })
    if not recs:
        return {}
    centre = np.asarray(centre if centre is not None else np.mean([r["tip"] for r in recs], axis=0), float)
    gap_px = min_mm / pitch
    landing = [None] * len(recs)
    trace_of = [None] * len(recs)
    buckets: dict[str, list[int]] = {"left": [], "right": [], "top": [], "bottom": []}
    for i, r in enumerate(recs):
        buckets[_side_name(r["tip"], centre)].append(i)
    for side, idxs in buckets.items():
        if not idxs:
            continue
        coord = 1 if side in ("left", "right") else 0
        idxs.sort(key=lambda i: (recs[i]["samples"][0][0][coord], recs[i]["tip"][coord]))
        base = np.array([recs[i]["samples"][0][0][coord] for i in idxs])
        bounds = np.array([_rail_bounds(recs[i], pitch, coord) for i in idxs])
        pos = _separate_bounded(base, bounds[:, 0], bounds[:, 1], gap_px)
        for i, target in zip(idxs, pos):
            landing[i], trace_of[i] = _place_on_strip(recs[i], float(target), coord, pitch)

    out = {}
    for i, r in enumerate(recs):
        out[(r["sid"], r["which"])] = {
            "tip": r["tip"], "tip_tangent": r["tip_tangent"], "landing": landing[i],
            "trace": trace_of[i], "width": r["width"],
        }
    return out


LABEL_SCALES = ((2.0, "2:1"), (1.5, "3:2"), (1.25, "5:4"), (1.0, "1:1"))


def label_layout(ends, crop, centre, pitch: float, box) -> dict | None:
    """Pick the largest scale whose margin can number every strip end.

    ends: [(strand_id, start_xy, end_xy)] in plan pixels; crop: (c0, r0, c1, r1) plan pixels;
    centre: plan pixels; box: (x0, y0, x1, y1) sheet pixels. Both ends are numbered. One end is
    only a last resort when the sheet cannot hold a balloon at every tip.
    """
    c0, r0, c1, r1 = crop
    bx0, by0, bx1, by1 = box
    by_angle = sorted(ends, key=lambda e: math.atan2(e[1][1] - centre[1], e[1][0] - centre[0]))
    one_each = [(sid, "start" if i % 2 == 0 else "end", a if i % 2 == 0 else b) for i, (sid, a, b) in enumerate(by_angle)]
    both = [(sid, which, p) for sid, a, b in ends for which, p in (("start", a), ("end", b))]
    fallback = None
    for scale, scale_label in LABEL_SCALES:
        k = pitch * scale * PX
        vw, vh = int((c1 - c0 + 1) * k), int((r1 - r0 + 1) * k)
        spare_x = (bx1 - bx0) - vw
        spare_y = (by1 - by0) - vh
        if spare_x < 70 or spare_y < 70:
            continue
        left = right = spare_x // 2
        top = bottom = spare_y // 2
        ox, oy = bx0 + left, by0 + top
        for chosen, radius in (
            (both, 15), (both, 13), (both, 12), (both, 11), (both, 10), (both, 9), (both, 8),
            (one_each, 12), (one_each, 10), (one_each, 8),
        ):
            pad = radius + 4
            allowance = {"left": left - pad, "right": right - pad, "top": top - pad, "bottom": bottom - pad}
            if min(allowance.values()) < radius + 6:
                continue
            anchors = [(ox + (p[0] - c0) * k, oy + (p[1] - r0) * k) for _sid, _w, p in chosen]
            mid = (ox + (centre[0] - c0) * k, oy + (centre[1] - r0) * k)
            placed = place_labels(anchors, (ox, oy, ox + vw, oy + vh), mid, radius, allowance)
            if placed is None:
                continue
            for item in placed:
                item["strand"], item["which"], _p = chosen[item["index"]]
            packed = {"scale": scale, "scale_label": scale_label, "k": k, "size": (vw, vh), "origin": (ox, oy),
                      "band": top, "radius": radius, "both": chosen is both, "labels": placed}
            if packed["both"]:
                return packed
            if fallback is None:
                fallback = packed
    return fallback


def place_tags(points, sizes, avoid=()) -> list[tuple[float, float]]:
    """Top-left corners for small text tags next to `points`, trying not to cover each other or `avoid`."""
    cell = 40.0
    boxes: dict[tuple[int, int], list[tuple]] = {}
    dots: dict[tuple[int, int], list[tuple]] = {}
    for p in list(points) + list(avoid):
        dots.setdefault((int(p[0] // cell), int(p[1] // cell)), []).append(p)

    def nearby(grid, box):
        for gx in range(int(box[0] // cell) - 1, int(box[2] // cell) + 2):
            for gy in range(int(box[1] // cell) - 1, int(box[3] // cell) + 2):
                yield from grid.get((gx, gy), ())

    def cost(box, own):
        area = 0.0
        for other in nearby(boxes, box):
            w = min(box[2], other[2]) - max(box[0], other[0])
            h = min(box[3], other[3]) - max(box[1], other[1])
            if w > 0 and h > 0:
                area += w * h
        for q in nearby(dots, box):
            if q is not own and box[0] - 4 <= q[0] <= box[2] + 4 and box[1] - 4 <= q[1] <= box[3] + 4:
                area += 500
        return area

    out = []
    for p, (tw, th) in zip(points, sizes):
        x, y = p
        best, best_cost = None, math.inf
        for r in (6.0, 11.0, 17.0):
            for ux, uy in ((1, -1), (1, 1), (-1, -1), (-1, 1), (0, -1), (0, 1), (1, 0), (-1, 0)):
                bx = x + r * ux - (0 if ux > 0 else tw if ux < 0 else tw / 2)
                by = y + r * uy - (0 if uy > 0 else th if uy < 0 else th / 2)
                box = (bx, by, bx + tw, by + th)
                c = cost(box, p)
                if c < best_cost:
                    best, best_cost = box, c
                if c == 0:
                    break
            if best_cost == 0:
                break
        boxes.setdefault((int(best[0] // cell), int(best[1] // cell)), []).append(best)
        out.append((best[0], best[1]))
    return out


def _without_entry_hooks(points, pitch: float, max_mm: float = 3.2, turn_deg: float = 22.0) -> np.ndarray:
    """Drop a sharp kink in the last few millimetres and continue on the incoming tangent.

    A buried tip sometimes leaves the strip's own direction for about 2 mm. On the
    sheet that reads as a turned head at the frame. The strip is drawn straight in.
    """
    pts = np.asarray(points, float)
    if len(pts) < 4:
        return pts
    pts = _straighten_one_end(pts, pitch, max_mm, turn_deg)
    return _straighten_one_end(pts[::-1], pitch, max_mm, turn_deg)[::-1]


def _straighten_one_end(pts: np.ndarray, pitch: float, max_mm: float, turn_deg: float) -> np.ndarray:
    acc = 0.0
    prev = None
    for i in range(len(pts) - 1):
        delta = pts[i + 1] - pts[i]
        length = float(np.linalg.norm(delta))
        if length < 1e-9:
            continue
        ang = math.atan2(float(delta[1]), float(delta[0]))
        if prev is not None:
            turn = (ang - prev + math.pi) % (2 * math.pi) - math.pi
            if abs(math.degrees(turn)) >= turn_deg and acc <= max_mm:
                outward = -delta / length
                tip = pts[i] + outward * (acc / max(pitch, 1e-6))
                return np.vstack([tip, pts[i:]])
        prev = ang
        acc += length * pitch
        if acc > max_mm:
            break
    return pts


def _packed_without_hooks(packed) -> list:
    out = []
    for row in packed:
        line = np.asarray(row[0], np.float32)
        xy = _without_entry_hooks(line[:, :2], 1.0)
        if line.shape[1] > 2:
            full = np.empty((len(xy), line.shape[1]), np.float32)
            full[:, :2] = xy
            full[:, 2:] = line[0, 2:]
        else:
            full = xy.astype(np.float32)
        out.append((full, *row[1:]))
    return out


def _ribbon_sides(points, half: float) -> tuple[np.ndarray, np.ndarray] | None:
    """Two long edges of a constant-width ribbon. Sharp bends are bevelled, not spiked."""
    raw = np.asarray(points, float)
    if len(raw) < 2:
        return None
    kept = [raw[0]]
    for point in raw[1:]:
        if math.hypot(point[0] - kept[-1][0], point[1] - kept[-1][1]) >= 0.6:
            kept.append(point)
    if len(kept) < 2:
        return None
    pts = np.asarray(kept, float)
    seg = np.diff(pts, axis=0)
    tangent = seg / np.maximum(np.linalg.norm(seg, axis=1)[:, None], 1e-9)
    normal = np.stack([-tangent[:, 1], tangent[:, 0]], axis=1)

    def side(sign: float) -> np.ndarray:
        normals = normal * sign
        out = [pts[0] + normals[0] * half]
        for i in range(1, len(pts) - 1):
            miter = normals[i - 1] + normals[i]
            span = float(np.linalg.norm(miter))
            dot = float(np.dot(miter, normals[i - 1]))
            if span < 1e-6 or dot < 0.55 * span:
                out.append(pts[i] + normals[i - 1] * half)
                out.append(pts[i] + normals[i] * half)
            else:
                out.append(pts[i] + miter * (half / dot))
        out.append(pts[-1] + normals[-1] * half)
        return np.asarray(out, float)

    return side(1.0), side(-1.0)


def _paint_ribbon(draw, points, half: float, fill, edge, edge_width: int = 2) -> None:
    sides = _ribbon_sides(points, half)
    if sides is None:
        return
    left, right = sides
    if fill is not None:
        draw.polygon([tuple(p) for p in np.vstack([left, right[::-1]])], fill=fill)
    if edge is not None and len(left) > 1:
        draw.line([tuple(p) for p in left], fill=edge, width=edge_width)
        draw.line([tuple(p) for p in right], fill=edge, width=edge_width)


def _frame_only(image: Image.Image) -> Image.Image:
    """Keep the fan rim and handle. The weave itself is drawn separately."""
    rgb = np.asarray(image.convert("RGB")).astype(np.int16)
    frame = (np.abs(rgb[:, :, 0] - 186) < 24) & (np.abs(rgb[:, :, 1] - 186) < 24) & (np.abs(rgb[:, :, 2] - 190) < 28)
    heart = (np.abs(rgb[:, :, 0] - 132) < 20) & (np.abs(rgb[:, :, 1] - 134) < 20) & (np.abs(rgb[:, :, 2] - 138) < 22)
    keep = frame | heart
    out = np.zeros((rgb.shape[0], rgb.shape[1], 4), np.uint8)
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(keep, 255, 0)
    return Image.fromarray(out, "RGBA")


def _axis_bar(points) -> bool:
    """Horizontal and vertical base strips sit under the diagonal weave."""
    pts = np.asarray(points, float)
    if len(pts) < 2:
        return False
    delta = pts[-1] - pts[0]
    span = float(np.hypot(delta[0], delta[1]))
    if span < 1e-6:
        return False
    deg = abs(math.degrees(math.atan2(abs(float(delta[1])), abs(float(delta[0])))))
    if not (deg < 14.0 or deg > 76.0):
        return False
    # A support bar lies on its chord. A horizontal wave bows off it, so it stays a weave strip.
    normal = np.array([-delta[1], delta[0]], float) / span
    bow = float(np.max(np.abs((pts - pts[0]) @ normal)))
    return bow < max(4.0, span * 0.05)


def _edge_span(edge, origin, tangent, reach: float):
    """The part of a ribbon edge that lies alongside one crossing."""
    edge = np.asarray(edge, float)
    if len(edge) < 2:
        return None
    proj = (edge - np.asarray(origin, float)) @ np.asarray(tangent, float)
    chosen = edge[np.abs(proj) <= reach]
    return chosen if len(chosen) >= 2 else None


def _opening_end(points, which: str, mask: np.ndarray) -> np.ndarray:
    """Where the strip comes out of the frame. The number dot sits on that end."""
    pts = np.asarray(points, float)
    if len(pts) < 2:
        return pts[0] if len(pts) else np.zeros(2)
    if which == "end":
        pts = pts[::-1].copy()
    h, w = mask.shape

    def inside(p) -> bool:
        c = int(round(float(p[0])))
        r = int(round(float(p[1])))
        return 0 <= r < h and 0 <= c < w and bool(mask[r, c])

    if inside(pts[0]):
        return np.asarray(pts[0], float)
    for a, b in zip(pts[:-1], pts[1:]):
        if not inside(b):
            continue
        lo, hi = np.asarray(a, float), np.asarray(b, float)
        for _ in range(10):
            mid = (lo + hi) * 0.5
            if inside(mid):
                hi = mid
            else:
                lo = mid
        return hi
    return np.asarray(pts[0], float)


def _visible_tip(points, which: str, image: Image.Image, extra_px: float) -> np.ndarray | None:
    """Where the strip becomes visible inside the rim. The number dot sits just there."""
    pts = np.asarray(points, float)
    if len(pts) < 2:
        return None
    if which == "end":
        pts = pts[::-1].copy()
    rgb = np.asarray(image.convert("RGB"))
    height, width = rgb.shape[:2]

    def bamboo(point) -> bool:
        c, r = int(round(float(point[0]))), int(round(float(point[1])))
        if not (0 <= r < height and 0 <= c < width):
            return False
        center = rgb[r, c].astype(int)
        paper = int(center[0]) > 232 and int(center[1]) > 226 and int(center[2]) > 214
        if paper:
            return False
        gray = abs(int(center[0]) - 186) < 28 and abs(int(center[1]) - 186) < 28 and abs(int(center[2]) - 190) < 32
        heart = abs(int(center[0]) - 132) < 22 and abs(int(center[1]) - 134) < 22 and abs(int(center[2]) - 138) < 24
        return not (gray or heart)

    found = 0.0 if bamboo(pts[0]) else None
    travelled = 0.0
    if found is None:
        for i in range(len(pts) - 1):
            seg = pts[i + 1] - pts[i]
            length = float(np.linalg.norm(seg))
            if length < 1e-6:
                continue
            steps = max(int(length), 1)
            for step in range(1, steps + 1):
                if bamboo(pts[i] + seg * (step / steps)):
                    found = travelled + length * step / steps
                    break
            if found is not None:
                break
            travelled += length
    if found is None:
        return None
    point, _tangent, _trace = _along(pts, found + max(extra_px, 0.0), "start")
    return point


def _tangent_at(points, which: str, point) -> np.ndarray:
    """Inward direction of the strip at `point`."""
    pts = np.asarray(points, float)
    if which == "end":
        pts = pts[::-1].copy()
    if len(pts) < 2:
        return np.array([1.0, 0.0])
    best_d, best_seg = 1e18, pts[1] - pts[0]
    for i in range(len(pts) - 1):
        seg = pts[i + 1] - pts[i]
        length = float(np.linalg.norm(seg))
        if length < 1e-9:
            continue
        t = float(np.clip(np.dot(np.asarray(point, float) - pts[i], seg) / (length * length), 0.0, 1.0))
        gap = float(np.linalg.norm(pts[i] + seg * t - np.asarray(point, float)))
        if gap < best_d:
            best_d, best_seg = gap, seg
    norm = float(np.linalg.norm(best_seg))
    return best_seg / norm if norm else np.array([1.0, 0.0])


def _spread_endpoints(records: list[dict], centre, min_px: float = 6.0) -> None:
    """Keep each dot on its own tip, and give neighbouring leaders their own lane.

    A dot may slide across its strip, up to the strip edge, so two tips that leave the
    frame side by side do not share one line. A pair that is still too close may step
    inward by at most one millimetre.
    """
    centre = np.asarray(centre, float)
    buckets: dict[str, list[int]] = {"left": [], "right": [], "top": [], "bottom": []}
    for i, rec in enumerate(records):
        buckets[_side_name(rec["point"], centre)].append(i)
    for side, idxs in buckets.items():
        if len(idxs) < 2:
            continue
        coord = 1 if side in ("left", "right") else 0
        idxs.sort(key=lambda i: float(records[i]["point"][coord]))
        base = np.array([float(records[i]["point"][coord]) for i in idxs])
        lo = np.empty(len(idxs))
        hi = np.empty(len(idxs))
        for n, i in enumerate(idxs):
            normal = np.array([-records[i]["tangent"][1], records[i]["tangent"][0]])
            reach = abs(float(normal[coord])) * 0.42 * float(records[i]["width_px"])
            lo[n] = base[n] - reach
            hi[n] = base[n] + reach
        pos = _separate_bounded(base, lo, hi, min_px)
        for i, target, origin in zip(idxs, pos, base):
            normal = np.array([-records[i]["tangent"][1], records[i]["tangent"][0]])
            slope = float(normal[coord])
            if abs(slope) < 1e-3:
                continue
            limit = 0.42 * float(records[i]["width_px"])
            shift = float(np.clip((float(target) - float(origin)) / slope, -limit, limit))
            records[i]["point"] = np.asarray(records[i]["point"], float) + normal * shift
        # A pair still closer than one line steps inward at most 1 mm, and only along its own strip.
        home = {i: np.asarray(records[i]["point"], float).copy() for i in idxs}

        def room_for(i) -> float:
            return 8.0 - float(np.linalg.norm(np.asarray(records[i]["point"], float) - home[i]))

        for _ in range(len(idxs)):
            moved = False
            for n in range(1, len(idxs)):
                later_i, earlier_i = idxs[n], idxs[n - 1]
                gap = float(records[later_i]["point"][coord] - records[earlier_i]["point"][coord])
                if gap >= min_px - 0.2:
                    continue
                for i, sign in ((later_i, 1.0), (earlier_i, -1.0)):
                    tangent = np.asarray(records[i]["tangent"], float)
                    slope = float(tangent[coord]) * sign
                    room = room_for(i)
                    if slope <= 0.25 or room <= 0.2:
                        continue
                    step = min((min_px - gap) / slope, room)
                    records[i]["point"] = np.asarray(records[i]["point"], float) + tangent * step
                    moved = True
                    break
            if not moved:
                break


def _tip_on_bamboo(points, which: str, mask: np.ndarray, inset_px: float) -> np.ndarray:
    """A point on the strip centerline, just inside the frame, where the number dot sits."""
    pts = np.asarray(points, float)
    if which == "end":
        pts = pts[::-1].copy()
    opening = _opening_end(pts, "start", mask)
    target = np.asarray(opening, float)
    best, best_d, acc = 0.0, 1e18, 0.0
    for i in range(len(pts) - 1):
        seg = pts[i + 1] - pts[i]
        length = float(np.linalg.norm(seg))
        if length < 1e-9:
            continue
        t = float(np.clip(np.dot(target - pts[i], seg) / (length * length), 0.0, 1.0))
        gap = float(np.linalg.norm(pts[i] + seg * t - target))
        if gap < best_d:
            best_d, best = gap, acc + t * length
        acc += length
    point, _tangent, _trace = _along(pts, best + max(inset_px, 0.0), "start")
    return point


def _clip_slab(poly, origin, normal, half: float) -> list[np.ndarray]:
    """Portion of a polyline that lies between two parallel edges."""
    pts = [np.asarray(p, float) for p in poly]
    if not pts:
        return []
    origin = np.asarray(origin, float)
    normal = np.asarray(normal, float)

    def signed(p) -> float:
        return float(np.dot(p - origin, normal))

    out: list[np.ndarray] = []
    prev, prev_s = pts[0], signed(pts[0])
    if abs(prev_s) <= half:
        out.append(prev)
    for cur in pts[1:]:
        cur_s = signed(cur)
        hits = []
        for edge in (half, -half):
            den = cur_s - prev_s
            if abs(den) < 1e-9:
                continue
            if (prev_s - edge) * (cur_s - edge) < 0:
                t = (edge - prev_s) / den
                hits.append((t, prev * (1.0 - t) + cur * t))
        for _t, point in sorted(hits, key=lambda item: item[0]):
            out.append(point)
        if abs(cur_s) <= half + 1e-6:
            out.append(cur)
        prev, prev_s = cur, cur_s
    return out


def _crossing_polygon(over_pts, origin, normal, over_half: float, under_half: float):
    """The piece of the upper strip that covers the lower one.

    Long sides follow the upper strip. Short sides lie on the lower strip's edges,
    so the join is the upper strip's own boundary and neither strip is cut square.
    """
    sides = _ribbon_sides(over_pts, over_half)
    if sides is None:
        return None
    left = _clip_slab(sides[0], origin, normal, under_half)
    right = _clip_slab(sides[1], origin, normal, under_half)
    if len(left) < 2 or len(right) < 2:
        return None
    return [tuple(float(v) for v in p) for p in list(left) + list(reversed(right))]


def _window(points, x: float, y: float, reach: float) -> np.ndarray:
    """Centerline samples within `reach` of (x, y), measured along the strip."""
    pts = np.asarray(points, float)
    if len(pts) < 2:
        return pts
    seg = np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1]))
    arc = np.concatenate([[0.0], np.cumsum(seg)])
    index = int(np.argmin(np.hypot(pts[:, 0] - x, pts[:, 1] - y)))
    at = float(arc[min(index, len(arc) - 1)])
    lo, hi = at - reach, at + reach

    def at_d(distance: float) -> np.ndarray:
        distance = float(np.clip(distance, 0.0, arc[-1]))
        i = int(np.searchsorted(arc, distance, side="right") - 1)
        i = min(max(i, 0), len(pts) - 2)
        length = float(seg[i])
        t = 0.0 if length < 1e-6 else float(np.clip((distance - arc[i]) / length, 0.0, 1.0))
        return pts[i] * (1 - t) + pts[i + 1] * t

    sample = [at_d(lo)]
    for point, distance in zip(pts, arc):
        if lo + 0.3 < float(distance) < hi - 0.3:
            sample.append(point)
    sample.append(at_d(hi))
    return np.asarray(sample, float)


def _crossing_pitch(strands: list[dict]) -> float:
    gaps = []
    for s in strands:
        stops = [c["s"] for c in s["crossings"]]
        gaps += [b - a for a, b in zip(stops, stops[1:]) if b - a > 0.5]
    return float(np.median(gaps)) if gaps else 6.0


def craft_drawing(params: dict, title: str, version: str, designer: str = "", drawing_no: str = "", lang: str = "zh-Hant") -> bytes:
    lang = sheet_lang(lang)
    from app.crossings import compose_for_view, crossing_view
    from app.geometry.weave_ribbons import paint_plan

    composed = compose_for_view(params)
    master, factor, packed, _meta = composed
    view = crossing_view(params, composed)
    strands = view["strands"]
    pitch = float(view["pitch_mm"])
    h_px, w_px = view["height"], view["width"]
    x0, y0 = float(view["x0_mm"]), float(view["y0_mm"])

    shell_lo = np.asarray(master["shell_min"], float) * factor
    shell_hi = np.asarray(master["shell_max"], float) * factor
    handle_lo = np.asarray(master["handle_min"], float) * factor
    handle_hi = np.asarray(master["handle_max"], float) * factor
    width_mm = shell_hi[0] - shell_lo[0]
    height_mm = shell_hi[1] - shell_lo[1]
    handle_mm = handle_hi[1] - handle_lo[1]
    rim_w = float(params.get("rim_width", 5.8) or 5.8)
    rim_d = float(params.get("rim_depth", 7.0) or 7.0)
    inner = np.flipud(master["inner"])
    rows = np.nonzero(inner.any(axis=1))[0]
    cols = np.nonzero(inner.any(axis=0))[0]
    open_w = (cols[-1] - cols[0] + 1) * pitch
    open_h = (rows[-1] - rows[0] + 1) * pitch
    primary = next((l for l in params.get("layers") or [] if l.get("enabled") is not False and l.get("algorithm") not in ("plain", "none")), {})
    lift = float(primary.get("crossing_lift", params.get("relief", 0.45)) or 0.45)
    if params.get("print_safe", True):
        lift = max(lift, 0.55)
    thick = strands[0]["thick_mm"] if strands else 1.2
    spec_of, specs = _specs(strands, lang)
    cross_pitch = _crossing_pitch(strands)
    summary = view["summary"]

    sheet = Sheet()
    d = sheet.draw
    W, H = SHEET
    d.rectangle([30, 30, W - 30, H - 30], outline=INK, width=4)
    d.rectangle([44, 44, W - 44, H - 44], outline=INK, width=1)
    sheet.text((80, 74), f"{title} · {tr(lang, 'doc')}", 52, bold=True)
    sheet.text((82, 140), "HAITANG WEAVE LAB · BAMBOO-WEAVE ROUND FAN · PRODUCTION DRAWING", 20, MUTED)

    # ---- View 1: front view 1:1 ------------------------------------------------
    plan = paint_plan(master, params, factor, _packed_without_hooks(_with_sheet_colors(packed, strands)), crossings=_meta.get("crossing_table"))
    k1 = pitch * PX
    v1 = plan.resize((int(w_px * k1), int(h_px * k1)), Image.LANCZOS)
    ox1, oy1 = 140, 340
    sheet.text((ox1, 210), tr(lang, "view1"), 30, bold=True)
    sheet.image.paste(v1, (ox1, oy1))
    solid = np.flipud(master["solid"])
    srows = np.nonzero(solid.any(axis=1))[0]
    scols = np.nonzero(solid.any(axis=0))[0]
    left, right = ox1 + scols[0] * k1, ox1 + (scols[-1] + 1) * k1
    top, bottom = oy1 + srows[0] * k1, oy1 + (srows[-1] + 1) * k1
    sheet.dim_h(left, right, top - 40, top, tr(lang, "width_all", v=f"{width_mm:.1f}"))
    sheet.dim_v(top, bottom, left - 70, left, tr(lang, "height_all", v=f"{height_mm:.1f}"))
    hy_top = oy1 + (h_px - 1 - (handle_hi[1] - y0) / pitch) * k1
    hy_bot = oy1 + (h_px - 1 - (handle_lo[1] - y0) / pitch) * k1
    sheet.dim_v(hy_top, hy_bot, right + 60, ox1 + v1.width * 0.56, tr(lang, "handle", v=f"{handle_mm:.1f}"))
    oy_top, oy_bot = oy1 + rows[0] * k1, oy1 + (rows[-1] + 1) * k1
    sheet.dim_v(oy_top, oy_bot, right + 130, right - rim_w * PX, tr(lang, "open_h", v=f"{open_h:.1f}"))
    ox_l, ox_r = ox1 + cols[0] * k1, ox1 + (cols[-1] + 1) * k1
    sheet.dim_h(ox_l, ox_r, oy_bot + 70, oy_bot - 20, tr(lang, "open_w", v=f"{open_w:.1f}"))
    lead = (right - rim_w * PX * 0.5, oy_bot - 40)
    label_at = (ox1 + v1.width * 0.64, hy_top + 120)
    d.line([lead, label_at], fill=INK, width=2)
    d.ellipse([lead[0] - 5, lead[1] - 5, lead[0] + 5, lead[1] + 5], fill=INK)
    sheet.text((label_at[0] + 6, label_at[1] - 4), tr(lang, "frame"), 22, bold=True)
    sheet.text((label_at[0] + 6, label_at[1] + 26), tr(lang, "rim_w", v=f"{rim_w:.1f}"), 22)
    sheet.text((label_at[0] + 6, label_at[1] + 56), tr(lang, "rim_t", v=f"{rim_d:.1f}"), 22)
    sheet.text((ox1, bottom + 120), tr(lang, "unit_note"), 20, MUTED)

    # ---- Detail A: section through crossings 5:1 -------------------------------
    s5 = 5 * PX
    ax, ay = 110, bottom + 180
    sheet.text((ax, ay), tr(lang, "detail_a"), 26, bold=True)
    strip_w = strands[0]["width_mm"] if strands else 2.6
    # One continuous strip keeps one colour. The crossing family is the other colour.
    along_fill = (228, 190, 132)
    cross_fill = (98, 60, 38)
    span = min(cross_pitch, 6.0) * s5
    x_start, x_end = ax + 60, ax + 60 + span * 3.0
    mid_y = ay + 130 + lift * s5
    amp = lift * s5 / 2
    xs = np.linspace(x_start, x_end, 240)
    centre = mid_y - amp * np.cos(np.pi * (xs - x_start - span * 0.5) / span)
    half = thick * s5 / 2
    callouts = []
    crossings = []
    for k in range(3):
        cx = x_start + span * (k + 0.5)
        on_top = k % 2 == 0
        cz = mid_y - amp * (1 if on_top else -1)
        box_y = cz + half if on_top else cz - half - thick * s5
        crossings.append((cx, box_y, on_top))
        if on_top:
            callouts.append((cx, box_y + thick * s5 + 26, tr(lang, "over_here"), OVER, "mm"))
        else:
            # To the right of the extension, in the white band above the crest.
            callouts.append((cx + 16, max(ay + 92, (mid_y - amp - half) - 30), tr(lang, "under_here"), UNDER, "lm"))
    for cx, box_y, on_top in crossings:
        if on_top:
            d.rectangle([cx - strip_w * s5 / 2, box_y, cx + strip_w * s5 / 2, box_y + thick * s5], fill=cross_fill, outline=INK)
    d.polygon(list(zip(xs, centre - half)) + list(zip(xs[::-1], (centre + half)[::-1])), fill=along_fill, outline=INK)
    for cx, box_y, on_top in crossings:
        if not on_top:
            d.rectangle([cx - strip_w * s5 / 2, box_y, cx + strip_w * s5 / 2, box_y + thick * s5], fill=cross_fill, outline=INK)
    sheet.dim_h(x_start + span * 0.5, x_start + span * 1.5, ay + 64, mid_y - amp - half, tr(lang, "pitch", v=f"{cross_pitch:.1f}"), 20)
    sheet.dim_v(mid_y - amp - half, mid_y - amp + half, x_end + 40, x_end - span * 0.5, f"t {thick:.2f}", 18)
    sheet.dim_v(mid_y - amp, mid_y + amp, x_start - 30, x_start + span * 0.5, f"h {lift:.2f}", 18)
    for cx, cy, label, color, anchor in callouts:
        w = sheet.width(label, 20)
        if anchor == "lm":
            pad = [cx - 4, cy - 14, cx + w + 6, cy + 12]
        else:
            pad = [cx - w / 2 - 5, cy - 14, cx + w / 2 + 5, cy + 12]
        d.rectangle(pad, fill=PAPER)
        sheet.text((cx, cy), label, 20, color, anchor=anchor)
    sheet.text((ax + 60, mid_y + amp + half + thick * s5 + 60),
               tr(lang, "section_note", t=f"{thick:.2f}", h=f"{lift:.2f}", w=f"{strip_w:.1f}"), 22)

    # ---- Detail B: strip entering the frame ------------------------------------
    bx, by = 110, mid_y + amp + half + thick * s5 + 130
    sheet.text((bx, by), tr(lang, "detail_b"), 26, bold=True)
    sb = 3 * PX
    fx = bx + 330
    fy = by + 110
    d.rectangle([fx, fy, fx + rim_w * sb, fy + rim_d * sb], fill=FRAME, outline=INK, width=2)
    strip_y = fy + rim_d * sb / 2 - thick * sb / 2
    d.rectangle([fx - 260, strip_y, fx + 1.8 * sb, strip_y + thick * sb], fill=(220, 193, 154), outline=INK, width=2)
    d.rectangle([fx + 1.8 * sb, strip_y, fx + TUCK_MM * sb, strip_y + thick * sb], outline=INK, width=1)
    for xx in np.arange(fx + 1.8 * sb, fx + TUCK_MM * sb, 10):
        d.line([(xx, strip_y), (xx + 6, strip_y + thick * sb)], fill=MUTED)
    sheet.dim_h(fx, fx + 1.8 * sb, fy - 30, strip_y, tr(lang, "embed"), 18)
    sheet.dim_h(fx, fx + TUCK_MM * sb, fy + rim_d * sb + 50, strip_y + thick * sb, tr(lang, "allowance", v=f"{TUCK_MM:.0f}"), 18)
    sheet.dim_v(fy, fy + rim_d * sb, fx + rim_w * sb + 40, fx + rim_w * sb, tr(lang, "frame_t", v=f"{rim_d:.1f}"), 18)
    sheet.text((fx - 260, strip_y - 34), tr(lang, "strip"), 20, MUTED)

    # ---- View 2: numbered over/under 2:1 ---------------------------------------
    margin = int((rim_w + 1.0) / pitch)
    c0, c1 = max(cols[0] - margin, 0), min(cols[-1] + margin, w_px - 1)
    r0, r1 = max(rows[0] - margin, 0), min(rows[-1] + margin, h_px - 1)
    # 2545 keeps the numbered view at 2:1, the same scale as the reference sheets, with the balloon rows still short of the table at 2560.
    box_x0, box_x1, box_y0, box_y1 = max(1000, int(right + 175)), 2545, 262, 1900
    fan_centre = ((cols[0] + cols[-1]) / 2, (rows[0] + rows[-1]) / 2)
    drawn = [{**s, "points": _without_entry_hooks(s["points"], pitch)} for s in strands]
    landings = spread_landings(drawn, pitch, fan_centre)
    # Four plan pixels keeps the dot on the visible tip. A rim-sized inset walked it down the strip.
    inset = 4.0
    records = []
    for strand in strands:
        if len(strand["points"]) < 2 or (strand["id"], "start") not in landings:
            continue
        strand_drawn = drawn[strand["id"]] if strand["id"] < len(drawn) else strand
        width_px = float(strand.get("width_mm", 2.6) or 2.6) / pitch
        for which in ("start", "end"):
            point = _visible_tip(strand_drawn["points"], which, plan, inset)
            if point is None:
                point = _tip_on_bamboo(strand_drawn["points"], which, inner, inset)
            records.append({
                "sid": strand["id"], "which": which, "point": np.asarray(point, float),
                "tangent": _tangent_at(strand_drawn["points"], which, point),
                "width_px": width_px,
            })
    _spread_endpoints(records, fan_centre, 6.0)
    paired: dict[int, dict] = {}
    for rec in records:
        paired.setdefault(rec["sid"], {})[rec["which"]] = rec["point"]
    ends = [(sid, pair["start"], pair["end"]) for sid, pair in paired.items() if "start" in pair and "end" in pair]
    layout = label_layout(ends, (c0, r0, c1, r1), fan_centre, pitch,
                          (box_x0, box_y0, box_x1, box_y1))
    if layout is None:
        raise ValueError("too many strip ends to number clearly on one sheet")
    scale, scale_label, k2 = layout["scale"], layout["scale_label"], layout["k"]
    (vw, vh), (ox2, oy2) = layout["size"], layout["origin"]
    band, radius, both, placed = layout["band"], layout["radius"], layout["both"], layout["labels"]
    by_id = {s["id"]: s for s in strands}
    s2 = scale * PX
    back = paint_plan(master, params, factor, []).crop((c0, r0, c1 + 1, r1 + 1))
    v2 = back.resize((vw, vh), Image.BILINEAR)
    title4 = tr(lang, "view4", s=scale_label)
    sheet.text((box_x0, 200), title4, 30, bold=True)
    one_end = "" if both else tr(lang, "one_end")
    hint_x = box_x0 + sheet.width(title4, 30, True) + 28
    sheet.text((hint_x, 190), tr(lang, "leaders", extra=one_end), 20, MUTED)
    has_base = any(s.get("role") == "base" for s in strands)
    sheet.text((hint_x, 214), tr(lang, "ends"), 20, MUTED)
    sheet.text((hint_x, 238), tr(lang, "cross_hint"), 20, MUTED)
    layer = Image.new("RGBA", v2.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    edge_ink = (55, 40, 28, 255)

    def to2(p):
        return ((p[0] - c0) * k2, (p[1] - r0) * k2)

    for s in drawn:
        path = [tuple(to2(p)) for p in s["points"]]
        if len(path) < 2:
            continue
        width = max(int(round(s["width_mm"] * s2)), 3)
        ld.line(path, fill=edge_ink, width=width + 2, joint="curve")
        ld.line(path, fill=_rgb(s["color"]) + (255,), width=width, joint="curve")
    for c in view["crossings"]:
        over, under = drawn[c["over"]], drawn[c["under"]]
        reach = (under["width_mm"] / 2 + 0.9) / pitch
        near = [p for p in over["points"] if math.hypot(p[0] - c["x"], p[1] - c["y"]) <= reach]
        if len(near) < 2:
            continue
        pts = [to2(p) for p in near]
        width = max(int(round(over["width_mm"] * s2)), 3)
        ld.line(pts, fill=OPEN + (255,), width=width + 4)
        ld.line(pts, fill=_rgb(over["color"]) + (255,), width=width)
    frame = _frame_only(v2)
    sheet.image.paste(frame, (ox2, oy2), frame)
    sheet.image.paste(layer, (ox2, oy2), layer)
    for c in view["crossings"]:
        x, y = to2((c["x"], c["y"]))
        label = str(c["n"])
        tw = sheet.width(label, 13)
        bx2, by2 = ox2 + x + 7, oy2 + y - 18
        d.rectangle([bx2 - 2, by2, bx2 + tw + 2, by2 + 16], fill=(255, 255, 255))
        sheet.text((bx2, by2 - 1), label, 13, UNDER)

    leaders = []
    for item in placed:
        a = np.asarray(item["anchor"], float)
        elbow = np.asarray(item["elbow"], float)
        c = np.asarray(item["centre"], float)
        direction = c - elbow
        length = max(np.linalg.norm(direction), 1e-6)
        stop = c - direction / length * radius
        leaders.append((a, elbow, stop))
    for a, elbow, stop in leaders:
        d.line([tuple(a), tuple(elbow), tuple(stop)], fill=PAPER, width=3)
    for a, elbow, stop in leaders:
        d.line([tuple(a), tuple(elbow), tuple(stop)], fill=INK, width=1)
        d.ellipse([a[0] - 3.5, a[1] - 3.5, a[0] + 3.5, a[1] + 3.5], fill=PAPER, outline=INK, width=1)
        d.ellipse([a[0] - 1.5, a[1] - 1.5, a[0] + 1.5, a[1] + 1.5], fill=INK)
    for item in placed:
        strand = by_id[item["strand"]]
        cx, cy = item["centre"]
        start = item["which"] == "start"
        d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=INK if start else (255, 255, 255), outline=INK, width=2)
        number = str(strand["id"] + 1)
        number_size = 16 if radius >= 15 else 14 if radius >= 13 else 12 if radius >= 10 else 11
        sheet.text((cx, cy), number, number_size, PAPER if start else INK, anchor="mm", bold=True)

    # ---- Under view 2: statistics and notes -------------------------------------
    ox2 = box_x0
    ny = box_y0 + v2.height + 2 * band + 30
    rate = summary["alternation_rate"]
    stats = [
        (tr(lang, "n_strips"), tr(lang, "n_strips_v", n=len(strands))),
        (tr(lang, "n_specs"), tr(lang, "n_specs_v", n=len(specs))),
        (tr(lang, "n_cross"), tr(lang, "n_cross_v", n=summary["crossing_count"])),
        (tr(lang, "alt"), "—" if rate is None else f"{rate * 100:.1f}%"),
        (tr(lang, "float", n=summary["long_float_threshold"]), tr(lang, "float_v", n=summary["strands_with_long_float"])),
        (tr(lang, "cut_total"), f"{sum(s['total_m'] for s in specs):.2f} m"),
    ]
    y = sheet.heading(ox2, ny, tr(lang, "head_stats"))
    sheet.table(ox2, y, [(tr(lang, "col_item"), 420, "l"), (tr(lang, "col_value"), 240, "r")], stats, row_h=34, size=21)
    weave_note = tr(lang, "note3") + (tr(lang, "note3base") if has_base else "") if both else tr(lang, "note3one")
    notes = [
        tr(lang, "note1"),
        tr(lang, "note2"),
        weave_note,
        tr(lang, "note4"),
        tr(lang, "note5", n=f"{R_MIN_MM:.0f}"),
        tr(lang, "note6"),
    ]
    nx = ox2 + 720
    note_w = max(280, min(620, (W - 44 - 1000) - (nx + 32) - 24))
    yy = sheet.heading(nx, ny, tr(lang, "head_notes"))
    for i, note in enumerate(notes, 1):
        lines = sheet.wrap(note, 21, note_w)
        sheet.text((nx, yy), f"{i}.", 21, bold=True)
        for j, text in enumerate(lines):
            sheet.text((nx + 32, yy + j * 30), text, 21)
        yy += 30 * len(lines) + 8

    # ---- Right column: dimensions, bill of materials, strip schedule -----------
    rx = 2560
    y = sheet.heading(rx, 200, tr(lang, "head_dims"), tr(lang, "unit_mm"))
    dims = [
        (tr(lang, "dim_overall"), f"{height_mm:.1f} × {width_mm:.1f}"),
        (tr(lang, "dim_handle"), f"{handle_mm:.1f}"),
        (tr(lang, "dim_open"), f"{open_w:.1f} × {open_h:.1f}"),
        (tr(lang, "dim_frame"), f"{rim_w:.1f} × {rim_d:.1f}"),
        (tr(lang, "dim_thick"), f"{thick:.2f}"),
        (tr(lang, "dim_lift"), f"{lift:.2f}"),
    ]
    y = sheet.table(rx, y, [(tr(lang, "col_item"), 470, "l"), (tr(lang, "col_size"), 400, "r")], dims, row_h=34, size=21) + 30
    y = sheet.heading(rx, y, tr(lang, "head_bom"), tr(lang, "bom_by"))
    bom = [(s["code"], ("swatch", s["color"], s.get("tone") or tone_name(s["color"])), f"{s['width']:.1f} × {s['thick']:.1f}", str(s["count"]),
            f"{s['min']}–{s['max']}" if s["min"] != s["max"] else str(s["min"]), f"{s['total_m']:.2f}") for s in specs]
    y = sheet.table(rx, y, [(tr(lang, "bom_spec"), 80, "l"), (tr(lang, "bom_color"), 200, "l"), (tr(lang, "bom_section"), 150, "r"), (tr(lang, "bom_qty"), 90, "r"), (tr(lang, "bom_cut"), 170, "r"), (tr(lang, "bom_total"), 180, "r")], bom, row_h=34, size=20) + 30

    title_top = H - 44 - 300
    y = sheet.heading(rx, y, tr(lang, "head_sched"), tr(lang, "sched_note"))
    footnote_h, gap = 46, 12
    usable = max(80, title_top - y - footnote_h - gap)
    count = len(strands)
    per_col = count if count <= 26 else math.ceil(count / 2)
    if per_col == count:
        columns = [(tr(lang, "sch_no"), 70, "r"), (tr(lang, "sch_spec"), 60, "l"), (tr(lang, "sch_cut"), 90, "r"), (tr(lang, "sch_x"), 64, "r"), (tr(lang, "sch_r"), 90, "r"), (tr(lang, "sch_seq"), 496, "l")]
        chunks = [strands]
        width_each = 870
        size = 15
    else:
        columns = [(tr(lang, "sch_no_s"), 42, "r"), (tr(lang, "sch_spec_s"), 34, "l"), (tr(lang, "sch_cut_s"), 50, "r"), (tr(lang, "sch_x_s"), 38, "r"), ("R", 36, "r"), (tr(lang, "sch_seq"), 250, "l")]
        chunks = [strands[:per_col], strands[per_col:]]
        width_each = 450
        size = 13
    seq_w = columns[-1][1] - 12
    head = 20
    bottoms = []
    for k, chunk in enumerate(chunks):
        chosen = None
        for size in (size, 11, 10):
            rows_data, heights = [], []
            for s in chunk:
                seq = _sequence_text(s["sequence"], lang) or "—"
                lines = sheet.wrap(seq, size, seq_w)
                step = size + 3
                heights.append(max(size + 8, len(lines) * step + 8))
                rows_data.append((str(s["id"] + 1), spec_of[s["id"]], str(math.ceil(s["length_mm"] + 2 * TUCK_MM)),
                                  str(len(s["crossings"])), _bend_text(s, pitch, lang), ("wrap", lines)))
            if sum(heights) + head <= usable or size == 10:
                chosen = (size, rows_data, heights)
                break
        size, rows_data, heights = chosen
        bottoms.append(sheet.table(rx + k * width_each, y, columns, rows_data, row_h=head, size=size, row_heights=heights))
    bottom_table = max(bottoms) if bottoms else y
    d.rectangle([rx, bottom_table + 2, rx + width_each * len(chunks), bottom_table + footnote_h], fill=PAPER)
    sheet.text((rx, bottom_table + 8), tr(lang, "footnote", n=f"{R_MIN_MM:.0f}"), 16, MUTED)

    # ---- Title block -----------------------------------------------------------
    tx, ty = W - 44 - 1000, title_top
    d.rectangle([tx, ty, W - 44, H - 44], outline=INK, width=3)
    grid = [
        [(tr(lang, "blk_title"), f"{title} {tr(lang, 'doc')}", 2)],
        [(tr(lang, "blk_no"), drawing_no or "—", 1), (tr(lang, "blk_scale"), f"1:1 / {scale_label}", 1)],
        [(tr(lang, "blk_by"), designer or "—", 1), (tr(lang, "blk_date"), datetime.now().strftime("%Y-%m-%d"), 1)],
        [(tr(lang, "blk_unit"), "mm", 1), (tr(lang, "blk_sheet"), "1 / 1", 1)],
        [(tr(lang, "blk_system"), f"{tr(lang, 'brand')} {version}", 2)],
    ]
    rh = 300 / len(grid)
    for r, row in enumerate(grid):
        top = ty + r * rh
        if r:
            d.line([(tx, top), (W - 44, top)], fill=INK, width=1)
        cx = tx
        for label, value, span in row:
            cw = 1000 * span / 2
            sheet.text((cx + 14, top + rh / 2), label, 20, MUTED, anchor="lm")
            value_size = 26 if r == 0 else 22
            sheet.text((cx + 90, top + rh / 2), sheet.fit(value, value_size, cw - 104, bold=r == 0),
                       value_size, bold=r == 0, anchor="lm")
            cx += cw
            if cx < W - 44:
                d.line([(cx, top), (cx, top + rh)], fill=INK, width=1)

    buf = io.BytesIO()
    sheet.image.save(buf, format="PNG", dpi=(DPI, DPI))
    return buf.getvalue()

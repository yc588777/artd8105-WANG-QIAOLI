"""Product-shot effect image: the photographed silver fan, with the current weave in the opening."""
from __future__ import annotations

import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from app.geometry.layers import compose_layers
from app.geometry.master_lock import REF_HEIGHT_MM, load_master, scale_of
from app.geometry.weave_ribbons import _cover_span, _disk_radius

ASSETS = Path(__file__).resolve().parent / "assets"
PLATE_PATH = ASSETS / "effect_plate.png"
OPENING_PATH = ASSETS / "effect_opening.png"
TUCK = 1.20
SUPERSAMPLE = 4
END_TUCK_MM = 14.0

_plate: np.ndarray | None = None
_opening: np.ndarray | None = None
_metal: np.ndarray | None = None


def _flood(walkable: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    h, w = walkable.shape
    seen = np.zeros((h, w), np.uint8)
    stack = [seed]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not walkable[y, x]:
            continue
        seen[y, x] = 1
        stack.append((y - 1, x))
        stack.append((y + 1, x))
        stack.append((y, x - 1))
        stack.append((y, x + 1))
    return seen.astype(bool)


def _dilate(mask: np.ndarray, steps: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(steps):
        nxt = out.copy()
        nxt[1:-1, 1:-1] = (
            out[1:-1, 1:-1]
            | out[:-2, 1:-1]
            | out[2:, 1:-1]
            | out[1:-1, :-2]
            | out[1:-1, 2:]
        )
        out = nxt
    return out


def _window_sum(mask: np.ndarray, radius: int) -> np.ndarray:
    values = np.pad(mask.astype(np.float32), radius)
    integral = np.zeros((values.shape[0] + 1, values.shape[1] + 1), np.float32)
    integral[1:, 1:] = values.cumsum(0).cumsum(1)
    span = radius * 2 + 1
    return (
        integral[span:, span:]
        - integral[:-span, span:]
        - integral[span:, :-span]
        + integral[:-span, :-span]
    )


def _erode(mask: np.ndarray, steps: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(steps):
        nxt = out.copy()
        nxt[1:-1, 1:-1] = (
            out[1:-1, 1:-1]
            & out[:-2, 1:-1]
            & out[2:, 1:-1]
            & out[1:-1, :-2]
            & out[1:-1, 2:]
        )
        out = nxt
    return out


def _silver(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    lum = (r.astype(np.int32) + g + b) / 3
    # The frame is neutral metal. Bamboo is warm, so a red-blue gap keeps it out of the mask.
    return (np.abs(r - b) < 16) & (np.abs(r - g) < 16) & (lum > 42) & (lum < 236)


def _outside(barrier: np.ndarray) -> np.ndarray:
    h, w = barrier.shape
    outside = np.zeros((h, w), np.uint8)
    stack = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)]
    stack += [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or outside[y, x] or barrier[y, x]:
            continue
        outside[y, x] = 1
        stack.append((y - 1, x))
        stack.append((y + 1, x))
        stack.append((y, x - 1))
        stack.append((y, x + 1))
    return outside.astype(bool)


def _connected(core: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    seen = np.zeros(core.shape, np.uint8)
    stack = seeds
    height, width = core.shape
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= height or x >= width or seen[y, x] or not core[y, x]:
            continue
        seen[y, x] = 1
        stack.append((y - 1, x))
        stack.append((y + 1, x))
        stack.append((y, x - 1))
        stack.append((y, x + 1))
    return seen.astype(bool)


def frame_mask(rgb: np.ndarray) -> np.ndarray:
    """Silver rim and handle. Engraving pits stay part of the frame; specks in the weave do not."""
    core = _silver(rgb)
    outside = _outside(core)
    contact = core & _dilate(outside, 1)
    seeds = [(int(y), int(x)) for y, x in zip(*np.nonzero(contact))]
    if not seeds:
        return core
    connected = _connected(core, seeds)
    # Close small gaps so dark scrollwork is not mistaken for the weave window.
    return _erode(_dilate(connected, 2), 2) | connected


def opening_from_plate(rgb: np.ndarray, metal: np.ndarray | None = None) -> np.ndarray:
    """The weave window: the one large hole inside the rim."""
    if metal is None:
        metal = frame_mask(rgb)
    outside = _outside(metal)
    enclosed = ~outside & ~metal
    counts = enclosed.sum(axis=1)
    y = int(np.argmax(counts))
    xs = np.flatnonzero(enclosed[y])
    if len(xs) == 0:
        return enclosed
    opening = _flood(enclosed, (y, int(xs[len(xs) // 2])))
    # Keep the detected silver, and also the dark lip that folds into the scrollwork.
    # A white pixel tucked into the filigree is a notch, so it stays on the photograph.
    opening = _erode(opening, 2)
    return opening & ~_notches(rgb, metal, opening)


def _notches(rgb: np.ndarray, metal: np.ndarray, opening: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    lum = (r.astype(np.int32) + g + b) / 3
    red_gap = r - b
    lip = (red_gap > 6) & (red_gap < 48) & (lum > 60) & (lum < 200)
    density = _window_sum(metal, 6)
    return opening & lip & (density > 0.22 * (13 * 13))


def _edge_alpha(opening: np.ndarray, metal: np.ndarray, plate: np.ndarray) -> np.ndarray:
    """Crisp inner edge. The gray lip stays photographic; the weave starts against it.

    Closing the rim fills notches in the filigree. Neutral pixels hugging the
    metal stay on the photograph, so a white cell cannot punch a pale bite
    into the scrollwork. One pixel on the boundary carries the coverage.
    """
    closed = _erode(_dilate(metal, 4), 4) | metal
    outside = _outside(closed)
    window = ~outside & ~closed & _dilate(opening, 8)
    red = plate[:, :, 0].astype(np.int16)
    blue = plate[:, :, 2].astype(np.int16)
    green = plate[:, :, 1].astype(np.int16)
    lum = (red.astype(np.int32) + green + blue) / 3
    lip = (np.abs(red - blue) < 22) & (np.abs(red - green) < 22) & (lum > 70) & (lum < 220)
    window = window & ~(lip & _dilate(metal, 4))
    alpha = window.astype(np.float32)
    edge = window & _dilate(~window & ~outside, 1)
    alpha[edge] = _window_sum(window, 1)[edge] / 9.0
    alpha[metal] = 0.0
    return alpha


def build_plate(source: Path) -> None:
    rgb = np.asarray(Image.open(source).convert("RGB"))
    metal = frame_mask(rgb)
    opening = opening_from_plate(rgb, metal)
    ASSETS.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(PLATE_PATH)
    Image.fromarray(np.where(opening, 255, 0).astype(np.uint8), "L").save(OPENING_PATH)
    global _plate, _opening, _metal
    _plate, _opening, _metal = rgb, opening, metal


def _load() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    global _plate, _opening, _metal
    if _plate is None or _opening is None or _metal is None:
        plate = np.asarray(Image.open(PLATE_PATH).convert("RGB"))
        metal = frame_mask(plate)
        _plate, _metal = plate, metal
        _opening = opening_from_plate(plate, metal)
    return _plate, _opening, _metal


def _fit(master: dict, opening: np.ndarray):
    inner = np.flipud(master["inner"])
    iy, ix = np.nonzero(inner)
    oy, ox = np.nonzero(opening)
    src_w = max(float(ix.max() - ix.min()), 1.0)
    src_h = max(float(iy.max() - iy.min()), 1.0)
    dst_w = float(ox.max() - ox.min())
    dst_h = float(oy.max() - oy.min())
    scale = max(dst_w / src_w, dst_h / src_h) * TUCK
    return (
        (float(ix.min() + ix.max()) * 0.5, float(iy.min() + iy.max()) * 0.5),
        (float(ox.min() + ox.max()) * 0.5, float(oy.min() + oy.max()) * 0.5),
        scale,
    )


def _rgb(color) -> tuple[int, int, int]:
    vals = np.asarray(color).reshape(-1)
    return tuple(int(v) for v in vals[:3])


def _extend(line: np.ndarray, extra: float) -> np.ndarray:
    """Carry each end along its tangent so the strip disappears under the metal rim."""
    if len(line) < 2 or extra <= 0:
        return line
    out = np.array(line, np.float32, copy=True)
    for start, step in ((0, 1), (len(out) - 1, -1)):
        delta = out[start, :2] - out[start + step, :2]
        norm = float(np.hypot(delta[0], delta[1]))
        if norm < 1e-4:
            continue
        out[start, :2] = out[start, :2] + delta / norm * extra
    return out


def _smooth(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if len(pts) < 3:
        return pts
    nxt = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        nxt.append((a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25))
        nxt.append((a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75))
    nxt.append(pts[-1])
    return nxt


def _mix(color: tuple[int, int, int], gain: float, toward: tuple[int, int, int] = (255, 248, 236)) -> tuple[int, int, int]:
    return tuple(int(np.clip(c * gain + t * (1.0 - gain) * 0.15, 0, 255)) for c, t in zip(color, toward))


def _resample(pts: list[tuple[float, float]], spacing: float) -> np.ndarray:
    p = np.asarray(pts, np.float32)
    if len(p) < 2:
        return p
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    total = float(seg.sum())
    if total < spacing * 1.5:
        return p
    count = max(2, int(total / spacing) + 1)
    samples = np.linspace(0.0, total, count)
    dist = np.concatenate([[0.0], np.cumsum(seg)])
    out = np.empty((count, 2), np.float32)
    j = 0
    for i, s in enumerate(samples):
        while j < len(seg) - 1 and dist[j + 1] < s:
            j += 1
        span = max(float(seg[j]), 1e-4)
        t = float(np.clip((s - dist[j]) / span, 0.0, 1.0))
        out[i] = p[j] * (1.0 - t) + p[j + 1] * t
    return out


def _frame(p: np.ndarray) -> np.ndarray:
    delta = np.zeros_like(p)
    delta[1:-1] = p[2:] - p[:-2]
    delta[0] = p[min(1, len(p) - 1)] - p[0]
    delta[-1] = p[-1] - p[max(0, len(p) - 2)]
    length = np.maximum(np.linalg.norm(delta, axis=1, keepdims=True), 1e-4)
    tang = delta / length
    return np.stack([-tang[:, 1], tang[:, 0]], axis=1)


def _poly(draw: ImageDraw.ImageDraw, left: np.ndarray, right: np.ndarray, color: tuple[int, int, int]) -> None:
    ring = np.vstack([left, right[::-1]])
    draw.polygon([(float(x), float(y)) for x, y in ring], fill=color)


def _slat_color(color: tuple[int, int, int], index: int) -> tuple[int, int, int]:
    """Map a design color onto the photographed fan's bamboo.

    Pale, gold, and chocolate slats alternate, matching the reference medians.
    A clearly red strip stays red.
    """
    red, green, blue = color
    # 赭红篾 stays red. 本色篾 is warm too, so the test requires a low green.
    if red > 130 and green * 10 < red * 7 and blue * 20 < red * 11 and red > green + 36:
        gain = (1.0, 0.92, 0.84, 0.96)[index % 4]
        return tuple(int(np.clip(channel * gain, 0, 255)) for channel in color)
    palette = (
        (246, 210, 156),
        (122, 70, 36),
        (230, 172, 98),
        (98, 56, 28),
    )
    target = palette[index % len(palette)]
    mixed = [tone * 0.94 + channel * 0.06 for tone, channel in zip(target, color)]
    jitter = ((index * 13) % 7) - 3
    mixed[0] += jitter
    mixed[1] += jitter * 0.6
    return tuple(int(np.clip(channel, 0, 255)) for channel in mixed)


def _tone(color: tuple[int, int, int], gain: float) -> tuple[int, int, int]:
    return tuple(int(np.clip(channel * gain, 0, 255)) for channel in color)


def _shade_at(offset: float) -> float:
    """Broad warm face, with the darker cut edge only at the rim."""
    span = abs(offset)
    sheen = 0.06 * float(np.exp(-((offset - 0.10) ** 2) / 0.12))
    if span < 0.78:
        return 0.96 + sheen
    rim = (span - 0.78) / 0.22
    return (0.96 + sheen) * (1.0 - rim) + 0.60 * rim


def _line(draw: ImageDraw.ImageDraw, path: np.ndarray, color: tuple[int, int, int], width: int) -> None:
    if len(path) < 2:
        return
    draw.line([(float(x), float(y)) for x, y in path], fill=color, width=width)


def _ribbon(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], color: tuple[int, int, int], width: float, caps: bool) -> None:
    """A photographed bamboo slat: warm body, fine long grain, and a cut edge."""
    pts = _smooth(pts)
    if len(pts) < 2 or width < 1.2:
        return
    half = width * 0.5
    p = _resample(pts, max(3.2, width * 0.48))
    if len(p) < 2:
        return
    normal = _frame(p)
    length = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))])
    phase = float((color[0] * 0.17 + color[1] * 0.11 + color[2] * 0.07) % 6.2832)
    grain = 0.985 + 0.02 * np.sin(length / 58.0 + phase) + 0.012 * np.sin(length / 19.0 + phase * 1.4)
    stops = np.linspace(-1.0, 1.0, 11)
    mids = (stops[:-1] + stops[1:]) * 0.5
    shade = np.array([_shade_at(float(mid)) for mid in mids])
    chunk = max(8, len(p) // 12)
    for start, end, gain in zip(stops[:-1], stops[1:], shade):
        for i0 in range(0, len(p) - 1, chunk):
            i1 = min(len(p) - 1, i0 + chunk)
            tone = _tone(color, float(gain * grain[i0]))
            _poly(
                draw,
                p[i0:i1 + 1] + normal[i0:i1 + 1] * (float(start) * half),
                p[i0:i1 + 1] + normal[i0:i1 + 1] * (float(end) * half),
                tone,
            )
    thread = max(3, int(round(width * 0.09)))
    for offset, gain in ((-0.58, 0.78), (-0.30, 0.88), (0.02, 0.80), (0.32, 0.90), (0.60, 0.76)):
        _line(draw, p + normal * (offset * half), _tone(color, _shade_at(offset) * gain), thread)
    edge_w = max(2, int(round(width * 0.07)))
    edge = _tone(color, 0.58)
    _line(draw, p + normal * (0.97 * half), edge, edge_w)
    _line(draw, p - normal * (0.97 * half), edge, edge_w)
    sheen = _tone(color, 1.08)
    if color[0] > 190:
        sheen = tuple(int(channel * 0.82 + cream * 0.18) for channel, cream in zip(sheen, (255, 236, 198)))
    _line(draw, p + normal * (0.14 * half), sheen, max(2, int(round(width * 0.08))))
    if not caps or float(np.hypot(*(p[0] - p[-1]))) < width:
        return
    for end_pt in (p[0], p[-1]):
        rad = half * 0.98
        draw.ellipse(
            (float(end_pt[0] - rad), float(end_pt[1] - rad), float(end_pt[0] + rad), float(end_pt[1] + rad)),
            fill=_tone(color, 0.92),
        )


def _stroke(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], color: tuple[int, int, int], width: float, caps: bool = True) -> None:
    _ribbon(draw, pts, color, width, caps)


def _paint(master: dict, factor: float, strands: list[tuple], crossings: list[dict] | None, plate: np.ndarray, opening: np.ndarray, metal: np.ndarray) -> Image.Image:
    h, w = plate.shape[:2]
    (scx, scy), (dcx, dcy), scale = _fit(master, opening)
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor
    mh = master["solid"].shape[0]
    step = SUPERSAMPLE

    def to_px(line: np.ndarray) -> list[tuple[float, float]]:
        col = (line[:, 0] - x0) / pitch
        row = mh - 1 - (line[:, 1] - y0) / pitch
        px = (dcx + (col - scx) * scale) * step
        py = (dcy + (row - scy) * scale) * step
        return [(float(a), float(b)) for a, b in zip(px, py)]

    canvas = Image.new("RGB", (w * step, h * step), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    slat_colors: list[tuple[int, int, int]] = []
    for index, item in enumerate(strands):
        raw = np.asarray(item[0], np.float32)
        color = _slat_color(_rgb(item[1]), index)
        slat_colors.append(color)
        width = float(item[2])
        disk = _disk_radius(raw, width)
        line = raw if disk is not None else _extend(raw, END_TUCK_MM)
        if disk is not None:
            center, radius = disk
            px = to_px(np.asarray([center], np.float32))[0]
            rad = radius / max(float(pitch), 0.05) * scale * step
            draw.ellipse((px[0] - rad, px[1] - rad, px[0] + rad, px[1] + rad), fill=_mix(color, 0.62))
            inner = rad * 0.78
            draw.ellipse((px[0] - inner, px[1] - inner, px[0] + inner, px[1] + inner), fill=color)
            shine = rad * 0.28
            draw.ellipse((px[0] - shine * 1.4, px[1] - shine * 1.6, px[0] + shine * 0.4, px[1] - shine * 0.2), fill=_mix(color, 0.5, (255, 252, 244)))
            continue
        _stroke(draw, to_px(line), color, max(1.0, width / max(float(pitch), 0.05) * scale * step))
    for item in crossings or []:
        over_i, under_i = int(item["over"]), int(item["under"])
        if over_i >= len(strands) or under_i >= len(strands):
            continue
        over = strands[over_i]
        over_line = np.asarray(over[0], np.float32)
        under_line = np.asarray(strands[under_i][0], np.float32)
        if len(over_line) < 2 or len(under_line) < 2:
            continue
        point = np.array([float(item["x"]), float(item["y"])], np.float32)
        oi = int(np.argmin(np.linalg.norm(over_line[:, :2] - point, axis=1)))
        ui = int(np.argmin(np.linalg.norm(under_line[:, :2] - point, axis=1)))
        ot = over_line[min(oi + 1, len(over_line) - 1), :2] - over_line[max(oi - 1, 0), :2]
        ut = under_line[min(ui + 1, len(under_line) - 1), :2] - under_line[max(ui - 1, 0), :2]
        on, un = float(np.linalg.norm(ot)), float(np.linalg.norm(ut))
        if on < 1e-6 or un < 1e-6:
            continue
        sin_a = max(abs(float(ot[0] / on * ut[1] / un - ot[1] / on * ut[0] / un)), 0.35)
        reach = float(strands[under_i][2]) * 0.5 / sin_a + float(over[2]) * 0.55
        span = _cover_span(over_line, oi, reach)
        if len(span) < 2:
            continue
        span_w = max(1.0, float(over[2]) / max(float(pitch), 0.05) * scale * step)
        _stroke(draw, to_px(span), slat_colors[over_i], span_w, caps=False)
    woven = np.asarray(canvas.resize((w, h), Image.Resampling.LANCZOS))
    alpha = _edge_alpha(opening, metal, plate)
    mixed = woven.astype(np.float32) * alpha[..., None] + plate.astype(np.float32) * (1.0 - alpha[..., None])
    out = np.clip(np.round(mixed), 0, 255).astype(np.uint8)
    out[metal] = plate[metal]
    return Image.fromarray(out, "RGB")


def effect_image(params: dict) -> Image.Image:
    plate, opening, metal = _load()
    master = load_master()
    target = float(np.clip(params.get("target_height", REF_HEIGHT_MM), 120.0, 220.0))
    factor = scale_of(master, target)
    strands, meta = compose_layers(master, params, factor, "draft")
    if not strands:
        blank = np.full_like(plate, 255)
        blank[metal] = plate[metal]
        return Image.fromarray(blank, "RGB")
    return _paint(master, factor, strands, meta.get("crossing_table"), plate, opening, metal)


def effect_png(params: dict) -> bytes:
    image = effect_image(params)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()

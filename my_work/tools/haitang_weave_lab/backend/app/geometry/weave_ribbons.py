"""Bamboo ribbons clipped to the master inner opening.

The same strand list feeds the 2D plan and the 3D mesh. Patterns may change
paths, density, width, order and color. They do not move the frame.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

BAMBOO = np.array(
    [
        [232, 206, 164],
        [196, 150, 92],
        [148, 102, 60],
        [92, 64, 40],
    ],
    dtype=np.uint8,
)
ACCENT = np.array([176, 68, 46], dtype=np.uint8)


def _sample_step(quality: str) -> float:
    return {"draft": 1.45, "recommended": 0.95, "high": 0.62}.get(quality, 1.45)


def _inside(master: dict, factor: float, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    from app.geometry.master_lock import _sample_mask

    return _sample_mask(master["inner"], master, x, y, factor)


def _bounds(master: dict, factor: float) -> tuple[float, float, float, float, tuple[float, float]]:
    inner = master["inner"]
    ys, xs = np.nonzero(inner)
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor
    x_min = float(xs.min() * pitch + x0)
    x_max = float(xs.max() * pitch + x0)
    y_min = float(ys.min() * pitch + y0)
    y_max = float(ys.max() * pitch + y0)
    focus = ((x_min + x_max) * 0.5, y_min - 1.5)
    return x_min, x_max, y_min, y_max, focus


def _resample(line: np.ndarray, step: float) -> np.ndarray:
    if len(line) < 2:
        return line
    delta = np.diff(line, axis=0)
    seg = np.linalg.norm(delta, axis=1)
    total = float(seg.sum())
    if total < step:
        return line[:1]
    count = max(2, int(np.ceil(total / step)) + 1)
    dist = np.concatenate([[0.0], np.cumsum(seg)])
    target = np.linspace(0.0, total, count)
    out = np.empty((count, 2), np.float32)
    out[:, 0] = np.interp(target, dist, line[:, 0])
    out[:, 1] = np.interp(target, dist, line[:, 1])
    return out


def _length(line: np.ndarray) -> float:
    if len(line) < 2:
        return 0.0
    return float(np.linalg.norm(np.diff(line, axis=0), axis=1).sum())


def _closed(line: np.ndarray) -> bool:
    return len(line) > 4 and float(np.linalg.norm(line[0] - line[-1])) <= 2.4


def _chaikin(line: np.ndarray, iterations: int = 1) -> np.ndarray:
    if len(line) < 3 or iterations < 1:
        return line
    closed = _closed(line)
    current = line[:-1].copy() if closed else line
    for _ in range(iterations):
        count = len(current)
        if count < 3:
            break
        nxt = []
        span = count if closed else count - 1
        if not closed:
            nxt.append(current[0])
        for index in range(span):
            a = current[index]
            b = current[(index + 1) % count]
            nxt.append(a * 0.75 + b * 0.25)
            nxt.append(a * 0.25 + b * 0.75)
        if not closed:
            nxt.append(current[-1])
        current = np.asarray(nxt, np.float32)
    if closed and len(current):
        current = np.vstack([current, current[:1]])
    return np.asarray(current, np.float32)


def _mask_at(master: dict, key: str, factor: float, point: np.ndarray) -> bool:
    from app.geometry.master_lock import _sample_mask

    return bool(_sample_mask(master[key], master, np.array([point[0]]), np.array([point[1]]), factor)[0])


def _extend_end(line: np.ndarray, at_start: bool, master: dict, factor: float) -> tuple[np.ndarray, bool]:
    """Run the tip through the opening and bury it inside the solid frame."""
    bury = 3.0
    step = 0.65
    origin_index = 0 if at_start else -1
    back_index = min(4, len(line) - 1) if at_start else max(-5, -len(line))
    origin = line[origin_index].astype(np.float32)
    direction = origin - line[back_index]
    norm = float(np.linalg.norm(direction))
    if norm < 1e-4:
        inside = _mask_at(master, "solid", factor, origin) and not _mask_at(master, "inner", factor, origin)
        return line, inside
    direction /= norm
    cursor = origin.copy()
    extra = []
    anchored = _mask_at(master, "solid", factor, origin) and not _mask_at(master, "inner", factor, origin)
    buried = 0.0
    for _ in range(64):
        nxt = cursor + direction * step
        if not _mask_at(master, "solid", factor, nxt):
            break
        if _mask_at(master, "guard", factor, nxt):
            if not _mask_at(master, "inner", factor, nxt):
                extra.append(nxt.copy())
                anchored = True
            break
        if anchored and _mask_at(master, "inner", factor, nxt):
            break
        if anchored and not _mask_at(master, "solid", factor, nxt + direction * 2.8):
            break
        cursor = nxt
        extra.append(cursor.copy())
        if not _mask_at(master, "inner", factor, cursor):
            anchored = True
            buried += step
            if buried >= bury:
                break
    if not extra:
        return line, anchored
    extra_line = np.asarray(extra, np.float32)
    if at_start:
        return np.vstack([extra_line[::-1], line]), anchored
    return np.vstack([line, extra_line]), anchored


def repair_run(master: dict, factor: float, line: np.ndarray, width: float, step: float) -> tuple[np.ndarray | None, str]:
    """Resample, round corners, hide ends under the frame, and drop stubs."""
    line = _chaikin(np.asarray(line, np.float32), 1)
    line = _resample(line, step)
    if len(line) < 2:
        return None, "short"
    if not _closed(line):
        line, start_ok = _extend_end(line, True, master, factor)
        line, end_ok = _extend_end(line, False, master, factor)
        if not (start_ok and end_ok):
            return None, "unanchored"
        line = _resample(line, step)
    minimum = max(4.0 * float(width), 20.0)
    if _length(line) < minimum:
        return None, "short"
    return line, "ok"


def _clip(master: dict, factor: float, line: np.ndarray, step: float) -> list[np.ndarray]:
    line = _resample(np.asarray(line, np.float32), step)
    if len(line) < 2:
        return []
    ok = _inside(master, factor, line[:, 0], line[:, 1])
    if not ok.any():
        return []
    cuts = np.diff(ok.astype(np.int8))
    starts = list(np.flatnonzero(cuts == 1) + 1)
    ends = list(np.flatnonzero(cuts == -1) + 1)
    if ok[0]:
        starts = [0, *starts]
    if ok[-1]:
        ends = [*ends, len(ok)]
    runs = []
    for start, end in zip(starts, ends):
        if end - start >= 2:
            runs.append(line[start:end])
    return runs


def _tone(index: int, seed: int, accent_every: int) -> np.ndarray:
    if accent_every > 0 and (index + seed) % accent_every == 0:
        return ACCENT
    return BAMBOO[(index + seed) % len(BAMBOO)]


def _pitch(width: float, density: float, print_safe: bool) -> float:
    width = float(np.clip(width, 0.8, 4.5))
    density = float(np.clip(density, 0.35, 2.8))
    gap = 2.0 if print_safe else max(0.35, width * 0.28)
    return max((width + gap) / density, width * 1.15)


def _radial(master, factor, params, step, x0, x1, y0, y1, focus) -> list[tuple]:
    from app.geometry.pattern_fields import radial_paths

    return radial_paths(master, factor, params, step, x0, x1, y0, y1, focus)


def _ripple(master, factor, params, step, x0, x1, y0, y1, focus) -> list[tuple]:
    from app.geometry.pattern_fields import ripple_paths

    return ripple_paths(master, factor, params, step, x0, x1, y0, y1, focus)


def _diamond(master, factor, params, step, x0, x1, y0, y1, focus) -> list[tuple]:
    del focus
    if float(params.get("center_spacing") or 0) >= 2.5:
        from app.geometry.diamond_field import reference_diamond_paths

        return reference_diamond_paths(master, factor, params, step, x0, x1, y0, y1)
    base = np.deg2rad(35.0 + float(params.get("weave_angle", 0)))
    span = max(x1 - x0, y1 - y0) * 1.4
    cx = (x0 + x1) * 0.5
    cy = (y0 + y1) * 0.5
    part = str(params.get("diamond_part", "both"))
    families = ((0, 1.0), (1, -1.0)) if part == "both" else (((0, 1.0),) if part == "a" else ((1, -1.0),))
    power = float(np.clip(params.get("edge_compression", 0.82), 0.55, 1.0))
    strength = float(np.clip(params.get("rotation_strength", 0.2), 0.0, 1.4))
    strands = []
    for family, sign in families:
        width = params["wu"] if family == 0 else params["wv"]
        pitch = _pitch(width, params["density_u"] if family == 0 else params["density_v"], params["print_safe"])
        angle = base if family == 0 else -base
        direction = np.array([np.cos(angle), np.sin(angle)], np.float32)
        normal = np.array([-direction[1], direction[0]], np.float32)
        offsets = np.arange(-span, span, pitch)
        samples = np.linspace(-span, span, 90).astype(np.float32)
        travel = np.linspace(0.0, 1.0, len(samples), dtype=np.float32)
        bend = strength * (8.0 + (1.0 - power) * 14.0) * np.sin(np.pi * travel)
        for i, offset in enumerate(offsets):
            line = np.column_stack([
                cx + normal[0] * offset + direction[0] * samples + normal[0] * bend,
                cy + normal[1] * offset + direction[1] * samples + normal[1] * bend,
            ]).astype(np.float32)
            color = _tone(i + family, int(params["seed"]), 0)
            for run in _clip(master, factor, line, step):
                strands.append((run, color, width, sign if i % 2 == 0 else -sign))
    return strands


def _cellular(master, factor, params, step, x0, x1, y0, y1, focus) -> list[tuple]:
    del focus
    from app.geometry.pattern_fields import cellular_paths_field

    return cellular_paths_field(master, factor, params, step, x0, x1, y0, y1)


def _plain(master, factor, params, step, x0, x1, y0, y1, focus):
    tuned = dict(params)
    tuned["amplitude"] = 0.45
    tuned["frequency"] = 0.55
    tuned["accent_every"] = 0
    return _ripple(master, factor, tuned, step, x0, x1, y0, y1, focus)


def strands_for(master: dict, params: dict, factor: float, quality: str) -> list[tuple]:
    pattern = str(params.get("pattern", "radial"))
    if pattern == "blank" or not master["inner"].any():
        return []
    step = _sample_step(quality)
    x0, x1, y0, y1, focus = _bounds(master, factor)
    tuned = {
        "wu": max(float(params.get("strand_width_u", 1.6)), 1.4 if params.get("print_safe", True) else 0.9),
        "wv": max(float(params.get("strand_width_v", 1.6)), 1.4 if params.get("print_safe", True) else 0.9),
        "density_u": float(params.get("density_u", 1.2)),
        "density_v": float(params.get("density_v", 1.2)),
        "print_safe": bool(params.get("print_safe", True)),
        "seed": int(params.get("seed", 1)),
        "amplitude": float(params.get("amplitude", 2.4)),
        "frequency": float(params.get("frequency", 1.4)),
        "weave_angle": float(params.get("weave_angle", 0)),
        "cell_aspect": float(params.get("cell_aspect", 1)),
        "randomness": float(params.get("randomness", 0) or 0),
        "spoke_count": int(params.get("spoke_count") or 0),
        "ring_count": int(params.get("ring_count") or 0),
        "radial_part": str(params.get("radial_part", "both")),
        "ripple_part": str(params.get("ripple_part", "both")),
        "diamond_part": str(params.get("diamond_part", "both")),
        "accent_every": int(params.get("accent_every", 5)),
        "include_basket": bool(params.get("include_basket", True)),
        "edge_compression": float(params.get("edge_compression", 0.82) or 0.82),
        "bundle_count": int(params.get("bundle_count") or 1),
        "wave_phase": float(params.get("wave_phase", params.get("seed", 1))),
        "rotation_strength": float(params.get("rotation_strength", 0.2) or 0.0),
        "center_spacing": float(params.get("center_spacing") or 0),
        "direction_a": float(params.get("direction_a") or 0),
        "direction_b": float(params.get("direction_b") or 0),
        "arc_a": float(params.get("arc_a") or 0),
        "arc_b": float(params.get("arc_b") or 0),
        "edge_spacing": float(params.get("edge_spacing") or 0),
        "secondary_strength": float(params.get("secondary_strength") or 0.7),
        "structural_strength": float(params.get("structural_strength") or 0),
        "binder_density": float(params.get("binder_density") or 0),
        "support_level": str(params.get("support_level") or "off"),
        "support_density": float(params.get("support_density") or 0),
        "support_motif": str(params.get("support_motif") or "bar-h"),
        "support_motifs": params.get("support_motifs", None),
        "support_size": float(params.get("support_size") or 3.2),
    }
    builders = {
        "radial": _radial,
        "ripple": _ripple,
        "diamond": _diamond,
        "cellular": _cellular,
        "plain": _plain,
        "twill": _diamond,
    }
    return builders.get(pattern, _radial)(master, factor, tuned, step, x0, x1, y0, y1, focus)


def _rounded_profile(width: float, thick: float) -> np.ndarray:
    """Rounded rectangle in the (normal, thickness) plane. Eight corners, not a tube."""
    half_w = max(float(width), float(thick) * 1.7) * 0.5
    half_t = float(thick) * 0.5
    radius = min(half_t * 0.45, half_w * 0.18)
    inner_w = half_w - radius
    inner_t = max(half_t - radius, half_t * 0.55)
    crown = half_t * 0.08
    return np.array(
        [
            [half_w, inner_t * 0.35],
            [inner_w, half_t + crown],
            [-inner_w, half_t + crown],
            [-half_w, inner_t * 0.35],
            [-half_w, -inner_t],
            [-inner_w, -half_t],
            [inner_w, -half_t],
            [half_w, -inner_t],
        ],
        np.float32,
    )


def mesh_from_strands(strands: list[tuple], params: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    print_safe = bool(params.get("print_safe", True))
    requested = float(params.get("t_max", 2.2))
    custom = params.get("ribbon_thickness")
    if custom is not None and float(custom) > 0:
        thick = float(np.clip(float(custom), 0.6, 2.2))
    elif params.get("_flat_section", True):
        thick = requested if requested <= 1.35 else 1.15
        thick = float(np.clip(thick, 0.55, 1.25))
    elif print_safe:
        thick = float(np.clip(max(requested, 1.8), 1.8, 2.5))
    else:
        thick = float(np.clip(requested, 0.55, 1.25))
    params["_used_thick"] = thick
    relief = 0.0 if print_safe else float(np.clip(params.get("relief", 0.6), 0.0, 1.2)) * 0.55
    # Sit just behind the front skin plane so the guard, which is proud of that plane, stays in front.
    z_center = 1.7
    positions: list[np.ndarray] = []
    indices: list[np.ndarray] = []
    colors: list[np.ndarray] = []
    base = 0
    for item in strands:
        line, color, width, z_sign = item[0], item[1], item[2], item[3]
        profile_z = item[4] if len(item) > 4 and not np.isscalar(item[4]) else None
        strand_thick = float(item[5]) * (thick / 1.2) if len(item) > 5 and np.isscalar(item[5]) else thick
        strand_thick = float(np.clip(strand_thick, 0.45, max(thick, 0.45)))
        frame_half = max(float(params.get("rim_depth", 7) or 7) * 0.5 - 0.2, 0.35)
        if params.get("_flat_section", True):
            width = max(float(width), strand_thick * 1.7)
        else:
            width = max(float(width), 2.2)
        n = len(line)
        if n < 2:
            continue
        closed = _closed(line)
        if closed:
            line = line[:-1]
            n = len(line)
            if profile_z is not None and len(profile_z) == n + 1:
                profile_z = profile_z[:-1]
        if n < 2:
            continue
        nxt = np.roll(line, -1, axis=0) if closed else np.vstack([line[1:], line[-1]])
        prev = np.roll(line, 1, axis=0) if closed else np.vstack([line[:1], line[:-1]])
        tangent = nxt - prev
        tangent /= np.maximum(np.linalg.norm(tangent, axis=1, keepdims=True), 1e-6)
        normal = np.stack([-tangent[:, 1], tangent[:, 0]], axis=1)
        if profile_z is not None and len(profile_z) == n:
            z = np.asarray(profile_z, np.float32)
        else:
            z = np.full(n, z_center + float(z_sign) * relief, np.float32)
        section = _rounded_profile(float(width), strand_thick)
        count = len(section)
        verts = np.empty((n * count, 3), np.float32)
        for corner, (nu, zv) in enumerate(section):
            verts[corner::count, 0] = line[:, 0] + normal[:, 0] * nu
            verts[corner::count, 1] = line[:, 1] + normal[:, 1] * nu
            verts[corner::count, 2] = np.clip(z + zv, -frame_half, frame_half)
        spans = n if closed else n - 1
        faces_flat: list[int] = []
        for i in range(spans):
            j = (i + 1) % n
            for corner in range(count):
                nxt_corner = (corner + 1) % count
                a = i * count + corner
                b = i * count + nxt_corner
                c = j * count + nxt_corner
                d = j * count + corner
                faces_flat.extend((a, b, c, a, c, d))
        if not closed:
            center_a = len(verts)
            center_b = center_a + 1
            extra = np.vstack([
                np.array([line[0, 0], line[0, 1], z[0]], np.float32),
                np.array([line[-1, 0], line[-1, 1], z[-1]], np.float32),
            ])
            verts = np.vstack([verts, extra])
            for corner in range(count):
                nxt_corner = (corner + 1) % count
                faces_flat.extend((center_a, corner, nxt_corner))
                faces_flat.extend((
                    center_b,
                    (n - 1) * count + nxt_corner,
                    (n - 1) * count + corner,
                ))
        faces = np.asarray(faces_flat, np.uint32).reshape(-1, 3)
        positions.append(verts)
        indices.append(faces + base)
        colors.append(np.tile(np.asarray(color, np.uint8), (len(verts), 1)))
        base += len(verts)
    if not positions:
        return np.zeros((0, 3), np.float32), np.zeros((0, 3), np.uint32), np.zeros((0, 3), np.uint8)
    return np.concatenate(positions), np.concatenate(indices), np.concatenate(colors)


def _close_mask(mask: np.ndarray, times: int) -> np.ndarray:
    cur = mask.copy()
    for _ in range(times):
        grown = cur.copy()
        grown[1:] |= cur[:-1]
        grown[:-1] |= cur[1:]
        grown[:, 1:] |= cur[:, :-1]
        grown[:, :-1] |= cur[:, 1:]
        cur = grown
    for _ in range(times):
        nxt = cur.copy()
        nxt[1:-1, 1:-1] = (
            cur[1:-1, 1:-1]
            & cur[:-2, 1:-1]
            & cur[2:, 1:-1]
            & cur[1:-1, :-2]
            & cur[1:-1, 2:]
        )
        cur = nxt
    return cur


def _disk_radius(line: np.ndarray, width: float):
    """A circle whose stroke reaches the center is a solid disk of the outer radius."""
    if not _closed(line):
        return None
    body = line[:-1]
    if len(body) < 8:
        return None
    center = body.mean(axis=0)
    radii = np.linalg.norm(body - center, axis=1)
    mean = float(radii.mean())
    if mean < 0.4 or float(radii.std()) > mean * 0.18:
        return None
    if width < mean * 1.5:
        return None
    return center, mean + width * 0.5


MARK_COLORS = {
    "free_end": (196, 52, 40),
    "shallow": (214, 120, 30),
    "unanchored": (196, 52, 40),
    "gap": (196, 52, 40),
    "short": (154, 123, 73),
    "loose": (120, 60, 160),
}


def paint_plan(master: dict, params: dict, factor: float, strands: list[tuple], marks: list[dict] | None = None, crossings: list[dict] | None = None) -> Image.Image:
    image = _paint_strands(master, params, factor, strands, crossings)
    if not marks:
        return image
    draw = ImageDraw.Draw(image)
    h = master["solid"].shape[0]
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor
    radius = 3.2 / max(float(pitch), 0.05)
    for mark in marks:
        cx = (float(mark["x"]) - x0) / pitch
        cy = h - 1 - (float(mark["y"]) - y0) / pitch
        color = MARK_COLORS.get(str(mark.get("kind")), (196, 52, 40))
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color, width=max(2, int(radius / 4)))
    return image


def _cover_span(line: np.ndarray, index: int, reach: float) -> np.ndarray:
    """The part of a centerline that lies within `reach` millimetres of one crossing."""
    i0 = index
    walked = 0.0
    while i0 > 0 and walked < reach:
        walked += float(np.hypot(*(line[i0, :2] - line[i0 - 1, :2])))
        i0 -= 1
    i1 = index
    walked = 0.0
    last = len(line) - 1
    while i1 < last and walked < reach:
        walked += float(np.hypot(*(line[i1 + 1, :2] - line[i1, :2])))
        i1 += 1
    return line[i0:i1 + 1]


def _paint_strands(master: dict, params: dict, factor: float, strands: list[tuple], crossings: list[dict] | None = None) -> Image.Image:
    solid = master["solid"]
    inner = _close_mask(master["inner"], 5)
    guard = master["guard"]
    h, w = solid.shape
    rgb = np.full((h, w, 3), 244, np.uint8)
    rgb[np.flipud(solid)] = (186, 186, 190)
    rgb[np.flipud(inner)] = (245, 240, 232)
    image = Image.fromarray(rgb, "RGB")
    draw = ImageDraw.Draw(image)
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor

    def to_px(line: np.ndarray) -> list[tuple[float, float]]:
        col = (line[:, 0] - x0) / pitch
        row = (line[:, 1] - y0) / pitch
        return [(float(c), float(h - 1 - r)) for c, r in zip(col, row)]

    for item in strands:
        line, color, width = item[0], item[1], item[2]
        fill = tuple(int(v) for v in color)
        disk = _disk_radius(line, float(width))
        if disk is not None:
            center, radius = disk
            px = to_px(np.asarray([center], np.float32))[0]
            rad = radius / max(float(pitch), 0.05)
            draw.ellipse((px[0] - rad, px[1] - rad, px[0] + rad, px[1] + rad), fill=fill)
            continue
        px_width = max(1, int(round(float(width) / max(pitch, 0.05))))
        draw.line(to_px(line), fill=fill, width=px_width)
    for item in crossings or []:
        over_i, under_i = int(item["over"]), int(item["under"])
        if over_i >= len(strands) or under_i >= len(strands):
            continue
        over, under = strands[over_i], strands[under_i]
        over_line = np.asarray(over[0], np.float32)
        under_line = np.asarray(under[0], np.float32)
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
        over_w, under_w = float(over[2]), float(under[2])
        reach = under_w * 0.5 / sin_a + over_w * 0.55
        span = _cover_span(over_line, oi, reach)
        if len(span) < 2:
            continue
        fill = tuple(int(v) for v in over[1])
        px_width = max(1, int(round(over_w / max(pitch, 0.05))))
        ink = tuple(max(0, int(v * 0.42)) for v in fill)
        draw.line(to_px(span), fill=ink, width=px_width + 2)
        draw.line(to_px(span), fill=fill, width=px_width)
    painted = np.asarray(image).copy()
    # Row 0 of the mask is the handle tip, which is the bottom of the flipped image.
    shell = np.flipud(solid & ~inner)
    heart = np.flipud(guard)
    painted[shell] = (186, 186, 190)
    painted[heart] = (132, 134, 138)
    extra = float(params.get("rim_width", 0) or 0) - 3.6
    if extra > 0.8:
        steps = int(np.clip(round(extra / max(pitch, 0.05)), 1, 18))
        core = inner.copy()
        for _ in range(steps):
            nxt = core.copy()
            nxt[1:-1, 1:-1] = (
                core[1:-1, 1:-1]
                & core[:-2, 1:-1]
                & core[2:, 1:-1]
                & core[1:-1, :-2]
                & core[1:-1, 2:]
            )
            core = nxt
        lip = np.flipud(inner & ~core & ~guard)
        painted[lip] = (186, 186, 190)
    return Image.fromarray(painted, "RGB")

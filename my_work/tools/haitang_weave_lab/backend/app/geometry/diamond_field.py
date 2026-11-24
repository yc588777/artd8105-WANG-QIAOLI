"""Symmetric rotating-diamond field.

Center spacing stays wider than edge spacing. The second family is the
mirror of the first, so the lattice cannot drift left or right.
"""
from __future__ import annotations

import numpy as np

from app.geometry.master_lock import _sample_mask
from app.geometry.weave_ribbons import ACCENT, BAMBOO, _resample

REFERENCE_ASPECT = 0.66012
REFERENCE_DEPTH_RATIO = 0.05023
LIGHT = np.array([214, 186, 148], np.uint8)
DARK = np.array([118, 84, 58], np.uint8)


def solid_frame_mesh(master: dict, factor: float, rim_width: float, rim_depth: float = 7.0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Solid rim. Width offsets the inner edge. Depth scales thickness, down to 1 mm."""
    from app.geometry.master_lock import _dilate, _erode
    from app.geometry.weave_ribbons import _close_mask

    empty = (
        np.zeros((0, 3), np.float32),
        np.zeros((0, 3), np.uint32),
        np.zeros((0, 3), np.uint8),
    )
    guard = master["guard"]
    opening = _close_mask(master["inner"], 5) & ~_dilate(guard, 1)
    pitch_mm = float(master["pitch"] * master["scale"] * factor)
    delta = float(np.clip(rim_width, 1.0, 12.0)) - 3.6
    steps = int(round(abs(delta) / max(pitch_mm, 0.05)))
    if steps > 0 and delta > 0:
        opening = _erode(opening, steps) & ~_dilate(guard, 1)
    elif steps > 0:
        opening = _dilate(opening, steps) & master["solid"] & ~_dilate(guard, 1)
    rim = _erode(master["solid"], 4) & ~opening & ~_dilate(guard, 2)
    rim[: int(master["neck_row"])] = False
    cell = max(2, int(round(0.36 / max(pitch_mm, 0.05))))
    height, width = rim.shape
    cropped_h = (height // cell) * cell
    cropped_w = (width // cell) * cell
    if cropped_h < cell or cropped_w < cell or not rim.any():
        return empty
    blocks = rim[:cropped_h, :cropped_w].reshape(cropped_h // cell, cell, cropped_w // cell, cell)
    occupied = blocks.any(axis=(1, 3))
    x0 = float(master["x0"] * master["scale"] * factor)
    y0 = float(master["z0"] * master["scale"] * factor)
    z_back, z_front = _shell_corner_z(master, factor, x0, y0, pitch_mm * cell, occupied.shape)
    depth = float(np.clip(rim_depth, 1.0, 12.0))
    mid = (z_back + z_front) * 0.5
    half = np.minimum((z_front - z_back) * 0.5, np.float32(depth * 0.5))
    half = np.maximum(half, np.float32(0.5))
    return _extrude_mask(occupied, pitch_mm * cell, x0, y0, mid - half, mid + half)


def _shell_corner_z(master: dict, factor: float, x0: float, y0: float, pitch: float, shape: tuple[int, int]):
    """Front and back of each grid corner, taken from the master shell."""
    height, width = shape
    pos = master["preview_pos"] * np.float32(factor)
    pixel = float(master["pitch"] * master["scale"] * factor)
    origin_x = float(master["x0"] * master["scale"] * factor)
    origin_y = float(master["z0"] * master["scale"] * factor)
    col = np.floor((pos[:, 0] - origin_x) / pixel).astype(np.int32)
    row = np.floor((pos[:, 1] - origin_y) / pixel).astype(np.int32)
    mask_h, mask_w = master["solid"].shape
    inside = (col >= 0) & (row >= 0) & (col < mask_w) & (row < mask_h)
    from app.geometry.weave_ribbons import _close_mask

    band = master["solid"] & ~_close_mask(master["inner"], 5) & ~master["guard"]
    band[: int(master["neck_row"])] = False
    chosen = np.zeros(len(pos), dtype=bool)
    chosen[inside] = band[row[inside], col[inside]]
    pos = pos[chosen]
    gx = np.floor((pos[:, 0] - x0) / pitch).astype(np.int32)
    gy = np.floor((pos[:, 1] - y0) / pitch).astype(np.int32)
    keep = (gx >= 0) & (gy >= 0) & (gx < width) & (gy < height)
    gx, gy, z = gx[keep], gy[keep], pos[keep, 2]
    zmin = np.full((height, width), np.inf, np.float32)
    zmax = np.full((height, width), -np.inf, np.float32)
    if len(z):
        np.minimum.at(zmin, (gy, gx), z)
        np.maximum.at(zmax, (gy, gx), z)
    valid = np.isfinite(zmin) & ((zmax - zmin) > 2.0)
    zmin = np.where(valid, zmin, np.nan).astype(np.float32)
    zmax = np.where(valid, zmax, np.nan).astype(np.float32)
    for _ in range(3):
        zmin = _fill_holes(zmin, np.minimum)
        zmax = _fill_holes(zmax, np.maximum)
    zmin = _smooth_known(zmin)
    zmax = _smooth_known(zmax)
    corner_min = np.full((height + 1, width + 1), np.nan, np.float32)
    corner_max = np.full((height + 1, width + 1), np.nan, np.float32)
    for dy, dx in ((0, 0), (0, 1), (1, 0), (1, 1)):
        block_min = corner_min[dy : dy + height, dx : dx + width]
        block_max = corner_max[dy : dy + height, dx : dx + width]
        corner_min[dy : dy + height, dx : dx + width] = _nan_reduce(block_min, zmin, np.minimum)
        corner_max[dy : dy + height, dx : dx + width] = _nan_reduce(block_max, zmax, np.maximum)
    known = np.isfinite(corner_min) & np.isfinite(corner_max)
    fallback_min = float(np.nanmedian(corner_min)) if known.any() else -4.4 * float(factor)
    fallback_max = float(np.nanmedian(corner_max)) if known.any() else 4.4 * float(factor)
    corner_min = np.where(np.isfinite(corner_min), corner_min, fallback_min)
    corner_max = np.where(np.isfinite(corner_max), corner_max, fallback_max)
    inset = np.float32(0.08 * float(factor))
    corner_min = corner_min + inset
    corner_max = corner_max - inset
    mid = (corner_min + corner_max) * 0.5
    half = np.maximum((corner_max - corner_min) * 0.5, np.float32(1.2 * float(factor)))
    return (mid - half).astype(np.float32), (mid + half).astype(np.float32)


def _shift(field: np.ndarray, dy: int, dx: int) -> np.ndarray:
    rolled = np.roll(np.roll(field, dy, axis=0), dx, axis=1)
    if dy > 0:
        rolled[:dy, :] = np.nan
    elif dy < 0:
        rolled[dy:, :] = np.nan
    if dx > 0:
        rolled[:, :dx] = np.nan
    elif dx < 0:
        rolled[:, dx:] = np.nan
    return rolled


def _nan_reduce(left: np.ndarray, right: np.ndarray, reduce) -> np.ndarray:
    both = np.isfinite(left) & np.isfinite(right)
    out = np.where(np.isfinite(left), left, right)
    out = np.where(both, reduce(left, right), out)
    return out.astype(np.float32)


def _fill_holes(field: np.ndarray, reduce) -> np.ndarray:
    acc = field
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        acc = _nan_reduce(acc, _shift(field, dy, dx), reduce)
    return np.where(np.isfinite(field), field, acc).astype(np.float32)


def _smooth_known(field: np.ndarray) -> np.ndarray:
    total = np.zeros(field.shape, np.float32)
    weight = np.zeros(field.shape, np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            shifted = _shift(field, dy, dx)
            known = np.isfinite(shifted)
            total += np.where(known, shifted, 0.0)
            weight += known
    smoothed = np.where(weight > 0, total / np.maximum(weight, 1.0), np.nan)
    return np.where(np.isfinite(field), smoothed, field).astype(np.float32)


def _extrude_mask(
    occupied: np.ndarray,
    pitch: float,
    x0: float,
    y0: float,
    z_back: np.ndarray,
    z_front: np.ndarray,
):
    empty = (
        np.zeros((0, 3), np.float32),
        np.zeros((0, 3), np.uint32),
        np.zeros((0, 3), np.uint8),
    )
    gy, gx = np.nonzero(occupied)
    if len(gy) < 8:
        return empty
    height, width = occupied.shape
    used = np.zeros((height + 1, width + 1), dtype=bool)
    used[gy, gx] = True
    used[gy, gx + 1] = True
    used[gy + 1, gx] = True
    used[gy + 1, gx + 1] = True
    ids = np.full(used.shape, -1, np.int32)
    count = int(used.sum())
    ids[used] = np.arange(count, dtype=np.int32)
    ys, xs = np.nonzero(used)
    bottom = np.column_stack(
        (
            x0 + xs.astype(np.float32) * pitch,
            y0 + ys.astype(np.float32) * pitch,
            z_back[ys, xs],
        )
    ).astype(np.float32)
    top = bottom.copy()
    top[:, 2] = z_front[ys, xs]
    verts = np.vstack((bottom, top)).astype(np.float32)
    a = ids[gy, gx]
    b = ids[gy, gx + 1]
    c = ids[gy + 1, gx + 1]
    d = ids[gy + 1, gx]
    caps = np.empty((len(gy), 12), np.int32)
    caps[:, 0:6] = np.stack((a, b, c, a, c, d), axis=1)
    caps[:, 6:12] = np.stack((a + count, d + count, c + count, a + count, c + count, b + count), axis=1)
    faces = [caps.reshape(-1, 3)]

    def side(active: np.ndarray, p: np.ndarray, q: np.ndarray) -> None:
        if not np.any(active):
            return
        p = p[active]
        q = q[active]
        wall = np.stack((p, q, q + count, p, q + count, p + count), axis=1)
        faces.append(wall.reshape(-1, 3))

    above = np.ones(len(gy), dtype=bool)
    sel = gy > 0
    above[sel] = ~occupied[gy[sel] - 1, gx[sel]]
    below = np.ones(len(gy), dtype=bool)
    sel = gy + 1 < height
    below[sel] = ~occupied[gy[sel] + 1, gx[sel]]
    left = np.ones(len(gy), dtype=bool)
    sel = gx > 0
    left[sel] = ~occupied[gy[sel], gx[sel] - 1]
    right = np.ones(len(gy), dtype=bool)
    sel = gx + 1 < width
    right[sel] = ~occupied[gy[sel], gx[sel] + 1]
    side(above, a, b)
    side(below, d, c)
    side(left, a, d)
    side(right, b, c)
    idx = np.concatenate(faces, axis=0).astype(np.uint32)
    color = np.tile(np.array([186, 186, 190], np.uint8), (len(verts), 1))
    return verts, idx, color


def frame_lip_mesh(master: dict, factor: float, rim_width: float, rim_depth: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Inward lip. The outer silhouette stays on the master shell."""
    extra = float(rim_width) - 3.6
    if extra < 0.8:
        empty = np.zeros((0, 3), np.float32)
        return empty, np.zeros((0, 3), np.uint32), np.zeros((0, 3), np.uint8)
    inner = master["inner"]
    guard = master["guard"]
    core = inner & ~guard
    eroded = core.copy()
    eroded[1:-1, 1:-1] = (
        core[1:-1, 1:-1]
        & core[:-2, 1:-1]
        & core[2:, 1:-1]
        & core[1:-1, :-2]
        & core[1:-1, 2:]
    )
    boundary = core & ~eroded
    loop = _longest_loop(boundary)
    if len(loop) < 12:
        empty = np.zeros((0, 3), np.float32)
        return empty, np.zeros((0, 3), np.uint32), np.zeros((0, 3), np.uint8)
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor
    pts = np.column_stack([loop[:, 1] * pitch + x0, loop[:, 0] * pitch + y0]).astype(np.float32)
    pts = _resample_closed(pts, 1.8)
    center = pts.mean(axis=0)
    inward = center - pts
    inward /= np.maximum(np.linalg.norm(inward, axis=1, keepdims=True), 1e-6)
    inner_pts = pts + inward * extra
    depth = float(np.clip(rim_depth, 4.0, 10.0))
    center_z = 1.7
    front = center_z + depth * 0.5
    back = center_z - depth * 0.5
    lip = 1.4
    return _lip_band(pts, inner_pts, front, back, lip)


def _longest_loop(boundary: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(boundary)
    if len(ys) < 12:
        return np.zeros((0, 2), np.int32)
    start = int(np.argmin(ys))
    pixels = {(int(y), int(x)) for y, x in zip(ys, xs)}
    y, x = int(ys[start]), int(xs[start])
    path = [(y, x)]
    seen = {(y, x)}
    neighbors = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
    for _ in range(len(pixels) + 2):
        found = None
        for dy, dx in neighbors:
            nxt = (y + dy, x + dx)
            if nxt in pixels and nxt not in seen:
                found = nxt
                break
        if found is None:
            break
        y, x = found
        seen.add(found)
        path.append(found)
    return np.asarray(path, np.int32)


def _resample_closed(line: np.ndarray, step: float) -> np.ndarray:
    closed = np.vstack([line, line[:1]])
    delta = np.linalg.norm(np.diff(closed, axis=0), axis=1)
    total = float(delta.sum()) or 1.0
    count = max(24, int(total / step))
    dist = np.concatenate([[0.0], np.cumsum(delta)])
    target = np.linspace(0.0, total, count, endpoint=False)
    out = np.empty((count, 2), np.float32)
    out[:, 0] = np.interp(target, dist, closed[:, 0])
    out[:, 1] = np.interp(target, dist, closed[:, 1])
    return out


def _lip_band(outer: np.ndarray, inner: np.ndarray, front: float, back: float, lip: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = len(outer)
    # 4 rings: outer-front, outer-back, inner-front, inner-back-of-front-lip, and back lip rings.
    z_front_lip = front - lip
    z_back_lip = back + lip
    rings = [
        np.column_stack([outer, np.full(n, front)]),
        np.column_stack([outer, np.full(n, back)]),
        np.column_stack([inner, np.full(n, front)]),
        np.column_stack([inner, np.full(n, z_front_lip)]),
        np.column_stack([inner, np.full(n, z_back_lip)]),
        np.column_stack([inner, np.full(n, back)]),
    ]
    verts = np.concatenate(rings, axis=0).astype(np.float32)
    faces = []
    pairs = ((0, 2), (2, 3), (0, 1), (1, 5), (5, 4))
    for a, b in pairs:
        for i in range(n):
            j = (i + 1) % n
            ia, ja = a * n + i, a * n + j
            ib, jb = b * n + i, b * n + j
            faces.append((ia, ja, jb, ia, jb, ib))
    idx = np.asarray(faces, np.uint32).reshape(-1, 3)
    color = np.tile(np.array([186, 186, 190], np.uint8), (len(verts), 1))
    return verts, idx, color


def reference_metrics(width_mm: float, height_mm: float, thickness_mm: float) -> dict:
    aspect = float(width_mm) / max(float(height_mm), 1e-6)
    return {
        "reference_aspect": REFERENCE_ASPECT,
        "reference_depth_ratio": REFERENCE_DEPTH_RATIO,
        "outline_aspect": round(aspect, 5),
        "aspect_error": round(abs(aspect - REFERENCE_ASPECT), 5),
        "thickness_ratio": round(float(thickness_mm) / max(float(height_mm), 1e-6), 5),
        "target_width_mm": round(180.0 * REFERENCE_ASPECT, 2),
        "target_depth_mm": round(180.0 * REFERENCE_DEPTH_RATIO, 2),
    }


def _smooth(edge: np.ndarray) -> np.ndarray:
    edge = np.clip(edge, 0.0, 1.0)
    return edge * edge * (3.0 - 2.0 * edge)


def _offsets(half_span: float, center_spacing: float, edge_spacing: float, compression: float) -> list[float]:
    center_spacing = max(float(center_spacing), float(edge_spacing) + 1.5, 6.0)
    edge_spacing = max(float(edge_spacing), 3.5)
    compression = float(np.clip(compression, 0.25, 0.9))
    offsets = [0.0]
    cursor = 0.0
    guard = 0
    while cursor < half_span and guard < 80:
        guard += 1
        t = cursor / max(half_span, 1.0)
        start = compression
        edge = _smooth((t - start) / max(1.0 - start, 0.08))
        step = center_spacing * (1.0 - edge) + edge_spacing * edge
        cursor += step
        if cursor < half_span:
            offsets.append(cursor)
    return offsets


def _trace(cx: float, cy: float, y0: float, y1: float, offset: float, angle: float, bend: float) -> np.ndarray:
    direction = np.array([np.cos(angle), np.sin(angle)], np.float32)
    normal = np.array([-direction[1], direction[0]], np.float32)
    span = max(y1 - y0, 40.0) * 1.35
    travel = np.linspace(0.0, 1.0, 96, dtype=np.float32)
    samples = (travel - 0.5) * span * 2.0
    # Odd in offset, so the mirrored copy stays the opposite family.
    curve = bend * np.sin(np.pi * travel) * np.tanh(offset / 8.0)
    origin = np.array([cx, cy], np.float32) + normal * offset
    return origin + direction * samples[:, None] + normal * curve[:, None]


def _reflect(line: np.ndarray, cx: float) -> np.ndarray:
    mirrored = line.copy()
    mirrored[:, 0] = 2.0 * cx - mirrored[:, 0]
    return mirrored


def _clip_anchored(master, factor, line: np.ndarray, step: float) -> list[np.ndarray]:
    """Keep one strip across a rim notch. Ends stop inside the frame, not in open air."""
    line = _resample(np.asarray(line, np.float32), step)
    if len(line) < 2:
        return []
    solid = _sample_mask(master["solid"], master, line[:, 0], line[:, 1], factor)
    guard = _sample_mask(master["guard"], master, line[:, 0], line[:, 1], factor)
    inner = _sample_mask(master["inner"], master, line[:, 0], line[:, 1], factor)
    # The heart stops a strip. The rim between petals does not.
    open_path = solid & ~guard
    if not (open_path & inner).any():
        return []
    cuts = np.diff(open_path.astype(np.int8))
    starts = list(np.flatnonzero(cuts == 1) + 1)
    ends = list(np.flatnonzero(cuts == -1) + 1)
    if open_path[0]:
        starts = [0, *starts]
    if open_path[-1]:
        ends = [*ends, len(open_path)]
    embed = max(1, int(round(4.0 / max(step, 0.4))))
    runs = []
    for start, end in zip(starts, ends):
        piece_inner = inner[start:end]
        if not piece_inner.any():
            continue
        first = int(np.flatnonzero(piece_inner)[0])
        last = int(np.flatnonzero(piece_inner)[-1])
        a = max(0, first - embed)
        b = min(end - start, last + embed + 1)
        run = line[start:end][a:b]
        if len(run) >= 2:
            runs.append(run)
    return runs


def _opening_loop(master, factor) -> np.ndarray:
    from app.geometry.weave_ribbons import _close_mask

    inner = _close_mask(master["inner"], 4) & ~master["guard"]
    eroded = inner.copy()
    eroded[1:-1, 1:-1] = (
        inner[1:-1, 1:-1]
        & inner[:-2, 1:-1]
        & inner[2:, 1:-1]
        & inner[1:-1, :-2]
        & inner[1:-1, 2:]
    )
    loop = _longest_loop(inner & ~eroded)
    if len(loop) < 12:
        return np.zeros((0, 2), np.float32)
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor
    pts = np.column_stack([loop[:, 1] * pitch + x0, loop[:, 0] * pitch + y0]).astype(np.float32)
    return _resample_closed(pts, 1.2)


def _length_of(line: np.ndarray) -> float:
    if len(line) < 2:
        return 0.0
    return float(np.linalg.norm(np.diff(line, axis=0), axis=1).sum())


def _chord(origin: np.ndarray, direction: np.ndarray, bend: float) -> np.ndarray:
    step = 1.35
    count = 120
    travel = (np.arange(count, dtype=np.float32) - count * 0.5) * step
    normal = np.array([-direction[1], direction[0]], np.float32)
    curve = bend * np.sin(np.linspace(0, np.pi, count, dtype=np.float32))
    return origin + direction * travel[:, None] + normal * curve[:, None]


def reference_diamond_paths(master, factor, params, step, x0, x1, y0, y1) -> list[tuple]:
    from app.geometry.rotating_diamond import rotating_diamond_paths

    return rotating_diamond_paths(master, factor, params, step, x0, x1, y0, y1)

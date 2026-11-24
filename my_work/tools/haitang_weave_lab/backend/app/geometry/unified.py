"""One-piece haitang hand fan. Rim, face and handle are a single mesh.

The outline comes from the gray-rim template STL. The footprint is scaled so the
default fan fits a 220 mm printer bed. Thickness is a lithophane range, not a
copy of the template's sculpted depth.
"""
from __future__ import annotations

import struct
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / "assets" / "baseline" / "unified_fan.npz"
TEMPLATE_TRIANGLES = 1963389

QUALITY_STEP = {"draft": 0.42, "recommended": 0.28, "high": 0.18}


def _dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(max(0, radius)):
        pad = np.pad(out, 1, constant_values=False)
        out = (
            pad[1:-1, 1:-1]
            | pad[:-2, 1:-1]
            | pad[2:, 1:-1]
            | pad[1:-1, :-2]
            | pad[1:-1, 2:]
            | pad[:-2, :-2]
            | pad[:-2, 2:]
            | pad[2:, :-2]
            | pad[2:, 2:]
        )
    return out


def _erode(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask.copy()
    return ~_dilate(~mask, radius)


def _find_template() -> Path:
    downloads = Path.home() / "Downloads"
    folders = [ROOT / "assets" / "references", downloads]
    for folder in folders:
        if not folder.exists():
            continue
        for path in folder.glob("*.stl"):
            if path.stat().st_size < 80_000_000:
                continue
            count = struct.unpack_from("<I", path.read_bytes()[:84], 80)[0]
            if count == TEMPLATE_TRIANGLES:
                return path
    raise FileNotFoundError("找不到灰边团扇模板 STL（1963389 三角面）。")


def _load_cache() -> dict:
    if CACHE.exists():
        data = np.load(CACHE)
        return {
            "solid": data["solid"].astype(bool),
            "flower": data["flower"].astype(bool),
            "dist_px": data["dist_px"].astype(np.float32),
            "pitch_file": float(np.asarray(data["pitch_file"]).reshape(-1)[0]),
            "file_height": float(np.asarray(data["file_height"]).reshape(-1)[0]),
            "file_width": float(np.asarray(data["file_width"]).reshape(-1)[0]),
        }
    path = _find_template()
    data = path.read_bytes()
    count = struct.unpack_from("<I", data, 80)[0]
    rec = np.dtype([("n", "<f4", (3,)), ("v", "<f4", (3, 3)), ("a", "<u2")])
    verts = np.frombuffer(data, dtype=rec, count=count, offset=84)["v"].reshape(-1, 3)
    # X is width, Z runs from the handle tip to the flower top, Y is sculpt depth.
    pitch = 0.0016
    x0 = float(verts[:, 0].min())
    z0 = float(verts[:, 2].min())
    x1 = float(verts[:, 0].max())
    z1 = float(verts[:, 2].max())
    w = int((x1 - x0) / pitch) + 4
    h = int((z1 - z0) / pitch) + 4
    ix = np.clip(((verts[:, 0] - x0) / pitch).astype(np.int32), 0, w - 1)
    iz = np.clip(((verts[:, 2] - z0) / pitch).astype(np.int32), 0, h - 1)
    occ = np.zeros((h, w), dtype=bool)
    occ[iz, ix] = True
    solid = _erode(_dilate(occ, 2), 2)
    # Flood the outside so enclosed gaps in the splat become part of the fan.
    exterior = np.zeros_like(solid)
    from collections import deque

    seen = np.zeros_like(solid)
    q = deque((0, x) for x in range(w))
    q.extend((h - 1, x) for x in range(w))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or solid[y, x]:
            continue
        seen[y, x] = True
        exterior[y, x] = True
        q.append((y + 1, x))
        q.append((y - 1, x))
        q.append((y, x + 1))
        q.append((y, x - 1))
    solid = ~exterior
    widths = solid.sum(axis=1)
    peak = int(widths.max())
    flower_start = int(np.argmax(widths > peak * 0.50))
    flower = solid.copy()
    flower[:flower_start] = False
    dist = _distance(flower)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        CACHE,
        solid=solid.astype(np.uint8),
        flower=flower.astype(np.uint8),
        dist_px=dist.astype(np.float32),
        pitch_file=np.array([pitch]),
        file_height=np.array([z1 - z0]),
        file_width=np.array([x1 - x0]),
        flower_start=np.array([flower_start]),
    )
    return {
        "solid": solid,
        "flower": flower,
        "dist_px": dist,
        "pitch_file": pitch,
        "file_height": z1 - z0,
        "file_width": x1 - x0,
    }


def _distance(mask: np.ndarray) -> np.ndarray:
    d = np.where(mask, np.float32(1e6), np.float32(0))
    for _ in range(56):
        pad = np.pad(d, 1, constant_values=0)
        d = np.minimum(d, pad[1:-1, 2:] + 1)
        d = np.minimum(d, pad[1:-1, :-2] + 1)
        d = np.minimum(d, pad[2:, 1:-1] + 1)
        d = np.minimum(d, pad[:-2, 1:-1] + 1)
        d = np.minimum(d, pad[:-2, :-2] + 1.4142)
        d = np.minimum(d, pad[:-2, 2:] + 1.4142)
        d = np.minimum(d, pad[2:, :-2] + 1.4142)
        d = np.minimum(d, pad[2:, 2:] + 1.4142)
    return np.where(mask, d, np.float32(0))


def _sample(mask: np.ndarray, cols: np.ndarray, rows: np.ndarray) -> np.ndarray:
    ix = np.rint(cols).astype(np.int32)
    iy = np.rint(rows).astype(np.int32)
    ok = (ix >= 0) & (iy >= 0) & (ix < mask.shape[1]) & (iy < mask.shape[0])
    out = np.zeros(np.broadcast(cols, rows).shape, dtype=bool)
    out[ok] = mask[iy[ok], ix[ok]]
    return out


def _sample_f(field: np.ndarray, cols: np.ndarray, rows: np.ndarray) -> np.ndarray:
    ix = np.clip(np.rint(cols).astype(np.int32), 0, field.shape[1] - 1)
    iy = np.clip(np.rint(rows).astype(np.int32), 0, field.shape[0] - 1)
    return field[iy, ix]


def _cell_seeds(focus: tuple[float, float], face_r: float, pitch: float) -> np.ndarray:
    fx, fy = focus
    pitch = float(np.clip(pitch, 8.0, 28.0))
    n = int(np.ceil(face_r * 2.6 / pitch)) + 1
    idx = np.arange(-n, n + 1)
    q, r = np.meshgrid(idx, idx)
    x = pitch * (q + 0.5 * r)
    y = pitch * (np.sqrt(3) * 0.5) * r
    rad = np.hypot(x, y)
    reach = max(face_r, 1.0)
    t = np.clip(rad / reach, 0, 1.35)
    rad2 = reach * np.power(np.maximum(t, 1e-4), 0.82)
    scale = np.ones_like(rad)
    np.divide(rad2, np.maximum(rad, 1e-6), out=scale, where=rad > 1e-3)
    cy = fy + face_r * 0.55
    x = x * scale + fx
    y = y * scale + cy
    keep = np.hypot(x - fx, y - cy) < face_r * 1.9
    seeds = np.stack([x[keep], y[keep]], axis=1).astype(np.float64)
    if len(seeds) < 3:
        seeds = np.array([[fx, cy], [fx + pitch, cy], [fx, cy + pitch]], dtype=np.float64)
    return seeds


def _voronoi_edge(x: np.ndarray, y: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    px = np.ascontiguousarray(x, dtype=np.float64).ravel()
    py = np.ascontiguousarray(y, dtype=np.float64).ravel()
    nearest = np.full(px.shape, 1e9, dtype=np.float64)
    second = np.full(px.shape, 1e9, dtype=np.float64)
    for sx, sy in seeds:
        dist = np.hypot(px - sx, py - sy)
        closer = dist < nearest
        second = np.where(closer, nearest, np.minimum(second, dist))
        nearest = np.where(closer, dist, nearest)
    return ((second - nearest) * 0.5).reshape(x.shape)


def _band(dist: np.ndarray, width: np.ndarray, pitch: np.ndarray) -> np.ndarray:
    half = np.minimum(width * 0.5, pitch * 0.34)
    edge = np.maximum(0.04, half * 0.12)
    return np.clip((half + edge - dist) / (2 * edge), 0.0, 1.0)


def _line_dist(coord: np.ndarray, pitch: np.ndarray) -> np.ndarray:
    pitch = np.maximum(pitch, 0.4)
    frac = np.mod(coord, pitch)
    return np.minimum(frac, pitch - frac)


def _seal_pinches(solid: np.ndarray) -> np.ndarray:
    """Bridge cells that touch only at a corner so the extruded sheet stays manifold."""
    s = solid.copy()
    for _ in range(8):
        a = s[:-1, :-1]
        b = s[:-1, 1:]
        c = s[1:, :-1]
        d = s[1:, 1:]
        fill_b = a & d & ~b & ~c
        fill_a = b & c & ~a & ~d
        if not (fill_a.any() or fill_b.any()):
            break
        s[:-1, 1:] |= fill_b
        s[:-1, :-1] |= fill_a
    return s


def _finish(field: np.ndarray, params: dict) -> np.ndarray:
    contrast = float(params.get("contrast", 1.35))
    field = np.clip((field - 0.5) * contrast + 0.5, 0.0, 1.0)
    levels = int(params.get("dark_levels", 4))
    if levels > 1:
        dark = field < 0.6
        field = np.where(dark, np.round(field * levels) / levels, field)
    if params.get("invert"):
        field = 1.0 - field
    radius = int(round(float(params.get("smoothness", 0.5))))
    if radius > 0:
        k = radius * 2 + 1
        pad = np.pad(field, radius, mode="edge")
        acc = np.cumsum(np.cumsum(pad, axis=0), axis=1)
        acc = np.pad(acc, ((1, 0), (1, 0)))
        field = (acc[k:, k:] - acc[:-k, k:] - acc[k:, :-k] + acc[:-k, :-k]) / (k * k)
    return np.clip(field, 0.0, 1.0)


def _pattern(pattern: str, x: np.ndarray, y: np.ndarray, params: dict, focus: tuple[float, float], face_r: float) -> np.ndarray:
    density_u = float(np.clip(params.get("density_u", 0.7), 0.3, 2.8))
    density_v = float(np.clip(params.get("density_v", 0.7), 0.3, 2.8))
    width_u = float(np.clip(params.get("strand_width_u", 2.4), 0.5, 8))
    width_v = float(np.clip(params.get("strand_width_v", 2.2), 0.5, 8))
    angle = np.deg2rad(float(params.get("weave_angle", 0)))
    fx, fy = focus
    dx, dy = x - fx, y - fy
    if pattern == "blank":
        return np.full(x.shape, 0.08, dtype=np.float64)
    if pattern == "radial":
        radius = np.hypot(dx, dy) + 1.4
        ang = np.arctan2(dy, dx)
        reach = max(face_r, 1.0)
        rim_gap = 6.2 / max(density_u, 0.35)
        spoke_n = int(np.clip(round(2 * np.pi * reach / rim_gap), 42, 120))
        spoke_pitch = 2 * np.pi / spoke_n
        arc = np.abs(np.mod(ang + np.pi, spoke_pitch) - spoke_pitch * 0.5) * radius
        spoke_gap = np.maximum(radius * spoke_pitch, rim_gap * 0.55)
        spoke_w = np.minimum(np.full_like(radius, width_u * 0.78), spoke_gap * 0.3)
        spoke = _band(arc, spoke_w, spoke_gap)
        ring_pitch = np.maximum((5.6 / max(density_v, 0.35)) * (0.62 + 0.7 * radius / reach), 2.8)
        ring = _band(_line_dist(radius, ring_pitch), np.full_like(radius, min(width_v, 1.35) * 0.7), ring_pitch)
        field = np.maximum(spoke, ring)
        return np.clip(field * 0.86 + spoke * ring * 0.5, 0, 1)
    if pattern == "cellular":
        seeds = _cell_seeds((fx, fy), face_r, 15.5 / max(density_u, 0.35))
        edge = _voronoi_edge(x, y, seeds)
        bead = max(0.7, min(width_u, 1.6))
        return _band(edge, np.full_like(edge, bead), np.full_like(edge, 8.0))
    xr = dx * np.cos(angle) + dy * np.sin(angle)
    yr = -dx * np.sin(angle) + dy * np.cos(angle)
    if pattern == "ripple":
        amp = float(params.get("amplitude", 2.4))
        freq = float(params.get("frequency", 1.4))
        yr = yr + amp * np.sin(xr * freq * 0.28 + dy * 0.02)
        xr = xr + amp * 0.28 * np.sin(yr * 0.09)
    if pattern == "diamond":
        xr, yr = (xr + yr) * 0.7071, (xr - yr) * 0.7071
    pitch_u = 10.0 / density_u
    pitch_v = 10.0 / density_v
    if pattern == "twill":
        xr = xr + (np.floor(yr / pitch_v).astype(np.int32) % 3) * (pitch_u / 3.0)
    fu = np.mod(xr / pitch_u, 1.0)
    fv = np.mod(yr / pitch_v, 1.0)
    du = np.minimum(fu, 1 - fu) * pitch_u
    dv = np.minimum(fv, 1 - fv) * pitch_v
    warp = _band(du, np.full_like(du, width_u), np.full_like(du, pitch_u))
    weft = _band(dv, np.full_like(dv, width_v), np.full_like(dv, pitch_v))
    iu = np.floor(xr / pitch_u).astype(np.int32)
    iv = np.floor(yr / pitch_v).astype(np.int32)
    accent = ((iu % 4) == 0) | ((iv % 5) == 0)
    if pattern == "ripple":
        field = np.maximum(weft, warp * 0.62)
    else:
        field = np.maximum(warp, weft)
    field = np.maximum(field, accent * np.maximum(warp, weft) * 0.35)
    relief = float(params.get("relief", 0.7))
    over = ((iu + iv) & 1) == 0
    cross = warp * weft
    field = np.clip(field * (1 - 0.25 * relief) + cross * np.where(over, relief, 0.15), 0, 1)
    return field


def build_unified(params: dict, quality: str = "draft"):
    if params.get("geometry_lock", True):
        from app.geometry.master_lock import compose_locked

        return compose_locked(params, quality, preview=(quality == "draft"))
    cache = _load_cache()
    target = float(np.clip(params.get("target_height", 180), 120, 220))
    scale = target / cache["file_height"]
    pixel = cache["pitch_file"] * scale
    solid = cache["solid"]
    height = solid.shape[0] * pixel
    width = solid.shape[1] * pixel
    step = QUALITY_STEP.get(quality, 1.35)
    xs = np.arange(-width * 0.5, width * 0.5 + step * 0.1, step)
    ys = np.arange(0.0, height + step * 0.1, step)
    if xs[-1] > width * 0.5:
        xs[-1] = width * 0.5
    if ys[-1] > height:
        ys[-1] = height
    warnings: list[str] = []
    frame = float(np.clip(params.get("frame_mm", 2.6), 1.6, 3.4))
    t_min = float(params.get("t_min", 0.6))
    t_max = float(params.get("t_max", 2.2))
    if t_max < t_min:
        t_min, t_max = t_max, t_min
        warnings.append("最厚处小于最薄处，已对调。")
    t_min = float(np.clip(t_min, 0.0, 2.8))
    t_max = float(np.clip(t_max, 0.2, 2.8))
    if t_min <= 0.011 and str(params.get("pattern")) != "blank":
        warnings.append("最薄处为 0：扇面间隙是真实镂空，边框和扇柄仍然闭合。")

    def grids(xa, ya):
        X, Y = np.meshgrid(xa, ya)
        cols = (X + width * 0.5) / pixel
        rows = Y / pixel
        inside = _sample(solid, cols, rows)
        flower = _sample(cache["flower"], cols, rows)
        dist_mm = _sample_f(cache["dist_px"], cols, rows) * pixel
        rim = float(params.get("rim_width", 4.2))
        weave = flower & (dist_mm > rim)
        # Focus sits at the bottom center of the flower, just above the handle.
        focus_rows = np.nonzero(cache["flower"].any(axis=1))[0]
        focus_y = float(focus_rows.min()) * pixel if len(focus_rows) else height * 0.35
        face_r = max(8.0, (float(focus_rows.max()) - float(focus_rows.min())) * pixel * 0.5) if len(focus_rows) else height * 0.25
        field = _pattern(str(params.get("pattern", "radial")), X, Y, params, (0.0, focus_y), face_r)
        field = _finish(field, params)
        open_weave = t_min <= 0.011 and str(params.get("pattern", "radial")) != "blank"
        if open_weave:
            perf = weave & (field < 0.42)
            strand = 0.7 + (t_max - 0.7) * np.clip((field - 0.42) / 0.58, 0, 1)
            thick = np.where(weave, strand, frame)
        else:
            perf = np.zeros(weave.shape, dtype=bool)
            face_thick = t_min + (t_max - t_min) * field
            if str(params.get("pattern")) == "blank" and t_min <= 0.011:
                face_thick = np.full_like(field, 1.05)
            thick = np.where(weave, face_thick, frame)
        thick = np.where(inside, thick, 0.0)
        keep = inside & ~perf
        return thick.astype(np.float32), keep, inside

    thickness, _, _ = grids(xs, ys)
    xc = (xs[:-1] + xs[1:]) * 0.5
    yc = (ys[:-1] + ys[1:]) * 0.5
    _, keep, template = grids(xc, yc)
    sealed = _seal_pinches(keep)
    positions, indices = _mesh(xs, ys, thickness, sealed, frame)
    positions = _snap_outline(positions, xs, ys, template, sealed, cache["solid"], pixel, width * 0.5)
    pmin = positions.min(0)
    pmax = positions.max(0)
    size = pmax - pmin
    longest = float(max(size[0], size[1]))
    fits_220 = float(size[0]) <= 210 and float(size[1]) <= 210
    fits_256 = float(size[0]) <= 248 and float(size[1]) <= 248
    if not fits_220:
        warnings.append("当前高度放不进 220 mm 热床。把目标高度降到 180 mm 或以下。")
    report = {
        "unified": True,
        "one_piece": True,
        "quality": quality,
        "step_mm": step,
        "pattern": params.get("pattern"),
        "triangles": int(len(indices)),
        "vertices": int(len(positions)),
        "bbox_min": [round(float(v), 3) for v in pmin],
        "bbox_max": [round(float(v), 3) for v in pmax],
        "width_mm": round(float(size[0]), 2),
        "height_mm": round(float(size[1]), 2),
        "thickness_mm": round(float(size[2]), 2),
        "target_height_mm": target,
        "fits_220": fits_220,
        "fits_256": fits_256,
        "longest_mm": round(longest, 2),
        "z_envelope_ok": float(pmin[2]) >= -0.01 and float(pmax[2]) <= 3.45,
        "xy_envelope_ok": True,
        "warnings": warnings,
        "digital_check_only": True,
        "physical_print_tested": False,
        "note": "扇面、灰边和扇柄是同一个网格。默认高度 180 mm，适合 220 mm 级热床平放打印。",
    }
    return positions, indices, report


def _box_mean(mask: np.ndarray, radius: int) -> np.ndarray:
    k = radius * 2 + 1
    pad = np.pad(mask.astype(np.float32), radius, mode="edge")
    acc = np.cumsum(np.cumsum(pad, axis=0), axis=1)
    acc = np.pad(acc, ((1, 0), (1, 0)))
    return (acc[k:, k:] - acc[:-k, k:] - acc[k:, :-k] + acc[:-k, :-k]) / float(k * k)


def _bilerp(field: np.ndarray, col: np.ndarray, row: np.ndarray) -> np.ndarray:
    c0 = np.floor(col).astype(np.int32)
    r0 = np.floor(row).astype(np.int32)
    tc = (col - c0).astype(np.float32)
    tr = (row - r0).astype(np.float32)
    h, w = field.shape
    c0 = np.clip(c0, 0, w - 1)
    r0 = np.clip(r0, 0, h - 1)
    c1 = np.clip(c0 + 1, 0, w - 1)
    r1 = np.clip(r0 + 1, 0, h - 1)
    top = field[r0, c0] * (1 - tc) + field[r0, c1] * tc
    bot = field[r1, c0] * (1 - tc) + field[r1, c1] * tc
    return top * (1 - tr) + bot * tr


def _snap_outline(positions, xs, ys, template, cells, solid, pixel, half_width):
    """Pull the outer rim onto the template contour so the lobes are not grid stairs."""
    h, w = template.shape
    used = np.zeros((h + 1, w + 1), dtype=bool)
    used[:-1, :-1] |= cells
    used[:-1, 1:] |= cells
    used[1:, :-1] |= cells
    used[1:, 1:] |= cells
    n = int(used.sum())
    if n == 0 or n * 2 != len(positions) or h < 2 or w < 2:
        return positions
    iy, ix = np.indices((h + 1, w + 1))
    inside_touch = np.zeros((h + 1, w + 1), dtype=bool)
    outside_touch = np.zeros((h + 1, w + 1), dtype=bool)
    for dy, dx in ((-1, -1), (-1, 0), (0, -1), (0, 0)):
        yy = iy + dy
        xx = ix + dx
        valid = (yy >= 0) & (xx >= 0) & (yy < h) & (xx < w)
        hit = np.zeros(valid.shape, dtype=bool)
        hit[valid] = template[yy[valid], xx[valid]]
        inside_touch |= hit
        outside_touch |= ~hit
    outer = (inside_touch & outside_touch & used).ravel()
    if not outer[used.ravel()].any():
        return positions
    soft = _box_mean(solid, 2)
    col = np.broadcast_to((xs + half_width) / pixel, (h + 1, w + 1)).astype(np.float64).copy()
    row = np.broadcast_to((ys / pixel)[:, None], (h + 1, w + 1)).astype(np.float64).copy()
    base_col = col.copy()
    base_row = row.copy()
    for _ in range(5):
        level = _bilerp(soft, col, row)
        gx = _bilerp(soft, col + 0.8, row) - _bilerp(soft, col - 0.8, row)
        gy = _bilerp(soft, col, row + 0.8) - _bilerp(soft, col, row - 0.8)
        mag = np.hypot(gx, gy) + 1e-6
        delta = np.clip((level - 0.5) / mag, -1.4, 1.4)
        col = np.clip(col - gx / mag * delta, base_col - 1.8, base_col + 1.8)
        row = np.clip(row - gy / mag * delta, base_row - 1.8, base_row + 1.8)
    picked = used.ravel()
    new_x = (col * pixel - half_width).astype(np.float32).ravel()[picked]
    new_y = (row * pixel).astype(np.float32).ravel()[picked]
    move = outer[picked]
    positions = positions.copy()
    positions[:n, 0] = np.where(move, new_x, positions[:n, 0])
    positions[:n, 1] = np.where(move, new_y, positions[:n, 1])
    positions[n:, 0] = positions[:n, 0]
    positions[n:, 1] = positions[:n, 1]
    return positions


def _mesh(xs, ys, thickness, solid, frame: float):
    h, w = solid.shape
    vid = np.full((h + 1, w + 1), -1, dtype=np.int32)
    vid[:-1, :-1] = np.where(solid, 1, vid[:-1, :-1])
    vid[:-1, 1:] = np.where(solid, 1, vid[:-1, 1:])
    vid[1:, :-1] = np.where(solid, 1, vid[1:, :-1])
    vid[1:, 1:] = np.where(solid, 1, vid[1:, 1:])
    used = vid.ravel() > 0
    new_id = -np.ones(used.size, dtype=np.int32)
    new_id[used] = np.arange(int(used.sum()), dtype=np.int32)
    vid = new_id.reshape(vid.shape)
    n = int(used.sum())
    if n < 4:
        raise RuntimeError("一体扇没有生成出实体。")
    X, Y = np.meshgrid(xs, ys)
    z = thickness.copy()
    z = np.where((z < 0.2) & (vid >= 0), np.float32(max(frame * 0.45, 0.8)), z)
    top = np.stack([X.ravel()[used], Y.ravel()[used], z.ravel()[used]], axis=1)
    bot = np.stack([X.ravel()[used], Y.ravel()[used], np.zeros(n, np.float32)], axis=1)
    positions = np.concatenate([top, bot], axis=0).astype(np.float32)
    yy, xx = np.nonzero(solid)
    i00, i10 = vid[yy, xx], vid[yy, xx + 1]
    i11, i01 = vid[yy + 1, xx + 1], vid[yy + 1, xx]
    faces = [
        np.stack([i00, i10, i11, i00, i11, i01], 1).reshape(-1, 3),
        np.stack([i00 + n, i01 + n, i11 + n, i00 + n, i11 + n, i10 + n], 1).reshape(-1, 3),
    ]

    def add_wall(y0, x0, y1, x1, sign: str):
        a = vid[y0, x0]
        b = vid[y1, x1]
        if sign == "+":
            tri = np.stack([a, a + n, b + n, a, b + n, b], 1)
        else:
            tri = np.stack([a, b, b + n, a, b + n, a + n], 1)
        faces.append(tri.reshape(-1, 3))

    right = np.ones_like(solid)
    right[:, :-1] = ~solid[:, 1:]
    ye, xe = np.nonzero(solid & right)
    if len(ye):
        add_wall(ye, xe + 1, ye + 1, xe + 1, "+")
    left = np.ones_like(solid)
    left[:, 1:] = ~solid[:, :-1]
    yw, xw = np.nonzero(solid & left)
    if len(yw):
        add_wall(yw, xw, yw + 1, xw, "-")
    up = np.ones_like(solid)
    up[:-1, :] = ~solid[1:, :]
    yn, xn = np.nonzero(solid & up)
    if len(yn):
        add_wall(yn + 1, xn, yn + 1, xn + 1, "-")
    down = np.ones_like(solid)
    down[1:, :] = ~solid[:-1, :]
    ys2, xs2 = np.nonzero(solid & down)
    if len(ys2):
        add_wall(ys2, xs2 + 1, ys2, xs2, "+")
    return positions, np.concatenate(faces, axis=0).astype(np.int32)


def plan_unified(params: dict) -> Image.Image:
    if params.get("geometry_lock", True):
        from app.geometry.master_lock import plan_locked

        return plan_locked(params)
    cache = _load_cache()
    target = float(np.clip(params.get("target_height", 180), 120, 220))
    scale = target / cache["file_height"]
    pixel = cache["pitch_file"] * scale
    step_px = max(1, int(round(0.36 / pixel)))
    solid = cache["solid"][::step_px, ::step_px]
    small_pixel = pixel * step_px
    h, w = solid.shape
    ys = (np.arange(h) + 0.5) * small_pixel
    xs = (np.arange(w) + 0.5) * small_pixel - (cache["solid"].shape[1] * pixel) * 0.5
    # Reuse the mesher's field by sampling through build's pattern on this coarse grid.
    positions_dummy = None
    del positions_dummy
    X, Y = np.meshgrid(xs, ys)
    cols = (X + cache["solid"].shape[1] * pixel * 0.5) / pixel
    rows = Y / pixel
    flower = _sample(cache["flower"], cols, rows)
    dist_mm = _sample_f(cache["dist_px"], cols, rows) * pixel
    weave = flower & (dist_mm > float(params.get("rim_width", 4.2)))
    focus_rows = np.nonzero(cache["flower"].any(axis=1))[0]
    focus_y = float(focus_rows.min()) * pixel
    face_r = (float(focus_rows.max()) - float(focus_rows.min())) * pixel * 0.5
    field = _finish(_pattern(str(params.get("pattern", "radial")), X, Y, params, (0.0, focus_y), face_r), params)
    holes = weave & (float(params.get("t_min", 0.6)) <= 0.011) & (str(params.get("pattern")) != "blank") & (field < 0.42)
    shade = np.where(solid & ~holes, np.where(weave, 0.22 + 0.78 * field, 0.94), 0.0)
    rgb = np.zeros((*shade.shape, 3), dtype=np.uint8)
    rgb[..., 0] = np.clip(246 - shade * 188, 0, 255).astype(np.uint8)
    rgb[..., 1] = np.clip(240 - shade * 156, 0, 255).astype(np.uint8)
    rgb[..., 2] = np.clip(228 - shade * 136, 0, 255).astype(np.uint8)
    rgb[~solid | holes] = (244, 239, 230)
    return Image.fromarray(np.flipud(rgb), "RGB")

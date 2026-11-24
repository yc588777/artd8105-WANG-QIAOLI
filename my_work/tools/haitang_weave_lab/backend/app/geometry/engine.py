"""Parametric haitang-fan weave. The outer silhouette comes from the source STL.

Changing parameters rebuilds the triangle mesh. Materials are not involved.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from .stl_io import read_stl, triangle_bounds

ROOT = Path(__file__).resolve().parents[3]
ORIGINAL = ROOT / "assets" / "original"
CACHE = ROOT / "assets" / "baseline" / "fan_cache.npz"
BASELINE_PATH = ROOT / "assets" / "baseline" / "geometry_baseline.json"

ZONE_ORDER = ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"]
ZONE_CENTERS = {
    "NW": (0.17, 0.83),
    "N": (0.50, 0.83),
    "NE": (0.83, 0.83),
    "W": (0.17, 0.50),
    "C": (0.50, 0.50),
    "E": (0.83, 0.50),
    "SW": (0.17, 0.17),
    "S": (0.50, 0.17),
    "SE": (0.83, 0.17),
}

QUALITY_STEP = {"draft": 1.15, "recommended": 0.42, "high": 0.24}


def default_params() -> dict:
    zones = {name: {"enabled": True} for name in ZONE_ORDER}
    return {
        "pattern": "plain",
        "t_min": 0.2,
        "t_max": 1.8,
        "allow_extra_thickness": False,
        "rim_width": 3.8,
        "contrast": 1.4,
        "dark_levels": 4,
        "smoothness": 0.8,
        "invert": False,
        "density_u": 0.58,
        "density_v": 0.58,
        "strand_width_u": 3.4,
        "strand_width_v": 3.4,
        "relief": 0.72,
        "cell_aspect": 1.0,
        "stagger": 0.0,
        "weave_angle": 0.0,
        "frequency": 1.0,
        "amplitude": 2.2,
        "randomness": 0.0,
        "seed": 7,
        "blend_radius": 18.0,
        "zones": zones,
        "polygons": [],
    }


def _union_find_components(tris: np.ndarray, decimals: int = 3):
    flat = np.round(tris.reshape(-1, 3), decimals)
    _, inv = np.unique(flat, axis=0, return_inverse=True)
    faces = inv.reshape(-1, 3).astype(np.int32)
    n = int(faces.max()) + 1
    parent = np.arange(n, dtype=np.int32)

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = int(parent[x])
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for a, b, c in faces:
        union(int(a), int(b))
        union(int(b), int(c))
    roots = np.fromiter((find(int(i)) for i in faces[:, 0]), dtype=np.int32, count=len(faces))
    uniq = np.unique(roots)
    groups = []
    for root in uniq.tolist():
        groups.append(tris[roots == root])
    groups.sort(key=len, reverse=True)
    return groups


def _raster_solid(tris: np.ndarray, pitch: float = 0.22):
    pts = tris.reshape(-1, 3)
    bbmin = pts.min(0)
    bbmax = pts.max(0)
    pad = 3
    w = int(np.ceil((bbmax[0] - bbmin[0]) / pitch)) + pad * 2 + 2
    h = int(np.ceil((bbmax[1] - bbmin[1]) / pitch)) + pad * 2 + 2
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    flat = tris[:, :, :2]
    pix = np.empty((len(tris), 3, 2), dtype=np.float64)
    pix[:, :, 0] = (flat[:, :, 0] - bbmin[0]) / pitch + pad
    pix[:, :, 1] = (flat[:, :, 1] - bbmin[1]) / pitch + pad
    for tri in pix:
        draw.polygon([tuple(p) for p in tri], fill=1)
    mask = np.asarray(img, dtype=np.uint8) > 0
    exterior = np.zeros_like(mask)
    # Flood the true exterior. Enclosed weave holes stay inside.
    from collections import deque

    q = deque()
    q.extend((0, x) for x in range(w))
    q.extend((h - 1, x) for x in range(w))
    seen = np.zeros_like(mask)
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or mask[y, x]:
            continue
        seen[y, x] = True
        exterior[y, x] = True
        q.append((y + 1, x))
        q.append((y - 1, x))
        q.append((y, x + 1))
        q.append((y, x - 1))
    solid = ~exterior
    origin = np.array([bbmin[0] - (pad - 0.5) * pitch, bbmin[1] - (pad - 0.5) * pitch], dtype=np.float64)
    return solid, origin, pitch, bbmin, bbmax


def _dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(max(0, radius)):
        p = np.pad(out, 1, constant_values=False)
        out = (
            p[1:-1, 1:-1]
            | p[:-2, 1:-1]
            | p[2:, 1:-1]
            | p[1:-1, :-2]
            | p[1:-1, 2:]
            | p[:-2, :-2]
            | p[:-2, 2:]
            | p[2:, :-2]
            | p[2:, 2:]
        )
    return out


def _erode(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask.copy()
    return ~_dilate(~mask, radius)


def build_cache(force: bool = False) -> dict:
    if CACHE.exists() and not force:
        data = np.load(CACHE)
        return {
            "solid": data["solid"].astype(bool),
            "body": data["body"].astype(bool),
            "origin": data["origin"].astype(np.float64),
            "pitch": float(np.asarray(data["pitch"]).reshape(-1)[0]),
            "bbmin": data["bbmin"].astype(np.float64),
            "bbmax": data["bbmax"].astype(np.float64),
            "small": data["small"].astype(np.float64),
        }
    fan = read_stl(ORIGINAL / "obj_2_fan.stl")
    groups = _union_find_components(fan)
    main = groups[0]
    small = np.concatenate(groups[1:], axis=0) if len(groups) > 1 else np.zeros((0, 3, 3))
    solid, origin, pitch, bbmin, bbmax = _raster_solid(main, 0.22)
    # Opening removes a narrow connector tab from the weave body and locks it as solid.
    open_px = max(1, int(round(5.5 / pitch)))
    body = _dilate(_erode(solid, open_px), open_px)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        CACHE,
        solid=solid.astype(np.uint8),
        body=body.astype(np.uint8),
        origin=origin,
        pitch=np.array([pitch]),
        bbmin=bbmin,
        bbmax=bbmax,
        small=small.astype(np.float32),
    )
    _write_silhouette_png(solid, ROOT / "assets" / "baseline" / "silhouette.png")
    return {
        "solid": solid,
        "body": body,
        "origin": origin,
        "pitch": pitch,
        "bbmin": bbmin,
        "bbmax": bbmax,
        "small": small,
    }


def _write_silhouette_png(solid: np.ndarray, path: Path) -> None:
    h, w = solid.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[solid, 0] = 28
    rgba[solid, 1] = 40
    rgba[solid, 2] = 38
    rgba[solid, 3] = 255
    # Image row 0 is max world Y so the preview is upright.
    img = Image.fromarray(np.flipud(rgba), "RGBA")
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def _sample(mask: np.ndarray, origin: np.ndarray, pitch: float, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    ix = np.rint((xs - origin[0]) / pitch).astype(np.int32)
    iy = np.rint((ys - origin[1]) / pitch).astype(np.int32)
    inside = (ix >= 0) & (iy >= 0) & (ix < mask.shape[1]) & (iy < mask.shape[0])
    out = np.zeros(np.broadcast(xs, ys).shape, dtype=bool)
    out[inside] = mask[iy[inside], ix[inside]]
    return out


def _blur(img: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return img
    k = radius * 2 + 1
    pad = np.pad(img, radius, mode="edge")
    acc = np.cumsum(np.cumsum(pad, axis=0), axis=1)
    acc = np.pad(acc, ((1, 0), (1, 0)))
    return (acc[k:, k:] - acc[:-k, k:] - acc[k:, :-k] + acc[:-k, :-k]) / (k * k)


def _zone_weights(nx: np.ndarray, ny: np.ndarray, zones: dict, blend_mm: float, span: float) -> dict[str, np.ndarray]:
    sigma = max(0.06, (blend_mm / max(span, 1.0)) * 0.85)
    weights = []
    names = []
    for name in ZONE_ORDER:
        if not zones.get(name, {}).get("enabled", True):
            continue
        cx, cy = ZONE_CENTERS[name]
        weights.append(np.exp(-((nx - cx) ** 2 + (ny - cy) ** 2) / (2 * sigma * sigma)))
        names.append(name)
    if not weights:
        return {"C": np.ones_like(nx)}
    stack = np.stack(weights, axis=0)
    stack /= np.maximum(stack.sum(axis=0), 1e-8)
    return {name: stack[i] for i, name in enumerate(names)}


def _mix_scalar(weights: dict[str, np.ndarray], zones: dict, key: str, fallback: float) -> np.ndarray:
    acc = np.zeros(next(iter(weights.values())).shape, dtype=np.float64)
    for name, w in weights.items():
        raw = zones.get(name, {}).get(key, None)
        value = fallback if raw is None else float(raw)
        acc += w * value
    return acc


def field_on_grid(cache: dict, params: dict, xs: np.ndarray, ys: np.ndarray) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Return thickness (H,W), keep-mask (H,W), warnings. xs/ys are cell-center coordinates."""
    warnings: list[str] = []
    X, Y = np.meshgrid(xs, ys)
    origin = cache["origin"]
    pitch = cache["pitch"]
    solid = _sample(cache["solid"], origin, pitch, X, Y)
    body = _sample(cache["body"], origin, pitch, X, Y)
    bbmin, bbmax = cache["bbmin"], cache["bbmax"]
    span = float(max(bbmax[0] - bbmin[0], bbmax[1] - bbmin[1]))
    nx = (X - bbmin[0]) / max(float(bbmax[0] - bbmin[0]), 1e-6)
    ny = (Y - bbmin[1]) / max(float(bbmax[1] - bbmin[1]), 1e-6)
    zones = params.get("zones") or {}
    weights = _zone_weights(nx, ny, zones, float(params.get("blend_radius", 18)), span)

    density_u = np.clip(_mix_scalar(weights, zones, "density_u", float(params["density_u"])), 0.25, 3.5)
    density_v = np.clip(_mix_scalar(weights, zones, "density_v", float(params["density_v"])), 0.25, 3.5)
    brush = params.get("brush")
    if isinstance(brush, list) and len(brush) == 48 * 48:
        grid = np.clip(np.asarray(brush, dtype=np.float64).reshape(48, 48), 0.35, 2.5)
        ix = np.clip(np.rint(nx * 47).astype(np.int32), 0, 47)
        iy = np.clip(np.rint(ny * 47).astype(np.int32), 0, 47)
        factor = grid[iy, ix]
        density_u = np.clip(density_u * factor, 0.25, 3.5)
        density_v = np.clip(density_v * factor, 0.25, 3.5)
    width_u = np.clip(_mix_scalar(weights, zones, "strand_width_u", float(params["strand_width_u"])), 0.4, 12)
    width_v = np.clip(_mix_scalar(weights, zones, "strand_width_v", float(params["strand_width_v"])), 0.4, 12)
    relief = np.clip(_mix_scalar(weights, zones, "relief", float(params["relief"])), 0.0, 1.0)
    stagger = _mix_scalar(weights, zones, "stagger", float(params["stagger"]))
    angle = _mix_scalar(weights, zones, "weave_angle", float(params["weave_angle"]))
    aspect = float(params.get("cell_aspect", 1.0))

    # Polygonal local overrides, normalized 0–1 in the fan bbox.
    for poly in params.get("polygons") or []:
        pts = np.asarray(poly.get("points") or [], dtype=np.float64)
        if len(pts) < 3:
            continue
        # even-odd on normalized coords
        inside = _polygon_mask(nx, ny, pts)
        if poly.get("density_u") is not None:
            density_u = np.where(inside, float(poly["density_u"]), density_u)
        if poly.get("density_v") is not None:
            density_v = np.where(inside, float(poly["density_v"]), density_v)
        if poly.get("strand_width_u") is not None:
            width_u = np.where(inside, float(poly["strand_width_u"]), width_u)
        if poly.get("relief") is not None:
            relief = np.where(inside, float(poly["relief"]), relief)

    cx = float((bbmin[0] + bbmax[0]) * 0.5)
    cy = float((bbmin[1] + bbmax[1]) * 0.5)
    ang = np.deg2rad(angle)
    dx, dy = X - cx, Y - cy
    xr = dx * np.cos(ang) + dy * np.sin(ang)
    yr = (-dx * np.sin(ang) + dy * np.cos(ang)) * max(0.35, aspect)

    pattern = params.get("pattern", "plain")
    if pattern == "wave":
        yr = yr + float(params.get("amplitude", 2.0)) * np.sin(xr * float(params.get("frequency", 1.0)) * 0.18)
    if pattern == "gradient":
        scale = 0.62 + 0.85 * (1.0 - ny)
        density_u = density_u / scale
        density_v = density_v / scale

    pitch_u = 10.0 / density_u
    pitch_v = 10.0 / density_v
    if pattern == "twill":
        shift = (np.floor(yr / pitch_v).astype(np.int32) % 3) * (pitch_u / 3.0)
        xr = xr + shift

    fu = np.mod(xr / pitch_u + stagger, 1.0)
    fv = np.mod(yr / pitch_v, 1.0)
    du = np.minimum(fu, 1.0 - fu) * pitch_u
    dv = np.minimum(fv, 1.0 - fv) * pitch_v
    soft = 0.18 + 0.22 * float(params.get("smoothness", 0.8))

    def band(dist, width, pitch_local):
        half = np.minimum(width * 0.5, pitch_local * 0.48)
        edge = np.maximum(0.12, half * soft)
        return np.clip((half + edge - dist) / (2 * edge), 0.0, 1.0)

    if pattern == "cellular":
        cu = np.abs(fu - 0.5) * pitch_u
        cv = np.abs(fv - 0.5) * pitch_v
        rad = np.hypot(cu, cv)
        hole = np.minimum(pitch_u, pitch_v) * 0.30
        strand = np.clip((rad - hole) / np.maximum(width_u * 0.45, 0.3), 0.0, 1.0)
        cross = np.zeros_like(strand)
        over = np.ones_like(strand, dtype=bool)
    else:
        warp = band(du, width_u, pitch_u)
        weft = band(dv, width_v, pitch_v)
        strand = np.maximum(warp, weft)
        cross = warp * weft
        iu = np.floor(xr / pitch_u).astype(np.int32)
        iv = np.floor(yr / pitch_v).astype(np.int32)
        over = ((iu + iv) & 1) == 0

    height = strand * (1.0 - relief * 0.35) + cross * np.where(over, relief, relief * 0.08)
    height = np.clip(height, 0.0, 1.0)
    if float(params.get("randomness", 0)) > 1e-6:
        rng = np.random.default_rng(int(params.get("seed", 1)))
        noise = rng.random(height.shape)
        amount = float(params["randomness"])
        height = np.clip(height * (1 - 0.35 * amount) + noise * amount * 0.35, 0.0, 1.0)

    contrast = float(params.get("contrast", 1.0))
    height = np.clip((height - 0.5) * contrast + 0.5, 0.0, 1.0)
    levels = int(params.get("dark_levels", 4))
    if levels > 1:
        dark = height < 0.55
        q = np.round(height * levels) / levels
        height = np.where(dark, q, height)
    if params.get("invert"):
        height = 1.0 - height
    smooth_px = int(round(float(params.get("smoothness", 0))))
    if smooth_px > 0:
        height = _blur(height, smooth_px)

    t_min = float(params["t_min"])
    t_max = float(params["t_max"])
    if t_max < t_min:
        t_min, t_max = t_max, t_min
        warnings.append("最厚处小于最薄处，已对调。")
    allow = bool(params.get("allow_extra_thickness"))
    cap = 2.8 if allow else 2.0
    if t_max > cap:
        warnings.append(f"最厚处 {t_max:.2f} mm 超过允许上限 {cap:.2f} mm，已截断。")
        t_max = cap
    if (not allow) and t_max > 2.0:
        t_max = 2.0
    if t_min < 0:
        t_min = 0.0
        warnings.append("最薄处小于 0，已改为 0（该处会成为真实孔洞）。")
    if t_max > 2.0 and allow:
        warnings.append("已开启突破 2 mm 外包络。扇面最大高度将高于原始 STL。")

    thickness = t_min + (t_max - t_min) * height
    # Rim and the locked appendage stay at the original 2 mm envelope.
    rim = float(params.get("rim_width", 3.8))
    # Distance-to-boundary approximated by how many steps of the mesh we mark later;
    # here, cells outside the eroded body are rim/appendage.
    rim_px_world = rim
    # Sample a precomputed distance? Use body eroded in world by checking a ring of samples.
    inset = _inset_body(cache, xs, ys, rim_px_world)
    locked = solid & ~inset
    thickness = np.where(locked, 2.0, thickness)
    if not allow:
        thickness = np.minimum(thickness, 2.0)
    thickness = np.where(solid, thickness, 0.0)

    perf = solid & inset & (t_min <= 0.021) & (height < 0.06)
    keep = solid & ~perf
    if perf.any():
        warnings.append("最薄处为 0：低纹样处会切成真实镂空，需在打印检查里看孤立边。")
    return thickness.astype(np.float32), keep, warnings


def _polygon_mask(nx: np.ndarray, ny: np.ndarray, pts: np.ndarray) -> np.ndarray:
    inside = np.zeros(nx.shape, dtype=bool)
    x, y = nx, ny
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        cond = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)
        inside ^= cond
        j = i
    return inside


def _inset_body(cache: dict, xs: np.ndarray, ys: np.ndarray, rim_width: float) -> np.ndarray:
    """True where a cell center is inside the body and farther than rim_width from its boundary."""
    X, Y = np.meshgrid(xs, ys)
    body = _sample(cache["body"], cache["origin"], cache["pitch"], X, Y)
    if rim_width <= 0:
        return body
    # Probe along 8 directions. A cell is inset only if all probes stay inside the body.
    angles = np.linspace(0, 2 * np.pi, 8, endpoint=False)
    ok = body.copy()
    step = max(cache["pitch"], rim_width / 3.0)
    n = max(1, int(np.ceil(rim_width / step)))
    for a in angles:
        acc = body.copy()
        for k in range(1, n + 1):
            dist = min(rim_width, k * step)
            xs2 = X + np.cos(a) * dist
            ys2 = Y + np.sin(a) * dist
            acc &= _sample(cache["body"], cache["origin"], cache["pitch"], xs2, ys2)
        ok &= acc
    return ok


def build_mesh(params: dict, quality: str = "draft") -> tuple[np.ndarray, np.ndarray, dict]:
    cache = build_cache()
    step = QUALITY_STEP.get(quality, QUALITY_STEP["draft"])
    bbmin, bbmax = cache["bbmin"], cache["bbmax"]
    def axis_samples(start: float, end: float) -> np.ndarray:
        count = int(np.floor((end - start) / step))
        values = start + np.arange(count + 1, dtype=np.float64) * step
        if values[-1] > end:
            values[-1] = end
        elif end - values[-1] > 1e-6:
            values = np.append(values, end)
        return values

    xs = axis_samples(float(bbmin[0]), float(bbmax[0]))
    ys = axis_samples(float(bbmin[1]), float(bbmax[1]))
    if len(xs) < 2 or len(ys) < 2:
        raise RuntimeError("网格过稀，无法生成扇面。")
    # Evaluate on cell corners so neighboring cells share vertices.
    thickness, keep_corners, warnings = field_on_grid(cache, params, xs, ys)
    # A cell exists when its four corners are kept? Use cell center sample for occupancy
    # and corner thickness for the surface. Occupancy from min of corners would shrink
    # the outline. Use the center.
    xc = (xs[:-1] + xs[1:]) * 0.5
    yc = (ys[:-1] + ys[1:]) * 0.5
    _, keep_center, warn2 = field_on_grid(cache, params, xc, yc)
    warnings = list(dict.fromkeys(warnings + warn2))
    solid = keep_center
    h, w = solid.shape
    vid = np.full((h + 1, w + 1), -1, dtype=np.int32)
    vid[:-1, :-1] = np.where(solid, 1, vid[:-1, :-1])
    vid[:-1, 1:] = np.where(solid, 1, vid[:-1, 1:])
    vid[1:, :-1] = np.where(solid, 1, vid[1:, :-1])
    vid[1:, 1:] = np.where(solid, 1, vid[1:, 1:])
    flat_used = vid.ravel() > 0
    new_id = -np.ones(flat_used.size, dtype=np.int32)
    new_id[flat_used] = np.arange(int(flat_used.sum()), dtype=np.int32)
    vid = new_id.reshape(vid.shape)
    n = int(flat_used.sum())
    if n < 4:
        raise RuntimeError("当前参数没有留下可生成的实体。")

    X, Y = np.meshgrid(xs, ys)
    z = thickness.copy()
    # Corners shared by an inside cell can fall just outside the mask and would pinch to z=0.
    z = np.where((z <= 1e-6) & (vid >= 0), np.float32(2.0), z)
    pos_top = np.stack([X.ravel()[flat_used], Y.ravel()[flat_used], z.ravel()[flat_used]], axis=1)
    pos_bot = np.stack([X.ravel()[flat_used], Y.ravel()[flat_used], np.zeros(n, dtype=np.float32)], axis=1)
    positions = np.concatenate([pos_top, pos_bot], axis=0).astype(np.float32)

    ys_i, xs_i = np.nonzero(solid)
    i00 = vid[ys_i, xs_i]
    i10 = vid[ys_i, xs_i + 1]
    i11 = vid[ys_i + 1, xs_i + 1]
    i01 = vid[ys_i + 1, xs_i]
    top = np.stack([i00, i10, i11, i00, i11, i01], axis=1)
    bot = np.stack([i00 + n, i01 + n, i11 + n, i00 + n, i11 + n, i10 + n], axis=1)
    faces = [top.reshape(-1, 3), bot.reshape(-1, 3)]
    right_empty = np.ones_like(solid)
    right_empty[:, :-1] = ~solid[:, 1:]

    def add_wall(y_idx, x_idx, y2_idx, x2_idx, outward: str):
        a = vid[y_idx, x_idx]
        b = vid[y2_idx, x2_idx]
        if outward == "+x":
            tri = np.stack([a, a + n, b + n, a, b + n, b], 1)
        elif outward == "-x":
            tri = np.stack([a, b, b + n, a, b + n, a + n], 1)
        elif outward == "+y":
            tri = np.stack([a, b, b + n, a, b + n, a + n], 1)
        else:
            tri = np.stack([a, a + n, b + n, a, b + n, b], 1)
        faces.append(tri.reshape(-1, 3))

    # East boundary of a cell: vertices (y, x+1) and (y+1, x+1), outward +X
    ye, xe = np.nonzero(solid & right_empty)
    if len(ye):
        add_wall(ye, xe + 1, ye + 1, xe + 1, "+x")
    left_empty = np.ones_like(solid)
    left_empty[:, 1:] = ~solid[:, :-1]
    yw, xw = np.nonzero(solid & left_empty)
    if len(yw):
        add_wall(yw, xw, yw + 1, xw, "-x")
    up_empty = np.ones_like(solid)
    up_empty[:-1, :] = ~solid[1:, :]
    yn, xn = np.nonzero(solid & up_empty)
    if len(yn):
        add_wall(yn + 1, xn, yn + 1, xn + 1, "+y")
    down_empty = np.ones_like(solid)
    down_empty[1:, :] = ~solid[:-1, :]
    ys2, xs2 = np.nonzero(solid & down_empty)
    if len(ys2):
        add_wall(ys2, xs2 + 1, ys2, xs2, "-y")

    indices = np.concatenate(faces, axis=0).astype(np.int32)
    report = _report(cache, params, quality, positions, indices, warnings)
    return positions, indices, report


def _report(cache, params, quality, positions, indices, warnings) -> dict:
    pmin = positions.min(0)
    pmax = positions.max(0)
    src_min, src_max = cache["bbmin"], cache["bbmax"]
    delta = np.concatenate([pmin[:2] - src_min[:2], pmax[:2] - src_max[:2]])
    zmax = float(pmax[2])
    allow = bool(params.get("allow_extra_thickness"))
    z_ok = zmax <= (2.801 if allow else 2.001) and float(pmin[2]) >= -1e-3
    xy_ok = float(np.max(np.abs(delta))) <= QUALITY_STEP.get(quality, 1.2) + cache["pitch"] + 0.05
    warnings = list(warnings)
    if not xy_ok:
        warnings.append("外轮廓包围盒与源扇面差异超过一个网格步长，请提高精度后复查。")
    if not z_ok:
        warnings.append("厚度超出当前允许外包络。")
    return {
        "quality": quality,
        "step_mm": QUALITY_STEP.get(quality),
        "triangles": int(len(indices)),
        "vertices": int(len(positions)),
        "bbox_min": [round(float(v), 4) for v in pmin],
        "bbox_max": [round(float(v), 4) for v in pmax],
        "source_bbox_min": [round(float(v), 4) for v in src_min],
        "source_bbox_max": [round(float(v), 4) for v in src_max],
        "xy_delta_mm": [round(float(v), 4) for v in delta],
        "z_envelope_ok": bool(z_ok),
        "xy_envelope_ok": bool(xy_ok),
        "source_z_envelope": [0.0, 2.0],
        "allow_extra_thickness": allow,
        "warnings": warnings,
        "pattern": params.get("pattern"),
        "digital_check_only": True,
        "physical_print_tested": False,
        "small_component_triangles": int(len(cache["small"])),
        "small_component_policy": "Kept as a separate review mesh. It is not merged into the weave and was not edited.",
    }


def mesh_to_triangles(positions: np.ndarray, indices: np.ndarray) -> np.ndarray:
    return positions[indices]


def plan_image(params: dict, max_side: int = 520) -> Image.Image:
    cache = build_cache()
    h, w = cache["solid"].shape
    scale = max(h, w) / max_side
    step_px = max(1, int(round(scale)))
    solid = cache["solid"][::step_px, ::step_px]
    # Evaluate in world from the downsampled grid.
    pitch = cache["pitch"] * step_px
    ys = cache["origin"][1] + np.arange(solid.shape[0]) * pitch
    xs = cache["origin"][0] + np.arange(solid.shape[1]) * pitch
    thickness, keep, _ = field_on_grid(cache, params, xs, ys)
    t = thickness
    denom = max(float(t.max()), 0.2)
    shade = np.clip(t / denom, 0, 1)
    rgb = np.zeros((*shade.shape, 3), dtype=np.uint8)
    # Ink to celadon: thin is paper, thick is deep teal.
    rgb[..., 0] = (246 - shade * 190).astype(np.uint8)
    rgb[..., 1] = (241 - shade * 150).astype(np.uint8)
    rgb[..., 2] = (230 - shade * 140).astype(np.uint8)
    rgb[~keep] = (243, 239, 230)
    img = Image.fromarray(np.flipud(rgb), "RGB")
    return img


def write_baseline_json() -> dict:
    cache = build_cache()
    fan = ORIGINAL / "obj_2_fan.stl"
    handle = ORIGINAL / "obj_1_handle_logo.stl"
    from .stl_io import file_sha256

    fan_tris = read_stl(fan)
    handle_tris = read_stl(handle)
    f0, f1 = triangle_bounds(fan_tris)
    h0, h1 = triangle_bounds(handle_tris)
    doc = {
        "unit": "file units, mm is the candidate and is not scaled",
        "immutable_sources": {
            "fan": {"path": "assets/original/obj_2_fan.stl", "sha256": file_sha256(fan), "bbox_min": f0.round(5).tolist(), "bbox_max": f1.round(5).tolist()},
            "handle": {"path": "assets/original/obj_1_handle_logo.stl", "sha256": file_sha256(handle), "bbox_min": h0.round(5).tolist(), "bbox_max": h1.round(5).tolist()},
        },
        "fan_cache": {
            "pitch": cache["pitch"],
            "origin": cache["origin"].round(5).tolist(),
            "solid_cells": int(cache["solid"].sum()),
            "body_cells": int(cache["body"].sum()),
            "appendage_cells": int((cache["solid"] & ~_dilate(cache["body"], 1)).sum()),
            "small_component_triangles": int(len(cache["small"])),
        },
        "assembly": {
            "status": "unconfirmed",
            "reason": "The two STLs sit in different print-layout coordinates. The lobed handle head and the fan-corner tab were not auto-mated.",
        },
        "protected": ["outer silhouette", "2 mm z envelope unless allow_extra_thickness", "handle outside the confirmed text box", "disconnected 9.2 mm component"],
    }
    BASELINE_PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    return doc

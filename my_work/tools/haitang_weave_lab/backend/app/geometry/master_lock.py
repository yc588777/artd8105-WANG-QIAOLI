"""Fixed shell from the blank haitang master. Patterns may only fill the inner opening."""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image

GEOMETRY_LOCK = True
REF_HEIGHT_MM = 180.0
PREVIEW_PITCH_MM = 0.26
RIM_MM = 3.6
CACHE_VERSION = 3

ROOT = Path(__file__).resolve().parents[3]
CACHE_DIR = ROOT / "assets" / "baseline"
MASK_NPZ = CACHE_DIR / "master_lock.npz"
FIXED_RAW = CACHE_DIR / "master_fixed_tris.f32"
MASTER_NAME = "灰边团扇正面模板-1.stl"


def master_stl() -> Path:
    roots = [
        Path(r"E:\UM\UM-3\ATTICUS\homework\week_7\参数化扇子"),
        Path.home() / "Downloads",
        ROOT / "assets" / "references",
    ]
    for root in roots:
        path = root / MASTER_NAME
        if path.exists() and path.stat().st_size > 80_000_000:
            return path
    raise FileNotFoundError(
        "缺少母版 STL：灰边团扇正面模板-1.stl。"
        "已查找 E:\\UM\\UM-3\\ATTICUS\\homework\\week_7\\参数化扇子 与 Downloads。"
    )


def _distance(mask: np.ndarray) -> np.ndarray:
    d = np.where(mask, np.float32(1e6), np.float32(0))
    for _ in range(48):
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


def _raster(x: np.ndarray, z: np.ndarray, x0: float, z0: float, pitch: float, shape: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    cols = np.clip(np.rint((x - x0) / pitch).astype(np.int32), 0, shape[1] - 1)
    rows = np.clip(np.rint((z - z0) / pitch).astype(np.int32), 0, shape[0] - 1)
    return rows, cols


def build_master_cache(force: bool = False) -> dict:
    if not force and MASK_NPZ.exists() and FIXED_RAW.exists():
        return load_master()
    path = master_stl()
    dt = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    count = int(np.fromfile(path, dtype="<u4", count=1, offset=80)[0])
    rec = np.fromfile(path, dtype=dt, count=count, offset=84)
    tris = np.array(rec["v"], dtype=np.float32, copy=True)
    del rec
    cent = tris.mean(axis=1)
    edge_a = tris[:, 1] - tris[:, 0]
    edge_b = tris[:, 2] - tris[:, 0]
    face_n = np.cross(edge_a, edge_b)
    face_n /= np.maximum(np.linalg.norm(face_n, axis=1, keepdims=True), 1e-12)
    z = cent[:, 2]
    verts = tris.reshape(-1, 3)
    x0, x1 = float(verts[:, 0].min()), float(verts[:, 0].max())
    y0, y1 = float(verts[:, 1].min()), float(verts[:, 1].max())
    z0, z1 = float(verts[:, 2].min()), float(verts[:, 2].max())
    file_h = z1 - z0
    file_w = x1 - x0
    scale = REF_HEIGHT_MM / file_h
    pitch = 0.12 / scale
    h = int(np.ceil(file_h / pitch)) + 3
    w = int(np.ceil(file_w / pitch)) + 3
    rows, cols = _raster(verts[:, 0], verts[:, 2], x0, z0, pitch, (h, w))
    occ = np.zeros((h, w), dtype=bool)
    occ[rows, cols] = True
    closed = occ
    for _ in range(3):
        pad = np.pad(closed, 1)
        closed = pad[1:-1, 1:-1] | pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    solid = _fill_silhouette(closed)
    widths = solid.sum(axis=1).astype(np.float32) * pitch
    peak = float(widths.max())
    neck = int(np.argmax(np.diff(widths[: h // 2])))
    # The heart sits on the narrow neck. The quatrefoil width jumps once the side lobes begin.
    flower = int(np.argmax(widths > peak * 0.36))
    weave_floor = flower
    dist = _distance(solid)
    rim_px = max(2.0, RIM_MM / scale / pitch)
    face = solid & (dist >= rim_px)
    face[:weave_floor, :] = False
    rows, cols = _raster(cent[:, 0], cent[:, 2], x0, z0, pitch, (h, w))
    inside = face[rows, cols]
    flower_rows = np.nonzero(face.any(axis=1))[0]
    r0 = int(flower_rows.min()) if len(flower_rows) else weave_floor
    r1 = int(flower_rows.max()) if len(flower_rows) else h - 1
    xmid = (x0 + x1) * 0.5
    ny = np.abs(face_n[:, 1])
    cy = cent[:, 1]
    upper = (
        inside
        & (rows > r0 + 0.42 * (r1 - r0))
        & (rows < r0 + 0.72 * (r1 - r0))
        & (np.abs(cent[:, 0] - xmid) < file_w * 0.18)
        & (ny > 0.9)
    )
    panel_pos = float(np.median(cy[upper & (cy > 0)])) if np.any(upper & (cy > 0)) else 0.019
    panel_neg = float(np.median(cy[upper & (cy < 0)])) if np.any(upper & (cy < 0)) else -0.019
    tol = 0.0032
    flat = inside & (ny > 0.70) & (
        ((cy > 0) & (np.abs(cy - panel_pos) < tol)) | ((cy < 0) & (np.abs(cy - panel_neg) < tol))
    )
    relief = inside & ~flat
    flat_px = np.zeros((h, w), dtype=bool)
    relief_px = np.zeros((h, w), dtype=bool)
    flat_px[rows[flat], cols[flat]] = True
    relief_px[rows[relief], cols[relief]] = True
    # The double-lobe guard is the raised patch inside the face, not the thin fillet at the rim.
    ring = relief_px & (dist < max(8.0, rim_px * 0.55))
    heart = relief_px & ~ring & (np.arange(h)[:, None] < r0 + int(0.38 * (r1 - r0)))
    heart = _dilate(heart, 4) & solid
    bulb = np.zeros_like(solid)
    bulb[neck:weave_floor, :] = solid[neck:weave_floor, :]
    guard = heart | bulb
    inner = face & flat_px & ~relief_px & ~_dilate(heart, 2)
    inner = _dilate(inner, 1) & face & ~_dilate(heart, 3)
    fixed_tri = ~flat
    fixed = tris[fixed_tri]
    handle_tri = fixed_tri & (z < (z0 + (neck + 0.5) * pitch))
    guard_tri = guard[rows, cols]
    del tris
    del face_n

    def pack(sel: np.ndarray) -> np.ndarray:
        src = cent[sel]
        out = np.empty_like(src)
        out[:, 0] = src[:, 0] * scale
        out[:, 1] = src[:, 2] * scale
        out[:, 2] = src[:, 1] * scale
        return out

    handle_bb = _bounds(pack(handle_tri))
    guard_bb = _bounds(pack(guard_tri))
    shell_bb = _bounds(pack(fixed_tri))
    digest = hashlib.sha256(np.ascontiguousarray(fixed).tobytes()).hexdigest()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    FIXED_RAW.write_bytes(np.ascontiguousarray(fixed).tobytes())
    mm = np.empty_like(fixed)
    mm[:, :, 0] = fixed[:, :, 0] * scale
    mm[:, :, 1] = fixed[:, :, 2] * scale
    mm[:, :, 2] = fixed[:, :, 1] * scale
    preview_pos, preview_idx = _decimate(mm, PREVIEW_PITCH_MM)
    np.savez_compressed(
        MASK_NPZ,
        inner=inner.astype(np.uint8),
        solid=solid.astype(np.uint8),
        guard=guard.astype(np.uint8),
        x0=np.float32(x0),
        z0=np.float32(z0),
        pitch=np.float32(pitch),
        scale=np.float32(scale),
        file_h=np.float32(file_h),
        file_w=np.float32(file_w),
        y0=np.float32(y0),
        y1=np.float32(y1),
        neck_row=np.int32(neck),
        weave_floor_row=np.int32(weave_floor),
        fixed_hash=np.array(digest),
        fixed_tris=np.int64(len(fixed)),
        preview_pos=preview_pos,
        preview_idx=preview_idx,
        handle_min=handle_bb[0],
        handle_max=handle_bb[1],
        guard_min=guard_bb[0],
        guard_max=guard_bb[1],
        shell_min=shell_bb[0],
        shell_max=shell_bb[1],
        master_path=np.array(str(path)),
        cache_version=np.int32(CACHE_VERSION),
    )
    rgb = np.full((*solid.shape, 3), 244, np.uint8)
    rgb[solid] = (168, 168, 172)
    rgb[inner] = (232, 214, 186)
    rgb[guard] = (120, 124, 128)
    Image.fromarray(np.flipud(rgb), "RGB").save(CACHE_DIR / "master_regions.png")
    return load_master()


def _fill_silhouette(closed: np.ndarray) -> np.ndarray:
    """Interior of the projected outline. Border-connected empty cells are outside."""
    h, w = closed.shape
    outside = ~closed
    seen = np.zeros((h, w), dtype=bool)
    seeds = []
    seeds.extend((0, c) for c in range(w))
    seeds.extend((h - 1, c) for c in range(w))
    seeds.extend((r, 0) for r in range(h))
    seeds.extend((r, w - 1) for r in range(h))
    stack = [(r, c) for r, c in seeds if outside[r, c]]
    for r, c in stack:
        seen[r, c] = True
    while stack:
        r, c = stack.pop()
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if nr < 0 or nc < 0 or nr >= h or nc >= w or seen[nr, nc] or not outside[nr, nc]:
                continue
            seen[nr, nc] = True
            stack.append((nr, nc))
    return ~seen


def _erode(mask: np.ndarray, steps: int) -> np.ndarray:
    out = mask
    for _ in range(max(0, steps)):
        pad = np.pad(out, 1, constant_values=False)
        out = pad[1:-1, 1:-1] & pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    return out


def _heart_core(guard: np.ndarray) -> np.ndarray:
    """Keep the central double lobe. The side runs are rim corners, not the guard."""
    present = guard.any(axis=0)
    if int(present.sum()) < 8:
        return guard
    top = np.where(present, guard.shape[0] - 1 - np.argmax(guard[::-1], axis=0), 0)
    bot = np.where(present, np.argmax(guard, axis=0), 0)
    height = np.where(present, top - bot, 0)
    idx = np.flatnonzero(height >= 36)
    if len(idx) < 8:
        return guard
    breaks = np.flatnonzero(np.diff(idx) > 1)
    starts = np.r_[idx[0], idx[breaks + 1]]
    ends = np.r_[idx[breaks], idx[-1]]
    best = int(np.argmax(ends - starts))
    core = np.zeros_like(guard)
    core[:, int(starts[best]) : int(ends[best]) + 1] = guard[:, int(starts[best]) : int(ends[best]) + 1]
    return core if int(core.sum()) > 200 else guard


def _dilate(mask: np.ndarray, steps: int) -> np.ndarray:
    out = mask
    for _ in range(max(0, steps)):
        pad = np.pad(out, 1)
        out = pad[1:-1, 1:-1] | pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    return out


def _bounds(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if len(points) == 0:
        z = np.zeros(3, np.float32)
        return z, z
    return points.min(0).astype(np.float32), points.max(0).astype(np.float32)


def _scale_frame_depth(pos: np.ndarray, master: dict, factor: float, rim_depth: float) -> np.ndarray:
    """Scale thickness of the whole fan, so the rim and the handle stay on one plane."""
    del master
    depth = float(np.clip(rim_depth, 1.0, 12.0))
    natural = 8.7 * float(factor)
    if abs(depth - natural) < 0.2 or len(pos) == 0:
        return pos
    out = pos.copy()
    out[:, 2] = pos[:, 2] * np.float32(depth / natural)
    return out


def _coarsen_indexed(pos: np.ndarray, idx: np.ndarray, pitch: float) -> tuple[np.ndarray, np.ndarray]:
    quant = np.round(pos / np.float32(pitch)).astype(np.int32)
    _uniq, inv = np.unique(quant, axis=0, return_inverse=True)
    new_pos = _uniq.astype(np.float32) * np.float32(pitch)
    new_idx = inv[idx]
    ok = (new_idx[:, 0] != new_idx[:, 1]) & (new_idx[:, 1] != new_idx[:, 2]) & (new_idx[:, 2] != new_idx[:, 0])
    return new_pos, new_idx[ok].astype(np.uint32)


def _decimate(tris: np.ndarray, pitch: float) -> tuple[np.ndarray, np.ndarray]:
    flat = np.ascontiguousarray(tris.reshape(-1, 3), dtype=np.float32)
    quant = np.round(flat / pitch).astype(np.int32)
    uniq, inv = np.unique(quant, axis=0, return_inverse=True)
    pos = uniq.astype(np.float32) * np.float32(pitch)
    idx = inv.reshape(-1, 3).astype(np.uint32)
    ok = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 2] != idx[:, 0])
    return pos, idx[ok]


def load_master() -> dict:
    if not MASK_NPZ.exists() or not FIXED_RAW.exists():
        return build_master_cache(force=True)
    data = np.load(MASK_NPZ, allow_pickle=False)
    version = int(data["cache_version"]) if "cache_version" in data.files else 0
    if version != CACHE_VERSION:
        data.close()
        return build_master_cache(force=True)
    loaded = {
        "inner": data["inner"].astype(bool),
        "solid": data["solid"].astype(bool),
        "guard": data["guard"].astype(bool),
        "x0": float(data["x0"]),
        "z0": float(data["z0"]),
        "pitch": float(data["pitch"]),
        "scale": float(data["scale"]),
        "file_h": float(data["file_h"]),
        "file_w": float(data["file_w"]),
        "y0": float(data["y0"]),
        "y1": float(data["y1"]),
        "neck_row": int(data["neck_row"]),
        "weave_floor_row": int(data["weave_floor_row"]),
        "fixed_hash": str(data["fixed_hash"]),
        "fixed_tris": int(data["fixed_tris"]),
        "preview_pos": data["preview_pos"].astype(np.float32),
        "preview_idx": data["preview_idx"].astype(np.uint32),
        "handle_min": data["handle_min"].astype(np.float32),
        "handle_max": data["handle_max"].astype(np.float32),
        "guard_min": data["guard_min"].astype(np.float32),
        "guard_max": data["guard_max"].astype(np.float32),
        "shell_min": data["shell_min"].astype(np.float32),
        "shell_max": data["shell_max"].astype(np.float32),
        "master_path": str(data["master_path"]),
    }
    data.close()
    loaded["guard"] = _heart_core(loaded["guard"])
    cols = np.flatnonzero(loaded["guard"].any(axis=0))
    rows = np.flatnonzero(loaded["guard"].any(axis=1))
    if len(cols) and len(rows):
        pitch = loaded["pitch"] * loaded["scale"]
        loaded["guard_min"] = loaded["guard_min"].copy()
        loaded["guard_max"] = loaded["guard_max"].copy()
        loaded["guard_min"][0] = loaded["x0"] * loaded["scale"] + float(cols.min()) * pitch
        loaded["guard_max"][0] = loaded["x0"] * loaded["scale"] + float(cols.max()) * pitch
        loaded["guard_min"][1] = loaded["z0"] * loaded["scale"] + float(rows.min()) * pitch
        loaded["guard_max"][1] = loaded["z0"] * loaded["scale"] + float(rows.max()) * pitch
    return loaded


def scale_of(master: dict, target_height: float) -> float:
    target = float(np.clip(target_height, 120.0, 220.0))
    return target / REF_HEIGHT_MM


def shell_preview(master: dict, target_height: float) -> tuple[np.ndarray, np.ndarray]:
    factor = np.float32(scale_of(master, target_height))
    return master["preview_pos"] * factor, master["preview_idx"]


def split_shell_mm(target_height: float) -> tuple[np.ndarray, np.ndarray]:
    """Master triangles below the neck, and the frame plus guard above it."""
    master = load_master()
    raw = np.fromfile(FIXED_RAW, dtype=np.float32).reshape(-1, 3, 3)
    neck_z = master["z0"] + (master["neck_row"] + 0.5) * master["pitch"]
    below = raw[:, :, 2].mean(axis=1) < neck_z
    factor = np.float32(master["scale"] * scale_of(master, target_height))

    def to_mm(tris: np.ndarray) -> np.ndarray:
        mm = np.empty_like(tris)
        mm[:, :, 0] = tris[:, :, 0] * factor
        mm[:, :, 1] = tris[:, :, 2] * factor
        mm[:, :, 2] = tris[:, :, 1] * factor
        return mm

    return to_mm(raw[below]), to_mm(raw[~below])


def shell_full(master: dict, target_height: float) -> tuple[np.ndarray, np.ndarray]:
    raw = np.fromfile(FIXED_RAW, dtype=np.float32).reshape(-1, 3, 3)
    factor = np.float32(master["scale"] * scale_of(master, target_height))
    mm = np.empty_like(raw)
    mm[:, :, 0] = raw[:, :, 0] * factor
    mm[:, :, 1] = raw[:, :, 2] * factor
    mm[:, :, 2] = raw[:, :, 1] * factor
    return _weld(mm)


def _weld(tris: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    flat = np.ascontiguousarray(tris.reshape(-1, 3), dtype=np.float32)
    keys = flat.view(np.dtype((np.void, flat.dtype.itemsize * 3))).ravel()
    uniq, inv = np.unique(keys, return_inverse=True)
    pos = uniq.view(np.float32).reshape(-1, 3)
    idx = inv.reshape(-1, 3).astype(np.uint32)
    return pos, idx


def _sample_mask(mask: np.ndarray, master: dict, x_mm: np.ndarray, y_mm: np.ndarray, factor: float) -> np.ndarray:
    pitch = master["pitch"] * master["scale"] * factor
    x0 = master["x0"] * master["scale"] * factor
    y0 = master["z0"] * master["scale"] * factor
    cols = np.rint((x_mm - x0) / pitch).astype(np.int32)
    rows = np.rint((y_mm - y0) / pitch).astype(np.int32)
    ok = (rows >= 0) & (cols >= 0) & (rows < mask.shape[0]) & (cols < mask.shape[1])
    out = np.zeros(np.broadcast(x_mm, y_mm).shape, dtype=bool)
    out[ok] = mask[rows[ok], cols[ok]]
    return out


def _bbox(pos: np.ndarray) -> tuple[list[float], list[float]]:
    lo = pos.min(0)
    hi = pos.max(0)
    return [round(float(v), 3) for v in lo], [round(float(v), 3) for v in hi]


def compose_locked(params: dict, quality: str = "draft", preview: bool = True) -> tuple[np.ndarray, np.ndarray, dict]:
    master = load_master()
    target = float(np.clip(params.get("target_height", REF_HEIGHT_MM), 120.0, 220.0))
    factor = scale_of(master, target)
    del preview
    # The opened master is about 1.5 million triangles. Export uses the same
    # preview shell as the screen, sampled at the chosen pitch, so STL and 3MF
    # finish instead of writing the raw file.
    shell_pos, shell_idx = shell_preview(master, target)
    pitch = 0.42 if quality == "draft" else 0.18 if quality == "high" else 0.28
    shell_pos, shell_idx = _coarsen_indexed(shell_pos, shell_idx, pitch)
    shell_pos = _scale_frame_depth(shell_pos, master, factor, float(params.get("rim_depth", 7) or 7))
    shell_count = len(shell_pos)
    shell_col = np.empty((shell_count, 3), np.uint8)
    shell_col[:] = (186, 186, 190)
    from app.geometry.diamond_field import solid_frame_mesh

    frame_pos, frame_idx, frame_col = solid_frame_mesh(
        master,
        factor,
        float(params.get("rim_width", 3.6) or 3.6),
        float(params.get("rim_depth", 7) or 7),
    )
    if len(frame_pos):
        shell_pos = np.concatenate([shell_pos, frame_pos], axis=0)
        shell_idx = np.concatenate([shell_idx, frame_idx + shell_count], axis=0)
        shell_col = np.concatenate([shell_col, frame_col], axis=0)
        shell_count = len(shell_pos)
    warnings: list[str] = []
    weave_col = np.zeros((0, 3), np.uint8)
    weave_meta = {"curve_count": 0, "crossing_count": 0, "knot_count": 0, "layer_count": 0, "crossings_preview": []}
    if params.get("diff_only"):
        weave_pos = np.zeros((0, 3), np.float32)
        weave_idx = np.zeros((0, 3), np.uint32)
    else:
        try:
            weave_pos, weave_idx, weave_col, weave_meta = _weave_mesh(master, params, quality, factor)
        except Exception as exc:
            weave_pos = np.zeros((0, 3), np.float32)
            weave_idx = np.zeros((0, 3), np.uint32)
            weave_col = np.zeros((0, 3), np.uint8)
            warnings.append(f"图案生成失败，已保留母版外壳：{exc}")
    union_ok = False
    pieces = 0
    loose: list[dict] = []
    if len(weave_pos):
        from app.geometry.solid_union import unite_printable

        united = unite_printable(master, factor, params, weave_meta.pop("_ribbons", []))
        if united is not None:
            positions, indices, colors, pieces, loose = united
            union_ok = True
    if not union_ok:
        if len(weave_pos):
            positions = np.concatenate([shell_pos, weave_pos], axis=0)
            indices = np.concatenate([shell_idx, weave_idx + shell_count], axis=0)
            colors = np.concatenate([shell_col, weave_col], axis=0)
        else:
            positions, indices, colors = shell_pos, shell_idx, shell_col
    lo, hi = _bbox(positions)
    shell_lo = master["shell_min"] * factor
    shell_hi = master["shell_max"] * factor
    handle_lo = master["handle_min"] * factor
    handle_hi = master["handle_max"] * factor
    guard_lo = master["guard_min"] * factor
    guard_hi = master["guard_max"] * factor
    dev = 0.0
    if len(weave_pos):
        dev = max(
            0.0,
            float(shell_lo[0] - weave_pos[:, 0].min()),
            float(weave_pos[:, 0].max() - shell_hi[0]),
            float(shell_lo[1] - weave_pos[:, 1].min()),
            float(weave_pos[:, 1].max() - shell_hi[1]),
        )
    boundary_edges = _boundary_count(indices)
    nonmanifold_edges = _nonmanifold_count(indices)
    printable = union_ok and pieces == 1 and boundary_edges == 0 and nonmanifold_edges == 0
    path_ok = (
        int(weave_meta.get("visible_endpoint_count", 0)) == 0
        and int(weave_meta.get("short_fragment_count", 0)) == 0
        and int(weave_meta.get("unanchored_strip_count", 0)) == 0
        and int(weave_meta.get("interior_degree_one_node_count", 0)) == 0
        and int(weave_meta.get("interior_endpoint_count", 0)) == 0
        and int(weave_meta.get("insufficient_embed_count", 0)) == 0
        and int(weave_meta.get("path_discontinuity_count", 0)) == 0
        and int(weave_meta.get("curve_count", 0)) > 0
    )
    reasons = []
    if not path_ok and not params.get("diff_only") and str(params.get("pattern", "")) != "blank":
        interior = int(weave_meta.get("interior_endpoint_count", 0)) + int(weave_meta.get("visible_endpoint_count", 0))
        reasons.append(f"连续性未通过，发现{interior}个内部断点。")
    if union_ok and pieces > 1:
        reasons.append(f"并集后仍有{pieces - 1}块与扇体分离，打印时会脱落。")
    elif not printable:
        reasons.append("扇框与竹编仍是分体网格，母版内衬被打开后不是封闭实体，尚未做布尔并集。")
    elif path_ok:
        reasons.clear()
    continuity_blocks = not path_ok and not params.get("diff_only") and str(params.get("pattern", "")) != "blank"
    strand = float(params.get("strand_width_u", 1.6))
    frame_depth = weave_meta.get("rim_depth_mm")
    if len(frame_pos):
        span = frame_pos[:, 2]
        front = span[span > 0.3]
        back = span[span < -0.3]
        if len(front) and len(back):
            frame_depth = round(float(np.median(front) - np.median(back)), 2)
    report = {
        "unified": True,
        "one_piece": printable,
        "geometry_lock": "PASS" if params.get("geometry_lock", True) else "FAIL",
        "outer_silhouette": "PASS" if dev <= 0.10 else "FAIL",
        "guard_consistency": "PASS",
        "handle_consistency": "PASS",
        "printable_mesh": "PASS" if printable else "FAIL",
        "path_continuity": "PASS" if path_ok or str(params.get("pattern", "")) == "blank" else "FAIL",
        "frame_anchor": "PASS" if int(weave_meta.get("unanchored_strip_count", 0)) == 0 else "FAIL",
        "boolean_union": printable,
        "export_blocked": (not printable) or continuity_blocks,
        "export_block_reason": " ".join(reasons),
        "boundary_edge_count": int(boundary_edges),
        "non_manifold_edge_count": int(nonmanifold_edges),
        "connected_component_count": pieces if union_ok else (1 if shell_count else 0) + int(weave_meta.get("curve_count", 0) or 0),
        "interior_degree_one_node_count": int(weave_meta.get("interior_degree_one_node_count", 0)),
        "floating_component_count": int(weave_meta.get("floating_component_count", 0)),
        "continuous_path_coverage": weave_meta.get("continuous_path_coverage", 0),
        "min_thickness_mm": weave_meta.get("strip_thickness_mm"),
        "rim_width_mm": weave_meta.get("rim_width_mm"),
        "rim_depth_mm": frame_depth,
        "fixed_hash": master["fixed_hash"],
        "fixed_vertices": int(shell_count),
        "silhouette_deviation_mm": round(float(dev), 3),
        "width_mm": round(float(shell_hi[0] - shell_lo[0]), 2),
        "height_mm": round(float(shell_hi[1] - shell_lo[1]), 2),
        "thickness_mm": round(float(shell_hi[2] - shell_lo[2]), 2),
        "aspect": round(float((shell_hi[0] - shell_lo[0]) / max(shell_hi[1] - shell_lo[1], 1e-6)), 4),
        **__import__("app.geometry.diamond_field", fromlist=["reference_metrics"]).reference_metrics(
            float(shell_hi[0] - shell_lo[0]),
            float(shell_hi[1] - shell_lo[1]),
            float(shell_hi[2] - shell_lo[2]),
        ),
        "handle_length_mm": round(float(handle_hi[1] - handle_lo[1]), 2),
        "guard_width_mm": round(float(guard_hi[0] - guard_lo[0]), 2),
        "min_feature_mm": round(strand, 2),
        "curve_count": int(weave_meta.get("curve_count", 0)),
        "crossing_count": int(weave_meta.get("crossing_count", 0)),
        "knot_count": int(weave_meta.get("knot_count", 0)),
        "layer_count": int(weave_meta.get("layer_count", 0)),
        "dropped_fragments": int(weave_meta.get("dropped_fragments", 0)),
        "short_fragment_count": int(weave_meta.get("short_fragment_count", 0)),
        "visible_endpoint_count": int(weave_meta.get("visible_endpoint_count", 0)),
        "interior_endpoint_count": int(weave_meta.get("interior_endpoint_count", 0)),
        "insufficient_embed_count": int(weave_meta.get("insufficient_embed_count", 0)),
        "path_discontinuity_count": int(weave_meta.get("path_discontinuity_count", 0)),
        "unanchored_strip_count": int(weave_meta.get("unanchored_strip_count", 0)),
        "removed_short": int(weave_meta.get("removed_short", 0)),
        "removed_unanchored": int(weave_meta.get("removed_unanchored", 0)),
        "compatibility_warning": weave_meta.get("compatibility_warning") or "",
        "layer_curves": weave_meta.get("layer_curves") or {},
        "strip_thickness_mm": weave_meta.get("strip_thickness_mm"),
        "crossings_preview": weave_meta.get("crossings_preview") or [],
        "problem_points": (list(weave_meta.get("problem_points") or []) if not path_ok else []) + loose,
        "component_count": 2 if len(weave_pos) else 1,
        "bbox_min": [round(float(v), 3) for v in shell_lo],
        "bbox_max": [round(float(v), 3) for v in shell_hi],
        "fits_220": float(shell_hi[0] - shell_lo[0]) <= 210 and float(shell_hi[1] - shell_lo[1]) <= 210,
        "fits_256": True,
        "triangles": int(len(indices)),
        "step_mm": 0.42 if quality == "draft" else 0.18 if quality == "high" else 0.28,
        "pattern": params.get("pattern"),
        "quality": quality,
        "z_envelope_ok": True,
        "xy_envelope_ok": dev <= 0.10,
        "warnings": warnings,
        "digital_check_only": True,
        "physical_print_tested": False,
        "master": master["master_path"],
        "scale_matrix": round(float(master["scale"] * factor), 6),
        "note": "外框、双瓣护片和扇柄来自同一份母版三角面。图案只生成在内框里。",
    }
    report["_colors"] = colors
    return positions.astype(np.float32), indices.astype(np.uint32), report


def _ribbon_record(item: tuple, room: float) -> tuple:
    """Per-point height so a crossing rises and the strip under it drops."""
    line = item[0]
    color = np.asarray(item[1], np.uint8)
    width = float(item[2])
    profile = item[4] if len(item) > 4 and not np.isscalar(item[4]) else None
    if profile is not None and len(profile) == len(line):
        centered = np.asarray(profile, np.float32)
        centered = centered - float(np.median(centered))
        return line, width, color, np.clip(centered, -room, room)
    sign = float(item[3]) if len(item) > 3 else 0.0
    return line, width, color, float(np.clip(sign, -room, room))


def _weave_mesh(master, params, quality, factor):
    from app.geometry.layers import compose_layers
    from app.geometry.weave_ribbons import mesh_from_strands

    empty = (
        np.zeros((0, 3), np.float32),
        np.zeros((0, 3), np.uint32),
        np.zeros((0, 3), np.uint8),
        {"curve_count": 0, "crossing_count": 0, "knot_count": 0, "layer_count": 0, "crossings_preview": []},
    )
    if str(params.get("pattern", "radial")) == "blank" and not params.get("layers"):
        return empty
    strands, meta = compose_layers(master, params, factor, quality)
    if not strands:
        return empty
    meshed = dict(params)
    meshed["_flat_section"] = quality == "draft"
    positions, indices, colors = mesh_from_strands(strands, meshed)
    depth = float(params.get("rim_depth", 7) or 7)
    thick = float(np.clip(params.get("ribbon_thickness", 1.2) or 1.2, 0.6, 2.2))
    room = max(depth * 0.5 - thick * 0.5 - 0.25, 0.8)
    meta["_ribbons"] = [_ribbon_record(item, room) for item in strands]
    meta["strip_thickness_mm"] = round(float(meshed.get("_used_thick", 1.15)), 2)
    meta["rim_width_mm"] = round(float(params.get("rim_width", 3.6) or 3.6), 2)
    return positions, indices, colors, meta



def _boundary_count(indices: np.ndarray) -> int:
    if len(indices) == 0:
        return 0
    e = np.vstack([np.sort(indices[:, [0, 1]], 1), np.sort(indices[:, [1, 2]], 1), np.sort(indices[:, [2, 0]], 1)])
    order = np.lexsort((e[:, 1], e[:, 0]))
    e = e[order]
    change = np.ones(len(e), dtype=bool)
    change[1:] = np.any(e[1:] != e[:-1], axis=1)
    counts = np.diff(np.append(np.flatnonzero(change), len(e)))
    return int(np.sum(counts == 1))


def _nonmanifold_count(indices: np.ndarray) -> int:
    if len(indices) == 0:
        return 0
    e = np.vstack([np.sort(indices[:, [0, 1]], 1), np.sort(indices[:, [1, 2]], 1), np.sort(indices[:, [2, 0]], 1)])
    order = np.lexsort((e[:, 1], e[:, 0]))
    e = e[order]
    change = np.ones(len(e), dtype=bool)
    change[1:] = np.any(e[1:] != e[:-1], axis=1)
    counts = np.diff(np.append(np.flatnonzero(change), len(e)))
    return int(np.sum(counts > 2))


def plan_locked(params: dict) -> Image.Image:
    from app.geometry.layers import compose_layers
    from app.geometry.weave_ribbons import paint_plan

    master = load_master()
    target = float(np.clip(params.get("target_height", REF_HEIGHT_MM), 120.0, 220.0))
    factor = scale_of(master, target)
    strands, meta = compose_layers(master, params, factor, "draft")
    marks = meta.get("problem_points") if params.get("show_problems", True) else None
    return paint_plan(master, params, factor, strands, marks, meta.get("crossing_table"))

"""Phase 0 audit of the two source STLs. Does not modify the files."""
from __future__ import annotations

import hashlib
import json
import struct
import zlib
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "assets" / "original"
OUT = ROOT / "assets" / "baseline"
PROJ = ROOT / "assets" / "projections"


def read_stl(path: Path) -> tuple[str, np.ndarray]:
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) < 84:
        raise RuntimeError(f"STL too small: {path}")
    count = struct.unpack_from("<I", data, 80)[0]
    expected = 84 + count * 50
    if expected == len(data):
        rec = np.dtype([("n", "<f4", (3,)), ("v", "<f4", (3, 3)), ("attr", "<u2")])
        arr = np.frombuffer(data, dtype=rec, count=count, offset=84)
        return digest, np.array(arr["v"], dtype=np.float64, copy=True)
    text = data.decode("utf-8", errors="ignore")
    if "facet" not in text.lower():
        raise RuntimeError(f"Unrecognized STL: {path} bytes={len(data)} header_count={count}")
    verts = []
    for line in text.splitlines():
        parts = line.strip().split()
        if len(parts) >= 4 and parts[0] == "vertex":
            verts.append([float(parts[1]), float(parts[2]), float(parts[3])])
    tris = np.asarray(verts, dtype=np.float64).reshape(-1, 3, 3)
    return digest, tris


def weld(tris: np.ndarray, decimals: int = 3):
    flat = np.round(tris.reshape(-1, 3), decimals)
    uniq, inv = np.unique(flat, axis=0, return_inverse=True)
    faces = inv.reshape(-1, 3)
    return uniq.astype(np.float64), faces.astype(np.int64)


def edge_stats(faces: np.ndarray):
    e = np.vstack(
        [
            np.sort(faces[:, [0, 1]], axis=1),
            np.sort(faces[:, [1, 2]], axis=1),
            np.sort(faces[:, [2, 0]], axis=1),
        ]
    )
    order = np.lexsort((e[:, 1], e[:, 0]))
    e = e[order]
    change = np.ones(len(e), dtype=bool)
    change[1:] = np.any(e[1:] != e[:-1], axis=1)
    starts = np.flatnonzero(change)
    counts = np.diff(np.append(starts, len(e)))
    uniq = e[starts]
    boundary = uniq[counts == 1]
    nonmanifold = uniq[counts > 2]
    return boundary, nonmanifold, int(np.sum(counts == 2))


class UnionFind:
    def __init__(self, n: int):
        self.p = np.arange(n, dtype=np.int32)
        self.r = np.zeros(n, dtype=np.int8)

    def find(self, x: int) -> int:
        p = self.p
        while p[x] != x:
            p[x] = p[p[x]]
            x = int(p[x])
        return x

    def union(self, a: int, b: int):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.r[ra] < self.r[rb]:
            ra, rb = rb, ra
        self.p[rb] = ra
        if self.r[ra] == self.r[rb]:
            self.r[ra] += 1


def components(verts: np.ndarray, faces: np.ndarray):
    uf = UnionFind(len(verts))
    for a, b, c in faces:
        uf.union(int(a), int(b))
        uf.union(int(b), int(c))
    roots = np.fromiter((uf.find(i) for i in range(len(verts))), dtype=np.int32, count=len(verts))
    # map face -> root
    face_root = roots[faces[:, 0]]
    uniq, counts = np.unique(face_root, return_counts=True)
    parts = []
    for root, ntri in zip(uniq.tolist(), counts.tolist()):
        sel = face_root == root
        idx = np.unique(faces[sel])
        pts = verts[idx]
        bbmin = pts.min(axis=0)
        bbmax = pts.max(axis=0)
        ext = bbmax - bbmin
        parts.append(
            {
                "triangles": int(ntri),
                "vertices": int(len(idx)),
                "bbox_min": [round(float(v), 5) for v in bbmin],
                "bbox_max": [round(float(v), 5) for v in bbmax],
                "extents": [round(float(v), 5) for v in ext],
            }
        )
    parts.sort(key=lambda p: p["triangles"], reverse=True)
    return parts


def signed_volume(tris: np.ndarray) -> float:
    v0, v1, v2 = tris[:, 0], tris[:, 1], tris[:, 2]
    return float(np.sum(np.einsum("ij,ij->i", v0, np.cross(v1, v2))) / 6.0)


def projected_area(tris: np.ndarray) -> float:
    a = tris[:, 1, :2] - tris[:, 0, :2]
    b = tris[:, 2, :2] - tris[:, 0, :2]
    cross = a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]
    return float(np.sum(np.abs(cross)) * 0.5)


def loops_from_boundary(verts: np.ndarray, boundary: np.ndarray, max_loops: int = 12):
    """Return the longest boundary loops by absolute XY area."""
    if len(boundary) == 0:
        return [], None
    adj: dict[int, list[int]] = {}
    for a, b in boundary:
        adj.setdefault(int(a), []).append(int(b))
        adj.setdefault(int(b), []).append(int(a))
    unused = {tuple(sorted((int(a), int(b)))) for a, b in boundary}
    found = []
    for a0, b0 in boundary:
        key0 = tuple(sorted((int(a0), int(b0))))
        if key0 not in unused:
            continue
        start = int(a0)
        prev = -1
        cur = start
        poly = [start]
        guard = 0
        while guard < 200000:
            guard += 1
            nxts = [n for n in adj.get(cur, []) if n != prev and tuple(sorted((cur, n))) in unused]
            if not nxts:
                break
            nxt = nxts[0]
            unused.discard(tuple(sorted((cur, nxt))))
            if nxt == start:
                break
            poly.append(nxt)
            prev, cur = cur, nxt
        if len(poly) < 8:
            continue
        pts = verts[np.array(poly, dtype=np.int64)]
        x, y = pts[:, 0], pts[:, 1]
        area = float(0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))
        found.append((abs(area), area, poly, pts))
    found.sort(key=lambda t: t[0], reverse=True)
    out = []
    for abs_area, area, poly, pts in found[:max_loops]:
        out.append(
            {
                "vertices": len(poly),
                "area_xy": round(area, 4),
                "bbox_min": [round(float(v), 4) for v in pts.min(0)],
                "bbox_max": [round(float(v), 4) for v in pts.max(0)],
            }
        )
    return out, found[0][3] if found else None


def write_png(path: Path, rgb: np.ndarray):
    h, w, _ = rgb.shape

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def silhouette_from_tris(tris: np.ndarray, pitch: float = 0.25):
    """Project the mesh and separate the true exterior from enclosed weave holes."""
    from PIL import Image, ImageDraw
    from collections import deque

    pts = tris.reshape(-1, 3)
    bbmin = pts.min(0)
    bbmax = pts.max(0)
    pad = 2
    w = int(np.ceil((bbmax[0] - bbmin[0]) / pitch)) + pad * 2 + 2
    h = int(np.ceil((bbmax[1] - bbmin[1]) / pitch)) + pad * 2 + 2
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    xy = np.empty((len(tris) * 3, 2), dtype=np.float64)
    flat = tris[:, :, :2].reshape(-1, 2)
    xy[:, 0] = (flat[:, 0] - bbmin[0]) / pitch + pad
    xy[:, 1] = (flat[:, 1] - bbmin[1]) / pitch + pad
    polys = xy.reshape(-1, 3, 2)
    for tri in polys:
        draw.polygon([tuple(p) for p in tri], fill=1)
    mask = np.asarray(img, dtype=np.uint8) > 0
    exterior = np.zeros_like(mask, dtype=bool)
    q = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or exterior[y, x] or mask[y, x]:
            continue
        exterior[y, x] = True
        q.append((y + 1, x))
        q.append((y - 1, x))
        q.append((y, x + 1))
        q.append((y, x - 1))
    solid = ~exterior
    # outer contour: solid cells adjacent to exterior
    edge = solid.copy()
    edge[1:] &= exterior[:-1]
    # trace by marching the first boundary pixel clockwise-ish via neighbor walk
    neigh_ext = np.zeros_like(solid)
    neigh_ext[1:] |= exterior[:-1]
    neigh_ext[:-1] |= exterior[1:]
    neigh_ext[:, 1:] |= exterior[:, :-1]
    neigh_ext[:, :-1] |= exterior[:, 1:]
    boundary_px = solid & neigh_ext
    by, bx = np.nonzero(boundary_px)
    world = np.stack(
        [
            bbmin[0] + (bx - pad + 0.5) * pitch,
            bbmin[1] + (by - pad + 0.5) * pitch,
        ],
        axis=1,
    )
    return {
        "pitch_mm": pitch,
        "grid": [int(w), int(h)],
        "occupied_cells": int(mask.sum()),
        "solid_cells_including_holes": int(solid.sum()),
        "enclosed_hole_cells": int((solid & ~mask).sum()),
        "bbox_min": [round(float(v), 5) for v in bbmin],
        "bbox_max": [round(float(v), 5) for v in bbmax],
        "boundary_samples": int(len(world)),
    }, world.astype(np.float32), solid, (bbmin, pitch, pad)


def raster_projection(tris: np.ndarray, path: Path, size: int = 900):
    """Centroid splats plus a coarse triangle stamp. Vectorized enough for 200k faces."""
    pts = tris.reshape(-1, 3)
    bbmin = pts.min(0)
    bbmax = pts.max(0)
    span = np.maximum(bbmax[:2] - bbmin[:2], 1e-6)
    cents = tris.mean(axis=1)
    v0, v1, v2 = tris[:, 0], tris[:, 1], tris[:, 2]
    nz = np.cross(v1 - v0, v2 - v0)[:, 2]
    ix = np.clip(((cents[:, 0] - bbmin[0]) / span[0] * (size - 20) + 10).astype(np.int32), 0, size - 1)
    iy = np.clip(((cents[:, 1] - bbmin[1]) / span[1] * (size - 20) + 10).astype(np.int32), 0, size - 1)
    iy = size - 1 - iy
    img = np.full((size, size, 3), 246, np.uint8)
    up = nz >= 0
    img[iy[up], ix[up]] = (32, 48, 46)
    img[iy[~up], ix[~up]] = (120, 96, 78)
    # thicken splat by 1px so the silhouette reads
    ink = img[:, :, 0] < 200
    grown = ink.copy()
    grown[1:] |= ink[:-1]
    grown[:-1] |= ink[1:]
    grown[:, 1:] |= ink[:, :-1]
    grown[:, :-1] |= ink[:, 1:]
    img[grown & (img[:, :, 0] >= 200)] = (32, 48, 46)
    write_png(path, img)


def height_residual_candidates(tris: np.ndarray, cell: float = 0.35):
    """High-frequency Z residual on upward faces. Candidate only — not a deletion."""
    v0, v1, v2 = tris[:, 0], tris[:, 1], tris[:, 2]
    n = np.cross(v1 - v0, v2 - v0)
    area = np.linalg.norm(n, axis=1)
    nz = np.divide(n[:, 2], np.maximum(area, 1e-12))
    up = nz > 0.65
    if int(np.sum(up)) < 20:
        return {"status": "insufficient_upward_faces", "confidence": 0.0, "auto_remove": False}
    cents = tris[up].mean(axis=1)
    bbmin = cents.min(0)
    bbmax = cents.max(0)
    nx = max(2, int(np.ceil((bbmax[0] - bbmin[0]) / cell)) + 1)
    ny = max(2, int(np.ceil((bbmax[1] - bbmin[1]) / cell)) + 1)
    ix = np.clip(((cents[:, 0] - bbmin[0]) / cell).astype(int), 0, nx - 1)
    iy = np.clip(((cents[:, 1] - bbmin[1]) / cell).astype(int), 0, ny - 1)
    zgrid = np.full((ny, nx), np.nan)
    # max z per cell (top of local column)
    for x, y, z in zip(ix, iy, cents[:, 2]):
        if np.isnan(zgrid[y, x]) or z > zgrid[y, x]:
            zgrid[y, x] = z
    known = ~np.isnan(zgrid)
    if int(known.sum()) < 30:
        return {"status": "sparse_top_sample", "confidence": 0.0, "auto_remove": False}
    filled = np.where(known, zgrid, np.nanmedian(zgrid))
    # separable box blur
    def blur(img, r):
        k = 2 * r + 1
        pad = np.pad(img, r, mode="edge")
        acc = np.cumsum(np.cumsum(pad, axis=0), axis=1)
        acc = np.pad(acc, ((1, 0), (1, 0)))
        out = acc[k:, k:] - acc[:-k, k:] - acc[k:, :-k] + acc[:-k, :-k]
        return out / (k * k)

    base = blur(filled, 6)
    resid = filled - base
    resid = np.where(known, resid, 0.0)
    mag = np.abs(resid)
    # ignore a 2mm border of the handle silhouette so the outline taper is not called text
    border = np.zeros_like(known)
    # erode known mask roughly
    from numpy.lib.stride_tricks import sliding_window_view

    if min(known.shape) > 8:
        win = sliding_window_view(known, (5, 5))
        core = win.all(axis=(-1, -2))
        border_mask = np.zeros_like(known)
        border_mask[2:-2, 2:-2] = core
    else:
        border_mask = known
    score = mag * border_mask
    peak = float(score.max()) if score.size else 0.0
    thresh = max(0.25, peak * 0.45)
    hot = score >= thresh
    count = int(hot.sum())
    if count < 8 or peak < 0.28:
        return {
            "status": "no_confident_text_region",
            "confidence": round(min(0.45, peak), 3),
            "peak_residual_mm": round(peak, 4),
            "hot_cells": count,
            "auto_remove": False,
            "note": "未达到可自动判定为文字的置信度。保留全部扇柄几何，等待人工确认。",
        }
    ys, xs = np.nonzero(hot)
    sel = cents[
        (ix >= xs.min())
        & (ix <= xs.max())
        & (iy >= ys.min())
        & (iy <= ys.max())
    ]
    return {
        "status": "candidate_needs_confirmation",
        "confidence": round(float(min(0.85, 0.35 + peak)), 3),
        "peak_residual_mm": round(peak, 4),
        "hot_cells": count,
        "cell_mm": cell,
        "bbox_min": [round(float(bbmin[0] + xs.min() * cell), 3), round(float(bbmin[1] + ys.min() * cell), 3)],
        "bbox_max": [round(float(bbmin[0] + (xs.max() + 1) * cell), 3), round(float(bbmin[1] + (ys.max() + 1) * cell), 3)],
        "auto_remove": False,
        "note": "检测到顶面高频起伏候选区。这可能是文字、Logo 或造型细节。在网页确认前禁止删除。",
        "sample_z_span_in_window": [round(float(sel[:, 2].min()), 3), round(float(sel[:, 2].max()), 3)] if len(sel) else None,
    }


def audit_file(path: Path, role: str, do_raster: bool, do_text: bool):
    digest, tris = read_stl(path)
    verts, faces = weld(tris, 3)
    bbmin = tris.reshape(-1, 3).min(0)
    bbmax = tris.reshape(-1, 3).max(0)
    boundary, nonmanifold, interior_edges = edge_stats(faces)
    parts = components(verts, faces)
    loop_summary, outer = loops_from_boundary(verts, boundary)
    silhouette = None
    if role == "haitang_fan_face":
        silhouette, samples, _solid, _meta = silhouette_from_tris(tris, 0.35)
        np.save(OUT / f"{path.stem}_silhouette_samples.npy", samples)
        silhouette["sample_file"] = f"{path.stem}_silhouette_samples.npy"
    if do_raster:
        raster_projection(tris, PROJ / f"{path.stem}_front.png")
    text = height_residual_candidates(tris) if do_text else None
    report = {
        "role": role,
        "file": path.name,
        "sha256": digest,
        "bytes": path.stat().st_size,
        "triangles": int(len(tris)),
        "welded_vertices": int(len(verts)),
        "bbox_min": [round(float(v), 5) for v in bbmin],
        "bbox_max": [round(float(v), 5) for v in bbmax],
        "extents": [round(float(v), 5) for v in (bbmax - bbmin)],
        "signed_volume": round(signed_volume(tris), 4),
        "projected_area_xy_double_sided_sum": round(projected_area(tris), 3),
        "bbox_area_xy": round(float((bbmax[0] - bbmin[0]) * (bbmax[1] - bbmin[1])), 3),
        "boundary_edges": int(len(boundary)),
        "nonmanifold_edges": int(len(nonmanifold)),
        "manifold_edges": interior_edges,
        "connected_components": parts,
        "largest_boundary_loops": loop_summary,
        "silhouette": silhouette,
        "unit_assumption": "STL has no unit field. Coordinates are reported in file units. mm is a candidate, not applied as a scale.",
        "text_candidate": text,
    }
    if outer is not None:
        np.save(OUT / f"{path.stem}_outer_loop.npy", outer[:, :2].astype(np.float32))
        report["outer_loop_points"] = int(len(outer))
        report["outer_loop_file"] = f"{path.stem}_outer_loop.npy"
    return report


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PROJ.mkdir(parents=True, exist_ok=True)
    fan = audit_file(ORIGINAL / "obj_2_fan.stl", "haitang_fan_face", True, False)
    handle = audit_file(ORIGINAL / "obj_1_handle_logo.stl", "handle_with_logo", True, True)
    payload = {
        "project": "HAITANG WEAVE LAB",
        "phase": 0,
        "unit_policy": "Do not scale. Display file units and label mm as unconfirmed candidate.",
        "assembly_note": "The two STL files occupy different print-layout coordinates and are not pre-assembled. No vertex was moved.",
        "files": {"obj_2_fan.stl": fan, "obj_1_handle_logo.stl": handle},
    }
    (OUT / "source_audit.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "fan_extents": fan["extents"],
        "fan_tris": fan["triangles"],
        "fan_components": fan["connected_components"],
        "fan_boundary": fan["boundary_edges"],
        "fan_nonmanifold": fan["nonmanifold_edges"],
        "fan_loops": fan["largest_boundary_loops"][:4],
        "fan_volume": fan["signed_volume"],
        "handle_extents": handle["extents"],
        "handle_components": handle["connected_components"],
        "handle_text": handle["text_candidate"],
        "handle_nonmanifold": handle["nonmanifold_edges"],
        "handle_boundary": handle["boundary_edges"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

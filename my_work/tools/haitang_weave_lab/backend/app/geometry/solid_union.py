"""Closed fan body plus weave ribbons, fused into one printable solid."""
from __future__ import annotations

import numpy as np

from app.geometry.weave_ribbons import _close_mask

SLIVER_MM3 = 0.5


def unite_printable(master: dict, factor: float, params: dict, ribbons: list):
    """Return positions, indices, colors when the frame and strips are one closed solid."""
    try:
        return _unite(master, factor, params, ribbons)
    except Exception:
        return None


def _unite(master: dict, factor: float, params: dict, ribbons: list):
    import manifold3d as mf

    body = _fan_body(master, factor, params)
    if body is None or body.status() != mf.Error.NoError or body.volume() <= 1.0:
        return None
    thick = float(np.clip(params.get("ribbon_thickness", 1.2) or 1.2, 0.6, 2.2))
    depth = float(np.clip(params.get("rim_depth", 7) or 7, 1.0, 12.0))
    thick = min(thick, max(depth - 0.4, 0.6))
    parts = [body]
    samples = []
    for item in ribbons or []:
        line, width, color = item[0], item[1], item[2]
        lift = item[3] if len(item) > 3 else 0.0
        solid, sampled = _ribbon_solid(line, float(width), thick, np.asarray(color, np.uint8), lift)
        if solid is not None:
            parts.append(solid)
            samples.extend(sampled)
    fused = parts[0] if len(parts) == 1 else mf.Manifold.batch_boolean(parts, mf.OpType.Add)
    if fused.status() != mf.Error.NoError or fused.volume() <= body.volume() + 1.0:
        return None
    split = sorted(fused.decompose(), key=lambda part: part.volume(), reverse=True)
    # The union can leave zero-volume slivers where ribbon faces graze; they are not
    # strips that could fall off, so drop them from the mesh instead of counting them.
    kept = [part for part in split if part.volume() >= SLIVER_MM3]
    if len(kept) < len(split):
        split = kept
        fused = split[0] if len(split) == 1 else mf.Manifold.compose(split)
    loose = []
    for part in split[1:40]:
        verts = np.asarray(part.to_mesh().vert_properties[:, :2], np.float32)
        loose.append({"kind": "loose", "x": round(float(verts[:, 0].mean()), 2), "y": round(float(verts[:, 1].mean()), 2)})
    mesh = fused.to_mesh()
    positions = np.asarray(mesh.vert_properties[:, :3], np.float32)
    indices = np.asarray(mesh.tri_verts, np.uint32)
    colors = _paint(positions, samples)
    return positions, indices, colors, len(split), loose


def _as_solid(positions: np.ndarray, indices: np.ndarray):
    import manifold3d as mf

    verts = np.asarray(positions, np.float32)
    faces = np.asarray(indices, np.uint32)
    if len(verts) < 8 or len(faces) < 4:
        return None
    for candidate in (faces, faces[:, ::-1]):
        solid = mf.Manifold(mf.Mesh(vert_properties=verts, tri_verts=np.ascontiguousarray(candidate)))
        if solid.status() == mf.Error.NoError and solid.volume() > 0.2:
            return solid
    return None


def _components(positions: np.ndarray, indices: np.ndarray, colors: np.ndarray):
    parent = np.arange(len(positions), dtype=np.int32)

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = int(parent[node])
        return node

    for tri in indices:
        root = find(int(tri[0]))
        for vertex in tri[1:]:
            other = find(int(vertex))
            if root != other:
                parent[other] = root
    groups: dict[int, list[int]] = {}
    for vertex in range(len(positions)):
        groups.setdefault(find(vertex), []).append(vertex)
    for members in groups.values():
        if len(members) < 8:
            continue
        remap = -np.ones(len(positions), np.int32)
        remap[np.asarray(members, np.int32)] = np.arange(len(members), dtype=np.int32)
        local = remap[indices]
        keep = np.all(local >= 0, axis=1)
        if int(keep.sum()) < 4:
            continue
        yield positions[np.asarray(members)], local[keep].astype(np.uint32), colors[np.asarray(members)]


def _ribbon_solid(line: np.ndarray, width: float, thick: float, color: np.ndarray, lift: float = 0.0):
    """Overlap flat boxes along the centerline. Each box is a closed solid."""
    import manifold3d as mf

    pts = np.asarray(line, np.float32)
    if len(pts) < 2:
        return None, None
    boxes = []
    samples = []
    width = float(np.clip(width, 0.8, 4.2))
    # Boxes cut to the exact segment length only touch face to face, and leave a
    # wedge at every bend; the union then splits the strip. Overlap them.
    overlap = float(np.clip(width * 0.6, 0.6, 1.6))
    lifts = np.asarray(lift, np.float32).reshape(-1) if np.ndim(lift) else None
    for index, (start, end) in enumerate(zip(pts[:-1], pts[1:])):
        delta = end[:2] - start[:2]
        length = float(np.hypot(delta[0], delta[1]))
        if length < 0.25:
            continue
        if lifts is not None and len(lifts) == len(pts):
            height_shift = float((lifts[index] + lifts[min(index + 1, len(lifts) - 1)]) * 0.5)
        else:
            height_shift = float(lift) if lifts is None else 0.0
        box = mf.Manifold.cube((length + overlap, width, thick), True)
        angle = float(np.degrees(np.arctan2(float(delta[1]), float(delta[0]))))
        box = box.rotate((0.0, 0.0, angle))
        mid = (start + end) * 0.5
        boxes.append(box.translate((float(mid[0]), float(mid[1]), height_shift)))
        normal = np.array([-delta[1], delta[0]], np.float32) / max(length, 1e-4)
        for side in np.linspace(-width * 0.5, width * 0.5, 4):
            for height in (-thick * 0.5, 0.0, thick * 0.5):
                samples.append((np.array([
                    mid[0] + normal[0] * side,
                    mid[1] + normal[1] * side,
                    height + height_shift,
                ], np.float32), color))
    if not boxes:
        return None, None
    solid = boxes[0] if len(boxes) == 1 else mf.Manifold.batch_boolean(boxes, mf.OpType.Add)
    if solid.status() != mf.Error.NoError or solid.volume() <= 0.2:
        return None, None
    return solid, samples


def _paint(positions: np.ndarray, samples: list) -> np.ndarray:
    colors = np.empty((len(positions), 3), np.uint8)
    colors[:] = (186, 186, 190)
    if not samples:
        return colors
    pitch = 0.8
    lookup: dict[tuple[int, int, int], np.ndarray] = {}
    for point, color in samples:
        for corner in (
            point,
            point + np.array([0.0, 0.4, 0.0], np.float32),
            point + np.array([0.4, 0.0, 0.0], np.float32),
            point + np.array([0.0, 0.0, 0.3], np.float32),
        ):
            key = tuple(int(v) for v in np.round(corner / pitch))
            lookup[key] = color
    rounded = np.round(positions / pitch).astype(np.int32)
    for index, key in enumerate(rounded):
        color = lookup.get((int(key[0]), int(key[1]), int(key[2])))
        if color is not None:
            colors[index] = color
    return colors


def _fan_body(master: dict, factor: float, params: dict):
    import manifold3d as mf

    from app.geometry.master_lock import _dilate, _erode

    opening = _close_mask(master["inner"], 5) & ~_dilate(master["guard"], 1)
    pitch_mm = float(master["pitch"] * master["scale"] * factor)
    delta = float(np.clip(params.get("rim_width", 5.8) or 5.8, 1.0, 12.0)) - 3.6
    steps = int(round(abs(delta) / max(pitch_mm, 0.05)))
    if steps > 0 and delta > 0:
        opening = _erode(opening, steps) & ~_dilate(master["guard"], 1)
    elif steps > 0:
        opening = _dilate(opening, steps) & master["solid"] & ~_dilate(master["guard"], 1)
    outer = _loop_mm(master["solid"], master, factor, 0.28)
    hole = _loop_mm(opening, master, factor, 0.28)
    outer = _constrain_smooth(outer, 0.32)
    hole = _constrain_smooth(hole, 0.32)
    if len(outer) < 24 or len(hole) < 24:
        return None
    depth = float(np.clip(params.get("rim_depth", 7) or 7, 1.0, 12.0))
    body = mf.Manifold.extrude(mf.CrossSection([outer.tolist(), hole.tolist()], mf.FillRule.EvenOdd), depth)
    body = body.translate((0.0, 0.0, -depth * 0.5))
    if body.status() != mf.Error.NoError or body.volume() <= 1.0:
        return None
    return body


def _loop_mm(mask: np.ndarray, master: dict, factor: float, step: float) -> np.ndarray:
    loop = _longest_edge_loop(mask)
    if len(loop) < 12:
        return np.zeros((0, 2), np.float32)
    pitch = float(master["pitch"] * master["scale"] * factor)
    x0 = float(master["x0"] * master["scale"] * factor)
    y0 = float(master["z0"] * master["scale"] * factor)
    points = np.column_stack([
        x0 + loop[:, 0].astype(np.float32) * pitch,
        y0 + loop[:, 1].astype(np.float32) * pitch,
    ])
    return _resample_closed(points, step)


def _constrain_smooth(line: np.ndarray, limit: float) -> np.ndarray:
    """Round only the pixel stair. Each point stays within `limit` mm of the master outline."""
    if len(line) < 8:
        return line
    origin = np.asarray(line, np.float32)
    out = origin.copy()
    for _ in range(3):
        prev = np.roll(out, 1, axis=0)
        nxt = np.roll(out, -1, axis=0)
        target = out + np.float32(0.34) * (0.5 * (prev + nxt) - out)
        delta = target - origin
        dist = np.linalg.norm(delta, axis=1, keepdims=True)
        scale = np.minimum(1.0, np.float32(limit) / np.maximum(dist, np.float32(1e-6)))
        out = origin + delta * scale.astype(np.float32)
    return out


def _resample_closed(line: np.ndarray, step: float) -> np.ndarray:
    closed = np.vstack([line, line[:1]])
    delta = np.linalg.norm(np.diff(closed, axis=0), axis=1)
    total = float(delta.sum()) or 1.0
    count = max(48, int(total / max(step, 0.2)))
    dist = np.concatenate([[0.0], np.cumsum(delta)])
    target = np.linspace(0.0, total, count, endpoint=False)
    out = np.empty((count, 2), np.float32)
    out[:, 0] = np.interp(target, dist, closed[:, 0])
    out[:, 1] = np.interp(target, dist, closed[:, 1])
    return out


def _longest_edge_loop(mask: np.ndarray) -> np.ndarray:
    """Ordered pixel-corner loop around the largest foreground boundary."""
    height, width = mask.shape
    outgoing: dict[tuple[int, int], list[tuple[int, int]]] = {}

    def add(start: tuple[int, int], end: tuple[int, int]) -> None:
        outgoing.setdefault(start, []).append(end)

    ys, xs = np.nonzero(mask)
    for row, col in zip(ys.tolist(), xs.tolist()):
        if row == 0 or not mask[row - 1, col]:
            add((col, row), (col + 1, row))
        if col == width - 1 or not mask[row, col + 1]:
            add((col + 1, row), (col + 1, row + 1))
        if row == height - 1 or not mask[row + 1, col]:
            add((col + 1, row + 1), (col, row + 1))
        if col == 0 or not mask[row, col - 1]:
            add((col, row + 1), (col, row))
    best: list[tuple[int, int]] = []
    seen: set[tuple[tuple[int, int], tuple[int, int]]] = set()
    for start, ends in outgoing.items():
        for end in ends:
            token = (start, end)
            if token in seen:
                continue
            path = [start]
            cursor, nxt = start, end
            guard = 0
            while guard < 200000:
                guard += 1
                seen.add((cursor, nxt))
                path.append(nxt)
                options = [item for item in outgoing.get(nxt, []) if (nxt, item) not in seen]
                if not options:
                    break
                cursor, nxt = nxt, options[0]
                if nxt == path[0]:
                    path.append(nxt)
                    break
            if len(path) > len(best):
                best = path
    if len(best) < 12:
        return np.zeros((0, 2), np.float32)
    return np.asarray(best, np.float32)

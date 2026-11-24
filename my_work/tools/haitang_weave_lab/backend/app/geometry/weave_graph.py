"""One weave graph for the plan, the preview and the export.

Paths are continuous centerlines: closed rings, boundary-to-boundary
spans, or edges that meet other edges at a node. Auxiliary patterns
change this field. They do not add a second independent mesh.
"""
from __future__ import annotations

import numpy as np

from app.geometry.weave_ribbons import (
    _bounds,
    _chaikin,
    _closed,
    _extend_end,
    _inside,
    _length,
    _mask_at,
    _resample,
    _tone,
)

_FACE: dict[tuple, tuple[float, float, float]] = {}


def face_center(master: dict, factor: float) -> tuple[float, float, float]:
    """Point inside the opening with the largest clear radius, plus that radius."""
    key = (id(master.get("inner")), round(float(factor), 5))
    cached = _FACE.get(key)
    if cached is not None:
        return cached
    x0, x1, y0, y1, _focus = _bounds(master, factor)
    xs = np.linspace(x0 + 4, x1 - 4, 18)
    ys = np.linspace(y0 + 4, y1 - 4, 22)
    grid_x, grid_y = np.meshgrid(xs, ys)
    inside = _inside(master, factor, grid_x.ravel(), grid_y.ravel())
    best = ((x0 + x1) * 0.5, (y0 + y1) * 0.5, 8.0)
    best_r = 0.0
    angles = np.linspace(0, 2 * np.pi, 10, endpoint=False)
    cos_a, sin_a = np.cos(angles), np.sin(angles)
    for x, y, ok in zip(grid_x.ravel(), grid_y.ravel(), inside):
        if not ok:
            continue
        radius = 0.0
        for _ in range(16):
            trial = radius + 3.0
            if not _inside(master, factor, x + cos_a * trial, y + sin_a * trial).all():
                break
            radius = trial
        if radius > best_r:
            best_r = radius
            best = (float(x), float(y), float(radius))
    _FACE[key] = best
    return best


def apply_modulators(tuned: dict, modulators: list[dict]) -> dict:
    """Auxiliary patterns bend the main field. Weights stay below the main pattern."""
    tuned = dict(tuned)
    scales = (0.22, 0.12, 0.08)
    for mod, scale in zip(modulators[:3], scales):
        algo = str(mod.get("_algo", mod.get("algorithm", "")))
        if "ripple" in algo:
            tuned["amplitude"] = float(tuned.get("amplitude", 4.0)) + 2.4 * scale / 0.22
            tuned["frequency"] = float(tuned.get("frequency", 1.0)) * (1.0 + 0.18 * scale / 0.22)
        elif "diamond" in algo:
            tuned["weave_angle"] = float(tuned.get("weave_angle", 0.0)) + 16.0 * scale / 0.22
            tuned["rotation_strength"] = float(tuned.get("rotation_strength", 0.15)) + 0.45 * scale / 0.22
        elif "radial" in algo:
            tuned["weave_angle"] = float(tuned.get("weave_angle", 0.0)) + 10.0 * scale / 0.22
        elif "cellular" in algo:
            tuned["randomness"] = min(2.0, float(tuned.get("randomness", 0.0)) + 0.16 * scale / 0.22)
    if modulators:
        keep = max(0.58, 1.0 - 0.12 * len(modulators[:3]))
        tuned["density_u"] = float(tuned["density_u"]) * keep
        tuned["density_v"] = float(tuned["density_v"]) * keep
    return tuned


def _near_boundary(master: dict, factor: float, point: np.ndarray) -> bool:
    angles = np.linspace(0, 2 * np.pi, 8, endpoint=False)
    x = point[0] + np.cos(angles) * 2.4
    y = point[1] + np.sin(angles) * 2.4
    return not bool(_inside(master, factor, x, y).all())


def finish_batch(master: dict, factor: float, lines: list[np.ndarray], width: float, step: float) -> tuple[list[tuple[int, np.ndarray]], dict]:
    """Keep closed rings, boundary spans, and edges that meet at a node."""
    prepared: list[tuple[int, np.ndarray]] = []
    for source, line in enumerate(lines):
        current = np.asarray(line, np.float32)
        closed = _closed(current)
        if not closed:
            current = _chaikin(current, 1)
        current = _resample(current, 0.32 if closed else step)
        shortest = 6.0 if _closed(current) else 8.0
        if len(current) >= 2 and _length(current) >= shortest:
            prepared.append((source, current))
    minimum = max(4.0 * float(width), 14.0)
    dropped_short = 0
    dropped_free = 0
    ends: list[tuple[int, int, np.ndarray]] = []
    for index, (_source, line) in enumerate(prepared):
        if _closed(line):
            continue
        ends.append((index, 0, line[0]))
        ends.append((index, 1, line[-1]))

    def neighbors(index: int, point: np.ndarray) -> int:
        count = 0
        for other, _side, other_point in ends:
            if other == index:
                continue
            if float(np.hypot(*(other_point - point))) <= 1.8:
                count += 1
        return count

    kept: list[tuple[int, np.ndarray]] = []
    for index, (source, line) in enumerate(prepared):
        if _closed(line):
            if _length(line) >= 6.0:
                kept.append((source, line))
            else:
                dropped_short += 1
            continue
        start_node = neighbors(index, line[0]) > 0 and not _near_boundary(master, factor, line[0])
        end_node = neighbors(index, line[-1]) > 0 and not _near_boundary(master, factor, line[-1])
        current = line
        start_ok = start_node or not _mask_at(master, "inner", factor, current[0])
        end_ok = end_node or not _mask_at(master, "inner", factor, current[-1])
        if not start_ok:
            current, start_ok = _extend_end(current, True, master, factor)
        if not end_ok:
            current, end_ok = _extend_end(current, False, master, factor)
        if not (start_ok and end_ok):
            dropped_free += 1
            continue
        if _length(current) < minimum:
            dropped_short += 1
            continue
        kept.append((source, _resample(current, step)))
    _pull_boundary_nodes(master, factor, kept)
    extra_free, extra_short = _rescue_orphans(master, factor, kept, step)
    return kept, {"removed_short": dropped_short + extra_short, "removed_unanchored": dropped_free + extra_free}


def _rescue_orphans(master: dict, factor: float, kept: list[tuple[int, np.ndarray]], step: float) -> tuple[int, int]:
    """Extend or delete ends that lost their node when a neighbour was dropped."""
    removed_free = 0
    removed_short = 0
    for _ in range(80):
        ends: list[tuple[int, int, np.ndarray]] = []
        for index, (_source, line) in enumerate(kept):
            if _closed(line):
                continue
            ends.append((index, 0, line[0]))
            ends.append((index, 1, line[-1]))
        target = None
        for slot, (index, side, point) in enumerate(ends):
            if not _mask_at(master, "inner", factor, point):
                continue
            linked = 0
            for other, (_path, _side, other_point) in enumerate(ends):
                if other == slot:
                    continue
                if float(np.hypot(*(other_point - point))) <= 1.8:
                    linked += 1
            if linked == 0:
                target = (index, side)
                break
        if target is None:
            break
        index, side = target
        source, line = kept[index]
        current, ok = _extend_end(line, side == 0, master, factor)
        end = current[0] if side == 0 else current[-1]
        if (not ok) or _mask_at(master, "inner", factor, end) or _length(current) < 14.0:
            kept.pop(index)
            removed_free += 1
            continue
        kept[index] = (source, _resample(current, step))
    for _ in range(40):
        drop = [index for index, (_source, line) in enumerate(kept) if not _closed(line) and _length(line) < 14.0]
        for index in sorted(set(drop), reverse=True):
            kept.pop(index)
            removed_short += 1
        drop = []
        ends = []
        for index, (_source, line) in enumerate(kept):
            if _closed(line):
                continue
            ends.append((index, line[0]))
            ends.append((index, line[-1]))
        for slot, (index, point) in enumerate(ends):
            if not _mask_at(master, "inner", factor, point):
                continue
            linked = 0
            for other, (_path, other_point) in enumerate(ends):
                if other == slot:
                    continue
                if float(np.hypot(*(other_point - point))) <= 1.8:
                    linked += 1
            if linked == 0:
                drop.append(index)
        if not drop:
            break
        for index in sorted(set(drop), reverse=True):
            kept.pop(index)
            removed_free += 1
    return removed_free, removed_short


def _pull_boundary_nodes(master: dict, factor: float, kept: list[tuple[int, np.ndarray]]) -> None:
    """Move nodes that sit on the opening edge into the frame, together."""
    ends: list[tuple[int, int, np.ndarray]] = []
    for index, (_source, line) in enumerate(kept):
        if _closed(line):
            continue
        ends.append((index, 0, line[0]))
        ends.append((index, -1, line[-1]))
    used: set[int] = set()
    for index, item in enumerate(ends):
        if index in used:
            continue
        cluster = [index]
        used.add(index)
        for other in range(index + 1, len(ends)):
            if other in used:
                continue
            if float(np.hypot(*(ends[other][2] - item[2]))) <= 1.8:
                cluster.append(other)
                used.add(other)
        point = np.asarray(item[2], np.float32)
        if not _mask_at(master, "inner", factor, point):
            continue
        if not _near_boundary(master, factor, point):
            continue
        path_index = item[0]
        line = kept[path_index][1]
        mid = line[len(line) // 2]
        direction = point - mid
        norm = float(np.linalg.norm(direction))
        if norm < 1e-4:
            continue
        direction = direction / norm
        cursor = point.copy()
        landed = None
        for _ in range(18):
            cursor = cursor + direction * 0.6
            if not _mask_at(master, "solid", factor, cursor):
                break
            if not _mask_at(master, "inner", factor, cursor):
                landed = cursor.copy()
                break
        if landed is None:
            continue
        delta = landed - point
        for member in cluster:
            path_i, side, _point = ends[member]
            source, path = kept[path_i]
            path = path.copy()
            path[side] = path[side] + delta
            kept[path_i] = (source, path)


def audit_paths(master: dict, factor: float, lines: list[np.ndarray]) -> dict:
    """Count free ends on the paths that will actually be meshed."""
    visible = 0
    unanchored = 0
    short = 0
    degree_one = 0
    ends: list[np.ndarray] = []
    open_ends: list[tuple[int, np.ndarray]] = []
    points: list[dict] = []
    for index, line in enumerate(lines):
        if _length(line) < 14.0 and not _closed(line):
            short += 1
            _mark(points, "short", line[len(line) // 2])
        if _closed(line):
            continue
        ends.append(line[0])
        ends.append(line[-1])
        open_ends.append((index, line[0]))
        open_ends.append((index, line[-1]))
    for slot, (_index, point) in enumerate(open_ends):
        inner = _mask_at(master, "inner", factor, point)
        solid = _mask_at(master, "solid", factor, point)
        linked = 0
        for other, other_point in enumerate(ends):
            if other == slot:
                continue
            if float(np.hypot(*(other_point - point))) <= 1.8:
                linked += 1
        boundary = _near_boundary(master, factor, point)
        if inner and linked == 0:
            visible += 1
            degree_one += 1
            _mark(points, "free_end", point)
        if not solid:
            unanchored += 1
            _mark(points, "unanchored", point)
    interior, insufficient, discontinuity = _strict_breaks(master, factor, lines, points)
    legacy = lines and visible == 0 and unanchored == 0 and short == 0 and degree_one == 0
    coverage = 1.0 if legacy else 0.0
    return {
        "visible_endpoint_count": visible,
        "unanchored_strip_count": unanchored,
        "short_fragment_count": short,
        "interior_degree_one_node_count": degree_one,
        "interior_endpoint_count": interior,
        "insufficient_embed_count": insufficient,
        "path_discontinuity_count": discontinuity,
        "floating_component_count": unanchored,
        "continuous_path_coverage": coverage,
        "problem_points": points,
    }


def _mark(points: list[dict], kind: str, point: np.ndarray) -> None:
    """Where a problem is, in model millimetres; one mark per spot so the plan stays readable."""
    x, y = round(float(point[0]), 2), round(float(point[1]), 2)
    if len(points) >= 240 or any(abs(p["x"] - x) < 1.5 and abs(p["y"] - y) < 1.5 for p in points):
        return
    points.append({"kind": kind, "x": x, "y": y})


def _strict_breaks(master: dict, factor: float, lines: list[np.ndarray], points: list[dict] | None = None) -> tuple[int, int, int]:
    """Interior ends, short embeds, and gaps. These are what the status line must trust."""
    from app.geometry.master_lock import _sample_mask
    from app.geometry.weave_ribbons import _close_mask

    if not lines:
        return 0, 0, 0
    opening = _close_mask(master["inner"], 5) & ~master["guard"]
    interior = 0
    insufficient = 0
    discontinuity = 0
    for line in lines:
        if len(line) < 2 or _closed(line):
            continue
        step = np.linalg.norm(np.diff(line, axis=0), axis=1)
        if len(step) and float(step.max()) > 8.0:
            discontinuity += 1
            if points is not None:
                gap = int(np.argmax(step))
                _mark(points, "gap", (line[gap] + line[gap + 1]) / 2)
        for end, nxt in ((line[0], line[min(3, len(line) - 1)]), (line[-1], line[max(0, len(line) - 4)])):
            inside = bool(_sample_mask(opening, master, np.array([end[0]]), np.array([end[1]]), factor)[0])
            if inside and _deep(opening, master, factor, end):
                interior += 1
                if points is not None:
                    _mark(points, "free_end", end)
                continue
            embed = _embed_length(line, opening, master, factor, end, nxt)
            if embed < 1.2:
                insufficient += 1
                if points is not None:
                    _mark(points, "shallow", end)
    return interior, insufficient, discontinuity


def _deep(opening: np.ndarray, master: dict, factor: float, point: np.ndarray) -> bool:
    from app.geometry.master_lock import _sample_mask

    angles = np.linspace(0, 2 * np.pi, 8, endpoint=False)
    samples = np.column_stack([point[0] + np.cos(angles) * 2.4, point[1] + np.sin(angles) * 2.4])
    return bool(_sample_mask(opening, master, samples[:, 0], samples[:, 1], factor).all())


def _embed_length(line: np.ndarray, opening: np.ndarray, master: dict, factor: float, end: np.ndarray, toward: np.ndarray) -> float:
    """Distance along the strip, from the tip, until the line enters the opening."""
    del toward
    from app.geometry.master_lock import _sample_mask

    seq = line if float(np.linalg.norm(line[0] - end)) <= float(np.linalg.norm(line[-1] - end)) else line[::-1]
    travelled = 0.0
    for index in range(1, min(len(seq), 24)):
        step = float(np.linalg.norm(seq[index] - seq[index - 1]))
        travelled += step
        inside = bool(_sample_mask(opening, master, np.array([seq[index, 0]]), np.array([seq[index, 1]]), factor)[0])
        if inside:
            return travelled
        if travelled >= 8.0:
            break
    return travelled


def cellular_paths(master, factor, params, step, x0, x1, y0, y1) -> list[tuple]:
    """Poisson seeds, three Lloyd passes, then the Voronoi walls inside the opening."""
    rng = np.random.default_rng(int(params["seed"]))
    density = float(np.clip(params["density_u"], 0.4, 2.2))
    count = int(np.clip(round(8 + density * 10), 8, 28))
    spacing = float(np.clip(26.0 / np.sqrt(count), 7.0, 16.0))
    gradient = float(np.clip(params.get("cell_aspect", 1.0) - 1.0, -0.4, 0.6))
    jitter = float(np.clip(params.get("randomness", 0.0), 0.0, 2.0)) * spacing * 3.0
    seeds: list[np.ndarray] = []
    tries = 0
    while len(seeds) < count and tries < count * 50:
        tries += 1
        x = float(rng.uniform(x0 + 2, x1 - 2))
        y = float(rng.uniform(y0 + 2, y1 - 2))
        if not _mask_at(master, "inner", factor, np.array([x, y], np.float32)):
            continue
        span = max(y1 - y0, 1.0)
        local = spacing * (1.0 + gradient * 0.85 * ((y - y0) / span - 0.5))
        local = max(6.0, local)
        if all(float(np.hypot(x - s[0], y - s[1])) >= local for s in seeds):
            seeds.append(np.array([x, y], np.float32))
    if len(seeds) < 4:
        return []
    cloud = np.stack(seeds).astype(np.float32)
    if jitter > 0:
        cloud = cloud + rng.normal(0.0, jitter * 0.35, cloud.shape).astype(np.float32)
    pitch = 2.8
    xs = np.arange(x0, x1 + pitch, pitch, dtype=np.float32)
    ys = np.arange(y0, y1 + pitch, pitch, dtype=np.float32)
    grid_x, grid_y = np.meshgrid(xs, ys)
    flat_x = grid_x.ravel()
    flat_y = grid_y.ravel()
    inside = _inside(master, factor, flat_x, flat_y)
    points = np.column_stack([flat_x[inside], flat_y[inside]]).astype(np.float32)
    if len(points) < 8:
        return []
    labels = np.full(grid_x.shape, -1, np.int32)
    assigned = np.flatnonzero(inside)
    for _ in range(3):
        delta = points[:, None, :] - cloud[None, :, :]
        nearest = np.argmin(np.einsum("ijk,ijk->ij", delta, delta), axis=1).astype(np.int32)
        for index in range(len(cloud)):
            chosen = nearest == index
            if int(chosen.sum()) < 3:
                continue
            cloud[index] = points[chosen].mean(axis=0)
    delta = points[:, None, :] - cloud[None, :, :]
    nearest = np.argmin(np.einsum("ijk,ijk->ij", delta, delta), axis=1).astype(np.int32)
    labels.ravel()[assigned] = nearest
    segments: list[tuple[np.ndarray, np.ndarray]] = []
    rows, cols = labels.shape
    for row in range(rows):
        for col in range(cols - 1):
            left, right = int(labels[row, col]), int(labels[row, col + 1])
            if left == right or left < 0 or right < 0:
                continue
            x = (float(xs[col]) + float(xs[col + 1])) * 0.5
            y_a = float(ys[row]) - pitch * 0.5
            y_b = float(ys[row]) + pitch * 0.5
            segments.append((np.array([x, y_a], np.float32), np.array([x, y_b], np.float32)))
    for row in range(rows - 1):
        for col in range(cols):
            low, high = int(labels[row, col]), int(labels[row + 1, col])
            if low == high or low < 0 or high < 0:
                continue
            y = (float(ys[row]) + float(ys[row + 1])) * 0.5
            x_a = float(xs[col]) - pitch * 0.5
            x_b = float(xs[col]) + pitch * 0.5
            segments.append((np.array([x_a, y], np.float32), np.array([x_b, y], np.float32)))
    chains = _chain(segments)
    width = max(float(params["wu"]) * 0.95, 1.5)
    seed = int(params["seed"])
    paths = []
    for index, line in enumerate(chains):
        if _length(line) < 10.0:
            continue
        paths.append((line, _tone(index, seed, 0), width, 1.0 if index % 2 == 0 else -1.0))
    return paths


def _chain(segments: list[tuple[np.ndarray, np.ndarray]]) -> list[np.ndarray]:
    def key(point: np.ndarray) -> tuple[int, int]:
        return (int(round(float(point[0]) * 10)), int(round(float(point[1]) * 10)))

    adjacency: dict[tuple[int, int], list[tuple]] = {}
    for index, (start, end) in enumerate(segments):
        a, b = key(start), key(end)
        adjacency.setdefault(a, []).append((b, index, end, start))
        adjacency.setdefault(b, []).append((a, index, start, end))
    used: set[int] = set()
    paths: list[np.ndarray] = []
    starts = [item for item in adjacency if len(adjacency[item]) != 2] or list(adjacency)
    for start in starts:
        for _other, seg_id, nxt, origin in adjacency[start]:
            if seg_id in used:
                continue
            used.add(seg_id)
            points = [origin, nxt]
            cursor = _other
            guard = 0
            while len(adjacency.get(cursor, [])) == 2 and guard < 4000:
                guard += 1
                pending = [item for item in adjacency[cursor] if item[1] not in used]
                if not pending:
                    break
                nxt_key, nxt_id, nxt_point, _here = pending[0]
                used.add(nxt_id)
                points.append(nxt_point)
                cursor = nxt_key
            paths.append(np.asarray(points, np.float32))
    return paths


def seal_open_paths(master: dict, factor: float, strands: list[dict]) -> list[dict]:
    """Push every open tip into the frame so the strict break count can reach zero."""
    from app.geometry.master_lock import _sample_mask
    from app.geometry.weave_ribbons import _close_mask

    if not strands:
        return strands
    opening = _close_mask(master["inner"], 5) & ~master["guard"]

    def at(mask: np.ndarray, point: np.ndarray) -> bool:
        hit = _sample_mask(mask, master, np.array([point[0]]), np.array([point[1]]), factor)
        return bool(hit[0])

    def ready(line: np.ndarray, at_start: bool) -> bool:
        end = line[0] if at_start else line[-1]
        inward = line[min(4, len(line) - 1)] if at_start else line[max(0, len(line) - 5)]
        if not at(master["solid"], end) or at(opening, end):
            return False
        if _deep(opening, master, factor, end):
            return False
        return _embed_length(line, opening, master, factor, end, inward) >= 1.6

    def exit_direction(origin: np.ndarray, hint: np.ndarray) -> np.ndarray | None:
        best = None
        best_dist = 1e9
        angles = np.linspace(0, 2 * np.pi, 24, endpoint=False)
        for prefer in (True, False):
            for angle in angles:
                direction = np.array([np.cos(angle), np.sin(angle)], np.float32)
                if prefer and float(np.dot(direction, hint)) < 0.2:
                    continue
                cursor = origin.astype(np.float32).copy()
                dist = 0.0
                landed = False
                for _ in range(48):
                    cursor = cursor + direction * 0.7
                    dist += 0.7
                    if not at(master["solid"], cursor):
                        break
                    if not at(opening, cursor):
                        landed = True
                        break
                if landed and dist < best_dist:
                    best = direction
                    best_dist = dist
            if best is not None:
                return best
        return None

    def bury(line: np.ndarray, at_start: bool) -> np.ndarray | None:
        if ready(line, at_start):
            return line
        origin = line[0] if at_start else line[-1]
        back = line[min(5, len(line) - 1)] if at_start else line[max(0, len(line) - 6)]
        hint = origin.astype(np.float32) - back.astype(np.float32)
        norm = float(np.linalg.norm(hint))
        hint = hint / norm if norm > 1e-4 else np.array([0.0, 1.0], np.float32)
        direction = exit_direction(origin, hint)
        if direction is None:
            return None
        cursor = origin.astype(np.float32).copy()
        extra = []
        buried = 0.0
        left = not at(opening, origin)
        for _ in range(64):
            nxt = cursor + direction * 0.5
            if not at(master["solid"], nxt):
                break
            if left and not at(master["solid"], nxt + direction * 1.6):
                break
            if at(master["guard"], nxt) and not at(opening, nxt):
                extra.append(nxt.copy())
                buried = 2.0
                left = True
                break
            cursor = nxt
            extra.append(cursor.copy())
            if not at(opening, cursor):
                left = True
                buried += 0.5
                if buried >= 2.0:
                    break
        if not left or buried < 1.4 or not extra:
            return None
        added = np.asarray(extra, np.float32)
        if at_start:
            return np.vstack([added[::-1], line])
        return np.vstack([line, added])

    kept = []
    for item in strands:
        line = np.asarray(item["line"], np.float32)
        if len(line) < 2 or _closed(line):
            kept.append(item)
            continue
        sealed = bury(line, True)
        if sealed is None:
            continue
        sealed = bury(sealed, False)
        if sealed is None:
            continue
        sealed = _resample(sealed, 0.65)
        sealed = bury(sealed, True)
        if sealed is None:
            continue
        sealed = bury(sealed, False)
        if sealed is None or _length(sealed) < 14.0 or not ready(sealed, True) or not ready(sealed, False):
            continue
        updated = dict(item)
        updated["line"] = sealed
        kept.append(updated)
    return kept

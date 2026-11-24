"""Four weave layers share one master shell and one curve graph."""
from __future__ import annotations

import numpy as np

from app.geometry.weave_ribbons import ACCENT, BAMBOO, _bounds, _closed, strands_for

ALGO = {
    "none": "blank",
    "plain": "plain",
    "radial-star": "radial",
    "ripple-wave": "ripple",
    "cellular-growth": "cellular",
    "rotating-diamond": "diamond",
    "radial": "radial",
    "ripple": "ripple",
    "cellular": "cellular",
    "diamond": "diamond",
    "blank": "blank",
    "twill": "diamond",
}

TONES = {
    "light": BAMBOO[0],
    "medium": BAMBOO[1],
    "dark": BAMBOO[3],
    "red": ACCENT,
}


def _layer(slot: str, name: str, algorithm: str, **extra) -> dict:
    layer = {
        "id": slot,
        "name": name,
        "enabled": True,
        "visible": True,
        "locked": False,
        "solo": False,
        "algorithm": algorithm,
        "seed": 7,
        "density": 1.0,
        "strip_width": 1.55,
        "offset_x": 0.0,
        "offset_y": 0.0,
        "rotation": 0.0,
        "scale_x": 1.0,
        "scale_y": 1.0,
        "base_z": 0.15,
        "wave_amplitude": 0.16,
        "wave_frequency": 1.1,
        "wave_phase": 0.0,
        "crossing_lift": 0.42,
        "priority": 1,
        "tone": "medium",
    }
    layer.update(extra)
    return layer


def reference_presets() -> list[dict]:
    """One primary grammar per preset. Extra algorithms stay off until that grammar is continuous."""
    return [
        {
            "id": "plain-weave",
            "name": "平纹经纬",
            "pattern": "plain",
            "seed": 7,
            "layers": [
                _layer("L1", "基础编织", "plain", density=0.9, strip_width=1.45, base_z=0.05, priority=0, tone="medium", ripple_part="both"),
                _layer("L2", "主图案", "radial-star", density=0.4, strip_width=1.25, base_z=0.45, priority=2, tone="red", radial_part="spokes", spoke_count=8, ring_count=0),
                _layer("L3", "结构强化", "plain", enabled=False, visible=False, density=0.3, priority=1, tone="dark"),
                _layer("L4", "绑结", "none", enabled=False, visible=False, density=0.2, base_z=1.05, priority=3, tone="red"),
            ],
        },
        {
            "id": "radial-star",
            "name": "放射星纹",
            "pattern": "radial",
            "seed": 7,
            "layers": [
                _layer("L1", "结构底编", "plain", enabled=False, visible=False, density=0.34, strip_width=1.25, priority=0, tone="dark", ripple_part="warp", amplitude=0.15, accent_every=0),
                _layer("L2", "主图案", "radial-star", density=1.15, strip_width=1.45, base_z=0.4, priority=2, tone="medium", crossing_lift=1.8, spoke_count=32, ring_count=14, radial_part="both", pattern_angle=0),
                _layer("L3", "结构强化", "radial-star", enabled=False, visible=False, density=0.35, strip_width=1.2, priority=1, tone="light", radial_part="rings", ring_count=3),
                _layer("L4", "绑结", "none", enabled=False, visible=False, density=0.25, base_z=1.05, priority=3, tone="red"),
            ],
        },
        {
            "id": "ripple-wave",
            "name": "涟漪流动",
            "pattern": "ripple",
            "seed": 7,
            "layers": [
                _layer("L1", "结构底编", "plain", enabled=False, visible=False, density=0.34, strip_width=1.25, priority=0, tone="dark", ripple_part="warp", amplitude=0.15, accent_every=0),
                _layer("L2", "主图案", "ripple-wave", density=1.35, strip_width=2.0, base_z=0.4, priority=2, tone="light", crossing_lift=1.8, amplitude=4.6, frequency=2.0, bundle_count=1, ripple_part="weft", accent_every=3, wave_phase=0.4),
                _layer("L3", "结构强化", "ripple-wave", enabled=False, visible=False, density=0.3, priority=1, tone="red", amplitude=5.6, frequency=1.05, ripple_part="weft"),
                _layer("L4", "绑结", "none", enabled=False, visible=False, density=0.2, base_z=1.05, priority=3, tone="red"),
            ],
        },
        {
            "id": "cellular-growth",
            "name": "笼目网纹",
            "pattern": "cellular",
            "seed": 7,
            "layers": [
                _layer("L1", "结构底编", "plain", enabled=False, visible=False, density=0.34, strip_width=1.25, priority=0, tone="dark", ripple_part="warp", amplitude=0.15, accent_every=0),
                _layer("L2", "主图案", "cellular-growth", density=1.7, strip_width=2.2, base_z=0.45, priority=2, tone="medium", crossing_lift=1.8, include_basket=False, randomness=0.0, cell_aspect=1.0),
                _layer("L3", "结构强化", "plain", enabled=False, visible=False, density=0.25, priority=1, tone="light"),
                _layer("L4", "绑结", "none", enabled=False, visible=False, density=0.2, base_z=1.05, priority=3, tone="red"),
            ],
        },
        {
            "id": "rotating-diamond-reference",
            "name": "旋转菱纹",
            "pattern": "diamond",
            "seed": 5205,
            "layers": [
                _layer("L1", "结构底编", "plain", enabled=False, visible=False, density=0.2, strip_width=1.1, priority=0, tone="dark", ripple_part="warp"),
                _layer(
                    "L2", "主图案", "rotating-diamond",
                    density=1.15, strip_width=2.6, base_z=0.2, priority=2, tone="light", crossing_lift=1.8,
                    diamond_part="both", pattern_angle=0, edge_compression=0.42, rotation_strength=0.28,
                    center_spacing=4.8, edge_spacing=3.4, secondary_strength=0.70,
                    structural_strength=0.0, binder_density=0.0,
                    direction_a=0, direction_b=0, arc_a=18, arc_b=-18,
                ),
                _layer("L3", "结构强化", "none", enabled=False, visible=False, priority=1),
                _layer("L4", "绑结", "none", enabled=False, visible=False, priority=3),
            ],
        },
        {
            "id": "rotating-diamond",
            "name": "旋转菱纹",
            "pattern": "diamond",
            "seed": 7,
            "layers": [
                _layer("L1", "结构底编", "plain", enabled=False, visible=False, density=0.34, strip_width=1.25, priority=0, tone="dark", ripple_part="warp"),
                _layer(
                    "L2", "主图案", "rotating-diamond",
                    density=0.95, strip_width=2.2, base_z=0.35, priority=2, tone="light", crossing_lift=0.8,
                    diamond_part="both", pattern_angle=10, edge_compression=0.55, rotation_strength=0.16,
                    center_spacing=15.0, edge_spacing=5.2, secondary_strength=0.72, binder_density=0.0,
                ),
                _layer("L3", "结构强化", "rotating-diamond", enabled=False, visible=False, density=0.4, priority=1, tone="dark", diamond_part="b", pattern_angle=6),
                _layer("L4", "绑结", "none", enabled=False, visible=False, density=0.2, base_z=1.05, priority=3, tone="red"),
            ],
        },
        {
            "id": "star-ripple",
            "name": "星涟共振",
            "pattern": "radial",
            "seed": 11,
            "layers": [
                _layer("L1", "基础编织", "rotating-diamond", density=0.55, strip_width=1.2, base_z=0.0, priority=0, tone="light"),
                _layer("L2", "主图案", "radial-star", density=0.85, strip_width=1.5, base_z=0.4, priority=2, tone="medium"),
                _layer("L3", "结构强化", "ripple-wave", enabled=False, visible=False, density=0.5, strip_width=1.25, base_z=0.75, priority=1, tone="dark", wave_amplitude=0.12),
                _layer("L4", "绑结", "none", enabled=True, visible=True, priority=3, tone="red", crossing_lift=0.55),
            ],
        },
        {
            "id": "cellular-loom",
            "name": "生长经纬",
            "pattern": "cellular",
            "seed": 11,
            "layers": [
                _layer("L1", "基础编织", "plain", density=0.8, strip_width=1.15, base_z=0.0, priority=0, tone="light"),
                _layer("L2", "主图案", "cellular-growth", density=0.75, strip_width=1.5, base_z=0.45, priority=2, tone="medium"),
                _layer("L3", "结构强化", "rotating-diamond", enabled=False, visible=False, density=0.4, strip_width=1.2, base_z=0.8, priority=1, tone="dark"),
                _layer("L4", "绑结", "none", enabled=True, visible=True, priority=3, tone="red"),
            ],
        },
        {
            "id": "rotating-tide",
            "name": "回旋潮汐",
            "pattern": "ripple",
            "seed": 13,
            "layers": [
                _layer("L1", "基础编织", "rotating-diamond", density=0.5, strip_width=1.2, base_z=0.0, priority=0, tone="dark"),
                _layer("L2", "主图案", "ripple-wave", density=0.8, strip_width=1.55, base_z=0.4, priority=2, tone="medium"),
                _layer("L3", "结构强化", "rotating-diamond", enabled=False, visible=False, density=0.45, strip_width=1.25, base_z=0.8, priority=1, tone="light", rotation=18),
                _layer("L4", "绑结", "none", enabled=True, visible=True, priority=3, tone="red"),
            ],
        },
        {
            "id": "haitang-constellation",
            "name": "海棠星络",
            "pattern": "radial",
            "seed": 17,
            "layers": [
                _layer("L1", "基础编织", "plain", density=0.9, strip_width=1.1, base_z=0.0, priority=0, tone="light"),
                _layer("L2", "主图案", "radial-star", density=0.7, strip_width=1.45, base_z=0.4, priority=2, tone="medium"),
                _layer("L3", "结构强化", "cellular-growth", enabled=False, visible=False, density=0.45, strip_width=1.3, base_z=0.85, priority=1, tone="dark"),
                _layer("L4", "绑结", "none", enabled=True, visible=True, priority=3, tone="red"),
            ],
        },
    ]


def preset_by_id(preset_id: str) -> dict | None:
    for item in reference_presets():
        if item["id"] == preset_id:
            return item
    return None


def active_layers(params: dict) -> list[dict]:
    raw = params.get("layers") or []
    if not raw:
        pattern = str(params.get("pattern", "radial"))
        algo = {
            "radial": "radial-star",
            "ripple": "ripple-wave",
            "cellular": "cellular-growth",
            "diamond": "rotating-diamond",
            "plain": "plain",
            "blank": "none",
        }.get(pattern, "radial-star")
        return [
            _layer("L2", "主图案", algo, density=float(params.get("density_u", 1.2)), strip_width=float(params.get("strand_width_u", 1.6)), seed=int(params.get("seed", 7)), priority=2)
        ]
    layers = [dict(item) for item in raw if isinstance(item, dict)]
    solos = [item for item in layers if item.get("solo") and item.get("enabled", True)]
    chosen = solos or layers
    return [item for item in chosen if item.get("enabled", True) and item.get("visible", True) and ALGO.get(str(item.get("algorithm", "none")), "blank") != "blank"]


def _tint(color: np.ndarray, tone: str) -> np.ndarray:
    target = TONES.get(tone, BAMBOO[1]).astype(np.float32)
    mixed = np.asarray(color, np.float32) * 0.62 + target * 0.38
    return np.clip(mixed, 0, 255).astype(np.uint8)


def _transform(line: np.ndarray, layer: dict, focus: tuple[float, float]) -> np.ndarray:
    focus_xy = np.array(focus, np.float32)
    local = line - focus_xy
    local[:, 0] *= float(layer.get("scale_x", 1) or 1)
    local[:, 1] *= float(layer.get("scale_y", 1) or 1)
    angle = np.deg2rad(float(layer.get("rotation", 0) or 0))
    cos_a, sin_a = np.cos(angle), np.sin(angle)
    rotated = np.column_stack([
        local[:, 0] * cos_a - local[:, 1] * sin_a,
        local[:, 0] * sin_a + local[:, 1] * cos_a,
    ])
    rotated[:, 0] += float(layer.get("offset_x", 0) or 0)
    rotated[:, 1] += float(layer.get("offset_y", 0) or 0)
    return (rotated + focus_xy).astype(np.float32)


def _segment_hit(a: np.ndarray, b: np.ndarray, c: np.ndarray, d: np.ndarray):
    def cross(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    d1, d2 = cross(c, d, a), cross(c, d, b)
    d3, d4 = cross(a, b, c), cross(a, b, d)
    if d1 == 0 or d2 == 0 or d3 == 0 or d4 == 0:
        return None
    if ((d1 > 0) == (d2 > 0)) or ((d3 > 0) == (d4 > 0)):
        return None
    denom = d1 - d2
    t = float(d1 / denom) if abs(denom) > 1e-8 else 0.5
    point = a + (b - a) * t
    return point, t


def _collect_crossings(strands: list[dict], limit: int = 640) -> list[dict]:
    """Every place two strips cross. A pair that crosses twice is two crossings."""
    cell = 7.5
    buckets: dict[tuple[int, int], list[tuple]] = {}
    for index, strand in enumerate(strands):
        pts = strand["line"]
        step = max(1, len(pts) // 60)
        for i in range(0, len(pts) - 1, step):
            a, b = pts[i], pts[min(i + step, len(pts) - 1)]
            # A segment goes in every cell its box touches, or crossings near cell edges are missed.
            gx0, gx1 = sorted((int(a[0] // cell), int(b[0] // cell)))
            gy0, gy1 = sorted((int(a[1] // cell), int(b[1] // cell)))
            for gx in range(gx0, gx1 + 1):
                for gy in range(gy0, gy1 + 1):
                    buckets.setdefault((gx, gy), []).append((index, i, a, b))
    found: list[dict] = []
    by_pair: dict[tuple[int, int], list[np.ndarray]] = {}
    for key in sorted(buckets):
        items = buckets[key]
        for i in range(len(items)):
            ia, sa, a0, a1 = items[i]
            for jb in range(i + 1, len(items)):
                ib, sb, b0, b1 = items[jb]
                if ia == ib:
                    continue
                hit = _segment_hit(a0, a1, b0, b1)
                if hit is None:
                    continue
                point = hit[0].astype(np.float32)
                pair = (min(ia, ib), max(ia, ib))
                prior = by_pair.setdefault(pair, [])
                if any(float(np.hypot(*(point[:2] - p[:2]))) < 3.0 for p in prior):
                    continue
                prior.append(point)
                found.append({"a": ia, "b": ib, "point": point, "sa": sa, "sb": sb})
                if len(found) >= limit:
                    return found
    return found


def _alternate(strands: list[dict], crossings: list[dict], locks: list[dict]) -> list[int]:
    """Over/under so that every strip alternates along its length, the way it is woven.

    Each crossing is one unknown (does strip a go over?). Neighbouring crossings on a
    strip must differ, which ties unknowns together in pairs; a breadth-first pass sets
    them, starting from the crossings the designer locked.
    """
    count = len(crossings)
    stops: dict[int, list[tuple[float, int, int]]] = {}
    for c, cross in enumerate(crossings):
        for strand, flip in ((cross["a"], 0), (cross["b"], 1)):
            line = strands[strand]["line"]
            nearest = int(np.argmin(np.linalg.norm(line[:, :2] - cross["point"][:2], axis=1)))
            stops.setdefault(strand, []).append((float(strands[strand]["s"][nearest]), c, flip))
    links: list[list[tuple[int, int]]] = [[] for _ in range(count)]
    for row in stops.values():
        row.sort()
        for (_s1, c1, f1), (_s2, c2, f2) in zip(row, row[1:]):
            parity = 1 ^ f1 ^ f2
            links[c1].append((c2, parity))
            links[c2].append((c1, parity))
    value: list[int | None] = [None] * count
    fixed: list[tuple[int, int]] = []
    for c, cross in enumerate(crossings):
        point = cross["point"]
        for lock in locks:
            if abs(float(lock.get("x", 1e9)) - float(point[0])) < 2.5 and abs(float(lock.get("y", 1e9)) - float(point[1])) < 2.5:
                wanted = str(lock.get("over", ""))
                if strands[cross["a"]]["layer_id"] == wanted:
                    fixed.append((c, 1))
                elif strands[cross["b"]]["layer_id"] == wanted:
                    fixed.append((c, 0))
    roots = fixed + [(c, (strands[crossings[c]["a"]]["index"] + c) % 2 ^ 1) for c in range(count)]
    for start, guess in roots:
        if value[start] is not None:
            continue
        value[start] = guess
        queue = [start]
        while queue:
            current = queue.pop()
            for other, parity in links[current]:
                if value[other] is None:
                    value[other] = value[current] ^ parity
                    queue.append(other)
    locked = {c for c, _guess in fixed}
    for _ in range(8):
        changed = False
        for c, friends in enumerate(links):
            if c in locked or value[c] is None or not friends:
                continue
            wrong = sum(
                1 for other, parity in friends
                if value[other] is not None and value[other] != (value[c] ^ parity)
            )
            if wrong * 2 > len(friends):
                value[c] ^= 1
                changed = True
        if not changed:
            break
    return [crossings[c]["a"] if value[c] else crossings[c]["b"] for c in range(count)]


def _arc(line: np.ndarray) -> np.ndarray:
    delta = np.linalg.norm(np.diff(line, axis=0), axis=1)
    total = float(delta.sum()) or 1.0
    return np.concatenate([[0.0], np.cumsum(delta)]) / total


def _is_base_strand(strand: dict) -> bool:
    """The under-weave (底编). It is tagged by its thickness and by the sign used for support paths."""
    thick = float(strand.get("ribbon_thick") or 0)
    sign = float(strand.get("z_sign") or 0)
    return abs(thick - 0.75) < 0.05 or abs(sign + 0.35) < 0.08


def _layered_overs(strands: list[dict], crossings: list[dict], locks: list[dict], base: set[int]) -> list[int]:
    """Base weaves only with base, the pattern only with itself, and the pattern stays above the base.

    One alternation across every geometric hit is impossible once a third layer is present:
    a pattern strip that must stay above the base cannot also alternate at those hits.
    """
    groups: dict[str, list[int]] = {"base": [], "weave": [], "mix": []}
    for index, cross in enumerate(crossings):
        a_base = cross["a"] in base
        b_base = cross["b"] in base
        if a_base and b_base:
            groups["base"].append(index)
        elif a_base or b_base:
            groups["mix"].append(index)
        else:
            groups["weave"].append(index)
    overs = [crossings[index]["a"] for index in range(len(crossings))]
    for key in ("base", "weave"):
        chosen = groups[key]
        if not chosen:
            continue
        decided = _alternate(strands, [crossings[index] for index in chosen], locks)
        for index, over in zip(chosen, decided):
            overs[index] = over
    for index in groups["mix"]:
        cross = crossings[index]
        overs[index] = cross["b"] if cross["a"] in base else cross["a"]
    return overs


def _weave_offset(s: np.ndarray, stops: list[tuple[float, float]], lift: float) -> np.ndarray:
    """Height along one strip: +lift where it crosses on top, -lift where it passes under.

    The value is the crossing itself, then a cosine blend to the neighbours. Wide
    bumps used to overlap and cancel, so the strip recorded as 'over' sat underneath.
    """
    s = np.asarray(s, np.float32)
    out = np.zeros_like(s)
    if not stops:
        return out
    xs = [0.0]
    zs = [0.0]
    for sc, direction in sorted(stops):
        x = float(np.clip(sc, 0.0, 1.0))
        z = float(direction) * float(lift)
        if x <= xs[-1] + 1e-4:
            if abs(z) >= abs(zs[-1]):
                zs[-1] = z
            continue
        xs.append(x)
        zs.append(z)
    if xs[-1] < 1.0 - 1e-4:
        xs.append(1.0)
        zs.append(0.0)
    knots_x = np.asarray(xs, np.float32)
    knots_z = np.asarray(zs, np.float32)
    index = np.clip(np.searchsorted(knots_x, s, side="right") - 1, 0, len(knots_x) - 2)
    span = np.maximum(knots_x[index + 1] - knots_x[index], 1e-6)
    t = np.clip((s - knots_x[index]) / span, 0.0, 1.0)
    ease = (0.5 - 0.5 * np.cos(np.pi * t)).astype(np.float32)
    return (knots_z[index] + (knots_z[index + 1] - knots_z[index]) * ease).astype(np.float32)


def _elevate(strands: list[dict], crossings: list[dict], locks: list[dict], print_safe: bool) -> list[dict]:
    for strand in strands:
        s = _arc(strand["line"])
        phase = float(strand["wave_phase"]) + strand["index"] * 0.35
        z = float(strand["base_z"]) + float(strand["wave_amplitude"]) * np.sin(np.pi * 2 * float(strand["wave_frequency"]) * s + phase)
        strand["s"] = s
        strand["z"] = z.astype(np.float32)
    base = {index for index, strand in enumerate(strands) if _is_base_strand(strand)}
    if base and len(base) < len(strands):
        overs = _layered_overs(strands, crossings, locks, base)
    else:
        overs = _alternate(strands, crossings, locks)
    for order, cross in enumerate(crossings):
        ia, ib = cross["a"], cross["b"]
        over = overs[order]
        point = cross["point"]
        under = ib if over == ia else ia
        cross["over"] = strands[over]["layer_id"]
        cross["under"] = strands[under]["layer_id"]
        cross["over_strand"] = over
        cross["under_strand"] = under
        cross["id"] = f"c{order}"
        for side, direction in ((over, 1.0), (under, -1.0)):
            strand = strands[side]
            nearest = int(np.argmin(np.linalg.norm(strand["line"][:, :2] - point[:2], axis=1)))
            strand.setdefault("_stops", []).append((float(strand["s"][nearest]), direction))
    for strand in strands:
        stops = strand.pop("_stops", [])
        thick = float(strand.get("ribbon_thick") or 0)
        if thick < 0.3:
            thick = 1.2
        requested = float(strand["crossing_lift"])
        # The two centerlines must clear both thicknesses, even when the slider asks for less.
        floor = thick * 0.55 + 0.2
        lift = max(requested, floor) if requested >= 0.55 else max(0.55 if print_safe else max(requested, 0.35), floor)
        strand["z"] = (strand["z"] + _weave_offset(strand["s"], stops, lift)).astype(np.float32)
    for strand in strands:
        strand["z"] = (1.55 + strand["z"]).astype(np.float32)
    return crossings


def _knots(crossings: list[dict], strands: list[dict]) -> list[tuple]:
    knots = []
    for index, cross in enumerate(crossings):
        if index % 6:
            continue
        if len(knots) >= 10:
            break
        point = cross["point"]
        stitch = np.column_stack([
            point[0] + np.linspace(-1.6, 1.6, 8),
            np.full(8, point[1]),
        ]).astype(np.float32)
        over = strands[cross["a"]] if strands[cross["a"]]["layer_id"] == cross["over"] else strands[cross["b"]]
        z = float(np.max(over["z"])) + 0.35
        knots.append((stitch, ACCENT.copy(), 0.9, 1.0, np.full(len(stitch), z, np.float32)))
    return knots


def _hidden_turn(start: np.ndarray, end: np.ndarray) -> np.ndarray:
    start = np.asarray(start, np.float32)
    end = np.asarray(end, np.float32)
    mid = (start + end) * 0.5
    outward = np.array([1.0 if mid[0] >= 0.0 else -1.0, 0.0], np.float32)
    bulge = mid + outward * 3.6
    t = np.linspace(0.0, 1.0, 7, dtype=np.float32)[:, None]
    return ((1.0 - t) ** 2) * start + 2.0 * (1.0 - t) * t * bulge + (t ** 2) * end


def _stitch_serpentine(items: list[dict]) -> list[dict]:
    """Join nearby row ends with a turn hidden in the rim, so a weave is one path."""
    if len(items) < 2:
        return items
    long_items = []
    short_items = []
    for item in items:
        length = float(np.linalg.norm(np.diff(item["line"], axis=0), axis=1).sum())
        if length >= 28.0:
            long_items.append(item)
        else:
            short_items.append(item)
    groups: dict[bytes, list[dict]] = {}
    for item in long_items:
        red = int(np.asarray(item["color"])[0])
        green = int(np.asarray(item["color"])[1])
        key = b"accent" if red > green + 25 and red > 140 else b"weave"
        groups.setdefault(key, []).append(item)
    stitched: list[dict] = []
    for group in groups.values():
        ordered = sorted(group, key=lambda item: float(np.mean(item["line"][:, 1])))
        used = [False] * len(ordered)
        for index, item in enumerate(ordered):
            if used[index]:
                continue
            used[index] = True
            chain = item["line"]
            while True:
                end = chain[-1]
                best = None
                best_distance = 22.0
                for other_index, other in enumerate(ordered):
                    if used[other_index]:
                        continue
                    for point, flipped in ((other["line"][0], False), (other["line"][-1], True)):
                        distance = float(np.hypot(point[0] - end[0], point[1] - end[1]))
                        if distance < best_distance and abs(float(point[1] - end[1])) < 24.0:
                            best = (other_index, flipped)
                            best_distance = distance
                if best is None:
                    break
                other_index, flipped = best
                used[other_index] = True
                other_line = ordered[other_index]["line"][::-1] if flipped else ordered[other_index]["line"]
                bridge = _hidden_turn(end, other_line[0])
                chain = np.vstack([chain, bridge[1:], other_line]).astype(np.float32)
            merged = dict(item)
            merged["line"] = chain
            stitched.append(merged)
    return stitched + short_items


def _role(layer: dict) -> str:
    return ALGO.get(str(layer.get("algorithm", "none")), "blank")


def compose_layers(master: dict, params: dict, factor: float, quality: str) -> tuple[list[tuple], dict]:
    from app.geometry.rotating_diamond import TRIM_BASELINE

    token = TRIM_BASELINE.set(str(params.get("anchor_mode", "anchor")) == "trim")
    try:
        return _compose_layers(master, params, factor, quality)
    finally:
        TRIM_BASELINE.reset(token)


def _compose_layers(master: dict, params: dict, factor: float, quality: str) -> tuple[list[tuple], dict]:
    from app.geometry.rotating_diamond import TRIM_BASELINE
    from app.geometry.weave_graph import apply_modulators, audit_paths, finish_batch, seal_open_paths

    trim = TRIM_BASELINE.get()
    layers = _limit_dense(active_layers(params))
    modulators = [item for item in layers if item.get("modulate")]
    solids = [item for item in layers if not item.get("modulate")]
    artistic = [item for item in solids if _role(item) not in {"blank", "plain"}]
    plain_layers = [item for item in solids if _role(item) == "plain"]
    mesh_layers: list[dict] = []
    if artistic:
        artistic = sorted(artistic, key=lambda item: -int(item.get("priority", 0)))
        mesh_layers.append(artistic[0])
        modulators = modulators + artistic[1:]
        if plain_layers:
            mesh_layers.append(plain_layers[0])
    elif plain_layers:
        mesh_layers.append(plain_layers[0])
    if not mesh_layers:
        return [], {
            "curve_count": 0, "crossing_count": 0, "knot_count": 0, "layer_count": 0,
            "crossings_preview": [], "dropped_fragments": 0, "continuous_path_coverage": 0,
            "visible_endpoint_count": 0, "short_fragment_count": 0, "unanchored_strip_count": 0,
            "interior_degree_one_node_count": 0, "floating_component_count": 0,
        }
    _x0, _x1, _y0, _y1, focus = _bounds(master, factor)
    strands: list[dict] = []
    dropped = 0
    short_dropped = 0
    unanchored_dropped = 0
    step = 1.6 if quality == "draft" else 1.0
    for layer in mesh_layers:
        algo = _role(layer)
        if algo == "blank":
            continue
        tuned = dict(params)
        tuned["pattern"] = algo
        tuned["density_u"] = float(layer.get("density", params.get("density_u", 1)))
        tuned["density_v"] = float(layer.get("density", params.get("density_v", 1)))
        tuned["strand_width_u"] = float(layer.get("strip_width", 1.55))
        tuned["strand_width_v"] = float(layer.get("strip_width", 1.55))
        tuned["seed"] = int(layer.get("seed", params.get("seed", 7)))
        tuned["weave_angle"] = float(layer.get("pattern_angle", params.get("weave_angle", 0)) or 0)
        for key in (
            "amplitude", "frequency", "cell_aspect", "randomness", "accent_every",
            "spoke_count", "ring_count", "radial_part", "ripple_part", "diamond_part",
            "include_basket", "edge_compression", "bundle_count", "rotation_strength", "wave_phase",
            "center_spacing", "edge_spacing", "secondary_strength", "structural_strength", "binder_density",
            "direction_a", "direction_b", "arc_a", "arc_b",
        ):
            if key in layer and layer[key] is not None:
                tuned[key] = layer[key]
        if layer is not mesh_layers[0]:
            tuned["ripple_part"] = "warp"
            tuned["amplitude"] = 0.15
            tuned["accent_every"] = 0
            tuned["bundle_count"] = 1
        else:
            tuned = apply_modulators(tuned, modulators)
        raw = strands_for(master, tuned, factor, quality)
        pending: list[np.ndarray] = []
        sources: list[tuple] = []
        for index, item in enumerate(raw):
            line, color, width, z_sign = item[0], item[1], item[2], item[3]
            ribbon_thick = float(item[4]) if len(item) > 4 and np.isscalar(item[4]) else 0.0
            moved = _transform(line, layer, focus)
            # Reference diamonds are already cut from frame to frame. A second clip
            # breaks them at every petal notch.
            already_anchored = algo in {"diamond", "radial", "ripple", "cellular", "plain"} or float(layer.get("center_spacing") or 0) >= 6
            if _closed(moved) or already_anchored:
                pieces = [moved]
            else:
                from app.geometry.diamond_field import _clip_anchored

                pieces = _clip_anchored(master, factor, moved, step)
            for piece in pieces:
                pending.append(piece)
                sources.append((index, color, float(width), float(z_sign), ribbon_thick))
        if not pending:
            continue
        width_for_batch = float(np.median([item[2] for item in sources]))
        if trim:
            finished, dropped_info = list(enumerate(pending)), {"removed_short": 0, "removed_unanchored": 0}
        else:
            finished, dropped_info = finish_batch(master, factor, pending, width_for_batch, step)
        short_dropped += int(dropped_info["removed_short"])
        unanchored_dropped += int(dropped_info["removed_unanchored"])
        dropped += int(dropped_info["removed_short"]) + int(dropped_info["removed_unanchored"])
        for source_index, run in finished:
            index, color, width, z_sign, ribbon_thick = sources[source_index]
            strands.append({
                "line": run,
                "color": _tint(color, str(layer.get("tone", "medium"))),
                "width": width,
                "z_sign": z_sign,
                "layer_id": str(layer.get("id", "L")),
                "index": index,
                "priority": int(layer.get("priority", 1)),
                "base_z": float(layer.get("base_z", 0.2)),
                "wave_amplitude": float(layer.get("wave_amplitude", 0.12)),
                "wave_frequency": float(layer.get("wave_frequency", 1.0)),
                "wave_phase": float(layer.get("wave_phase", 0)),
                "crossing_lift": float(layer.get("crossing_lift", params.get("relief", 0.45))),
                "family": "warp" if algo == "plain" else "weft",
                "ribbon_thick": ribbon_thick,
            })
            if len(strands) > 520:
                break
    if not trim:
        strands = seal_open_paths(master, factor, strands)
    locks = list(params.get("crossing_locks") or [])
    crossings = _collect_crossings(strands) if len(strands) > 1 else []
    _elevate(strands, crossings, locks, bool(params.get("print_safe", True)))
    packed: list[tuple] = []
    for item in strands:
        row = (item["line"], item["color"], item["width"], item["z_sign"], item["z"])
        if float(item.get("ribbon_thick") or 0) > 0.2:
            row = (*row, float(item["ribbon_thick"]))
        packed.append(row)
    preview = [
        {"id": item["id"], "x": round(float(item["point"][0]), 2), "y": round(float(item["point"][1]), 2), "over": item["over"], "under": item["under"]}
        for item in crossings[:8]
    ]
    checked = audit_paths(master, factor, [item["line"] for item in strands])
    meta = {
        "curve_count": len(strands),
        "crossing_count": len(crossings),
        "knot_count": 0,
        "layer_count": len(mesh_layers),
        "dropped_fragments": dropped,
        "removed_short": short_dropped,
        "removed_unanchored": unanchored_dropped,
        "compatibility_warning": _compatibility_warning(mesh_layers),
        "layer_curves": {str(item["layer_id"]): sum(1 for row in strands if row["layer_id"] == item["layer_id"]) for item in strands},
        "crossings_preview": preview,
        "strand_layers": [str(item["layer_id"]) for item in strands],
        "crossing_table": [
            {"id": item["id"], "x": float(item["point"][0]), "y": float(item["point"][1]), "over": int(item["over_strand"]), "under": int(item["under_strand"])}
            for item in crossings
        ],
        "modulator_count": len(modulators[:3]),
        **checked,
    }
    return packed, meta


def _compatibility_warning(layers: list[dict]) -> str:
    primaries = [
        item for item in layers
        if ALGO.get(str(item.get("algorithm", "none")), "blank") not in {"blank", "plain"}
        and float(item.get("density", 0)) >= 0.75
    ]
    if len(primaries) > 1:
        return "当前组合可能产生视觉冲突，建议降低强化层密度或切换为平纹底层。"
    return ""


def _limit_dense(layers: list[dict]) -> list[dict]:
    order = {"L2": 0, "L1": 1, "L3": 2, "L4": 3}
    dense = [item for item in layers if float(item.get("density", 0)) >= 0.9]
    if len(dense) <= 2:
        return layers
    ranked = sorted(dense, key=lambda item: order.get(str(item.get("id")), 9))
    for item in ranked[2:]:
        item["density"] = min(float(item["density"]), 0.62)
    return layers

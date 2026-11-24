"""Three closed-form weaves. Diamond stays in rotating_diamond.

Radial star, spokes and rings about the focus just under the opening:
  spoke: p(t) = F + t (cos θ_k, sin θ_k), θ_k equally spaced
  ring:  p(φ) = F + r_k (cos φ, sin φ), r_{k+1}/r_k constant
  Each kept strip is one unbroken run from frame to frame.

Ripple, sine weft. Adjacent rows take opposite phase once A is tall enough to cross:
  y = y_j + A sin(2π f (x-x0)/W + φ + (j mod 2) π)

Cellular, three hex directions in a radial warp u = (p-c)(1 + β(|p-c|/R)^2):
  family k: n_k · u = m * gap,  n_k = (cos(kπ/3), sin(kπ/3))
"""
from __future__ import annotations

import numpy as np

from app.geometry.diamond_field import ACCENT, DARK, LIGHT
from app.geometry.weave_ribbons import _close_mask


def single_run_ok(runs: list) -> bool:
    from app.geometry.rotating_diamond import single_run_ok as check

    return check(runs)


def _anchor(master, factor, line, step):
    """Keep the part that crosses the opening, with both tips already buried on the same tangent."""
    from app.geometry.rotating_diamond import _anchored_runs

    opening = _close_mask(master["inner"], 5) & ~master["guard"]
    return _anchored_runs(master, opening, factor, line, step)


_MOTIFS = ("bar-h", "bar-v", "circle", "dot", "triangle", "star")


def _selected_motifs(params) -> list[str]:
    """Empty list means the user turned every element off. None falls back to the single motif."""
    raw = params.get("support_motifs", None)
    if raw is None:
        single = str(params.get("support_motif") or "")
        return [single] if single in _MOTIFS else []
    return [str(item) for item in raw if str(item) in _MOTIFS]


def _dense_pitch(previous: float, floor: float) -> float:
    """Same slider, five times tighter than the previous spacing law."""
    return max(float(previous) / 5.0, float(floor))


def base_support_paths(master, factor, params, step, x0, x1, y0, y1) -> list[tuple]:
    """Even under-weave. Several motifs can sit on the face at once.

    support_density 0 is off. Toward 1 the pitch gets smaller, still uniform,
    and five times tighter than the previous range.
    """
    density = float(np.clip(params.get("support_density", 0) or 0, 0.0, 1.0))
    if density < 0.04:
        return []
    motifs = _selected_motifs(params)
    if not motifs:
        return []
    size = float(np.clip(params.get("support_size", 3.2) or 3.2, 1.6, 8.0))
    strands: list[tuple] = []
    for motif in motifs:
        if len(strands) >= 420:
            break
        if motif in {"bar-h", "bar-v"}:
            strands.extend(_frame_bars(master, factor, step, x0, x1, y0, y1, motif, density, size))
            continue
        strands.extend(_motif_grid(master, factor, x0, x1, y0, y1, motif, density, size, 420 - len(strands)))
    return strands


def _motif_grid(master, factor, x0, x1, y0, y1, motif: str, density: float, size: float, room: int) -> list[tuple]:
    reach = _motif_reach(motif, size)
    previous = max(reach * 2.35, 30.0 - 20.0 * density)
    pitch = _dense_pitch(previous, reach * 1.2)
    opening = _close_mask(master["inner"], 5) & ~master["guard"]
    from app.geometry.master_lock import _sample_mask

    angles = np.linspace(0, 2 * np.pi, 8, endpoint=False)
    strands: list[tuple] = []
    xs = np.arange(float(x0) + pitch * 0.5, float(x1), pitch)
    ys = np.arange(float(y0) + pitch * 0.5, float(y1), pitch)
    stroke = _motif_stroke(motif, size)
    limit = min(120, max(int(room), 0))
    for y in ys:
        for x in xs:
            if len(strands) >= limit:
                return strands
            center = np.array([x, y], np.float32)
            ring = center + reach * np.column_stack([np.cos(angles), np.sin(angles)]).astype(np.float32)
            samples = np.vstack([center, ring])
            inside = _sample_mask(opening, master, samples[:, 0], samples[:, 1], factor)
            if not bool(inside.all()):
                continue
            line = _motif_line(motif, center, size)
            strands.append((line, DARK.copy(), stroke, -0.35))
    return strands


def _frame_bars(master, factor, step, x0, x1, y0, y1, motif: str, density: float, size: float) -> list[tuple]:
    """Full strips. A bar is kept only when it is one unbroken run with both tips in the frame."""
    previous = float(np.clip(26.0 - 18.0 * density, max(size * 1.55, 4.2), 28.0))
    width = float(np.clip(size * 0.55, 1.15, 3.4))
    pitch = _dense_pitch(previous, max(width * 1.08, 1.45))
    strands: list[tuple] = []
    if motif == "bar-h":
        places = np.arange(float(y0) + pitch * 0.5, float(y1), pitch)
        span = np.linspace(float(x0) - 16.0, float(x1) + 16.0, 140, dtype=np.float32)
        for place in places:
            if len(strands) >= 80:
                break
            line = np.column_stack([span, np.full(len(span), place, np.float32)])
            runs = _anchor(master, factor, line, step)
            if not single_run_ok(runs):
                continue
            strands.extend((run, DARK.copy(), width, -0.35) for run in runs)
        return strands
    places = np.arange(float(x0) + pitch * 0.5, float(x1), pitch)
    span = np.linspace(float(y0) - 16.0, float(y1) + 16.0, 160, dtype=np.float32)
    for place in places:
        if len(strands) >= 80:
            break
        line = np.column_stack([np.full(len(span), place, np.float32), span])
        runs = _anchor(master, factor, line, step)
        if not single_run_ok(runs):
            continue
        strands.extend((run, DARK.copy(), width, -0.35) for run in runs)
    return strands


def _motif_reach(motif: str, size: float) -> float:
    if motif == "dot":
        return max(2.1, size * 0.55)
    return size


def _motif_stroke(motif: str, size: float) -> float:
    if motif == "dot":
        return max(2.1, size * 0.55)
    if motif == "circle":
        return 0.72
    return 0.68


def _close_loop(points: np.ndarray) -> np.ndarray:
    pts = np.asarray(points, np.float32)
    if float(np.linalg.norm(pts[0] - pts[-1])) > 1e-3:
        pts = np.vstack([pts, pts[:1]])
    return pts


def _motif_line(motif: str, center: np.ndarray, size: float) -> np.ndarray:
    if motif in {"bar-h", "bar-v"}:
        return _capsule(center, max(size * 2.6, 7.0), max(1.35, size * 0.5), motif == "bar-h")
    if motif == "circle":
        return _circle(center, size, 28)
    if motif == "dot":
        # Centerline sits at half the radius and the stroke fills out to a solid disk.
        radius = max(2.1, size * 0.55)
        return _circle(center, radius * 0.5, 64)
    if motif == "triangle":
        angles = np.deg2rad(np.array([90.0, 210.0, 330.0], np.float32))
        verts = center + size * np.column_stack([np.cos(angles), np.sin(angles)]).astype(np.float32)
        return _polygon(verts, 8)
    angles = -np.pi / 2.0 + np.arange(5, dtype=np.float32) * (2.0 * np.pi / 5.0)
    verts = []
    for angle in angles:
        verts.append(center + size * np.array([np.cos(angle), np.sin(angle)], np.float32))
        inner = angle + np.pi / 5.0
        verts.append(center + size * 0.4 * np.array([np.cos(inner), np.sin(inner)], np.float32))
    return _polygon(np.asarray(verts, np.float32), 5)


def _circle(center: np.ndarray, radius: float, count: int) -> np.ndarray:
    theta = np.linspace(0, 2 * np.pi, count, endpoint=False, dtype=np.float32)
    pts = center + radius * np.column_stack([np.cos(theta), np.sin(theta)]).astype(np.float32)
    return _close_loop(pts)


def _polygon(verts: np.ndarray, steps: int) -> np.ndarray:
    blend = np.linspace(0.0, 1.0, steps, endpoint=False, dtype=np.float32)
    parts = []
    count = len(verts)
    for index in range(count):
        start = verts[index]
        stop = verts[(index + 1) % count]
        parts.append(start * (1.0 - blend)[:, None] + stop * blend[:, None])
    return _close_loop(np.vstack(parts))


def _capsule(center: np.ndarray, length: float, thick: float, horizontal: bool) -> np.ndarray:
    radius = max(float(thick) * 0.5, 0.55)
    half = max(float(length) * 0.5 - radius, 0.35)
    major = np.array([1.0, 0.0] if horizontal else [0.0, 1.0], np.float32)
    minor = np.array([-major[1], major[0]], np.float32)

    def arc(origin: np.ndarray, start: float, stop: float) -> np.ndarray:
        theta = np.linspace(start, stop, 8, dtype=np.float32)
        return origin + radius * (np.sin(theta)[:, None] * major + np.cos(theta)[:, None] * minor)

    right = center + major * half
    left = center - major * half
    return _close_loop(np.vstack([
        arc(right, -np.pi / 2.0, np.pi / 2.0),
        arc(left, np.pi / 2.0, 3.0 * np.pi / 2.0),
    ]))


def radial_paths(master, factor, params, step, x0, x1, y0, y1, focus) -> list[tuple]:
    """Spokes and rings about one focus, just under the opening.

    Spoke angles are equally spaced. Ring radii grow by a constant ratio,
    so the cells enlarge as they leave the focus. Spoke count is the ray
    family, ring count is the arc family. Every fifth strip is the red tie.
    """
    part = str(params.get("radial_part", "both"))
    density = float(np.clip(params.get("density_u", 1.0), 0.4, 2.6))
    spokes = int(params.get("spoke_count") or 0)
    if spokes <= 0:
        spokes = int(np.clip(round(16 * density + 8), 8, 48))
    else:
        spokes = max(4, int(round(spokes * density)))
    rings = max(int(params.get("ring_count") or 0), 0)
    if int(params.get("ring_count") or 0):
        rings = max(0, int(round(rings * density)))
    elif part == "rings":
        rings = max(int(round(8 * density)), 3)
    if focus is None:
        focus_pt = np.array([(float(x0) + float(x1)) * 0.5, float(y0) - 1.5], np.float32)
    else:
        focus_pt = np.array([float(focus[0]), float(focus[1])], np.float32)
    corners = np.array([[x0, y0], [x1, y0], [x0, y1], [x1, y1]], np.float32)
    delta = corners - focus_pt
    angles = np.unwrap(np.arctan2(delta[:, 1], delta[:, 0]))
    phase = np.deg2rad(float(params.get("weave_angle", 0.0) or 0.0))
    span = float(angles.max() - angles.min())
    pad = np.deg2rad(8.0) + abs(phase)
    a0 = float(angles.min()) - pad
    a1 = float(angles.max()) + pad
    reach = np.hypot(delta[:, 0], delta[:, 1])
    radius_max = float(reach.max()) * 1.12
    # Rings tighter than this shatter where the spokes converge: the over-under
    # rise is steeper than the ribbon thickness, so the solid breaks into pieces
    # that never meet the frame. 34 mm is the smallest ring that stays one piece.
    radius_min = max(float(reach.min()) * 0.55, 34.0)
    width = float(params["wu"])
    strands: list[tuple] = []
    # The lower rim of the opening meets the guard, which is part of the rigid frame.
    # Bury spoke and ring tips there, otherwise every ray through the focus is rejected.
    buried = dict(master)
    buried["guard"] = np.zeros_like(master["guard"])

    def keep(curve: np.ndarray, index: int, family: float) -> None:
        runs = _anchor(buried, factor, curve, step)
        if not single_run_ok(runs):
            return
        color = ACCENT if index % 5 == 0 else (LIGHT if index % 2 == 0 else DARK)
        sign = 1.0 if index % 2 == 0 else -1.0
        for run in runs:
            strands.append((run, color.copy(), width * (1.0 if family > 0 else 0.92), sign if family > 0 else -sign))

    if part != "rings":
        for index, angle in enumerate(np.linspace(a0, a1, max(int(spokes), 4))):
            direction = np.array([np.cos(angle + phase), np.sin(angle + phase)], np.float32)
            near = focus_pt - direction * np.float32(6.0)
            far = focus_pt + direction * np.float32(radius_max + 16.0)
            samples = np.linspace(0.0, 1.0, 96, dtype=np.float32)
            keep(near + (far - near) * samples[:, None], index, 1.0)
    if part != "spokes":
        count = rings if rings > 0 else max(spokes // 2, 4)
        count = max(int(count), 3)
        ratio = (radius_max / radius_min) ** (1.0 / max(count - 1, 1))
        window = np.linspace(a0 - phase, a1 - phase, 120, dtype=np.float32)
        circle = np.column_stack([np.cos(window), np.sin(window)]).astype(np.float32)
        for index in range(count):
            radius = radius_min * ratio ** index
            keep(focus_pt + circle * np.float32(radius), index, -1.0)
    strands.extend(base_support_paths(master, factor, params, step, x0, x1, y0, y1))
    return strands


def ripple_paths(master, factor, params, step, x0, x1, y0, y1, focus) -> list[tuple]:
    """Sine weft. Once the wave is tall enough to meet the next strip, adjacent rows run in opposite phase and cross into a diamond net. A short wave stays phase-locked."""
    del focus
    part = str(params.get("ripple_part", "both"))
    amp = float(np.clip(params.get("amplitude", 5.6), 0.0, 12.0))
    cycles = float(np.clip(params.get("frequency", 1.4), 0.2, 4.0))
    phase = float(params.get("wave_phase", 0.0) or 0.0)
    accent_every = int(params.get("accent_every", 4) or 0)
    density = float(np.clip(params.get("density_v", 0.8), 0.35, 2.6))
    width = float(params["wv"])
    pitch = max(width * 1.15, (width + 1.35) / density)
    # Plain weave and the other presets call this with a wave under 3 mm.
    # Leave those paths phase-locked. Only the tall ripple crosses itself.
    interlock = amp >= 3.0
    width_span = max(x1 - x0, 1.0)
    height_span = max(y1 - y0, 1.0)
    xs = np.linspace(x0 - 8.0, x1 + 8.0, 160, dtype=np.float32)
    ys = np.linspace(y0 - 8.0, y1 + 8.0, 160, dtype=np.float32)
    strands: list[tuple] = []
    if part != "weft":
        gap = max(float(params["wu"]) * 1.15, (float(params["wu"]) + 1.35) / max(float(params["density_u"]), 0.35))
        columns = np.arange(x0 + gap * 0.5, x1, gap, dtype=np.float32)
        for index, base in enumerate(columns):
            line = np.column_stack([
                base + amp * 0.45 * np.sin(2.0 * np.pi * cycles * (ys - y0) / height_span + phase + np.pi / 2.0),
                ys,
            ]).astype(np.float32)
            for run in _anchor(master, factor, line, step):
                strands.append((run, DARK.copy(), float(params["wu"]) * 0.72, -0.6))
    if part == "warp":
        strands.extend(base_support_paths(master, factor, params, step, x0, x1, y0, y1))
        return strands
    rows = np.arange(y0 + pitch * 0.45, y1, pitch, dtype=np.float32)
    for index, base in enumerate(rows):
        accent = accent_every > 0 and index % accent_every == 0
        color = ACCENT if accent else (LIGHT if index % 2 == 0 else DARK)
        shift = np.pi if interlock and index % 2 else 0.0
        line = np.column_stack([
            xs,
            base + amp * np.sin(2.0 * np.pi * cycles * (xs - x0) / width_span + phase + shift),
        ]).astype(np.float32)
        ribbon = width * (1.45 if accent and interlock else 1.15 if accent else 1.0)
        for run in _anchor(master, factor, line, step):
            strands.append((run, color.copy(), ribbon, 1.0 if index % 2 == 0 else -1.0))
    strands.extend(base_support_paths(master, factor, params, step, x0, x1, y0, y1))
    return strands


def _spaced_offsets(radius: float, center_gap: float, edge_gap: float) -> list[float]:
    offsets = [0.0]
    cursor = 0.0
    guard = 0
    while cursor < radius and guard < 70:
        guard += 1
        t = min(1.0, cursor / max(radius, 1.0))
        fade = t * t * (3.0 - 2.0 * t)
        step = center_gap * (1.0 - fade) + edge_gap * fade
        cursor += max(step, edge_gap)
        if cursor < radius:
            offsets.append(cursor)
    return offsets


def cellular_paths_field(master, factor, params, step, x0, x1, y0, y1) -> list[tuple]:
    """Hex level-sets of u = (p-c)(1 + β(|p-c|/R)^2). Cells shrink toward the rim."""
    center = np.array([(x0 + x1) * 0.5, (y0 + y1) * 0.5], np.float32)
    radius = max(x1 - x0, y1 - y0) * 0.62
    density = float(np.clip(params.get("density_u", 1.15), 0.4, 2.6))
    aspect = float(np.clip(params.get("cell_aspect", 1.0), 0.6, 1.6))
    center_gap = float(np.clip(11.5 / density, 3.4, 22.0))
    edge_gap = float(np.clip(center_gap * 0.68, 2.6, max(center_gap - 0.4, 2.6)))
    beta = float(np.clip((center_gap / edge_gap - 1.0) * 0.55, 0.05, 1.35))
    # The rim is where u grows fastest. Keep that gap wide enough that the
    # over-under rise stays inside one ribbon, otherwise the top cells fall off.
    if center_gap / (1.0 + 3.0 * beta) < 5.6:
        beta = max((center_gap / 5.6 - 1.0) / 3.0, 0.0)
    jitter = float(np.clip(params.get("randomness", 0.0) or 0.0, 0.0, 2.0))
    width = float(params["wu"])
    travel = np.linspace(-radius * 1.7, radius * 1.7, 96, dtype=np.float32)
    strands: list[tuple] = []
    offsets = _spaced_offsets(radius * (1.0 + beta), center_gap, edge_gap)
    signed = offsets + [-item for item in offsets if item > 0.4]
    # The lower rim meets the guard. Treat that guard as frame so the two
    # diagonal families can finish there, the same way a spoke does.
    buried = dict(master)
    buried["guard"] = np.zeros_like(master["guard"])
    for family, angle in enumerate((np.pi / 2.0, np.pi / 2.0 + np.pi / 3.0, np.pi / 2.0 + 2.0 * np.pi / 3.0)):
        normal = np.array([np.cos(angle), np.sin(angle) / aspect], np.float32)
        normal = normal / max(float(np.linalg.norm(normal)), 1e-6)
        tangent = np.array([-normal[1], normal[0]], np.float32)
        for index, offset in enumerate(signed):
            shift = jitter * center_gap * 3.0 * np.sin(family * 1.7 + index * 0.35)
            # Slide one family so the three directions no longer meet at one point.
            # A shared vertex forces the strip to rise and fall within one millimetre,
            # and the solid breaks there.
            if family == 1:
                shift += center_gap * 0.42
            origin = normal * np.float32(offset + shift)
            samples = origin + tangent * travel[:, None]
            line = center + _unwarp(samples, beta, radius)
            light = (family + index) % 2 == 0
            color = ACCENT if index % 5 == 0 else (LIGHT if light else DARK)
            for run in _anchor(buried, factor, line.astype(np.float32), step):
                strands.append((run, color.copy(), width, 1.0 if light else -1.0))
    strands.extend(base_support_paths(master, factor, params, step, x0, x1, y0, y1))
    return strands


def _unwarp(samples: np.ndarray, beta: float, radius: float) -> np.ndarray:
    """Inverse of u = s (1 + β (s/R)^2) applied to each vector."""
    target = np.linalg.norm(samples, axis=1)
    scale = np.ones(len(samples), np.float32)
    radius = max(float(radius), 1.0)
    for _ in range(5):
        warped = scale * (1.0 + beta * (scale / radius) ** 2)
        deriv = 1.0 + 3.0 * beta * (scale / radius) ** 2
        scale = np.maximum(scale - (warped - target) / np.maximum(deriv, 1e-4), 0.0)
    unit = samples / np.maximum(target[:, None], 1e-6)
    unit[target < 1e-6] = 0.0
    return (unit * scale[:, None]).astype(np.float32)

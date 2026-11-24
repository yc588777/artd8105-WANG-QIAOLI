"""Rotating-diamond kernel.

Two mirrored direction fields. Every kept strip is one polyline from the
frame, across the opening, and back into the frame. Nothing is seeded with
random breaks, and a line that leaves the opening does not re-enter.
"""
from __future__ import annotations

import contextvars

import numpy as np

from app.geometry.diamond_field import DARK, LIGHT
from app.geometry.master_lock import _sample_mask
from app.geometry.weave_ribbons import _close_mask, _resample

PRIMARY_THICK = 1.2
SECONDARY_THICK = 0.9
BASE_THICK = 0.75

# Evaluation baseline (E1): plain Boolean trim against the opening. No embedding,
# no short-run drop, no single-run rule. Never set by the interface.
TRIM_BASELINE: contextvars.ContextVar[bool] = contextvars.ContextVar("trim_baseline", default=False)


def single_run_ok(runs: list) -> bool:
    return len(runs) == 1 or (TRIM_BASELINE.get() and len(runs) > 0)


def rotating_diamond_paths(master, factor, params, step, x0, x1, y0, y1) -> list[tuple]:
    """Two families. With the arc and direction offsets at 0, the second is the mirror of the first.

    direction_a / direction_b rotate one family. arc_a / arc_b is the mid-strip
    sagitta in millimetres; 0 keeps that family straight.
    """
    cx = (float(x0) + float(x1)) * 0.5
    cy = (float(y0) + float(y1)) * 0.5
    half = max(float(x1) - float(x0), float(y1) - float(y0)) * 0.72
    density = float(np.clip(params.get("density_u", 1.0), 0.45, 1.6))
    center = float(np.clip(float(params.get("center_spacing", 4.8)) / density, 2.8, 20.0))
    edge = float(np.clip(float(params.get("edge_spacing", 3.4)) / density, 2.2, max(center - 0.4, 2.2)))
    raw_angle = float(params.get("weave_angle", 0.0))
    strength = float(np.clip(params.get("rotation_strength", 0.28), 0.0, 1.4))
    angle_deg = 42.0 + raw_angle + (strength - 0.28) * 16.0
    base = np.deg2rad(float(np.clip(angle_deg, 24.0, 68.0)))
    primary = float(np.clip(params.get("wu", params.get("strand_width_u", 3.4)), 1.6, 4.2))
    ratio = float(np.clip(params.get("secondary_strength", 0.70), 0.55, 0.85))
    secondary = max(primary * ratio, 1.6)
    direction_a = float(params.get("direction_a", 0.0) or 0.0)
    direction_b = float(params.get("direction_b", 0.0) or 0.0)
    arc_a = float(params.get("arc_a", 0.0) or 0.0)
    arc_b = float(params.get("arc_b", 0.0) or 0.0)
    opening = _close_mask(master["inner"], 5) & ~master["guard"]
    span = max(float(y1) - float(y0), float(x1) - float(x0)) * 1.35
    direction = np.array([np.cos(base), np.sin(base)], np.float32)
    normal = np.array([-direction[1], direction[0]], np.float32)
    samples = np.linspace(-span, span, max(48, int(span / 1.05)), dtype=np.float32)
    strands: list[tuple] = []
    seen: list[tuple[np.ndarray, np.ndarray]] = []

    def push(run: np.ndarray, color: np.ndarray, width: float, thick: float, sign: float) -> None:
        if len(run) < 2:
            return
        mid = run[len(run) // 2]
        tangent = run[-1] - run[0]
        tangent = tangent / max(float(np.linalg.norm(tangent)), 1e-6)
        for prev_mid, prev_tan in seen:
            if float(np.hypot(*(mid - prev_mid))) < 1.15 and abs(float(np.dot(tangent, prev_tan))) > 0.92:
                return
        seen.append((mid.copy(), tangent.copy()))
        strands.append((run, color.copy(), float(width), float(sign), float(thick)))

    straight: list[np.ndarray] = []
    for offset in _offsets(half, center, edge):
        origin = np.array([cx, cy], np.float32) + normal * np.float32(offset)
        curve = origin + direction * samples[:, None]
        for run in _anchored_runs(master, opening, factor, curve.astype(np.float32), step):
            straight.append(run)

    def emit(angle: float, arc: float, color: np.ndarray, width: float, thick: float, sign: float) -> None:
        aim = np.array([np.cos(angle), np.sin(angle)], np.float32)
        side = np.array([-aim[1], aim[0]], np.float32)
        for offset in _offsets(half, center, edge):
            origin = np.array([cx, cy], np.float32) + side * np.float32(offset)
            curve = _arc(origin, aim, side, samples, max(float(x1) - float(x0), float(y1) - float(y0)) * 0.5, arc)
            for run in _anchored_runs(master, opening, factor, curve, step):
                push(run, color, width, thick, sign)

    bend_a = abs(direction_a) > 0.2 or abs(arc_a) > 0.2
    bend_b = abs(direction_b) > 0.2 or abs(arc_b) > 0.2
    if bend_a:
        emit(base + np.deg2rad(direction_a), arc_a, LIGHT, primary, PRIMARY_THICK, 1.0)
    else:
        for run in straight:
            push(run, LIGHT, primary, PRIMARY_THICK, 1.0)
    if bend_b:
        emit(np.pi - base + np.deg2rad(direction_b), arc_b, DARK, secondary, SECONDARY_THICK, -1.0)
    else:
        for run in straight:
            mirrored = run.copy()
            mirrored[:, 0] = np.float32(2.0 * cx - mirrored[:, 0])
            push(mirrored[::-1], DARK, secondary, SECONDARY_THICK, -1.0)

    base_strength = float(params.get("structural_strength", 0.0) or 0.0)
    if base_strength > 0.04:
        gap = 24.0
        count = 1 if base_strength < 0.12 else 2 if base_strength < 0.28 else 3
        columns = [0.0]
        for index in range(1, count + 1):
            columns.extend([gap * index, -gap * index])
        for column in columns:
            spine = np.column_stack([
                np.full(70, cx + column, np.float32),
                np.linspace(y0 - 8.0, y1 + 8.0, 70, dtype=np.float32),
            ])
            for run in _anchored_runs(master, opening, factor, spine, step):
                push(run, DARK, max(1.35, primary * 0.42), BASE_THICK, 0.2)
    from app.geometry.pattern_fields import base_support_paths

    for run, color, width, sign in base_support_paths(master, factor, params, step, x0, x1, y0, y1):
        push(run, color, width, BASE_THICK, sign)
    return strands


def _arc(origin: np.ndarray, direction: np.ndarray, normal: np.ndarray, samples: np.ndarray, reach: float, arc: float) -> np.ndarray:
    """Bow whose sagitta is `arc` millimetres at the middle of the face.

    The chord across the opening is the straight strip. arc = 0 leaves it straight.
    """
    line = origin + direction * samples[:, None]
    if abs(float(arc)) < 0.05:
        return line.astype(np.float32)
    bow = np.float32(arc) * (1.0 - np.square(samples / max(float(reach), 1.0)))
    return (line + normal * bow[:, None]).astype(np.float32)


def _offsets(half: float, center: float, edge: float, start: float = 0.42) -> list[float]:
    offsets = [0.0]
    cursor = 0.0
    for _ in range(48):
        t = cursor / max(half, 1.0)
        blend = np.clip((t - start) / max(1.0 - start, 0.08), 0.0, 1.0)
        smooth = float(blend * blend * (3.0 - 2.0 * blend))
        step = center * (1.0 - smooth) + edge * smooth
        cursor += max(step, 2.0)
        if cursor >= half:
            break
        offsets.append(cursor)
        offsets.append(-cursor)
    return offsets


def _anchored_runs(master, opening, factor, line: np.ndarray, step: float) -> list[np.ndarray]:
    line = _resample(np.asarray(line, np.float32), max(float(step), 1.05))
    if len(line) < 4:
        return []
    inside = _sample_mask(opening, master, line[:, 0], line[:, 1], factor)
    if TRIM_BASELINE.get():
        return _trimmed_runs(line, inside)
    solid = _sample_mask(master["solid"], master, line[:, 0], line[:, 1], factor)
    guard = _sample_mask(master["guard"], master, line[:, 0], line[:, 1], factor)
    frame = solid & ~guard
    cuts = np.diff(inside.astype(np.int8))
    starts = list(np.flatnonzero(cuts == 1) + 1)
    ends = list(np.flatnonzero(cuts == -1) + 1)
    if inside[0]:
        starts = [0, *starts]
    if inside[-1]:
        ends = [*ends, len(inside)]
    runs = []
    for start, end in zip(starts, ends):
        if end - start < 4:
            continue
        left = _embed(line, frame, start, -1)
        right = _embed(line, frame, end - 1, 1)
        run = line[left:right]
        if len(run) < 4:
            continue
        if _length(run) < 18.0:
            continue
        if inside[left] or inside[min(right - 1, len(inside) - 1)]:
            continue
        if not frame[left] or not frame[min(right - 1, len(frame) - 1)]:
            continue
        runs.append(run)
    return runs


def _trimmed_runs(line: np.ndarray, inside: np.ndarray) -> list[np.ndarray]:
    cuts = np.diff(inside.astype(np.int8))
    starts = list(np.flatnonzero(cuts == 1) + 1)
    ends = list(np.flatnonzero(cuts == -1) + 1)
    if inside[0]:
        starts = [0, *starts]
    if inside[-1]:
        ends = [*ends, len(inside)]
    return [line[start:end] for start, end in zip(starts, ends) if end - start >= 2]


def _embed(line: np.ndarray, frame: np.ndarray, index: int, sign: int) -> int:
    """Stop inside the frame. The tip must not reach the outer skin."""
    cursor = index
    travelled = 0.0
    guard = 0.0
    limit = len(line) - 1
    while 0 < cursor < limit and travelled < 3.2:
        nxt = cursor + sign
        if nxt < 0 or nxt >= len(line) or not frame[nxt]:
            break
        step = float(np.hypot(*(line[nxt] - line[cursor])))
        guard += step
        # Keep at least 1.8 mm of frame beyond the tip, so the ribbon end stays buried.
        if _ahead(line, frame, nxt, sign) < 1.8:
            break
        travelled += step
        cursor = nxt
        if guard > 12:
            break
    return cursor if sign < 0 else cursor + 1


def _ahead(line: np.ndarray, frame: np.ndarray, index: int, sign: int) -> float:
    cursor = index
    travelled = 0.0
    limit = len(line) - 1
    while travelled < 4.0:
        nxt = cursor + sign
        if nxt < 0 or nxt > limit or not frame[nxt]:
            return travelled
        travelled += float(np.hypot(*(line[nxt] - line[cursor])))
        cursor = nxt
    return travelled


def _length(line: np.ndarray) -> float:
    return float(np.linalg.norm(np.diff(line, axis=0), axis=1).sum())

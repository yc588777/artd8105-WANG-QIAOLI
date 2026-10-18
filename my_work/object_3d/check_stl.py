"""Independent check of fan_parametric.stl.

Reads the binary STL without Blender or the Haitang generator.
Prints triangle count, bounding box in millimetres, signed volume,
and a vertex-weld edge census. Signed volume is the reliable closed-mesh
signal here: tessellated STL vertices are not shared, so a naive edge
match is not a fair manifold test.
"""

from __future__ import annotations

import struct
import sys
from collections import Counter
from pathlib import Path


def key(x: float, y: float, z: float, nd: int = 4) -> tuple[float, float, float]:
    return (round(x, nd), round(y, nd), round(z, nd))


def check(path: Path) -> None:
    data = path.read_bytes()
    if len(data) < 84:
        raise SystemExit(f"too small to be an STL: {path}")

    header = data[:80].decode("latin-1", errors="replace").rstrip("\x00").strip()
    ntri = struct.unpack_from("<I", data, 80)[0]
    expected = 84 + ntri * 50
    if len(data) != expected:
        raise SystemExit(f"size mismatch: file={len(data)} expected={expected}")

    xmin = ymin = zmin = float("inf")
    xmax = ymax = zmax = float("-inf")
    volume = 0.0
    edges: Counter[tuple] = Counter()
    off = 84

    for _ in range(ntri):
        nx, ny, nz, x1, y1, z1, x2, y2, z2, x3, y3, z3, _attr = struct.unpack_from(
            "<12fH", data, off
        )
        off += 50
        pts = ((x1, y1, z1), (x2, y2, z2), (x3, y3, z3))
        for x, y, z in pts:
            xmin, ymin, zmin = min(xmin, x), min(ymin, y), min(zmin, z)
            xmax, ymax, zmax = max(xmax, x), max(ymax, y), max(zmax, z)
        volume += (
            x1 * (y2 * z3 - y3 * z2)
            + x2 * (y3 * z1 - y1 * z3)
            + x3 * (y1 * z2 - y2 * z1)
        ) / 6.0
        v = [key(*p) for p in pts]
        for a, b in ((0, 1), (1, 2), (2, 0)):
            edges[tuple(sorted((v[a], v[b])))] += 1

    boundary = sum(1 for c in edges.values() if c == 1)
    nonman = sum(1 for c in edges.values() if c > 2)
    dx, dy, dz = xmax - xmin, ymax - ymin, zmax - zmin

    print(f"file: {path.name}")
    print(f"header: {header}")
    print(f"triangles: {ntri}")
    print(f"bytes: {len(data)}")
    print(
        f"bbox_mm: [{xmin:.3f}, {ymin:.3f}, {zmin:.3f}]"
        f" -> [{xmax:.3f}, {ymax:.3f}, {zmax:.3f}]"
    )
    print(f"size_mm: {dx:.3f} x {dy:.3f} x {dz:.3f}")
    print(f"signed_volume_mm3: {volume:.2f}")
    print(f"normals: {'outward-positive' if volume > 0 else 'inward-or-open'}")
    print(f"weld_0.0001mm_unique_edges: {len(edges)}")
    print(f"weld_0.0001mm_boundary_edges: {boundary}")
    print(f"weld_0.0001mm_nonmanifold_edges: {nonman}")
    print("note: weld census is diagnostic only; tessellated STL does not share vertices.")


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "fan_parametric.stl"
    check(target)

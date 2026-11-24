"""Save the four preset plans and coarse front/side views of the same mesh."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.geometry.master_lock import plan_locked  # noqa: E402
from app.geometry.unified import build_unified  # noqa: E402
from app.geometry.layers import preset_by_id  # noqa: E402

OUT = ROOT / "exports" / "audit"
OUT.mkdir(parents=True, exist_ok=True)


def params_for(preset_id: str) -> dict:
    preset = preset_by_id(preset_id)
    return {
        "pattern": preset["pattern"],
        "preset": preset_id,
        "layers": preset["layers"],
        "geometry_lock": True,
        "print_safe": True,
        "t_min": 0,
        "t_max": 2.2,
        "density_u": 1.0,
        "density_v": 1.0,
        "strand_width_u": 1.6,
        "strand_width_v": 1.6,
        "seed": preset["seed"],
        "target_height": 180,
        "amplitude": 4.0,
        "frequency": 1.0,
        "weave_angle": 0,
        "relief": 0.45,
        "crossing_locks": [],
    }


def paint(positions: np.ndarray, colors: np.ndarray, axis: str, path: Path) -> None:
    if axis == "front":
        x, y = positions[:, 0], positions[:, 1]
    else:
        x, y = positions[:, 2], positions[:, 1]
    width, height = 420, 640
    pad = 16
    span_x = max(float(x.max() - x.min()), 1.0)
    span_y = max(float(y.max() - y.min()), 1.0)
    scale = min((width - 2 * pad) / span_x, (height - 2 * pad) / span_y)
    col = ((x - x.min()) * scale + pad).astype(np.int32)
    row = (height - pad - (y - y.min()) * scale).astype(np.int32)
    image = np.full((height, width, 3), 247, np.uint8)
    step = max(1, len(positions) // 180000)
    order = np.argsort(positions[::step, 2 if axis == "front" else 0])
    pts = np.arange(0, len(positions), step)[order]
    for index in pts:
        c, r = int(col[index]), int(row[index])
        if 0 <= c < width and 0 <= r < height:
            image[r, c] = colors[index]
    Image.fromarray(image, "RGB").save(path)


def main() -> None:
    names = ("radial-star", "ripple-wave", "cellular-growth", "rotating-diamond")
    for name in names:
        plan_locked(params_for(name)).save(OUT / f"{name}-plan.png")
        positions, _indices, report = build_unified(params_for(name), "draft")
        colors = report.pop("_colors")
        paint(positions, colors, "front", OUT / f"{name}-front.png")
        paint(positions, colors, "side", OUT / f"{name}-side.png")
        print(name, report["curve_count"], report["path_continuity"], report["printable_mesh"], report["width_mm"], report["height_mm"])


if __name__ == "__main__":
    main()

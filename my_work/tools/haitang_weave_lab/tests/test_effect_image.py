import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.effect_image import effect_png, frame_mask  # noqa: E402
from app.geometry.layers import preset_by_id  # noqa: E402


def test_effect_png_matches_the_product_plate():
    preset = preset_by_id("radial-star")
    assert preset is not None
    png = effect_png(
        {
            "pattern": preset["pattern"],
            "preset": "radial-star",
            "layers": [dict(item) for item in preset["layers"]],
            "geometry_lock": True,
            "target_height": 180,
            "seed": preset["seed"],
        }
    )
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    image = Image.open(io.BytesIO(png))
    assert image.size == (768, 1024)
    assert image.mode == "RGB"
    plate = np.asarray(Image.open(ROOT / "backend" / "app" / "assets" / "effect_plate.png").convert("RGB"))
    painted = np.asarray(image)
    metal = frame_mask(plate)
    assert int(metal.sum()) > 20000
    assert np.array_equal(painted[metal], plate[metal])

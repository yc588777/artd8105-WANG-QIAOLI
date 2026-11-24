import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "exports" / "audit"
OUT.mkdir(parents=True, exist_ok=True)


def post(path: str, payload: dict) -> bytes:
    req = urllib.request.Request(
        "http://127.0.0.1:8787" + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    return urllib.request.urlopen(req, timeout=180).read()


def main() -> None:
    print(urllib.request.urlopen("http://127.0.0.1:8787/api/health").read().decode())
    presets = json.load(urllib.request.urlopen("http://127.0.0.1:8787/api/weave/layer-presets"))
    base = {
        "geometry_lock": True,
        "print_safe": True,
        "t_max": 2.2,
        "target_height": 180,
        "density_u": 1.2,
        "strand_width_u": 1.6,
        "amplitude": 2.4,
        "frequency": 1.2,
        "weave_angle": 0,
        "crossing_locks": [],
        "seed": 7,
    }
    for item in presets[:5]:
        params = dict(base)
        params.update({"pattern": item["pattern"], "preset": item["id"], "layers": item["layers"], "seed": item["seed"]})
        raw = post("/api/weave/plan", {"params": params, "quality": "draft"})
        (OUT / f"{item['id']}.png").write_bytes(raw)
        print(item["id"], len(raw))
    low = [dict(row) for row in presets[0]["layers"]]
    high = [dict(row) for row in presets[0]["layers"]]
    low[1]["spoke_count"] = 10
    high[1]["spoke_count"] = 36

    def plan(layers):
        params = dict(base)
        params.update({"pattern": "radial", "preset": "radial-star", "layers": layers, "seed": 7})
        raw = post("/api/weave/plan", {"params": params, "quality": "draft"})
        return np.asarray(Image.open(io.BytesIO(raw)))

    a = plan(low)
    b = plan(high)
    print("spoke_changed", not np.array_equal(a, b), "diff_px", int(np.any(a != b, axis=2).sum()))


if __name__ == "__main__":
    main()

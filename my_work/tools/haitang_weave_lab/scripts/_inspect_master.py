"""Inspect the blank master so the guard and inner face can be separated from real triangles."""
from pathlib import Path

import numpy as np
from PIL import Image

MASTER = Path(r"E:\UM\UM-3\ATTICUS\homework\week_7\参数化扇子\灰边团扇正面模板-1.stl")
OUT = Path(__file__).resolve().parents[1] / "exports" / "master_bins.png"

dt = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
n = np.fromfile(MASTER, dtype="<u4", count=1, offset=80)[0]
rec = np.fromfile(MASTER, dtype=dt, count=int(n), offset=84)
v = rec["v"]
c = v.mean(axis=1)
x, y, z = c[:, 0], c[:, 1], c[:, 2]
print("tris", int(n))
print("min", c.min(0))
print("max", c.max(0))
print("ext", c.max(0) - c.min(0))

# width profile along Z
bins = 240
z0, z1 = float(z.min()), float(z.max())
zi = np.clip(((z - z0) / (z1 - z0) * (bins - 1)).astype(np.int32), 0, bins - 1)
width = np.zeros(bins)
for i in range(bins):
    sel = zi == i
    if sel.any():
        width[i] = float(x[sel].max() - x[sel].min())
peak = width.max()
for frac in (0.08, 0.12, 0.18, 0.28, 0.4, 0.55, 0.7):
    idx = int(np.argmax(width > peak * frac))
    print(f"width>{frac:.2f} z={z0 + (idx + 0.5) / bins * (z1 - z0):.4f} w={width[idx]:.4f}")

# raster occupancy and mean |thickness|
H, W = 360, 240
xi = np.clip(((x - x.min()) / (x.max() - x.min() + 1e-12) * (W - 1)).astype(np.int32), 0, W - 1)
zi2 = np.clip(((z - z.min()) / (z.max() - z.min() + 1e-12) * (H - 1)).astype(np.int32), 0, H - 1)
acc = np.zeros((H, W), np.float64)
cnt = np.zeros((H, W), np.int32)
ymin = np.full((H, W), 1e9)
ymax = np.full((H, W), -1e9)
np.add.at(acc, (zi2, xi), y)
np.add.at(cnt, (zi2, xi), 1)
np.minimum.at(ymin, (zi2, xi), y)
np.maximum.at(ymax, (zi2, xi), y)
thick = np.where(cnt > 0, ymax - ymin, 0)
print("thick p50/p90/p99", np.percentile(thick[cnt > 0], [50, 90, 99]))
Image.fromarray((cnt > 0).astype(np.uint8) * 255).save(OUT)
print("wrote", OUT)

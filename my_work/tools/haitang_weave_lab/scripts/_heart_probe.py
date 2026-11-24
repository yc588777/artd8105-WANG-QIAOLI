"""Probe which master triangles form the overlapping double-lobe guard."""
from pathlib import Path

import numpy as np

from app.geometry.master_lock import load_master, master_stl

master = load_master()
path = master_stl()
dt = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
count = int(np.fromfile(path, dtype="<u4", count=1, offset=80)[0])
rec = np.fromfile(path, dtype=dt, count=count, offset=84)
tris = np.asarray(rec["v"], dtype=np.float32)
normals = np.asarray(rec["n"], dtype=np.float32)
del rec
cent = tris.mean(axis=1)
x0, z0, pitch = master["x0"], master["z0"], master["pitch"]
inner = master["inner"]
h, w = inner.shape
cols = np.clip(np.rint((cent[:, 0] - x0) / pitch).astype(np.int32), 0, w - 1)
rows = np.clip(np.rint((cent[:, 2] - z0) / pitch).astype(np.int32), 0, h - 1)
inside = inner[rows, cols]
ny = np.abs(normals[:, 1])
y = cent[:, 1]
z = cent[:, 2]
print("tris", len(tris), "inside", int(inside.sum()))
print("y range", float(y.min()), float(y.max()), "inside y", float(y[inside].min()), float(y[inside].max()))
# Y histogram of inner triangles
bins = np.linspace(y.min(), y.max(), 21)
hist, edges = np.histogram(y[inside], bins=bins)
for i, c in enumerate(hist):
    print(f"y {edges[i]:+.4f}..{edges[i+1]:+.4f}  {c}")
print("inside |ny|>0.85", int(((ny > 0.85) & inside).sum()), "|ny|<0.5", int(((ny < 0.5) & inside).sum()))
flower_rows = np.nonzero(inner.any(1))[0]
z_lo = z0 + (flower_rows.min()) * pitch
z_hi = z0 + (flower_rows.max() + 1) * pitch
print("inner z", z_lo, z_hi, "rows", int(flower_rows.min()), int(flower_rows.max()))
band = inside & (z < z_lo + 0.22 * (z_hi - z_lo))
print("lower band", int(band.sum()), "flat", int((band & (ny > 0.85)).sum()), "tilted", int((band & (ny < 0.55)).sum()))
# proud of the front: two Y modes
front = y[inside & (ny > 0.9)]
print("flat y p05/p50/p95", np.percentile(front, [5, 50, 95]) if len(front) else None)
# How far above the median front do lower-band triangles sit?
from PIL import Image

out = Path(__file__).resolve().parents[1] / "exports"
out.mkdir(exist_ok=True)
for sign, name in ((1.0, "pos"), (-1.0, "neg")):
    sel = inside & (y * sign > 0.008)
    img = np.full((h, w), np.float32(-1))
    yy = y[sel] * sign
    rr = rows[sel]
    cc = cols[sel]
    # keep the proudest sample in each pixel
    order = np.argsort(yy)
    img[rr[order], cc[order]] = yy[order]
    vis = np.zeros((h, w, 3), np.uint8)
    known = img >= 0
    vis[known] = 40
    if known.any():
        lo, hi = np.percentile(img[known], [5, 95])
        t = np.clip((img - lo) / max(hi - lo, 1e-6), 0, 1)
        vis[known, 0] = (40 + t[known] * 200).astype(np.uint8)
        vis[known, 1] = (40 + (1 - np.abs(t[known] - 0.5) * 2) * 80).astype(np.uint8)
        vis[known, 2] = (40 + (1 - t[known]) * 160).astype(np.uint8)
    Image.fromarray(np.flipud(vis), "RGB").resize((w // 2, h // 2), Image.Resampling.BOX).save(out / f"heart_{name}.png")
    print(name, "pixels", int(known.sum()), "y", float(yy.min()), float(yy.max()))

# Centered lower window on each side: relief vs flat by local Y std
for sign, name in ((1.0, "pos"), (-1.0, "neg")):
    window = inside & (np.abs(cent[:, 0]) < 0.16) & (z < z_lo + 0.16 * (z_hi - z_lo)) & (y * sign > 0.01)
    upper = inside & (np.abs(cent[:, 0]) < 0.16) & (z > z_lo + 0.45 * (z_hi - z_lo)) & (z < z_lo + 0.7 * (z_hi - z_lo)) & (y * sign > 0.01) & (ny > 0.85)
    print(name, "window", int(window.sum()), "y std", float(y[window].std()) if window.any() else None, "ny med", float(np.median(ny[window])) if window.any() else None)
    print(name, "upper flat", int(upper.sum()), "y std", float(y[upper].std()) if upper.any() else None, "y med", float(np.median(y[upper])) if upper.any() else None)

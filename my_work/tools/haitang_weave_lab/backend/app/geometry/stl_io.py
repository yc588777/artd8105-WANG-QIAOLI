"""Binary STL read/write. Source files are never opened for writing."""
from __future__ import annotations

import hashlib
import struct
from pathlib import Path

import numpy as np


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_stl(path: Path) -> np.ndarray:
    data = path.read_bytes()
    if len(data) < 84:
        raise ValueError(f"Not an STL: {path}")
    count = struct.unpack_from("<I", data, 80)[0]
    if 84 + count * 50 == len(data):
        rec = np.dtype([("n", "<f4", (3,)), ("v", "<f4", (3, 3)), ("attr", "<u2")])
        arr = np.frombuffer(data, dtype=rec, count=count, offset=84)
        return np.array(arr["v"], dtype=np.float64, copy=True)
    raise ValueError(f"ASCII or truncated STL is not accepted: {path}")


def write_stl(path: Path, tris: np.ndarray, header: str = "HAITANG WEAVE LAB") -> None:
    tris = np.asarray(tris, dtype=np.float32)
    if tris.size == 0:
        raise ValueError("Refusing to write an empty STL")
    if tris.ndim != 3 or tris.shape[1:] != (3, 3):
        raise ValueError("Triangles must have shape (N, 3, 3)")
    path.parent.mkdir(parents=True, exist_ok=True)
    n = tris.shape[0]
    v0, v1, v2 = tris[:, 0], tris[:, 1], tris[:, 2]
    normals = np.cross(v1 - v0, v2 - v0).astype(np.float32)
    length = np.linalg.norm(normals, axis=1)
    normals /= np.maximum(length, 1e-12)[:, None]
    header_b = header.encode("ascii", errors="replace")[:80].ljust(80, b"\0")
    rec = np.empty(n, dtype=np.dtype([("n", "<f4", (3,)), ("v", "<f4", (3, 3)), ("attr", "<u2")]))
    rec["n"] = normals
    rec["v"] = tris
    rec["attr"] = 0
    with path.open("wb") as f:
        f.write(header_b)
        f.write(struct.pack("<I", n))
        f.write(rec.tobytes())


def triangle_bounds(tris: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    pts = tris.reshape(-1, 3)
    return pts.min(axis=0), pts.max(axis=0)

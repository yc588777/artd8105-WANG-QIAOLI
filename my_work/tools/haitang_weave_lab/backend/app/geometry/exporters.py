"""STL, geometry-only 3MF, and GLB writers."""
from __future__ import annotations

import json
import struct
import zipfile
from pathlib import Path

import numpy as np

from .stl_io import write_stl


def write_stl_from_indexed(path: Path, positions: np.ndarray, indices: np.ndarray) -> None:
    tris = positions[indices]
    edges = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    keep = np.linalg.norm(edges, axis=1) > 1e-5
    write_stl(path, tris[keep], header="HAITANG WEAVE LAB parametric fan")


def write_3mf(path: Path, objects: list[tuple[str, np.ndarray, np.ndarray]]) -> None:
    """Geometry-only 3MF. No printer profile, supports, or slice settings are embedded."""
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<model unit="millimeter" xml:lang="zh-CN" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
        '<metadata name="Application">HAITANG WEAVE LAB</metadata>',
        '<metadata name="Content">geometry only; no slice configuration</metadata>',
        "<resources>",
    ]
    for i, (name, positions, indices) in enumerate(objects, start=1):
        parts.append(f'<object id="{i}" type="model" name="{name}">')
        parts.append("<mesh><vertices>")
        for x, y, z in positions:
            parts.append(f'<vertex x="{float(x):.5f}" y="{float(y):.5f}" z="{float(z):.5f}"/>')
        parts.append("</vertices><triangles>")
        for a, b, c in indices:
            parts.append(f'<triangle v1="{int(a)}" v2="{int(b)}" v3="{int(c)}"/>')
        parts.append("</triangles></mesh></object>")
    parts.append("</resources><build>")
    for i in range(1, len(objects) + 1):
        parts.append(f'<item objectid="{i}"/>')
    parts.append("</build></model>")
    model = "\n".join(parts).encode("utf-8")
    content_types = b"""<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>"""
    rels = b"""<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("3D/3dmodel.model", model)


def _pad4(data: bytes, pad: bytes) -> bytes:
    return data + pad * ((4 - len(data) % 4) % 4)


def write_glb(path: Path, meshes: list[tuple[str, np.ndarray, np.ndarray]], transforms: list[list[float]] | None = None) -> None:
    """One GLB, several nodes. transforms are 16-float column-major matrices."""
    blobs = []
    buffer_views = []
    accessors = []
    primitives = []
    nodes = []
    offset = 0
    for name, positions, indices in meshes:
        pos = np.ascontiguousarray(positions, dtype=np.float32)
        idx = np.ascontiguousarray(indices.reshape(-1), dtype=np.uint32)
        pos_b = pos.tobytes()
        idx_b = idx.tobytes()
        blobs.append(pos_b)
        blobs.append(idx_b)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(pos_b), "target": 34962})
        offset += len(pos_b)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(idx_b), "target": 34963})
        offset += len(idx_b)
        pmin = pos.min(0).tolist()
        pmax = pos.max(0).tolist()
        accessors.append({"bufferView": len(buffer_views) - 2, "componentType": 5126, "count": int(len(pos)), "type": "VEC3", "min": pmin, "max": pmax})
        accessors.append({"bufferView": len(buffer_views) - 1, "componentType": 5125, "count": int(len(idx)), "type": "SCALAR"})
        primitives.append({"attributes": {"POSITION": len(accessors) - 2}, "indices": len(accessors) - 1, "mode": 4})
    gltf_meshes = []
    for i, (name, _, _) in enumerate(meshes):
        gltf_meshes.append({"name": name, "primitives": [primitives[i]]})
        node = {"name": name, "mesh": i}
        if transforms and i < len(transforms):
            node["matrix"] = transforms[i]
        nodes.append(node)
    gltf = {
        "asset": {"version": "2.0", "generator": "HAITANG WEAVE LAB"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "buffers": [{"byteLength": offset}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }
    json_chunk = _pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
    bin_chunk = _pad4(b"".join(blobs), b"\x00")
    out = b"glTF"
    out += struct.pack("<I", 2)
    out += struct.pack("<I", 12 + 8 + len(json_chunk) + 8 + len(bin_chunk))
    out += struct.pack("<I", len(json_chunk)) + b"JSON" + json_chunk
    out += struct.pack("<I", len(bin_chunk)) + b"BIN\x00" + bin_chunk
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)

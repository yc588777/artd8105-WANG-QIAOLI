"""Browser stand-in for the manifold3d package. The lab calls this API unchanged."""
from __future__ import annotations

import numpy as np
from js import Object
from pyodide.ffi import to_js


def _lib():
    import js

    lib = js.__manifold
    if lib is None:
        raise RuntimeError("manifold wasm is not ready")
    return lib


def _entries(values: dict):
    return to_js(values, dict_converter=Object.fromEntries)


def _f32(values) -> object:
    import js

    data = np.ascontiguousarray(values, dtype=np.float32).reshape(-1)
    return js.Float32Array.new(to_js(data))


def _u32(values) -> object:
    import js

    data = np.ascontiguousarray(values, dtype=np.uint32).reshape(-1)
    return js.Uint32Array.new(to_js(data))


class Error:
    NoError = "NoError"


class OpType:
    Add = "Add"


class FillRule:
    EvenOdd = "EvenOdd"


class Mesh:
    def __init__(self, vert_properties, tri_verts):
        self._js = _lib().Mesh.new(_entries({
            "numProp": 3,
            "vertProperties": _f32(vert_properties),
            "triVerts": _u32(tri_verts),
        }))


class _MeshOut:
    def __init__(self, vert_properties, tri_verts):
        self.vert_properties = vert_properties
        self.tri_verts = tri_verts


class CrossSection:
    def __init__(self, contours, fill_rule=FillRule.EvenOdd):
        self._js = _lib().CrossSection.new(to_js(contours), fill_rule)


class Manifold:
    def __init__(self, mesh=None, _js=None):
        if _js is not None:
            self._js = _js
        else:
            self._js = _lib().Manifold.new(mesh._js)

    def status(self):
        raw = str(self._js.status())
        return Error.NoError if raw == "NoError" else raw

    def volume(self) -> float:
        return float(self._js.volume())

    def rotate(self, angles):
        return Manifold(_js=self._js.rotate(to_js(list(angles))))

    def translate(self, offset):
        return Manifold(_js=self._js.translate(to_js(list(offset))))

    def to_mesh(self):
        mesh = self._js.getMesh()
        props = np.asarray(mesh.vertProperties.to_py(), dtype=np.float32)
        width = int(mesh.numProp)
        verts = props.reshape(-1, width)[:, :3].copy()
        tris = np.asarray(mesh.triVerts.to_py(), dtype=np.uint32).reshape(-1, 3).copy()
        return _MeshOut(verts, tris)

    def decompose(self):
        items = self._js.decompose()
        return [Manifold(_js=items[index]) for index in range(len(items))]

    @staticmethod
    def cube(size, center=False):
        return Manifold(_js=_lib().Manifold.cube(to_js(list(size)), bool(center)))

    @staticmethod
    def extrude(section, height):
        return Manifold(_js=_lib().Manifold.extrude(section._js, float(height)))

    @staticmethod
    def batch_boolean(parts, op):
        if op != OpType.Add:
            raise ValueError(op)
        solids = to_js([part._js for part in parts])
        return Manifold(_js=_lib().Manifold.union(solids))

    @staticmethod
    def compose(parts):
        solids = to_js([part._js for part in parts])
        return Manifold(_js=_lib().Manifold.compose(solids))

"""Headless check. Usage: blender --background --python blender/validate_mesh.py -- model.stl"""
import sys

import bpy
import bmesh

argv = sys.argv[sys.argv.index("--") + 1 :]
path = argv[0]
bpy.ops.wm.stl_import(filepath=path)
obj = bpy.context.selected_objects[0]
bm = bmesh.new()
bm.from_mesh(obj.data)
bm.verts.ensure_lookup_table()
bm.edges.ensure_lookup_table()
xs = [v.co.x for v in bm.verts]
ys = [v.co.y for v in bm.verts]
zs = [v.co.z for v in bm.verts]
boundary = sum(1 for edge in bm.edges if edge.is_boundary)
nonmanifold = sum(1 for edge in bm.edges if not edge.is_manifold)
print("OBJECT", obj.name)
print("VERTS", len(bm.verts))
print("FACES", len(bm.faces))
print("BMIN", round(min(xs), 4), round(min(ys), 4), round(min(zs), 4))
print("BMAX", round(max(xs), 4), round(max(ys), 4), round(max(zs), 4))
print("BOUNDARY", boundary)
print("NONMANIFOLD", nonmanifold)
bm.free()

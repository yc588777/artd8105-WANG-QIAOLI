"""用 Blender 默认圆柱体建一个 3D 模型并导出。

本应调用本地 Blender MCP 的 execute_blender_code。
这次 Cloud Agent 会话没有挂上 Blender MCP，所以改用
`blender --background --python` 跑同一段 bpy。

网格用 Blender 菜单 Add → Mesh → Cylinder 的出厂默认：
32 边，半径 1，高度 2，放在世界原点。
"""

from pathlib import Path

import bpy

OUT = Path(__file__).resolve().parent
LOCAL = Path(__file__).resolve().parents[2] / "_local"
LOCAL.mkdir(parents=True, exist_ok=True)

# 删掉启动场景里的立方体，只留圆柱。
bpy.ops.object.select_all(action="DESELECT")
for obj in list(bpy.data.objects):
    if obj.type == "MESH":
        obj.select_set(True)
bpy.ops.object.delete()

bpy.ops.mesh.primitive_cylinder_add(
    vertices=32,
    radius=1.0,
    depth=2.0,
    location=(0.0, 0.0, 0.0),
)

cylinder = bpy.context.object
cylinder.name = "Cylinder"

# 相机只为预览截图服务：拉远一点，让高度 2 的圆柱完整入画。
# 网格本身没有改。
if "Camera" in bpy.data.objects:
    cam = bpy.data.objects["Camera"]
    cam.location = (7.0, -7.0, 5.0)
    cam.rotation_euler = (1.1, 0.0, 0.785)

blend_path = LOCAL / "cylinder.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

bpy.ops.wm.obj_export(filepath=str(OUT / "cylinder.obj"), export_selected_objects=False)
bpy.ops.object.select_all(action="DESELECT")
cylinder.select_set(True)
bpy.context.view_layer.objects.active = cylinder
bpy.ops.export_mesh.stl(filepath=str(OUT / "cylinder.stl"), use_selection=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "cylinder.glb"),
    export_format="GLB",
    use_selection=True,
)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
for view_layer in scene.view_layers:
    view_layer.cycles.use_denoising = False
scene.render.resolution_x = 1200
scene.render.resolution_y = 1200
scene.render.filepath = str(OUT / "cylinder_preview.png")
scene.render.image_settings.file_format = "PNG"

bpy.ops.render.render(write_still=True)

print("CREATED", cylinder.name)
print("VERTS", len(cylinder.data.vertices))
print("FACES", len(cylinder.data.polygons))
print("RADIUS", 1.0)
print("DEPTH", 2.0)
print("BLEND", blend_path)
print("OBJ", OUT / "cylinder.obj")
print("STL", OUT / "cylinder.stl")
print("GLB", OUT / "cylinder.glb")
print("PREVIEW", OUT / "cylinder_preview.png")

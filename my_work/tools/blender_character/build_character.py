"""Build a chibi 3D figure from the uploaded black-and-gold reference.

Runs inside Blender via blender-mcp execute_code.
Colours, costume and chibi proportions follow the picture.
Fur is a velvet shader (not hair particles); embroidery is a few gold motifs.
"""

import os
import math
import bpy
import bmesh
from mathutils import Vector

OUT = "/workspace/my_work/tools/blender_character"


def principled(name, color, metallic=0.0, roughness=0.5, specular=0.5,
               emission=None, emission_strength=0.0, sheen=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = specular
    if sheen:
        if "Sheen Weight" in bsdf.inputs:
            bsdf.inputs["Sheen Weight"].default_value = sheen
        elif "Sheen" in bsdf.inputs:
            bsdf.inputs["Sheen"].default_value = sheen
    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emission, 1.0)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign(ob, mat):
    if ob.data and hasattr(ob.data, "materials"):
        if ob.data.materials:
            ob.data.materials[0] = mat
        else:
            ob.data.materials.append(mat)


def smooth(ob):
    if ob.type == "MESH":
        for p in ob.data.polygons:
            p.use_smooth = True


def name_ob(ob, name):
    ob.name = name
    if ob.data:
        ob.data.name = name
    return ob


def parent_to_root(ob, root):
    """Root sits at the origin, so local == world."""
    ob.parent = root


def subsurf(ob, levels=1):
    mod = ob.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels


def sphere(name, loc, radius, scale=(1, 1, 1), segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segs, ring_count=rings, radius=radius, location=loc
    )
    ob = name_ob(bpy.context.active_object, name)
    ob.scale = scale
    smooth(ob)
    return ob


def cylinder(name, loc, radius, depth, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot
    )
    ob = name_ob(bpy.context.active_object, name)
    smooth(ob)
    return ob


def torus(name, loc, major, minor, rot=(0, 0, 0), major_seg=28, minor_seg=10):
    bpy.ops.mesh.primitive_torus_add(
        location=loc,
        rotation=rot,
        major_radius=major,
        minor_radius=minor,
        major_segments=major_seg,
        minor_segments=minor_seg,
    )
    ob = name_ob(bpy.context.active_object, name)
    smooth(ob)
    return ob


def cube(name, loc, scale, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot, scale=scale)
    ob = name_ob(bpy.context.active_object, name)
    smooth(ob)
    return ob


def cone(name, loc, r1, r2, depth, verts=32):
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc
    )
    ob = name_ob(bpy.context.active_object, name)
    smooth(ob)
    return ob


def heart_mesh(name, loc, size, depth, mat, root):
    bm = bmesh.new()
    n = 64
    vs = []
    for i in range(n):
        t = 2.0 * math.pi * i / n
        x = 16.0 * (math.sin(t) ** 3)
        z = (
            13.0 * math.cos(t)
            - 5.0 * math.cos(2.0 * t)
            - 2.0 * math.cos(3.0 * t)
            - math.cos(4.0 * t)
        )
        vs.append(bm.verts.new((x / 18.0, 0.0, z / 18.0)))
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(vs)
    geom = bmesh.ops.extrude_face_region(bm, geom=[face])
    extruded = [v for v in geom["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=extruded, vec=(0.0, -depth, 0.0))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.update()
    ob.location = loc
    ob.scale = (size, 1.0, size)
    smooth(ob)
    assign(ob, mat)
    parent_to_root(ob, root)
    return ob


def make_smile(name, loc, mat, root):
    curve_data = bpy.data.curves.new(name + "Data", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = 0.007
    curve_data.bevel_resolution = 4
    curve_data.fill_mode = "FULL"
    sp = curve_data.splines.new("BEZIER")
    sp.bezier_points.add(2)
    coords = [(-0.055, 0.0, 0.012), (0.0, 0.0, -0.022), (0.055, 0.0, 0.012)]
    for bp, co in zip(sp.bezier_points, coords):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    name_ob(ob, name)
    assign(ob, mat)
    parent_to_root(ob, root)
    return ob


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.curves,
        bpy.data.objects,
    ):
        for block in list(coll):
            if getattr(block, "users", 1) == 0:
                coll.remove(block)


reset_scene()

# Colours read off the reference
MAT_SKIN = principled("Skin", (0.94, 0.80, 0.72), roughness=0.36, specular=0.42)
MAT_BLUSH = principled("Blush", (0.93, 0.62, 0.64), roughness=0.45)
MAT_HAIR = principled("Hair", (0.025, 0.018, 0.016), roughness=0.42)
MAT_VELVET = principled(
    "BlackVelvet", (0.015, 0.013, 0.016), roughness=0.70, sheen=0.9, specular=0.12
)
MAT_GOLD = principled("Gold", (0.84, 0.60, 0.18), metallic=1.0, roughness=0.26)
MAT_GOLD_SOFT = principled("GoldSoft", (0.76, 0.52, 0.16), metallic=1.0, roughness=0.40)
MAT_PEARL = principled("Pearl", (0.93, 0.89, 0.80), roughness=0.20, specular=0.85)
MAT_EYE = principled(
    "EyeWhite",
    (0.99, 0.97, 0.95),
    roughness=0.22,
)
MAT_HEART = principled(
    "HeartGlow",
    (1.0, 0.97, 0.93),
    roughness=0.12,
    emission=(1.0, 0.98, 0.94),
    emission_strength=2.4,
)
MAT_LID = principled("Lid", (0.90, 0.52, 0.55), roughness=0.38)
MAT_SHOE = principled("ShoeGold", (0.70, 0.48, 0.15), metallic=1.0, roughness=0.34)
MAT_MOUTH = principled("Mouth", (0.55, 0.24, 0.26), roughness=0.38)

bpy.ops.object.empty_add(type="ARROWS", location=(0, 0, 0))
root = name_ob(bpy.context.active_object, "Character")

# --- body: vinyl-toy chibi, ~2.1 m tall -------------------------------------

head = sphere("Head", (0, 0.0, 1.46), 0.38, scale=(1.00, 0.94, 1.02), segs=40, rings=22)
assign(head, MAT_SKIN)
subsurf(head, 1)
parent_to_root(head, root)

for side, tag in ((-1, "L"), (1, "R")):
    ear = sphere(
        f"Ear.{tag}",
        (side * 0.34, 0.02, 1.40),
        0.07,
        scale=(0.65, 0.8, 1.0),
        segs=16,
        rings=10,
    )
    assign(ear, MAT_SKIN)
    parent_to_root(ear, root)

for side, tag in ((-1, "L"), (1, "R")):
    blush = sphere(
        f"Blush.{tag}",
        (side * 0.20, -0.30, 1.34),
        0.055,
        scale=(1.15, 0.32, 0.75),
        segs=14,
        rings=8,
    )
    assign(blush, MAT_BLUSH)
    parent_to_root(blush, root)

nose = sphere("Nose", (0, -0.345, 1.40), 0.022, scale=(0.75, 0.6, 0.5), segs=10, rings=6)
assign(nose, MAT_SKIN)
parent_to_root(nose, root)

# Eyes sit on the front of the head (character faces -Y)
for side, tag in ((-1, "L"), (1, "R")):
    white = sphere(
        f"EyeWhite.{tag}",
        (side * 0.125, -0.325, 1.48),
        0.088,
        scale=(1.08, 0.28, 1.12),
        segs=24,
        rings=14,
    )
    assign(white, MAT_EYE)
    parent_to_root(white, root)
    heart_mesh(
        f"EyeHeart.{tag}",
        (side * 0.125, -0.355, 1.475),
        size=0.085,
        depth=0.18,
        mat=MAT_HEART,
        root=root,
    )
    lid = torus(
        f"Lid.{tag}",
        (side * 0.125, -0.335, 1.545),
        major=0.07,
        minor=0.012,
        rot=(math.radians(80), 0, 0),
        major_seg=18,
        minor_seg=8,
    )
    lid.scale = (1.2, 0.45, 0.55)
    assign(lid, MAT_LID)
    parent_to_root(lid, root)

make_smile("Mouth", (0.0, -0.355, 1.305), MAT_MOUTH, root)

for side, tag in ((-1, "L"), (1, "R")):
    loop = torus(
        f"HairLoop.{tag}",
        (side * 0.32, 0.0, 1.44),
        major=0.055,
        minor=0.026,
        rot=(math.radians(90), math.radians(side * 12), math.radians(side * 75)),
        major_seg=18,
        minor_seg=8,
    )
    assign(loop, MAT_HAIR)
    parent_to_root(loop, root)
    bang = sphere(
        f"Bang.{tag}",
        (side * 0.20, -0.26, 1.68),
        0.055,
        scale=(1.2, 0.5, 0.4),
        segs=12,
        rings=8,
    )
    assign(bang, MAT_HAIR)
    parent_to_root(bang, root)

neck = cylinder("Neck", (0, 0.0, 1.10), 0.10, 0.14, verts=20)
assign(neck, MAT_SKIN)
parent_to_root(neck, root)

# Jacket as a rounded box — vinyl toy torso
jacket = cube("Jacket", (0, 0.02, 0.90), (0.58, 0.32, 0.42))
assign(jacket, MAT_VELVET)
subsurf(jacket, 2)
parent_to_root(jacket, root)

collar = torus(
    "Collar",
    (0, 0.0, 1.10),
    major=0.135,
    minor=0.016,
    rot=(math.radians(8), 0, 0),
    major_seg=24,
    minor_seg=8,
)
assign(collar, MAT_GOLD)
parent_to_root(collar, root)

# Gold bands across chest and hem
for name, z, maj in (("TrimChest", 1.00, 0.20), ("TrimHem", 0.72, 0.22)):
    band = torus(
        name,
        (0, 0.02, z),
        major=maj,
        minor=0.01,
        rot=(0, 0, 0),
        major_seg=28,
        minor_seg=8,
    )
    assign(band, MAT_GOLD)
    parent_to_root(band, root)

for i, (x, z, r) in enumerate(((-0.14, 0.86, 0.028), (0.14, 0.86, 0.028), (0.0, 0.78, 0.022))):
    motif = torus(
        f"Motif.{i}",
        (x, -0.155, z),
        major=r,
        minor=0.006,
        rot=(math.radians(90), 0, 0),
        major_seg=14,
        minor_seg=6,
    )
    assign(motif, MAT_GOLD_SOFT)
    parent_to_root(motif, root)

for side, tag in ((-1, "L"), (1, "R")):
    sleeve = cylinder(
        f"Sleeve.{tag}",
        (side * 0.36, 0.02, 0.88),
        0.09,
        0.36,
        rot=(0, math.radians(side * 14), 0),
        verts=20,
    )
    assign(sleeve, MAT_VELVET)
    subsurf(sleeve, 1)
    parent_to_root(sleeve, root)
    cuff = torus(
        f"Cuff.{tag}",
        (side * 0.40, 0.02, 0.72),
        major=0.095,
        minor=0.012,
        rot=(0, math.radians(side * 12), 0),
        major_seg=18,
        minor_seg=8,
    )
    assign(cuff, MAT_GOLD)
    parent_to_root(cuff, root)
    bar = cube(
        f"ShoulderBar.{tag}",
        (side * 0.22, -0.12, 1.06),
        (0.18, 0.04, 0.028),
        rot=(0, 0, math.radians(side * -6)),
    )
    assign(bar, MAT_GOLD)
    parent_to_root(bar, root)
    hand = sphere(
        f"Hand.{tag}",
        (side * 0.44, 0.03, 0.68),
        0.055,
        scale=(1.0, 0.9, 0.85),
        segs=16,
        rings=10,
    )
    assign(hand, MAT_SKIN)
    parent_to_root(hand, root)

# Skirt: one bell + two gold bands (pleats read as stacked rings in v1; this is a skirt)
skirt = cone("Skirt", (0, 0.02, 0.34), r1=0.38, r2=0.22, depth=0.58, verts=36)
assign(skirt, MAT_VELVET)
parent_to_root(skirt, root)
for i, (z, maj) in enumerate(((0.50, 0.24), (0.32, 0.30), (0.14, 0.36))):
    g = torus(
        f"SkirtGold.{i}",
        (0, 0.02, z),
        major=maj,
        minor=0.008,
        rot=(0, 0, 0),
        major_seg=32,
        minor_seg=8,
    )
    assign(g, MAT_GOLD)
    parent_to_root(g, root)

for side, tag in ((-1, "L"), (1, "R")):
    shoe = sphere(
        f"Shoe.{tag}",
        (side * 0.09, -0.02, 0.05),
        0.075,
        scale=(1.05, 1.3, 0.5),
        segs=14,
        rings=8,
    )
    assign(shoe, MAT_SHOE)
    parent_to_root(shoe, root)

# --- hat: black crown + small side puffs, face stays readable ----------------
hat = sphere("Hat", (0, 0.0, 1.80), 0.36, scale=(1.12, 1.02, 0.55), segs=28, rings=16)
assign(hat, MAT_VELVET)
parent_to_root(hat, root)
for side, tag in ((-1, "L"), (1, "R")):
    puff = sphere(
        f"HatPuff.{tag}",
        (side * 0.36, 0.02, 1.78),
        0.15,
        scale=(1.0, 0.9, 0.85),
        segs=20,
        rings=12,
    )
    assign(puff, MAT_VELVET)
    parent_to_root(puff, root)

# Gold palmette — 11 rays in a scallop, in front of the hat, above the mask
fan_origin = Vector((0.0, -0.34, 1.86))
n_rays = 13
span = math.radians(168)
for i in range(n_rays):
    t = i / (n_rays - 1)
    ang = -span / 2 + span * t
    length = 0.20 + 0.16 * math.sin(math.pi * t)
    loc = fan_origin + Vector((math.sin(ang) * 0.08, -0.01, math.cos(ang) * 0.02 + 0.04))
    ray = cube(
        f"FanRay.{i}",
        tuple(loc),
        (0.014 + 0.010 * math.sin(math.pi * t), 0.045, length * 0.5),
        rot=(math.radians(58), 0, ang),
    )
    assign(ray, MAT_GOLD)
    parent_to_root(ray, root)

# Thin gold mask plate (not a sphere — v1 swallowed the face)
mask = cylinder(
    "Mask",
    (0, -0.34, 1.74),
    0.15,
    0.025,
    rot=(math.radians(80), 0, 0),
    verts=28,
)
mask.scale = (1.15, 1.0, 0.78)
assign(mask, MAT_GOLD)
parent_to_root(mask, root)
for side, tag in ((-1, "L"), (1, "R")):
    hole = sphere(
        f"MaskHole.{tag}",
        (side * 0.07, -0.355, 1.75),
        0.035,
        scale=(1.25, 0.35, 0.8),
        segs=10,
        rings=6,
    )
    assign(hole, MAT_HAIR)
    parent_to_root(hole, root)

# Gold fringe under the mask
for i in range(17):
    t = i / 16.0
    x = -0.18 + t * 0.36
    length = 0.09 + 0.02 * math.sin(t * math.pi)
    z = 1.62 - length * 0.45
    fringe = cylinder(f"Fringe.{i}", (x, -0.355, z), 0.006, length, verts=6)
    assign(fringe, MAT_GOLD_SOFT)
    parent_to_root(fringe, root)

# Earrings
for side, tag in ((-1, "L"), (1, "R")):
    pearl = sphere(f"EarringPearl.{tag}", (side * 0.36, -0.06, 1.32), 0.024, segs=10, rings=6)
    assign(pearl, MAT_PEARL)
    parent_to_root(pearl, root)
    drop = cylinder(f"EarringDrop.{tag}", (side * 0.36, -0.06, 1.24), 0.007, 0.10, verts=8)
    assign(drop, MAT_GOLD)
    parent_to_root(drop, root)
    tassel = cylinder(f"EarringTassel.{tag}", (side * 0.36, -0.06, 1.17), 0.014, 0.05, verts=8)
    assign(tassel, MAT_GOLD_SOFT)
    parent_to_root(tassel, root)

# Necklace as a hanging U on the chest (not a hula hoop)
for i in range(13):
    t = i / 12.0
    x = -0.14 + t * 0.28
    hang = 4.0 * t * (1.0 - t)
    z = 1.08 - 0.28 * hang
    y = -0.175 - 0.02 * hang
    bead = sphere(f"ChainBead.{i}", (x, y, z), 0.012, segs=8, rings=6)
    assign(bead, MAT_GOLD)
    parent_to_root(bead, root)

crescent = torus(
    "Crescent",
    (0, -0.20, 0.98),
    major=0.045,
    minor=0.010,
    rot=(math.radians(90), 0, 0),
    major_seg=18,
    minor_seg=8,
)
assign(crescent, MAT_GOLD)
parent_to_root(crescent, root)

for side, tag in ((-1, "L"), (1, "R")):
    coin = cylinder(
        f"Coin.{tag}",
        (side * 0.08, -0.20, 0.86),
        0.032,
        0.01,
        rot=(math.radians(90), 0, 0),
        verts=16,
    )
    assign(coin, MAT_GOLD)
    parent_to_root(coin, root)

heart_mesh("PendantHeart", (0.0, -0.21, 0.76), size=0.05, depth=0.16, mat=MAT_GOLD, root=root)

# --- camera / lights / world ------------------------------------------------

bpy.ops.object.camera_add(location=(0.0, -6.6, 1.15))
cam = name_ob(bpy.context.active_object, "Camera")
target = Vector((0.0, 0.0, 1.05))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 70
bpy.context.scene.camera = cam


def area_light(name, loc, energy, size, look_at):
    bpy.ops.object.light_add(type="AREA", location=loc)
    lamp = name_ob(bpy.context.active_object, name)
    lamp.data.energy = energy
    lamp.data.size = size
    lamp.rotation_euler = (Vector(look_at) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return lamp


area_light("Key", (2.4, -3.6, 3.4), 160, 2.6, (0, 0, 1.2))
area_light("Fill", (-3.0, -2.6, 2.1), 55, 3.4, (0, 0, 1.1))
area_light("Rim", (0.2, 3.2, 2.6), 80, 2.2, (0, 0, 1.3))

world = bpy.context.scene.world
if world is None:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.97, 0.96, 0.94, 1.0)
bg.inputs[1].default_value = 0.35

# Seamless studio: a white wall behind the figure, a white floor under the shoes.
wall = cube("StudioWall", (0.0, 3.2, 2.0), (8.0, 0.08, 6.0))
assign(wall, principled("StudioWhite", (0.97, 0.96, 0.94), roughness=1.0, specular=0.0))
floor = cube("StudioFloor", (0.0, 0.0, -0.04), (8.0, 8.0, 0.08))
assign(floor, principled("StudioFloor", (0.97, 0.96, 0.94), roughness=1.0, specular=0.0))

scene = bpy.context.scene
scene.view_settings.view_transform = "Filmic"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.0

os.makedirs(OUT, exist_ok=True)

glb_path = os.path.join(OUT, "character.glb")
obj_path = os.path.join(OUT, "character.obj")
stl_path = os.path.join(OUT, "character.stl")

bpy.ops.object.select_all(action="DESELECT")
for ob in bpy.data.objects:
    if ob.type == "MESH" and not ob.name.startswith("Studio"):
        ob.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
)
try:
    bpy.ops.wm.obj_export(filepath=obj_path, export_selected_objects=True)
except Exception:
    bpy.ops.export_scene.obj(filepath=obj_path, use_selection=True)
try:
    bpy.ops.export_mesh.stl(filepath=stl_path, use_selection=True)
except Exception as exc:
    print("STL_SKIP", exc)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 56
scene.cycles.use_denoising = False
scene.render.resolution_x = 864
scene.render.resolution_y = 1152
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(OUT, "character_front.png")
bpy.ops.render.render(write_still=True)

cam.location = (2.55, -5.6, 1.35)
cam.rotation_euler = (Vector((0, 0, 1.05)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = os.path.join(OUT, "character_threequarter.png")
bpy.ops.render.render(write_still=True)

print("CHAR_OK meshes=%d" % sum(1 for o in bpy.data.objects if o.type == "MESH"))
print("CHAR_OK glb=" + glb_path)

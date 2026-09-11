"""Run with Blender --background --factory-startup --python this.py -- --addon DIR --model FILE --motions DIR --output FILE.

Imports the actual VRM and bakes Trick Lab world matrices into editable bones.
Source rest matrices preserve Blender's imported bone roll conventions. The
character root is already in the sampled matrices; never apply it a second time.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--addon', required=True)
parser.add_argument('--model', required=True)
parser.add_argument('--motions', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
sys.path.insert(0, args.addon)
import addon_utils
addon_utils.enable('io_scene_vrm', default_set=True, persistent=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
assert bpy.ops.import_scene.vrm(filepath=args.model) == {'FINISHED'}
# The add-on's shader setup may recreate Blender's default cube on first use.
cube = bpy.data.objects.get('Cube')
if cube and cube.type == 'MESH' and not cube.modifiers and not cube.parent:
    bpy.data.objects.remove(cube, do_unlink=True)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.name = 'Kaori - editable motion'
arm.show_in_front = True
mapping = {k.value: v.node.bone_name for k, v in arm.data.vrm_addon_extension.vrm1.humanoid.human_bones.human_bone_name_to_human_bone().items() if v.node.bone_name}
rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
bones = sorted(arm.data.bones, key=lambda b: len(b.parent_recursive))
# Three/glTF Y-up -> Blender Z-up; all arrays from three.js are column-major.
C = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def matrix(values):
    return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()

bpy.ops.object.empty_add()
board = bpy.context.object
board.name = 'Snowboard - independent motion'
bpy.ops.mesh.primitive_cube_add(size=1)
deck = bpy.context.object
deck.name = 'Snowboard deck'
deck.dimensions = (1.15, .26, .025)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
deck.parent = board
mat = bpy.data.materials.new('Kaori pink deck')
mat.diffuse_color = (.8,.22,.43,1)
mat.use_nodes=True
mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color
deck.data.materials.append(mat)
bevel = deck.modifiers.new('Soft deck edges', 'BEVEL'); bevel.width=.025; bevel.segments=3
for x in [-.24,.24]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,0,.035))
    binding=bpy.context.object; binding.name='Binding'; binding.dimensions=(.14,.14,.05)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    binding.parent=board

scene=bpy.context.scene
scene.render.fps=30
scene.unit_settings.system='METRIC'
arm.animation_data_create(); board.animation_data_create()
armTrack=arm.animation_data.nla_tracks.new(); armTrack.name='Reviewed source takes - edit action to refine'
boardTrack=board.animation_data.nla_tracks.new(); boardTrack.name='Matching board takes'
cursor=1
checks=[]
for trick in ['ollie','indy','backside-360']:
    path=Path(args.motions)/(trick+'.motion.json')
    data=json.loads(path.read_text())
    if data['version']!=1 or data['space']!='three-world-column-major-y-up': raise ValueError('Unsupported motion format')
    action=bpy.data.actions.new(trick+' | body'); action.use_fake_user=True
    propAction=bpy.data.actions.new(trick+' | board'); propAction.use_fake_user=True
    arm.animation_data.action=action; board.animation_data.action=propAction
    restSource={k:matrix(v) for k,v in data['restBones'].items()}
    expected=[]
    for i,sample in enumerate(data['samples']):
        frame=1+sample['time']*30
        desired={}
        targets={}
        for human, values in sample['bones'].items():
            name=mapping.get(human)
            if name:
                targets[name]=C @ matrix(values) @ restSource[human].inverted() @ C.inverted() @ rest[name]
        for bone in bones:
            parent=bone.parent
            target=targets.get(bone.name)
            if target is None:
                target=desired[parent.name] @ rest[parent.name].inverted() @ rest[bone.name] if parent else rest[bone.name]
            desired[bone.name]=target
            if bone.name not in targets: continue
            pb=arm.pose.bones[bone.name]
            kwargs={'parent_matrix':desired[parent.name], 'parent_matrix_local':rest[parent.name]} if parent else {}
            pb.rotation_mode='QUATERNION'
            pb.matrix_basis=bone.convert_local_to_pose(target, rest[bone.name], invert=True, **kwargs)
            pb.keyframe_insert('location',frame=frame)
            pb.keyframe_insert('rotation_quaternion',frame=frame)
            pb.keyframe_insert('scale',frame=frame)
        board.matrix_world=C @ matrix(sample['board']) @ C.inverted()
        board.rotation_mode='QUATERNION'
        board.keyframe_insert('location',frame=frame)
        board.keyframe_insert('rotation_quaternion',frame=frame)
        board.keyframe_insert('scale',frame=frame)
        if i in [0,len(data['samples'])//2,len(data['samples'])-1]: expected.append((frame,targets))
    # Check actual evaluated bones against exported targets before assembling NLA.
    max_error=0
    max_angle=0
    for frame,targets in expected:
        scene.frame_set(int(frame), subframe=frame-int(frame))
        bpy.context.view_layer.update()
        for name,target in targets.items():
            max_error=max(max_error,(arm.pose.bones[name].matrix.translation-target.translation).length)
            max_angle=max(max_angle,arm.pose.bones[name].matrix.to_quaternion().rotation_difference(target.to_quaternion()).angle)
    checks.append({'trick':trick,'samples':len(data['samples']),'max_position_error_m':max_error,'max_rotation_error_rad':max_angle})
    if max_error > .001 or max_angle > .005: raise RuntimeError(f'{trick}: bone conversion error {max_error}m / {max_angle}rad')
    arm.animation_data.action=None; board.animation_data.action=None
    bodyStrip=armTrack.strips.new(trick,cursor,action)
    propStrip=boardTrack.strips.new(trick,cursor,propAction)
    for strip in [bodyStrip,propStrip]:
        strip.extrapolation='NOTHING'; strip.blend_type='REPLACE'
    scene.timeline_markers.new(trick.upper(),frame=cursor)
    cursor=math.ceil(bodyStrip.frame_end)+1

scene.frame_start=1; scene.frame_end=cursor-1
scene.frame_set(25)
# A usable inspection view and lighting, plus packed image assets.
bpy.ops.mesh.primitive_plane_add(size=10)
floor=bpy.context.object; floor.name='Ground reference'; floor.location.z=-.02
floorMat=bpy.data.materials.new('Ground'); floorMat.diffuse_color=(.07,.09,.13,1); floorMat.use_nodes=True; floorMat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=floorMat.diffuse_color; floor.data.materials.append(floorMat)
bpy.ops.object.camera_add(location=(2.6,-2.6,1.9))
cam=bpy.context.object; cam.name='Review camera'; cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.lens=55; scene.camera=cam
for location,energy,size in [((2,-3,5),800,5),((-3,1,3),600,4)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light=bpy.context.object; light.data.energy=energy; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES'; scene.cycles.samples=16
scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.world.color=(.15,.15,.15)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=3.4
            area.spaces.active.region_3d.view_location=(0,0,.9)
            area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
            area.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); bpy.context.view_layer.objects.active=arm
notes=bpy.data.texts.new('START HERE - TrickBook')
notes.write('Kaori motion workshop\n\nTimeline: ollie, indy, backside 360. Space plays.\nEach body/board take is a separate Action in matching NLA strips.\nUse the Animation workspace and NLA tweak mode to edit a take.\nThese are baked source motions, not rider-approved finished tricks.\nThe board has its own animation; keep it aligned when editing feet.\nPose bones are editable; a dedicated IK control rig is not included yet.\nSource root motion is baked into the body. Do not add it again.\n\nConversion checks:\n'+json.dumps(checks,indent=2))
bpy.ops.file.pack_all()
output=Path(args.output); output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
output.with_suffix('.validation.json').write_text(json.dumps(checks,indent=2))
print('WORKSHOP_READY',str(output),json.dumps(checks))

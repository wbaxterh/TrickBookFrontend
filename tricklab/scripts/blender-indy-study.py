"""Author an indy study from existing motion; board-relative contact, no copied game assets."""
import sys, math, json, argparse
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Quaternion
parser=argparse.ArgumentParser();parser.add_argument('--workspace',required=True);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);base=Path(args.workspace)
sys.path.insert(0,str(base/'work/blender-addon/unpacked'))
import addon_utils
addon_utils.enable('io_scene_vrm',default_set=True,persistent=True)
bpy.ops.wm.open_mainfile(filepath=str(base/'outputs/Kaori-Motion-Workshop.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE'); board=bpy.data.objects['Snowboard - independent motion']; scene=bpy.context.scene
for obj in [arm,board]:
    for track in obj.animation_data.nla_tracks: track.mute=True
mapping={k.value:v.node.bone_name for k,v in arm.data.vrm_addon_extension.vrm1.humanoid.human_bones.human_bone_name_to_human_bone().items() if v.node.bone_name}
arm.animation_data.action=bpy.data.actions['indy | body']; board.animation_data.action=bpy.data.actions['indy | board']
bones=sorted(arm.data.bones,key=lambda b:len(b.parent_recursive)); captures=[]
for frame in range(1,121):
    scene.frame_set(frame); bpy.context.view_layer.update()
    captures.append(({b.name:arm.pose.bones[b.name].matrix.copy() for b in bones},board.matrix_world.copy()))
arm.animation_data.action.name='indy | original body'; board.animation_data.action.name='indy | original board'
a=bpy.data.actions.new('indy | body'); a.use_fake_user=True; arm.animation_data.action=a
ba=bpy.data.actions.new('indy | board');ba.use_fake_user=True;board.animation_data.action=ba

def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def weight(t):return smooth((t-1.43)/.38)*(1-smooth((t-2.36)/.40))
def aim(original,start,end):
    old=original.to_quaternion(); olddir=old @ Vector((0,1,0))
    q=olddir.rotation_difference((end-start).normalized()) @ old
    return Matrix.LocRotScale(start,q,original.to_scale())
def solve(original,upper,lower,tip,target,shift,bend=None):
    A=original[upper].translation+shift;B=original[lower].translation+shift;D=original[tip].translation+shift
    l1=(B-A).length;l2=(D-B).length;v=target-A;distance=v.length;axis=v.normalized();d=max(.001,min(distance,l1+l2-.0001))
    direction=bend if bend is not None else B-A
    pole=direction-axis*direction.dot(axis)
    if pole.length<.0001:pole=Vector((0,-1,0))-axis*axis.dot(Vector((0,-1,0)))
    pole.normalize();along=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-along*along))
    knee=A+axis*along+pole*height;end=A+axis*d
    return {upper:aim(original[upper],A,knee),lower:aim(original[lower],knee,end)},end,distance-(l1+l2)
checks=[]
for index,(original,bmat) in enumerate(captures):
    frame=index+1;t=index/30;w=weight(t);shift=Vector((0,0,-.13*w));lift=Vector((0,0,.34*w));targets={}
    hips=mapping['hips']
    pivot=original[hips].translation
    axis=bmat.to_quaternion() @ Vector((1,0,0))
    torso=Matrix.Translation(pivot) @ Quaternion(axis,.65*w).to_matrix().to_4x4() @ Matrix.Translation(-pivot)
    spine=mapping['spine']
    original={name:(torso @ mat if name==spine or any(p.name==spine for p in arm.data.bones[name].parent_recursive) else mat.copy()) for name,mat in original.items()}
    targets[hips]=original[hips].copy();targets[hips].translation+=shift
    for side in ['left','right']:
        u,l,f=[mapping[side+n] for n in ['UpperLeg','LowerLeg','Foot']]
        foot=original[f].copy();foot.translation+=lift
        solved,end,_=solve(original,u,l,f,foot.translation,shift,(original[l].translation-original[u].translation).normalized().lerp(bmat.to_quaternion() @ Vector((0,-1,.6)),w));targets.update(solved);targets[f]=foot
    bmat.translation+=lift
    wrist=mapping['rightHand'];u=mapping['rightUpperArm'];l=mapping['rightLowerArm']
    contact=bmat @ Vector((0,-.145,.075))
    goal=(original[wrist].translation+shift).lerp(contact,w)
    solved,end,overreach=solve(original,u,l,wrist,goal,shift);targets.update(solved)
    hand=original[wrist].copy();hand.translation=end;targets[wrist]=hand
    desired={}
    for bone in bones:
        parent=bone.parent
        if bone.name in targets: target=targets[bone.name]
        elif parent: target=desired[parent.name] @ original[parent.name].inverted() @ original[bone.name]
        else: target=original[bone.name]
        desired[bone.name]=target;pb=arm.pose.bones[bone.name];pb.rotation_mode='QUATERNION'
        kwargs={'parent_matrix':desired[parent.name],'parent_matrix_local':parent.matrix_local} if parent else {}
        pb.matrix_basis=bone.convert_local_to_pose(target,bone.matrix_local,invert=True,**kwargs)
        for channel in ['location','rotation_quaternion','scale']:pb.keyframe_insert(channel,frame=frame)
    board.matrix_world=bmat;board.rotation_mode='QUATERNION'
    for channel in ['location','rotation_quaternion','scale']:board.keyframe_insert(channel,frame=frame)
    if w>.999: checks.append({'frame':frame,'wrist_target_error_m':(end-contact).length,'reach_excess_m':max(0,overreach)})
for check in checks:
    scene.frame_set(check['frame']);bpy.context.view_layer.update()
    contact=board.matrix_world @ Vector((0,-.145,.075))
    check['evaluated_wrist_error_m']=(arm.pose.bones[mapping['rightHand']].matrix.translation-contact).length
    if check['evaluated_wrist_error_m']>.002:raise RuntimeError('Wrist target validation failed: '+str(check))
scene.frame_start=1;scene.frame_end=120;scene.frame_set(64)
# Focused board-contact study; source remains in the original workshop.
scene.camera.location=(2.2,-3.1,1.8);scene.camera.rotation_euler=(Vector((0,0,1))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_location=(0,0,1)
            area.spaces.active.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
            area.spaces.active.region_3d.view_distance=3.4
notes=bpy.data.texts.new('INDY STUDY - reference and limits')
notes.write('Reference: Snowboard Addiction Basic Grabs, https://www.youtube.com/watch?v=UNItNopAeDU around 1:52-2:02.\nOriginal authored study, not motion capture or exact footage timing.\nBoard comes upward during tuck; rear wrist aims at toe edge between bindings.\nWrist is a proxy: finger wrapping and clothing collisions still need artist review.\nOriginal actions are preserved with original in their names.\n'+json.dumps(checks,indent=2))
output=base/'outputs/Kaori-Indy-Reference-Study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(output))
(base/'outputs/Kaori-Indy-Reference-Study.validation.json').write_text(json.dumps(checks,indent=2))
scene.render.filepath=str(base/'outputs/Kaori-Indy-Reference-Study.png');bpy.ops.render.render(write_still=True)
print('INDY_STUDY',len(checks),max(c['wrist_target_error_m'] for c in checks))

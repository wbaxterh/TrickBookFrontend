"""Export workshop Actions back to VRMA + a separate board track for the lab."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix
p=argparse.ArgumentParser(); p.add_argument('--addon',required=True); p.add_argument('--input',required=True); p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
sys.path.insert(0,a.addon)
import addon_utils
addon_utils.enable('io_scene_vrm',default_set=True,persistent=True)
bpy.ops.wm.open_mainfile(filepath=a.input)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
board=bpy.data.objects['Snowboard - independent motion']
for obj in [arm,board]:
    for track in obj.animation_data.nla_tracks: track.mute=True
scene=bpy.context.scene; scene.render.fps=30
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
folder=Path(a.output);folder.mkdir(parents=True,exist_ok=True)
for trick in ['ollie','indy','backside-360']:
    arm.animation_data.action=bpy.data.actions[trick+' | body']
    board.animation_data.action=bpy.data.actions[trick+' | board']
    scene.frame_start=1;scene.frame_end=math.ceil(arm.animation_data.action.frame_range[1])
    bpy.context.view_layer.objects.active=arm;arm.select_set(True)
    result=bpy.ops.export_scene.vrma(filepath=str(folder/(trick+'.vrma')),armature_object_name=arm.name)
    if result!={'FINISHED'}:raise RuntimeError(str(result))
    samples=[]
    for frame in range(1,scene.frame_end+1):
        scene.frame_set(frame)
        m=C.inverted() @ board.matrix_world @ C
        samples.append({'time':(frame-1)/30,'matrix':[m[r][c] for c in range(4) for r in range(4)]})
    (folder/(trick+'.board.json')).write_text(json.dumps({'version':1,'trick':trick,'samples':samples}))
    print('EXPORTED',trick,scene.frame_end)

# Kaori motion workshop

The lab uses the mobile app's procedural engine. It adds duration-aware playback, frame stepping, reference-video scrubbing, grab controls, portable tuning presets, and a Blender round trip. It does not publish changes into either app.

## Run the lab

From `tricklab`: `npm ci`, then `npm run dev -- --port 3012`. The model preparation script copies the repository's Kaori asset into ignored public storage. Open http://127.0.0.1:3012.

Choose a trick and use the timeline, speed, camera and tuning controls. Tuning values affect trick families, not just the selected trick. Download a preset to keep a portable copy. Browser storage saves finished slider changes. Local reference clips can be synchronized using start offset and trick span; direct video URLs must be browser-playable.

## Blender round trip

Requires Blender 5.2 and the official VRM add-on (tested with 4.7.1). `--addon` is a directory containing the importable `io_scene_vrm` package. The scripts enable it in their process; no global preferences are saved.

1. Export ollie, indy and backside-360 from the lab. The local development server saves `exports/{trick}.motion.json`.
2. From the repository root, run:

```text
blender --background --factory-startup --python tricklab/scripts/blender-import.py -- --addon ADDON_DIR --model assets/models/kaori.vrm --motions tricklab/exports --output WORKSHOP.blend
```

The importer creates a fresh scene. Use a new output filename when rebuilding to preserve edits. Body and snowboard Actions are paired in NLA strips. Open the Animation workspace, select the relevant NLA strip and enter tweak mode to edit its Action. Keep the original Action names for export. Save an edited copy of the workshop.

3. Export that saved copy:

```text
blender --background --factory-startup --python tricklab/scripts/blender-export.py -- --addon ADDON_DIR --input WORKSHOP.blend --output tricklab/public/returns
```

4. Select the corresponding trick in the lab and click **Load Blender take**. Compare with **Procedural motion** at the same timeline position. Re-export and reload after edits. Body motion uses VRMA; the snowboard uses a separate sampled track.

## Scope and verification

The starter workshop covers three snowboard tricks. The browser still offers all 50 procedural tricks. Blender scripts currently expect the three starter names; arbitrary trick selection, character retargeting, dedicated IK controls, mobile playback of returned clips and website integration remain future work. These are existing motions made editable, not rider-approved improved demonstrations.

Source matrices include root motion. The importer converts Y-up to Z-up, preserves imported bone-roll conventions and validates first/middle/last samples to within 1 mm and 0.005 radians. Dense 30 fps keys preserve the starting motion; refine or simplify curves deliberately. Hair physics is excluded from deterministic source sampling. VRMA export rounds clip ends to the next 30 fps frame.

`npm test` checks finite poses for 50 tricks at 101 timestamps, shared root calculations, playback speed and preset rejection. `npm run build` verifies the lab bundle. Without the root Expo installation, Vite may warn about its missing parent config; the standalone lab supplies its own transform settings. A large 3D bundle warning is expected. A browser build is not a mobile-device test.

## Reference-informed indy study

`blender-indy-study.py --workspace WORKSPACE` is a local workshop experiment. It expects `outputs/Kaori-Motion-Workshop.blend` and `work/blender-addon/unpacked` under that workspace and writes a separate `outputs/Kaori-Indy-Reference-Study.blend`. Run it through Blender with `--background --factory-startup --python` and pass script arguments after `--`. It preserves the original workshop and uses authored two-bone solutions, not extracted third-party motion. Its wrist-target validation does not validate finger contact or clothing collisions. Export this study through `blender-export.py` to review it in the browser. The experiment deliberately retains local workspace layout assumptions; it is not a general character-retargeting tool.

## Shared grab contact correction

Airborne grabs now deepen knee flexion, lift both legs, and solve a bounded torso lean plus a two-bone arm reach toward a board-relative wrist target. Limb lengths are preserved. This runs in the shared mobile pose engine used by the lab; it does not update already baked Blender takes. Grounded handplants are excluded. Nosebone/crail/roast-beef styling has been moderated to make the target reachable on Kaori.

**Check all grabs** samples full-hold frames on the loaded character and saves `exports/grab-contact-audit.motion.json`. It measures normalized wrist-to-target distance, not finger wrapping, collision-free reach paths or mobile frame rate. The current Kaori check covers 16 airborne grab animations and 361 full-hold samples. Finger posing and per-trick artistic review remain necessary. Use **Procedural motion** to see the correction and export again when rebuilding Blender takes.

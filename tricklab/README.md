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

The procedural engine now solves both ankles to a rigid 0.48 m stance, keeps their orientation aligned with the duck-stance bindings, and lifts the board as a single rigid object. The knees bend up and outward instead of crossing inward. Arm reach follows a curved path with an elbow bend selected against leg capsules; the hand rolls and the fingers close at the edge. Fixed body profiles replace the torso optimizer that could twist Kaori sideways to reach a target.

`src/components/companion/grabProfiles.ts` contains Kaori-scale body/contact calibration. Toe, heel, tip and cross-body grabs have separate profiles. Through-knee reaches open the knee corridor first and use a continuous authored elbow direction. These values are character-specific, not a general retargeter for future companions. Airborne reach no longer uses the old handplant-angle sliders; those and the free-arm controls are labeled separately.

**Check all grabs** samples 401 timeline positions for each trick and checks every airborne reach/hold/release frame with at least 10% grab weight. It checks rendered/raw ankle spacing as well as normalized wrist reach and conservative leg-capsule clearance. Results go to `exports/grab-contact-audit.motion.json`. These are geometric guides, not mesh collision certification or proof of correct trick technique.

**Reach**, **50%**, and **Release** bookmark the review phases. **Front**, **Side**, and **Detail** frame the rider; **Hide reference** enlarges the review area. **Save pose image** writes the current rendered PNG as a data URL in an export JSON record. **Export selected trick** saves the current body/board take, with the normalized bind-pose hierarchy included for reproducible rig checks. Previously baked Blender takes remain unchanged; export again before rebuilding them.

`npm test` also exercises Kaori's exported normalized skeleton over 20,050 poses (50 tricks x 401 positions). It checks binding spacing, unchanged bone lengths, finite transforms, arm/leg capsule clearance, knee ordering, held wrist reach, elbow continuity, repeated application without accumulating rotations, and covariance under root spins/flips. Screenshot review remains necessary for clothing, palm/finger placement and artistic fidelity. The tests cover full riding stance; entry/exit blending and mobile-device performance still need device review.
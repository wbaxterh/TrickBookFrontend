import { grabContactDistances, riderClearance } from '../../src/components/companion/grabContact';
/**
 * Kaori Trick Lab — a browser live-tuner for the procedural trick animations.
 *
 * It imports the EXACT pose engine the app uses (riderFundamentals +
 * trickAnimations), loads Kaori's VRM, and drives a selected trick over t=0..1.
 * Every arm knob (ARM_TUNING) is a live slider, so you tune the motion in real
 * time next to a reference clip — then paste the exported values back into
 * riderFundamentals.ts. No mobile rebuild, no device.
 */

import { type VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { advanceTime, validatePreset } from './workflow';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

import {
  ARM_TUNING,
  ARM_TUNING_BS,
  GRAB_TUNING,
  applyRiderPose,
  resetRiderBones,
  STANCE_YAW,
} from '../../src/components/companion/riderFundamentals';
import {
  HEAD_TUNING,
  HEAD_TUNING_BS,
  STYLE_BS,
  TRICKS,
  riderRootAt,
} from '../../src/components/companion/trickAnimations';

// ---- three.js scene ----
const stage = document.getElementById('stage') as HTMLDivElement;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20242c);

const camera = new THREE.PerspectiveCamera(30, stage.clientWidth / stage.clientHeight, 0.1, 100);
camera.position.set(0, 1.15, 5.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x424655, 1.3));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(1.5, 2.5, 2);
scene.add(key);
scene.add(new THREE.GridHelper(6, 12, 0x3a3f48, 0x2a2e35));

// ---- load Kaori's VRM ----
let vrm: VRM | null = null;
let restBones: Record<string, number[]> = {};
let normalizedRest: any = {};
let returned: { mixer: THREE.AnimationMixer; action: THREE.AnimationAction; duration: number; board: Array<{ time: number; matrix: number[] }> } | null = null;
let showingBlender = false;
function currentDuration() { return showingBlender && returned ? returned.duration : TRICKS[state.trick as keyof typeof TRICKS].duration; }
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.load(
  '/kaori.vrm',
  (gltf) => {
    vrm = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    scene.add(vrm.scene);
    vrm.scene.updateMatrixWorld(true);
    restBones = boneMatrices();
    const names = Object.keys(vrm.humanoid.humanBones);
    normalizedRest = Object.fromEntries(names.map(name => {
      const node = vrm!.humanoid.getNormalizedBoneNode(name as any)!;
      return [name, { position: node.position.toArray(), quaternion: node.quaternion.toArray(), parent: names.find(n => vrm!.humanoid.getNormalizedBoneNode(n as any) === node.parent) ?? null }];
    }));
    status('Kaori ready. Choose a trick, then scrub or export it to Blender.');
  },
  undefined,
  (err) => { console.error(err); status('Could not load Kaori. Run npm run prepare:model and reload.'); },
);

// ---- snowboard, locked to her feet (like KaoriStage) so the leg tweaks read ----
const board = new THREE.Group();
board.add(
  new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.025, 0.26),
    new THREE.MeshStandardMaterial({ color: 0xf48fb8, roughness: 0.6 }),
  ),
);
for (const bx of [0.24, -0.24]) {
  const bind = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x141414 }),
  );
  bind.position.set(bx, 0.035, 0);
  bind.rotation.y = bx > 0 ? -0.18 : 0.18;
  board.add(bind);
}
board.visible = false;
scene.add(board);

const _lp = new THREE.Vector3();
const _rp = new THREE.Vector3();
const _along = new THREE.Vector3();
const _bodyUp = new THREE.Vector3();
const _up2 = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();
// Board long axis (+X) = the foot-to-foot line (tilts when a foot lifts → the
// nose/tail tweak); up derives from the body so it rolls through spins/flips.
function lockBoardToFeet() {
  if (!vrm) return;
  const lf = vrm.humanoid.getRawBoneNode('leftFoot');
  const rf = vrm.humanoid.getRawBoneNode('rightFoot');
  if (!lf || !rf) return;
  lf.getWorldPosition(_lp);
  rf.getWorldPosition(_rp);
  _along.subVectors(_lp, _rp); // right(tail) → left(nose) = board +X (regular stance)
  if (_along.lengthSq() < 1e-6) return;
  _along.normalize();
  _bodyUp.set(0, 1, 0).applyQuaternion(vrm.scene.quaternion);
  _z.crossVectors(_along, _bodyUp);
  if (_z.lengthSq() < 1e-5) return; // near-degenerate — keep last orientation
  _z.normalize();
  _up2.crossVectors(_z, _along).normalize();
  _basis.makeBasis(_along, _up2, _z);
  board.quaternion.setFromRotationMatrix(_basis);
  board.position.addVectors(_lp, _rp).multiplyScalar(0.5).addScaledVector(_up2, -0.07);
  board.visible = true;
}

// ---- controls / state ----
// speed ≈ 1/duration plays a trick near real-time; the scrubber t is normalized.
const state = { trick: 'ollie', t: 0, playing: true, speed: 1, referenceSync: true, referenceOffset: 0, referenceSpan: 4.2 };
// Dev hook: lets the console / automation scrub the lab precisely.
(window as unknown as { __lab: typeof state }).__lab = state;
(window as unknown as { __TRICKS: typeof TRICKS }).__TRICKS = TRICKS;
(window as unknown as { __STANCE_YAW: number }).__STANCE_YAW = STANCE_YAW;
(window as unknown as { __ARM: typeof ARM_TUNING }).__ARM = ARM_TUNING;
(window as unknown as { __ARM_BS: typeof ARM_TUNING_BS }).__ARM_BS = ARM_TUNING_BS;
(window as unknown as { __HEAD: typeof HEAD_TUNING }).__HEAD = HEAD_TUNING;
(window as unknown as { __HEAD_BS: typeof HEAD_TUNING_BS }).__HEAD_BS = HEAD_TUNING_BS;
(window as unknown as { __STYLE_BS: typeof STYLE_BS }).__STYLE_BS = STYLE_BS;
// Automation hooks (Playwright screenshot runs): camera + gui control.
(window as unknown as { __cam: typeof camera }).__cam = camera;
(window as unknown as { __controls: typeof controls }).__controls = controls;
(window as unknown as { __vrmReady: () => boolean }).__vrmReady = () => vrm !== null;

const gui = new GUI({ title: 'Motion tuning', container: document.getElementById('tuning')! });
(window as unknown as { __gui: typeof gui }).__gui = gui;
const ARM_KEYS = [
  'LIFT_AIR',
  'WRAP_AIR',
  'AIR_SWING',
  'LIFT_COIL',
  'LIFT_TUCK',
  'LIFT_BAL',
  'CROSS',
  'ELBOW',
  'ELBOW_AIR',
  'SWING',
  'CATCH',
] as const;
// Wide ranges (incl. negatives) so you can fully sculpt — e.g. a negative
// LIFT flips the arm the other way, WRAP > 1.5 crosses harder.
const MIN = -1.5;
const MAX = 3;
const STEP = 0.01;
// Frontside spins use ARM_TUNING; backside spins use ARM_TUNING_BS — tune them
// independently. Backside is opened by default since that's what we're dialing.
const armsFS = gui.addFolder('Arms — FRONTSIDE (ARM_TUNING)');
for (const k of ARM_KEYS)
  armsFS.add(ARM_TUNING as unknown as Record<string, number>, k, MIN, MAX, STEP).listen();
const armsBS = gui.addFolder('Arms — BACKSIDE (ARM_TUNING_BS)');
for (const k of ARM_KEYS)
  armsBS.add(ARM_TUNING_BS as unknown as Record<string, number>, k, MIN, MAX, STEP).listen();

// Head spotting — per direction, like the arms. LEAD is "look over the back
// shoulder at pop to initiate the spin" (signed: negative = right/back shoulder
// for a regular-stance backside). LEAD_END is how early it fades into the spot.
const HEAD_KEYS: [string, number, number][] = [
  ['DOWNHILL', -1.5, 1.5],
  ['LEAD', -1.5, 1.5],
  ['LEAD_END', 0.05, 1],
  ['FOLLOW', 0, 1], // 0 = spot the landing (whip); 1 = head rides around WITH the body (one motion)
  ['HOLD_FRAC', 0.05, 0.95],
  ['WHIP_END', 0.1, 1],
  ['SPOT', -1, 1.5],
  ['ROLL', -1, 1],
  ['NECK_CAP', 0.5, 2],
];
const headFS = gui.addFolder('Head — FRONTSIDE (HEAD_TUNING)');
for (const [k, mn, mx] of HEAD_KEYS)
  headFS.add(HEAD_TUNING as unknown as Record<string, number>, k, mn, mx, 0.01).listen();
const headBS = gui.addFolder('Head — BACKSIDE (HEAD_TUNING_BS)');
for (const [k, mn, mx] of HEAD_KEYS)
  headBS.add(HEAD_TUNING_BS as unknown as Record<string, number>, k, mn, mx, 0.01).listen();

// Stylish backside-360 leg tweak (select the 'backside-360-stylish' trick).
// FRONT/BACK amounts = leg-lift magnitudes; P1/P2_END = spin fractions the
// nose-up → tail-up → nose-down phases hand off.
const STYLE_KEYS: [string, number, number][] = [
  ['FRONT_EARLY', 0, 1.5],
  ['BACK_MID', 0, 1.5],
  ['FRONT_LATE', 0, 1.5],
  ['P1_END', 0.05, 0.9],
  ['P2_END', 0.1, 0.95],
  ['LAND_FRONT', 0, 1.5],
];
const styleBS = gui.addFolder('Style — BACKSIDE tweak (STYLE_BS)');
for (const [k, mn, mx] of STYLE_KEYS)
  styleBS.add(STYLE_BS as unknown as Record<string, number>, k, mn, mx, 0.01).listen();

const grabGUI = gui.addFolder('Handplants / free arm');
for (const key of Object.keys(GRAB_TUNING)) grabGUI.add(GRAB_TUNING, key, -3, 3, 0.01).listen();
for (const folder of gui.folders) folder.close();

// ---- reference video ----
const refVideo = document.getElementById('refVideo') as HTMLVideoElement;
const refUrl = document.getElementById('refUrl') as HTMLInputElement;
document.getElementById('refLoad')!.addEventListener('click', () => {
  const url = refUrl.value.trim();
  if (url) {
    refVideo.src = url;
    refVideo.play().catch(() => {});
  }
});
// drag-drop a local clip onto the video
refVideo.addEventListener('dragover', (e) => e.preventDefault());
refVideo.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    refVideo.src = URL.createObjectURL(file);
    refVideo.play().catch(() => {});
  }
});

// ---- animation loop ----
const COM_Y = 0.85; // hip/CoM height the flip pivots about (matches KaoriStage)
const clock = new THREE.Clock();
const yAxis = new THREE.Vector3(0, 1, 0);
// Flip axis = local toe-heel line (+Z), horizontal and PERPENDICULAR to the
// board — end over end (nose sweeps up and over). MUST match KaoriStage's
// _flipPitchAxis or the lab verifies a different trick than the app performs.
const flipAxis = new THREE.Vector3(0, 0, 1);

function applyAt(t: number) {
  if (!vrm) return;
  const trick = TRICKS[state.trick as keyof typeof TRICKS];
  const pose = trick.poseAt(t * trick.duration);
  vrm.humanoid.resetNormalizedPose();
  resetRiderBones(vrm.humanoid);
  applyRiderPose(vrm.humanoid, pose, 1);
  const root = riderRootAt(pose, trick);
  const q = new THREE.Quaternion().setFromAxisAngle(yAxis, root.rootYaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(flipAxis, root.rootPitch));
  vrm.scene.quaternion.copy(q);
  const offset = new THREE.Vector3(0, COM_Y, 0).applyQuaternion(q);
  vrm.scene.position.set(-offset.x, COM_Y + root.rootY - offset.y, -offset.z);
  // Deterministic body sampling; hair physics must not depend on scrub history.
  vrm.humanoid.update();
  vrm.scene.updateMatrixWorld(true);
  lockBoardToFeet();
  const gaps = Object.values(grabContactDistances(vrm.humanoid, pose));
  const fit=riderClearance(vrm.humanoid,pose);
  fit.bindingErrorMm=Math.abs(_lp.distanceTo(_rp)-.48)*1000;
  document.getElementById("contact")!.textContent = gaps.length ? `Held grab: wrist target gap ${Math.round(Math.max(...gaps)*1000)} mm` : "Grab contact: reach / release";
  document.getElementById("contact")!.textContent += ` | Binding spacing error ${fit.bindingErrorMm.toFixed(1)} mm | Arm clearance ${fit.armClearanceMm?.toFixed(0) ?? "—"} mm`;
  board.updateMatrixWorld(true);
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const duration = currentDuration();
  if (state.playing) state.t = advanceTime(state.t, dt, duration, state.speed);
  if (showingBlender && returned && vrm) {
    document.getElementById("contact")!.textContent = "Blender take — procedural contact check inactive";
    vrm.scene.position.set(0, 0, 0); vrm.scene.quaternion.identity();
    returned.action.paused = false; returned.action.enabled = true;
    returned.mixer.setTime(state.t * duration);
    vrm.humanoid.update(); vrm.scene.updateMatrixWorld(true);
    const samples = returned.board;
    const at = Math.min(samples.length - 1, state.t * duration * 30);
    const a = samples[Math.floor(at)], b = samples[Math.min(samples.length - 1, Math.ceil(at))];
    const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), sa = new THREE.Vector3();
    const pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sb = new THREE.Vector3();
    new THREE.Matrix4().fromArray(a.matrix).decompose(pa, qa, sa);
    new THREE.Matrix4().fromArray(b.matrix).decompose(pb, qb, sb);
    board.position.copy(pa).lerp(pb, at % 1); board.quaternion.copy(qa).slerp(qb, at % 1); board.scale.copy(sa).lerp(sb, at % 1); board.visible = true;
  } else applyAt(state.t);
  if (state.referenceSync && Number.isFinite(refVideo.duration)) {
    refVideo.pause();
    const target = Math.max(0, Math.min(refVideo.duration, state.referenceOffset + state.t * state.referenceSpan));
    if (Math.abs(refVideo.currentTime-target) > 0.035) refVideo.currentTime = target;
  }
  const scrub = document.getElementById('scrub') as HTMLInputElement;
  scrub.value = String(state.t);
  document.getElementById('time')!.textContent = (state.t * duration).toFixed(2) + ' / ' + duration.toFixed(2) + ' s';
  document.getElementById('play')!.textContent = state.playing ? 'Pause' : 'Play';
  renderer.render(scene, camera);
}
frame();

new ResizeObserver(() => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
}).observe(stage);

function status(message: string) { document.getElementById('status')!.textContent = message; }
const groups = { ARM_TUNING, ARM_TUNING_BS, HEAD_TUNING, HEAD_TUNING_BS, STYLE_BS, GRAB_TUNING };
const defaults = JSON.parse(JSON.stringify(groups));
function preset() { return { version: 1, trick: state.trick, tuning: JSON.parse(JSON.stringify(groups)) }; }
function loadPreset(value: unknown) {
  const p = validatePreset(value, groups, Object.keys(TRICKS));
  for (const [name, values] of Object.entries(groups)) Object.assign(values, p.tuning[name]);
  state.trick = p.trick; state.t = 0; state.playing = false;
  showingBlender = false;
  (document.getElementById('trickSelect') as HTMLSelectElement).value = state.trick;
  gui.controllersRecursive().forEach(c => c.updateDisplay());
}
gui.onFinishChange(() => {
  try { localStorage.setItem('kaori-tricklab-v1', JSON.stringify(preset())); status('Draft saved in this browser. Download a preset to keep a portable copy.'); }
  catch { status('Browser storage unavailable. Download a preset to save your changes.'); }
});
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.getElementById('savePreset')!.onclick = () => {
  try { validatePreset(preset(), groups, Object.keys(TRICKS)); download(`${state.trick}.preset.json`, preset()); status('Preset download started.'); }
  catch (e) { status(String(e)); }
};
document.getElementById('resetPreset')!.onclick = () => {
  loadPreset({ version: 1, trick: state.trick, tuning: defaults });
  try { localStorage.removeItem('kaori-tricklab-v1'); } catch {}
  status('Default tuning restored.');
};
(document.getElementById('presetFile') as HTMLInputElement).onchange = async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { loadPreset(JSON.parse(await file.text())); status(`Loaded ${file.name}`); } catch (e) { status(String(e)); }
};
const trickSelect = document.getElementById('trickSelect') as HTMLSelectElement;
for (const id of Object.keys(TRICKS)) { const option = document.createElement('option'); option.value = id; option.textContent = id.replaceAll('-', ' '); trickSelect.add(option); }
trickSelect.value = state.trick;
trickSelect.onchange = () => { state.trick = trickSelect.value; state.t = 0; showingBlender = false; };
document.getElementById('play')!.onclick = () => { state.playing = !state.playing; };
(document.getElementById('scrub') as HTMLInputElement).oninput = e => { state.t = Number((e.target as HTMLInputElement).value); state.playing = false; };
(document.getElementById('speed') as HTMLSelectElement).onchange = e => { state.speed = Number((e.target as HTMLSelectElement).value); };
for (const [id, sign] of [['previousFrame', -1], ['nextFrame', 1]] as const) {
  document.getElementById(id)!.onclick = () => { state.playing = false; state.t = THREE.MathUtils.clamp(state.t + sign / (30 * currentDuration()), 0, 1); };
}
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b => { b.onclick = () => { state.t = Number(b.dataset.time); state.playing = false; }; });
document.getElementById('frontCamera')!.onclick = () => { camera.position.set(-2.6, 1.3, 1.5); controls.target.set(0, .7, 0); controls.update(); };
document.getElementById('sideCamera')!.onclick = () => { camera.position.set(1.8, 1.3, 2.6); controls.target.set(0, .7, 0); controls.update(); };
let localVideo: string | null = null;
(document.getElementById('refFile') as HTMLInputElement).onchange = e => {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
  if (localVideo) URL.revokeObjectURL(localVideo);
  localVideo = URL.createObjectURL(file); refVideo.src = localVideo;
};
(document.getElementById('sync') as HTMLInputElement).onchange = e => { state.referenceSync = (e.target as HTMLInputElement).checked; };
(document.getElementById('offset') as HTMLInputElement).oninput = e => { state.referenceOffset = Math.max(0, Number((e.target as HTMLInputElement).value) || 0); };
(document.getElementById('span') as HTMLInputElement).oninput = e => { state.referenceSpan = Math.max(0.1, Number((e.target as HTMLInputElement).value) || 0.1); };
refVideo.onerror = () => status('Reference video could not load. Try a local video file or a direct MP4 URL.');
try { const stored = localStorage.getItem('kaori-tricklab-v1'); if (stored) loadPreset(JSON.parse(stored)); } catch { status('Saved draft was incompatible; using defaults.'); }

function boneMatrices() {
  const result: Record<string, number[]> = {};
  if (vrm) for (const [name, bone] of Object.entries(vrm.humanoid.humanBones)) result[name] = bone.node.matrixWorld.toArray();
  return result;
}
document.getElementById('exportMotion')!.onclick = async () => {
  if (showingBlender) { status('Switch to procedural motion before sampling a new source take.'); return; }
  if (!vrm) { status('Wait for Kaori to load.'); return; }
  const prior = { t: state.t, playing: state.playing };
  state.playing = false;
  try {
    validatePreset(preset(), groups, Object.keys(TRICKS));
    const duration = TRICKS[state.trick as keyof typeof TRICKS].duration;
    const count = Math.ceil(duration * 30);
    const samples = [];
    for (let frame = 0; frame <= count; frame++) {
      const time = Math.min(frame / 30, duration); applyAt(time / duration);
      samples.push({ time, normalizedBones: Object.fromEntries(Object.keys(restBones).map(name => [name, vrm!.humanoid.getNormalizedBoneNode(name as any)!.matrixWorld.toArray()])), bones: boneMatrices(), board: board.matrixWorld.toArray() });
    }
    const response = await fetch('/__lab/motion', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TrickLab': 'motion-v1' }, body: JSON.stringify({ version: 1, trick: state.trick, fps: 30, duration, space: 'three-world-column-major-y-up', restBones, normalizedRest, samples, preset: preset() }) });
    if (!response.ok) throw new Error(await response.text());
    const saved = await response.json(); status(`Saved ${saved.file}. Ready to import in Blender.`);
  } catch (e) { status(`Export failed: ${String(e)}`); }
  finally { Object.assign(state, prior); applyAt(state.t); }
};

document.getElementById('loadBlender')!.onclick = async () => {
  if (!vrm) return;
  const requested = state.trick;
  try {
    const loader = new GLTFLoader(); loader.register(parser => new VRMAnimationLoaderPlugin(parser));
    const [gltf, response] = await Promise.all([loader.loadAsync(`/returns/${requested}.vrma?v=${Date.now()}`), fetch(`/returns/${requested}.board.json?v=${Date.now()}`)]);
    if (!response.ok) throw new Error('Missing board export');
    const data = await response.json();
    if (state.trick !== requested) return;
    const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrm);
    returned?.mixer.stopAllAction();
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    returned = { mixer, action, duration: clip.duration, board: data.samples };
    showingBlender = true; state.t = 0; state.playing = false;
    status(`Blender take loaded: ${requested}. Scrub to compare. Tuning sliders affect procedural mode only.`);
  } catch (e) { status(`No Blender take available for ${requested}. Export it from the workshop first. ${String(e)}`); }
};
document.getElementById('useProcedural')!.onclick = () => { showingBlender = false; status('Procedural motion selected.'); };

document.getElementById('auditGrabs')!.onclick = async () => {
  if (!vrm) return;
  const prior={...state}, wasBlender=showingBlender;
  showingBlender=false;state.playing=false;
  const results=[];let bindingErrorMm=0;
  try {
    for(const [id,trick] of Object.entries(TRICKS)) {
      const gaps:number[]=[], fits:ReturnType<typeof riderClearance>[]=[];
      state.trick=id;
      for(let i=0;i<=400;i++) {
        const t=i/400,pose=trick.poseAt(t*trick.duration);
        if(pose.height<=.02 || Math.max(pose.grabFront,pose.grabRear)<.1)continue;
        applyAt(t);
        // Check the rendered/raw feet too, not only the normalized rig.
        bindingErrorMm=Math.max(bindingErrorMm,Math.abs(_lp.distanceTo(_rp)-.48)*1000);
        fits.push(riderClearance(vrm.humanoid,pose));
        gaps.push(...Object.values(grabContactDistances(vrm.humanoid,pose)));
      }
      if(gaps.length)results.push({trick:id,samples:fits.length,heldSamples:gaps.length,maxGapMm:Math.max(...gaps)*1000,minArmClearanceMm:Math.min(...fits.map(f=>f.armClearanceMm??Infinity))});
    }
    const response=await fetch('/__lab/motion',{method:'POST',headers:{'Content-Type':'application/json','X-TrickLab':'motion-v1'},body:JSON.stringify({version:1,trick:'grab-contact-audit',poses:results.reduce((n,r)=>n+r.samples,0),maxRenderedBindingErrorMm:bindingErrorMm,samples:results})});
    if(!response.ok)throw new Error(await response.text());
    const gap=Math.max(...results.map(r=>r.maxGapMm)),clearance=Math.min(...results.map(r=>r.minArmClearanceMm));
    status(`${results.length} grabs checked through reach, hold and release. Worst wrist gap ${gap.toFixed(1)} mm; leg-capsule clearance ${clearance.toFixed(1)} mm; rendered binding error ${bindingErrorMm.toFixed(3)} mm. Capsule checks are a guide; inspect clothing and fingers visually.`);
  }catch(e){status(String(e));}finally{Object.assign(state,prior);showingBlender=wasBlender;applyAt(state.t);}
};
document.getElementById("detailCamera")!.onclick=()=>{camera.position.set(-1.8,1.05,1.5);controls.target.set(0,.65,0);controls.update();};
document.getElementById('savePose')!.onclick = async () => {
  state.playing = false;
  renderer.render(scene, camera);
  const trick = `${state.trick}-pose-${Math.round(state.t * 10000)}`;
  const response = await fetch('/__lab/motion', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TrickLab': 'motion-v1' },
    body: JSON.stringify({version: 1, trick, samples: [{phase: state.t, camera: camera.position.toArray(), png: renderer.domElement.toDataURL('image/png')}]}),
  });
  status(response.ok ? `Pose image saved in exports/${trick}.motion.json.` : 'Pose image could not be saved.');
};
document.getElementById('toggleReference')!.onclick = () => {
  const hidden=document.getElementById('workspace')!.classList.toggle('reviewOnly');
  document.getElementById('toggleReference')!.textContent=hidden?'Show reference':'Hide reference';
};

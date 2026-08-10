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

import {
  ARM_TUNING,
  ARM_TUNING_BS,
  applyRiderPose,
  resetRiderBones,
  STANCE_YAW,
} from '../../src/components/companion/riderFundamentals';
import {
  HEAD_TUNING,
  HEAD_TUNING_BS,
  TRICKS,
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
camera.position.set(0, 1.15, 3.4);

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
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.load(
  '/kaori.vrm',
  (gltf) => {
    vrm = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    scene.add(vrm.scene);
  },
  undefined,
  (err) => console.error('VRM load failed:', err),
);

// ---- controls / state ----
// speed ≈ 1/duration plays a trick near real-time; the scrubber t is normalized.
const state = { trick: Object.keys(TRICKS)[0], t: 0, playing: true, speed: 0.25 };
// Dev hook: lets the console / automation scrub the lab precisely.
(window as unknown as { __lab: typeof state }).__lab = state;
(window as unknown as { __TRICKS: typeof TRICKS }).__TRICKS = TRICKS;
(window as unknown as { __STANCE_YAW: number }).__STANCE_YAW = STANCE_YAW;
(window as unknown as { __ARM: typeof ARM_TUNING }).__ARM = ARM_TUNING;
(window as unknown as { __ARM_BS: typeof ARM_TUNING_BS }).__ARM_BS = ARM_TUNING_BS;
(window as unknown as { __HEAD: typeof HEAD_TUNING }).__HEAD = HEAD_TUNING;
(window as unknown as { __HEAD_BS: typeof HEAD_TUNING_BS }).__HEAD_BS = HEAD_TUNING_BS;

const gui = new GUI({ title: 'Kaori Trick Lab' });
gui.add(state, 'trick', Object.keys(TRICKS)).name('trick');
gui.add(state, 't', 0, 1, 0.001).name('t (scrub)').listen();
gui.add(state, 'playing').name('▶ play');
gui.add(state, 'speed', 0.05, 1.5, 0.05).name('speed');

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
headBS.open();

gui
  .add(
    {
      exportTuning: () => {
        const out =
          `ARM_TUNING = ${JSON.stringify(ARM_TUNING, null, 2)}\n\n` +
          `ARM_TUNING_BS = ${JSON.stringify(ARM_TUNING_BS, null, 2)}\n\n` +
          `HEAD_TUNING = ${JSON.stringify(HEAD_TUNING, null, 2)}\n\n` +
          `HEAD_TUNING_BS = ${JSON.stringify(HEAD_TUNING_BS, null, 2)}`;
        navigator.clipboard?.writeText(out).catch(() => {});
        console.log(out);
        alert('Arm + head tuning (front & back) copied to clipboard + logged.');
      },
    },
    'exportTuning',
  )
  .name('⇩ export tuning');

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
const xAxis = new THREE.Vector3(1, 0, 0);

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  if (state.playing) state.t = (state.t + dt * state.speed) % 1;

  if (vrm) {
    const trick = (TRICKS as Record<string, (typeof TRICKS)[keyof typeof TRICKS]>)[state.trick];
    // poseAt is parameterized in SECONDS over the trick's `duration`; the
    // scrubber is normalized 0..1, so map it into the trick's real time domain.
    // (This is why the trick previously "only showed the wind-up" — we were
    // sampling the first 1s of a multi-second trick.)
    const pose = trick.poseAt(state.t * trick.duration);

    resetRiderBones(vrm.humanoid);
    applyRiderPose(vrm.humanoid, pose, 1);

    // Whole-body yaw (spin) * pitch (flip), pivoted at the CoM so a flip
    // somersaults about the hips rather than the feet.
    const yaw = STANCE_YAW + (trick.totalSpin || 0) * pose.spin;
    const pitch = ((trick as { totalFlip?: number }).totalFlip || 0) * pose.pitch;
    const q = new THREE.Quaternion()
      .setFromAxisAngle(yAxis, yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, pitch));
    vrm.scene.quaternion.copy(q);
    const comOffset = new THREE.Vector3(0, COM_Y, 0).applyQuaternion(q);
    vrm.scene.position.set(-comOffset.x, COM_Y + (pose.height || 0) - comOffset.y, -comOffset.z);

    vrm.update(dt);
  }
  renderer.render(scene, camera);
}
frame();

window.addEventListener('resize', () => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
});

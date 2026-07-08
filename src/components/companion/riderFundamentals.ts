/**
 * Rider fundamentals — the reusable building blocks every board trick is
 * made of. Trick timelines (trickAnimations.ts) compose these:
 *
 *  - STANCE: on-board yaw, foot splay, relaxed riding crouch, idle bounce
 *  - CROUCH: anatomically-correct knee fold (thigh forward, shin back,
 *    sole flat) with the hip drop that keeps feet planted on the board
 *  - COIL (wind-up): counter-rotation distributed through hips → spine →
 *    chest → neck, arms swinging with it
 *  - ARMS: rest / wound-up / tucked / balance blending
 *  - JUMP: parabolic air arc
 *
 * All values were visually tuned on-device (VRM 1.0 VRoid rig, normalized
 * humanoid bones, character facing +Z, her left side on +X).
 */

import type { VRM } from '@pixiv/three-vrm';

export type Humanoid = NonNullable<VRM['humanoid']>;

// --- Easing / timeline helpers ---
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (u: number) => u * u * (3 - 2 * u);
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Progress 0→1 of t between phase bounds. */
export const phase = (t: number, start: number, end: number) =>
  clamp01((t - start) / (end - start));

// --- Stance ---
/** Riding stance yaw: board across the camera view, chest quartered to us. */
export const STANCE_YAW = -1.05;
/** Relaxed knee bend while standing on the board talking. */
export const STANCE_CROUCH = 0.18;
/** Foot splay at full stance weight (rad per leg). */
export const STANCE_SPREAD = 0.25;

// --- Crouch geometry ---
/** Leg segment lengths (fraction of the VRM's ~0.85 hip height). */
const THIGH_LEN = 0.42;
const SHIN_LEN = 0.42;
/** Flexion at crouch=1: thigh drives forward, shin folds back under. */
const THIGH_FLEX = 1.1;
const SHIN_FLEX = 1.9;

/** How far the hips sink for a given crouch so feet stay on the board. */
export function hipDropFor(crouch: number): number {
  const thigh = THIGH_FLEX * crouch;
  const shinWorld = (SHIN_FLEX - THIGH_FLEX) * crouch;
  return THIGH_LEN * (1 - Math.cos(thigh)) + SHIN_LEN * (1 - Math.cos(shinWorld));
}

/** Parabolic jump arc: u 0→1 across the airtime, peaking at `height`. */
export function jumpArc(u: number, height: number): number {
  return u > 0 && u < 1 ? height * 4 * u * (1 - u) : 0;
}

/**
 * A rider pose — every trick timeline outputs one of these per frame.
 * All fields are normalized amounts the appliers translate to bones.
 */
export interface RiderPose {
  /** Rotation progress 0→1 (multiplied by the trick's total spin). */
  spin: number;
  /** Root height above the board line (jump arc). */
  height: number;
  /** 0 straight legs → 1 full squat (hip drop is derived from this). */
  crouch: number;
  /** Upper-body coil around Y: negative = wound away from the spin. */
  coil: number;
  /** 0 rest → 1 knees-to-chest airborne tuck. */
  tuck: number;
  /** 0 → 1 arms out wide for landing balance. */
  balance: number;
  /** Head: lead the spin (yaw) and spot the landing (pitch down). */
  headLead: number;
  headSpot: number;
}

export const REST_POSE: RiderPose = {
  spin: 0,
  height: 0,
  crouch: STANCE_CROUCH,
  coil: 0,
  tuck: 0,
  balance: 0,
  headLead: 0,
  headSpot: 0,
};

/** Relaxed on-board bounce while she talks between moves. */
export function stanceIdlePose(idleT: number): RiderPose {
  return {
    ...REST_POSE,
    crouch: STANCE_CROUCH + Math.sin(idleT * 1.6) * 0.035,
    coil: Math.sin(idleT * 0.7) * 0.05,
  };
}

// --- Bone appliers ---

function applyLegs(humanoid: Humanoid, crouch: number, stanceWeight: number) {
  const spread = STANCE_SPREAD * stanceWeight;
  for (const side of ['left', 'right'] as const) {
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperLeg`);
    const lower = humanoid.getNormalizedBoneNode(`${side}LowerLeg`);
    const foot = humanoid.getNormalizedBoneNode(`${side}Foot`);
    if (upper) {
      // Thigh pitches forward (knee travels toward the toe side)
      upper.rotation.x = -crouch * THIGH_FLEX;
      // Splay OUTWARD: her left leg sits on +X (she faces the camera)
      upper.rotation.z = side === 'left' ? spread : -spread;
    }
    // Shin folds back under the thigh — the human knee hinge
    if (lower) lower.rotation.x = crouch * SHIN_FLEX;
    // Keep the sole flat on the board
    if (foot) foot.rotation.x = -crouch * (SHIN_FLEX - THIGH_FLEX);
  }
}

function applyTorsoAndHead(humanoid: Humanoid, pose: RiderPose) {
  const hips = humanoid.getNormalizedBoneNode('hips');
  const spine = humanoid.getNormalizedBoneNode('spine');
  const chest = humanoid.getNormalizedBoneNode('chest');
  const neck = humanoid.getNormalizedBoneNode('neck');

  if (hips) {
    hips.rotation.y = pose.coil * 0.35;
    hips.rotation.z = 0;
  }
  if (spine) {
    spine.rotation.y = pose.coil * 0.5;
    spine.rotation.x = pose.crouch * 0.3 + pose.tuck * 0.25;
    spine.rotation.z = 0;
  }
  if (chest) {
    chest.rotation.y = pose.coil * 0.45;
    chest.rotation.x = pose.crouch * 0.18;
  }
  if (neck) {
    neck.rotation.y = pose.coil * 0.4 + pose.headLead;
    neck.rotation.x = pose.headSpot - pose.tuck * 0.15;
    neck.rotation.z = 0;
  }
}

function applyArms(humanoid: Humanoid, pose: RiderPose) {
  const rest = { uz: 1.15, ux: 0.06, fz: 0.15 };
  const windup = clamp01(-pose.coil / 0.7);
  const uzTarget = rest.uz - pose.tuck * 0.45 - pose.balance * 0.55 + windup * 0.1;
  const uxTarget = rest.ux + pose.tuck * 0.35 + windup * 0.25;
  const fzTarget = rest.fz + pose.tuck * 0.55;

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
    const lower = humanoid.getNormalizedBoneNode(`${side}LowerArm`);
    const hand = humanoid.getNormalizedBoneNode(`${side}Hand`);
    if (upper) {
      upper.rotation.z = sign * uzTarget;
      upper.rotation.x = uxTarget;
      upper.rotation.y = windup * 0.35;
    }
    if (lower) lower.rotation.z = sign * fzTarget;
    if (hand) hand.rotation.x = 0.1;
  }
}

/** Apply a full rider pose to the skeleton (legs scaled by stance weight). */
export function applyRiderPose(humanoid: Humanoid, pose: RiderPose, stanceWeight: number) {
  applyLegs(humanoid, pose.crouch * stanceWeight, stanceWeight);
  applyTorsoAndHead(humanoid, pose);
  applyArms(humanoid, pose);
}

/** Zero out the bones the idle system never touches (legs, arm Y). */
export function resetRiderBones(humanoid: Humanoid) {
  applyLegs(humanoid, 0, 0);
  for (const side of ['left', 'right'] as const) {
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
    if (upper) upper.rotation.y = 0;
  }
}

// --- Fundamental mini-demos (reused as spoken-phase segments) ---

/** Wind-up: sink deep + coil against the spin, hold, unwind to stance. */
export function windUpDemoPose(t: number): RiderPose {
  const sink = phase(t, 0, 1.1);
  const unwind = phase(t, 1.5, 2.6);
  const amount = easeInOut(sink) * (1 - easeInOut(unwind));
  return {
    ...REST_POSE,
    crouch: lerp(STANCE_CROUCH, 0.66, amount),
    coil: -0.7 * amount,
    headLead: -0.15 * amount,
  };
}
export const WIND_UP_DEMO_DURATION = 2.6;

/** Pop: quick sink, small straight hop, absorb back to stance. */
export function popDemoPose(t: number): RiderPose {
  const sink = phase(t, 0, 0.55);
  const hopTime = phase(t, 0.55, 1.05);
  const absorb = phase(t, 1.05, 1.6);
  const height = jumpArc(hopTime, 0.28);
  let crouch = lerp(STANCE_CROUCH, 0.6, easeInOut(sink));
  if (hopTime > 0) crouch = lerp(0.6, 0.1, easeInOut(hopTime));
  if (absorb > 0) crouch = lerp(0.1, STANCE_CROUCH, easeInOut(absorb));
  return { ...REST_POSE, height, crouch };
}
export const POP_DEMO_DURATION = 1.6;

/** Landing absorb: drop deep like eating an impact, rise back to stance. */
export function landDemoPose(t: number): RiderPose {
  const drop = phase(t, 0, 0.45);
  const rise = phase(t, 0.9, 1.8);
  const amount = easeInOut(drop) * (1 - easeInOut(rise));
  return {
    ...REST_POSE,
    crouch: lerp(STANCE_CROUCH, 0.72, amount),
    balance: amount * 0.8,
    headSpot: 0.2 * amount,
  };
}
export const LAND_DEMO_DURATION = 1.8;

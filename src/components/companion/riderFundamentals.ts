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
  /** Head tilt/roll toward the leading shoulder (radians) — "head over the shoulder". */
  headRoll: number;
  /** Asymmetric leg raise for stylish variants (0 → 1). Regular stance:
   *  front = left leg (lead foot), back = right leg. Lifting a leg bends its
   *  knee up so the corresponding end of the board can angle up. */
  backLegLift: number;
  frontLegLift: number;
  /** Board angle around its long axis (radians; + = tail up / nose down). */
  boardTilt: number;
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
  headRoll: 0,
  backLegLift: 0,
  frontLegLift: 0,
  boardTilt: 0,
};

/** Head turn to look "downhill" — down the board toward the nose (front foot,
 *  +X side) like a rider watching where they're going — rather than square
 *  across the board / off to the side. Applied to headLead (neck yaw). Raise
 *  toward ~0.9 for more of a look down the board, lower for squarer. */
export const DOWNHILL_LOOK = 0.6;
/** Small chin-down that pairs with the downhill look (gaze slightly down the
 *  slope, not level). Applied to headSpot at rest AND at the trick's settle. */
export const DOWNHILL_CHIN = 0.08;

/** Relaxed on-board bounce while she talks between moves — gaze downhill,
 *  head turned down the board toward the nose (not square across / off-camera). */
export function stanceIdlePose(idleT: number): RiderPose {
  return {
    ...REST_POSE,
    crouch: STANCE_CROUCH + Math.sin(idleT * 1.6) * 0.035,
    coil: Math.sin(idleT * 0.7) * 0.05,
    headLead: DOWNHILL_LOOK,
    headSpot: DOWNHILL_CHIN,
  };
}

// --- Bone appliers ---

function applyLegs(
  humanoid: Humanoid,
  crouch: number,
  stanceWeight: number,
  backLegLift = 0,
  frontLegLift = 0,
) {
  const spread = STANCE_SPREAD * stanceWeight;
  for (const side of ['left', 'right'] as const) {
    // Regular stance: left leg leads (front), right leg is back.
    const lift = side === 'left' ? frontLegLift : backLegLift;
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperLeg`);
    const lower = humanoid.getNormalizedBoneNode(`${side}LowerLeg`);
    const foot = humanoid.getNormalizedBoneNode(`${side}Foot`);
    if (upper) {
      // Thigh pitches forward (knee travels toward the toe side); a leg lift
      // raises the thigh a little so the knee comes up.
      upper.rotation.x = -crouch * THIGH_FLEX - lift * 0.5;
      // Splay OUTWARD: her left leg sits on +X (she faces the camera)
      upper.rotation.z = side === 'left' ? spread : -spread;
    }
    // Shin folds back under the thigh — the human knee hinge; a lift folds it
    // more so that foot lifts off the board.
    if (lower) lower.rotation.x = crouch * SHIN_FLEX + lift * 1.3;
    // Keep the sole flat on the board (relaxed when the foot is lifted)
    if (foot) foot.rotation.x = -crouch * (SHIN_FLEX - THIGH_FLEX) + lift * 0.4;
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
    // Tilt the head over the leading shoulder while spinning/spotting.
    neck.rotation.z = pose.headRoll;
  }
}

function applyArms(humanoid: Humanoid, pose: RiderPose) {
  // Rest (from T-pose): uz hangs the arms DOWN at the sides; ux ~0 = neutral
  // fwd/back; fz = slight elbow bend. Everything below is RELATIVE to the
  // chest, which already carries pose.coil * 0.45 of shoulder rotation — so we
  // deliberately ADD arm motion on top of that so the arms read as alive
  // instead of dead pendulums hanging off spinning shoulders.
  const rest = { uz: 1.15, ux: 0.06, fz: 0.15 };

  // --- Tuning magnitudes ---
  const SWING = 0.9; // fwd/back pump of a DOWN arm about upper.rotation.x
  const LIFT_COIL = 0.55; // how far the arms come UP off the sides at full coil
  const LIFT_TUCK = 0.45; // arms pulled in during the airborne tuck
  const LIFT_BAL = 0.55; // arms thrown wide for landing balance
  const CROSS = 0.4; // cross-body wrap (asymmetry via upper.rotation.y)
  const ELBOW = 0.75; // elbow flexion added while winding/whipping
  const CATCH = 0.25; // arms fling wide/back on the balance catch

  // coil runs the full -0.7 (wound up) -> +0.5 (whip at pop) -> ~0 range.
  // windup>0 ONLY while coil is negative (the load phase).
  const windup = clamp01(-pose.coil / 0.7);
  // whip>0 ONLY while coil is positive (the throw at/after the pop).
  const whip = clamp01(pose.coil / 0.5);
  // Raise arms off the sides whenever they're doing ANYTHING (loading OR
  // throwing) — biggest away from the neutral coil, so they pump up then
  // relax back down. |coil| already peaks at the extremes of the sequence.
  const coilMag = clamp01(Math.abs(pose.coil) / 0.7);

  // upper.rotation.z (abduction): LOWER uz => arm rises toward the T (out to
  // the side). Raise off the sides on coil, tuck in during air, wide on land.
  const uzTarget = rest.uz - coilMag * LIFT_COIL - pose.tuck * LIFT_TUCK - pose.balance * LIFT_BAL;

  // upper.rotation.x is THE visible fwd/back swing of a DOWN arm (rotation
  // about the world X axis pitches the hanging arm toward +Z=forward / -Z=back;
  // upper.rotation.y on a down arm only TWISTS it, so it can't do this job).
  // Load BACK against the spin during wind-up (coil<0 => negative swing), then
  // THROW FORWARD as coil whips positive. pose.coil is the single driver so the
  // swing is phase-locked to the shoulders.
  const swingBase = rest.ux + pose.coil * SWING + pose.tuck * 0.35;

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1; // left arm on +X, right on -X
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
    const lower = humanoid.getNormalizedBoneNode(`${side}LowerArm`);
    const hand = humanoid.getNormalizedBoneNode(`${side}Hand`);

    // Frontside spin is +Y (CCW from above): the BACK/right arm leads the throw
    // and reaches ACROSS the chest, the front/left arm trails — so bias the
    // right arm to swing a touch more forward and the left a touch less. This
    // asymmetry makes it read as a real wrap, not a symmetric puppet swing.
    const lead = side === 'right' ? 1 : -0.6;
    // On the landing she flings the arms wide and slightly back to catch balance.
    const catchSwing = -pose.balance * CATCH;

    if (upper) {
      upper.rotation.z = sign * uzTarget;
      upper.rotation.x = swingBase + lead * whip * 0.35 + catchSwing;
      // Cross-body wrap: twist the arms across during the whip + air, so the
      // hands travel around the torso instead of staying pinned to the sides.
      upper.rotation.y = sign * (whip * CROSS + pose.tuck * 0.3);
    }
    // Elbows bend as she loads and whips (arms don't stay straight in a spin),
    // and pull tighter in the tuck. fz base keeps the natural resting bend.
    if (lower) {
      lower.rotation.z = sign * (rest.fz + pose.tuck * 0.55 + (windup + whip) * ELBOW * 0.4);
      lower.rotation.x = -(windup * 0.5 + whip * 0.7 + pose.tuck * 0.6);
    }
    if (hand) hand.rotation.x = 0.1 + pose.tuck * 0.2;
  }
}

/** Apply a full rider pose to the skeleton (legs scaled by stance weight). */
export function applyRiderPose(humanoid: Humanoid, pose: RiderPose, stanceWeight: number) {
  applyLegs(
    humanoid,
    pose.crouch * stanceWeight,
    stanceWeight,
    pose.backLegLift * stanceWeight,
    pose.frontLegLift * stanceWeight,
  );
  applyTorsoAndHead(humanoid, pose);
  applyArms(humanoid, pose);
}

/** Zero out the bones the idle system never touches (legs, arm Y, neck roll/pitch). */
export function resetRiderBones(humanoid: Humanoid) {
  applyLegs(humanoid, 0, 0);
  for (const side of ['left', 'right'] as const) {
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
    if (upper) upper.rotation.y = 0;
  }
  // The idle system re-drives neck yaw each frame but not roll/pitch — clear
  // any leftover head-over-shoulder tilt / spot from a trick.
  const neck = humanoid.getNormalizedBoneNode('neck');
  if (neck) {
    neck.rotation.x = 0;
    neck.rotation.z = 0;
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

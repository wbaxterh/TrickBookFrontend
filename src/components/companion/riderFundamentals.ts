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
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
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
  /** Yaw rotation progress 0→1 (multiplied by the trick's total spin). */
  spin: number;
  /** Flip progress 0→1 (multiplied by the trick's total FLIP — a whole-body
   *  PITCH about the board's long axis, parallel to `spin`). 0 for pure spins. */
  pitch: number;
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
  /** GRAB channels (all 0 = no grab; existing tricks unaffected).
   *  grabFront/grabRear: 0→1 reach of the FRONT (lead/left) or REAR (right)
   *  hand down to the board. grabReach: where along the board the hand aims,
   *  -1 = nose (+X) … 0 = between the feet … +1 = tail. grabSide: +1 = toe
   *  edge (her facing side), -1 = heel edge (reach behind). */
  grabFront: number;
  grabRear: number;
  grabReach: number;
  grabSide: number;
  /** Leg POKE (bone): 0→1 straightens that knee and pushes that end of the
   *  board away — the opposite of a lift. Nosebone = front poke. */
  pokeFront: number;
  pokeBack: number;
  /** Back arch (method/japan tweak): 0→1 bends the spine back, chest opens. */
  arch: number;
  /** Carve lean: -1 heel-side … +1 toe-side whole-torso lean (radians ≈ ×0.5). */
  edgeLean: number;
  /** Spin direction: +1 frontside (CCW / +Y), -1 backside (CW / -Y). Flips the
   *  body wind, head look and arm wrap so a backside READS as backside. The
   *  actual rotation is carried by the trick's signed totalSpin, and `coil`
   *  stays frontside-signed either way so the arm load→whip TIMING is preserved
   *  (applyArms keys windup/whip off the coil sign). */
  dir: number;
}

export const REST_POSE: RiderPose = {
  spin: 0,
  pitch: 0,
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
  grabFront: 0,
  grabRear: 0,
  grabReach: 0,
  grabSide: 0,
  pokeFront: 0,
  pokeBack: 0,
  arch: 0,
  edgeLean: 0,
  dir: 1,
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
  pokeBack = 0,
  pokeFront = 0,
) {
  const spread = STANCE_SPREAD * stanceWeight;
  for (const side of ['left', 'right'] as const) {
    // Regular stance: left leg leads (front), right leg is back.
    const lift = side === 'left' ? frontLegLift : backLegLift;
    // A POKE (bone) is the opposite of a lift: the knee straightens and the
    // leg extends, pushing that end of the board away from the body.
    const poke = side === 'left' ? pokeFront : pokeBack;
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperLeg`);
    const lower = humanoid.getNormalizedBoneNode(`${side}LowerLeg`);
    const foot = humanoid.getNormalizedBoneNode(`${side}Foot`);
    if (upper) {
      // Thigh pitches forward (knee travels toward the toe side); a leg lift
      // raises the thigh a little so the knee comes up; a poke extends it.
      upper.rotation.x = -crouch * THIGH_FLEX * (1 - poke * 0.7) - lift * 0.5 + poke * 0.12;
      // Splay OUTWARD: her left leg sits on +X (she faces the camera). A poke
      // pushes the leg farther along the board line.
      const sideSign = side === 'left' ? 1 : -1;
      upper.rotation.z = sideSign * (spread + poke * 0.3);
    }
    // Shin folds back under the thigh — the human knee hinge; a lift folds it
    // more so that foot lifts off the board; a poke straightens it out.
    if (lower) lower.rotation.x = crouch * SHIN_FLEX * (1 - poke) + lift * 1.3;
    // Keep the sole flat on the board (relaxed when the foot is lifted)
    if (foot) foot.rotation.x = -crouch * (SHIN_FLEX - THIGH_FLEX) * (1 - poke) + lift * 0.4;
  }
}

function applyTorsoAndHead(humanoid: Humanoid, pose: RiderPose, w: number) {
  const hips = humanoid.getNormalizedBoneNode('hips');
  const spine = humanoid.getNormalizedBoneNode('spine');
  const chest = humanoid.getNormalizedBoneNode('chest');
  const neck = humanoid.getNormalizedBoneNode('neck');

  // Every channel scales by the stance weight `w` (neutral = 0 for all of
  // them), so the whole upper body eases IN as she steps onto the board and OUT
  // as she steps off — no torso/head SNAP at the idle↔demo handoff (that snap,
  // e.g. headLead jumping 0→0.6 at full strength while the legs were still
  // ramping, was the begin/end "glitch back into home position").
  // The coil-driven WIND flips with the spin direction (pose.dir) so a backside
  // winds the opposite way; headLead/headRoll already carry dir from the pose.
  const wind = pose.coil * pose.dir;
  // Carve lean tips the whole torso over an edge; back arch (method/japan)
  // opens the chest and bends the spine backward.
  const lean = pose.edgeLean * w;
  const arch = pose.arch * w;
  if (hips) {
    hips.rotation.y = wind * 0.35 * w;
    hips.rotation.z = lean * 0.18;
  }
  if (spine) {
    spine.rotation.y = wind * 0.5 * w;
    spine.rotation.x = (pose.crouch * 0.3 + pose.tuck * 0.25) * w - arch * 0.55;
    spine.rotation.z = lean * 0.22;
  }
  if (chest) {
    chest.rotation.y = wind * 0.45 * w;
    chest.rotation.x = pose.crouch * 0.18 * w - arch * 0.35;
  }
  if (neck) {
    neck.rotation.y = (wind * 0.4 + pose.headLead) * w;
    neck.rotation.x = (pose.headSpot - pose.tuck * 0.15) * w - arch * 0.2;
    // Tilt the head over the leading shoulder while spinning/spotting.
    neck.rotation.z = pose.headRoll * w;
  }
}

/**
 * Live-tunable arm magnitudes. The Trick Lab binds sliders directly to this
 * object, so mutating a field retunes applyArms in REAL TIME with no rebuild.
 * The defaults are the device-tuned values — this is the single source of truth
 * for the app too, so once the lab finds better numbers, edit them here.
 */
export const ARM_TUNING = {
  rest: { uz: 1.15, ux: 0.06, fz: 0.15 }, // arms-down rest pose (uz=abduction, ux=fwd/back, fz=elbow)
  SWING: 0.9, // fwd/back pump of a DOWN arm about upper.x (coil load/throw)
  LIFT_COIL: 0.45, // how far the arms come UP off the sides at full coil
  LIFT_TUCK: 0.18, // arms pulled in during the airborne tuck (was 0.45 — it was raising them)
  LIFT_BAL: 0.55, // arms thrown wide for landing balance
  LIFT_AIR: 0.12, // draw-in LIFT through the air/spin (was 0.6 — the main "winging")
  CROSS: 0.4, // cross-body wrap on the whip (upper.rotation.y)
  WRAP_AIR: 1.05, // continuous cross-body wrap that travels WITH the spin (the real "wrap")
  AIR_SWING: 0.05, // fwd swing into the spin (kept low — too much = "T-rex arms")
  ELBOW: 0.75, // elbow flexion added while winding/whipping
  ELBOW_AIR: 1.05, // elbows fold in tight as the arms wrap around mid-air
  CATCH: 0.25, // arms fling wide/back on the balance catch
};

// Backside spins want a DIFFERENT arm shape than frontside — frontside you can
// track the landing, backside is blind and the arms wrap the other way. applyArms
// uses THIS object for backside tricks (pose.dir < 0). It starts as an independent
// copy of ARM_TUNING (so nothing changes until you tune it), and the Trick Lab
// binds a separate "Arms — BACKSIDE" panel to it.
export const ARM_TUNING_BS: typeof ARM_TUNING = {
  rest: { uz: 1.15, ux: 0.06, fz: 0.15 },
  SWING: 0.9,
  LIFT_COIL: 0.48,
  LIFT_TUCK: 0.08,
  LIFT_BAL: -0.55,
  LIFT_AIR: -0.03,
  CROSS: 0.71,
  WRAP_AIR: -1.18,
  AIR_SWING: -0.84,
  ELBOW: 0.14,
  ELBOW_AIR: 1.05,
  CATCH: 0.82,
};

/**
 * Grab reach targets — live-tunable in the Trick Lab like ARM_TUNING.
 * A grab overrides that arm's procedural swing (lerped by the grab amount):
 * toe-side grabs reach down the FRONT of the body, heel-side wrap BEHIND.
 */
export const GRAB_TUNING = {
  // upper.rotation.x convention on this rig: NEGATIVE = forward. A toe-edge
  // grab reaches down the FRONT of the body; a heel-edge grab wraps BEHIND.
  TOE_FWD: -1.15, // upper.x reach fwd/down for a toe-edge grab
  TOE_DOWN: 0.72, // upper.z abduction (higher = arm hangs lower toward the board)
  HEEL_BACK: 0.78, // upper.x reach back/down for a heel-edge grab
  HEEL_DOWN: 1.0,
  REACH_SWING: 0.55, // upper.y swing toward the nose/tail (× grabReach)
  ELBOW: 0.25, // elbow bend while grabbing
  FREE_UP: 0.35, // the NON-grabbing arm styles up/out for balance
};

type BoneNode = ReturnType<Humanoid['getNormalizedBoneNode']>;

/** GRAB override for one arm: lerp it from wherever the procedural system put
 *  it toward the reach target by the grab amount; the free arm styles up/out. */
function applyGrabReach(
  upper: BoneNode,
  lower: BoneNode,
  sign: number,
  pose: RiderPose,
  grabAmt: number,
  otherGrab: number,
) {
  if (grabAmt > 0 && upper && lower) {
    const G = GRAB_TUNING;
    const toe = pose.grabSide >= 0;
    upper.rotation.x = lerp(upper.rotation.x, toe ? G.TOE_FWD : G.HEEL_BACK, grabAmt);
    upper.rotation.z = lerp(upper.rotation.z, sign * (toe ? G.TOE_DOWN : G.HEEL_DOWN), grabAmt);
    upper.rotation.y = lerp(upper.rotation.y, sign * pose.grabReach * G.REACH_SWING, grabAmt);
    lower.rotation.x = lerp(lower.rotation.x, -0.15, grabAmt);
    lower.rotation.z = lerp(lower.rotation.z, sign * G.ELBOW, grabAmt);
  } else if (otherGrab > 0 && upper) {
    upper.rotation.z = lerp(upper.rotation.z, sign * (1.15 - GRAB_TUNING.FREE_UP), otherGrab);
    upper.rotation.x = lerp(upper.rotation.x, -0.35, otherGrab * 0.7);
  }
}

function applyArms(humanoid: Humanoid, pose: RiderPose, w: number) {
  // Rest (from T-pose): uz hangs the arms DOWN at the sides; ux ~0 = neutral
  // fwd/back; fz = slight elbow bend. Everything below is RELATIVE to the
  // chest, which already carries pose.coil * 0.45 of shoulder rotation — so we
  // deliberately ADD arm motion on top of that so the arms read as alive
  // instead of dead pendulums hanging off spinning shoulders.
  // All magnitudes come from the live-tunable ARM_TUNING object (top of file),
  // so the Trick Lab can retune the arms in real time.
  // Backside tricks pull from their own tuning object (see ARM_TUNING_BS).
  const {
    rest,
    SWING,
    LIFT_COIL,
    LIFT_TUCK,
    LIFT_BAL,
    LIFT_AIR,
    CROSS,
    WRAP_AIR,
    AIR_SWING,
    ELBOW,
    ELBOW_AIR,
    CATCH,
  } = pose.dir < 0 ? ARM_TUNING_BS : ARM_TUNING;

  // coil runs the full -0.7 (wound up) -> +0.5 (whip at pop) -> ~0 range.
  // windup>0 ONLY while coil is negative (the load phase). whip>0 ONLY while
  // coil is positive (the throw at/after the pop). Both UNCHANGED so the good
  // frontside wind-up load/throw keeps its shape.
  const windup = clamp01(-pose.coil / 0.7);
  const whip = clamp01(pose.coil / 0.5);
  const coilMag = clamp01(Math.abs(pose.coil) / 0.7);

  // The OLD problem: past the pop, coil decays to ~0 so windup=whip=0 and the
  // arms went DEAD at the sides for the whole rotation. These two bells give the
  // arms a driver for the ENTIRE air, C0-seamless at both boundaries:
  //   airDrive = pose.tuck  -> already sin(π·air): 0 at the pop & land edges.
  //   spinSwing = sin(π·spin) -> 0 at spin=0 (stance handoff) AND spin=1 (opens
  //     for the landing), peaks at mid-spin — exactly where the arms hung still.
  const airDrive = pose.tuck;
  const spinSwing = Math.sin(Math.PI * clamp01(pose.spin));

  // upper.rotation.z (abduction): LOWER uz => arm rises toward the T. Rise on
  // coil, DRAW IN across the whole air (LIFT_AIR via spinSwing), tuck tighter,
  // wide on land. Clamp so it never rotates PAST the T into overhead.
  const uzTarget = Math.max(
    0.1,
    rest.uz -
      coilMag * LIFT_COIL -
      pose.tuck * LIFT_TUCK -
      spinSwing * LIFT_AIR -
      pose.balance * LIFT_BAL,
  );

  // upper.rotation.x — fwd/back swing of a DOWN arm (−x = forward). coil loads
  // BACK in the wind-up then THROWS FORWARD at the pop (UNCHANGED). On top,
  // AIR_SWING keeps the arms swung into the spin across the whole air instead of
  // drifting back to neutral once coil fades.
  // Keep the wind-up load/throw (coil*SWING) but cut the SYMMETRIC forward swing
  // that made both arms reach straight forward ("T-rex arms") — the cross-body
  // WRAP_AIR + lead/trail bias below should carry the spin instead.
  const swingBase = rest.ux + pose.coil * SWING + pose.tuck * 0.08 + spinSwing * AIR_SWING;

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1; // left arm on +X, right on -X
    const upper = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
    const lower = humanoid.getNormalizedBoneNode(`${side}LowerArm`);
    const hand = humanoid.getNormalizedBoneNode(`${side}Hand`);

    // The BACK arm leads the throw and reaches ACROSS the chest, the front arm
    // trails — bias the leader a touch more forward. Which arm leads flips with
    // the spin direction: frontside (+Y) the back/RIGHT arm leads; backside the
    // front/LEFT. This asymmetry reads as a real wrap, not a puppet swing.
    const lead = (pose.dir > 0 ? side === 'right' : side === 'left') ? 1 : -0.6;
    // On the landing she flings the arms wide and slightly back to catch balance.
    const catchSwing = -pose.balance * CATCH;

    // Everything below eases from the REST (arms-down) pose by the stance
    // weight `w`, so the arms blend in/out at the idle↔demo handoff instead of
    // snapping (neutral = rest for uz/ux/fz/hand, 0 for the wrap/pitch).
    if (upper) {
      upper.rotation.z = sign * lerp(rest.uz, uzTarget, w);
      // Lead arm reaches a touch farther forward through the air too, so the
      // wrap reads like a lead/trail pair, not a symmetric flap.
      upper.rotation.x = lerp(
        rest.ux,
        swingBase + lead * whip * 0.35 + lead * spinSwing * airDrive * 0.15 + catchSwing,
        w,
      );
      // Cross-body wrap: hands travel AROUND the torso. OLD wrap fired only on
      // whip+tuck (dead through the air); the WRAP_AIR term now carries it for
      // the whole rotation. Wraps the OPPOSITE way backside (× dir).
      upper.rotation.y =
        pose.dir * sign * (whip * CROSS + spinSwing * WRAP_AIR + pose.tuck * 0.3) * w;
    }
    // Elbows bend as she loads and whips, fold TIGHTER as the arms wrap around
    // mid-air (ELBOW_AIR via the spin bell), and pull in on the tuck.
    if (lower) {
      lower.rotation.z =
        sign *
        lerp(
          rest.fz,
          rest.fz + pose.tuck * 0.55 + (windup + whip) * ELBOW * 0.4 + spinSwing * ELBOW_AIR * 0.35,
          w,
        );
      lower.rotation.x = -(windup * 0.5 + whip * 0.7 + pose.tuck * 0.6 + spinSwing * 0.45) * w;
    }
    if (hand) hand.rotation.x = lerp(0.1, 0.1 + pose.tuck * 0.2 + spinSwing * 0.15, w);

    // GRAB override — front hand = left arm (regular stance), rear = right.
    applyGrabReach(
      upper,
      lower,
      sign,
      pose,
      (side === 'left' ? pose.grabFront : pose.grabRear) * w,
      (side === 'left' ? pose.grabRear : pose.grabFront) * w,
    );
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
    pose.pokeBack * stanceWeight,
    pose.pokeFront * stanceWeight,
  );
  applyTorsoAndHead(humanoid, pose, stanceWeight);
  applyArms(humanoid, pose, stanceWeight);
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

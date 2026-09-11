/**
 * Trick timelines + the demo state machine for the Kaori 3D stage.
 *
 * Every trick is a timeline of RiderPoses composed from the shared
 * fundamentals (riderFundamentals.ts): stance, crouch + hip drop, coil
 * wind-up, tuck, balance, jump arc. Adding a trick = one TRICKS entry.
 *
 * The demo runs as an on-board SESSION: while Kaori explains, she loops
 * the full trick with short stance breathers, and her spoken sentences
 * can cue segment demos (wind-up / pop / landing) in the gaps.
 *
 * Technique per Shred School / Snowboard Addiction / Whitelines trick
 * tips. Frontside for a regular rider spins counter-clockwise from above
 * (+Y yaw in three.js).
 */

import type { VRM } from '@pixiv/three-vrm';
import {
  applyRiderPose,
  clamp,
  clamp01,
  DOWNHILL_CHIN,
  DOWNHILL_LOOK,
  easeInOut,
  hipDropFor,
  jumpArc,
  LAND_DEMO_DURATION,
  landDemoPose,
  lerp,
  POP_DEMO_DURATION,
  phase,
  popDemoPose,
  REST_POSE,
  type RiderPose,
  resetRiderBones,
  STANCE_CROUCH,
  STANCE_YAW,
  stanceIdlePose,
  WIND_UP_DEMO_DURATION,
  windUpDemoPose,
} from './riderFundamentals';

export type TrickId =
  // Spins (flat axis)
  | 'frontside-180'
  | 'backside-180'
  | 'frontside-360'
  | 'frontside-360-stylish'
  | 'backside-360'
  | 'backside-360-stylish'
  | 'frontside-540'
  | 'backside-540'
  | 'frontside-720'
  | 'backside-720'
  | 'frontside-900'
  | 'backside-900'
  | 'frontside-1080'
  | 'backside-1080'
  | 'cab-180'
  | 'cab-360'
  // Flips + off-axis
  | 'wildcat'
  | 'tamedog'
  | 'backside-rodeo'
  | 'frontside-cork'
  | 'backside-cork'
  // Grabs (straight airs)
  | 'straight-air'
  | 'indy'
  | 'indy-nosebone'
  | 'weddle'
  | 'melon'
  | 'method'
  | 'nose-grab'
  | 'tail-grab'
  | 'stalefish'
  | 'japan'
  | 'crail'
  | 'roast-beef'
  | 'chicken-salad'
  | 'canadian-bacon'
  | 'seatbelt'
  | 'taipan'
  // Ground / flatland
  | 'ollie'
  | 'nollie'
  | 'nose-press'
  | 'tail-press'
  | 'butter'
  | 'nose-roll-180'
  | 'tail-roll-180'
  | 'tripod'
  | 'carved-turn'
  | 'ride-switch'
  // Jibs
  | 'fifty-fifty'
  | 'boardslide'
  | 'frontside-boardslide';

export type DemoAction = 'none' | 'full' | 'setup' | 'pop' | 'land';

export interface TrickTimeline {
  duration: number;
  /** Total root YAW over the trick (radians; + is frontside/CCW). */
  totalSpin: number;
  /** Total root PITCH/flip over the trick (radians, SIGNED: positive = wildcat,
   *  end over end in the TAIL direction — nose up and over backward; negative =
   *  tamedog, over the nose). Omit for pure spins (treated as 0). Yaw is about
   *  vertical, pitch about the local toe-heel axis (end over end) — the two
   *  compose independently. For corks/rodeos, totalFlip is the PEAK off-axis
   *  angle and pose.pitch is a bell that returns to 0 by landing. */
  totalFlip?: number;
  /** Constant stance-yaw offset (radians), eased by stance weight. π = the
   *  trick STARTS switch (cab tricks). Omit for regular-stance tricks. */
  yawOffset?: number;
  poseAt: (t: number) => RiderPose;
}

// --- 360 spins (frontside + backside share one core) ---
const FS360_SETUP_END = 1.5;
const FS360_POP_END = 1.8;
const FS360_AIR_END = 3.1;
const FS360_LAND_END = 3.7;
const FS360_SETTLE_END = 4.2;

// Head-spotting — live-tunable (the Trick Lab binds a HEAD panel per direction).
// Backside spins lead + spot over the OTHER shoulder, so they get their own
// HEAD_TUNING_BS. Defaults reproduce the prior behavior (LEAD 0 = no change),
// so only what you tune changes.
export const HEAD_TUNING = {
  DOWNHILL: 0.6, // resting downhill riding gaze (toward the nose / front foot)
  LEAD: 0, // look over the BACK shoulder at pop to LEAD the spin (signed; - = right/back shoulder)
  LEAD_END: 0.35, // how much of the air the lead persists before handing off
  FOLLOW: 0, // 0 = SPOT the landing (neck counter-rotates + whips — a mid-spin "pause"); 1 = head rides around WITH the body as one smooth rotation
  HOLD_FRAC: 0.5, // (spot mode) spin fraction she holds the gaze forward before whipping
  WHIP_END: 0.9, // (spot mode) spin fraction the head has re-fixated forward by
  SPOT: 0.32, // apex chin-down / spot magnitude
  ROLL: 0.26, // head roll over the shoulder at the apex
  NECK_CAP: 1.3, // anatomical neck-yaw limit (~75°)
};
export const HEAD_TUNING_BS: typeof HEAD_TUNING = {
  DOWNHILL: 0.6,
  LEAD: -0.9, // look over her RIGHT/back shoulder at the pop (regular-stance backside)
  LEAD_END: 0.45,
  FOLLOW: 1, // backside: head rotates smoothly WITH the body — no spotting pause
  HOLD_FRAC: 0.5,
  WHIP_END: 0.9,
  SPOT: 0.32,
  ROLL: 0.26,
  NECK_CAP: 1.3,
};

/**
 * Shared 360 timeline for frontside AND backside so they never drift apart.
 * `dir` = +1 frontside (CCW / +Y) or -1 backside (CW / -Y): it flips the body
 * wind, head look and arm wrap (carried out via pose.dir in the appliers) so a
 * backside READS as backside. The actual rotation is carried by the trick's
 * signed totalSpin — NOT by the coil, which stays frontside-signed for BOTH so
 * the arm load→whip TIMING (applyArms keys windup/whip off the coil sign) is
 * preserved.
 */
function spin360PoseAt(t: number, dir: 1 | -1): RiderPose {
  const setup = phase(t, 0, FS360_SETUP_END);
  const pop = phase(t, FS360_SETUP_END, FS360_POP_END);
  const air = phase(t, FS360_POP_END, FS360_AIR_END);
  const land = phase(t, FS360_AIR_END, FS360_LAND_END);
  const settle = phase(t, FS360_LAND_END, FS360_SETTLE_END);

  const spin = pop > 0 ? clamp01(0.08 * pop + 0.84 * easeInOut(air) + 0.08 * land) : 0;
  const height = jumpArc(phase(t, FS360_POP_END - 0.08, FS360_AIR_END + 0.15), 0.55);

  // Knees sink DEEP going into it, explode at pop, tuck, absorb, settle
  let crouch = lerp(STANCE_CROUCH, 0.68, easeInOut(setup));
  if (pop > 0) crouch = lerp(0.68, 0.06, easeInOut(pop));
  if (air > 0) crouch = lerp(0.06, 0.32, easeInOut(air));
  if (land > 0) crouch = lerp(0.32, 0.72, easeInOut(clamp01(land * 2)));
  if (land > 0.5) crouch = lerp(0.72, 0.35, easeInOut((land - 0.5) * 2));
  if (settle > 0) crouch = lerp(0.35, STANCE_CROUCH, easeInOut(settle));

  // Coil: wind away during setup, whip through at pop. The SHOULDERS lead and
  // the hips catch up (coil ratio in applyTorsoAndHead). Frontside-signed for
  // BOTH directions — the -0.7→+0.5 progression is the load→whip TIMING; the
  // WIND direction is flipped by pose.dir in the appliers, not here.
  let coil = -0.7 * easeInOut(setup);
  if (pop > 0) coil = lerp(-0.7, 0.5, easeInOut(pop));
  if (air > 0) coil = lerp(0.5, 0.05, easeInOut(air));
  if (land > 0) coil = lerp(0.05, 0, land);

  const tuck = air > 0 && land === 0 ? Math.sin(Math.PI * air) : 0;
  const balance = land > 0 ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle) : 0;

  // Head — HEAD-SPOTTING (one continuous curve, no snaps). The BODY sweeps a
  // full dir*2π via rootYaw; the neck (its child) COUNTER-rotates to keep her
  // GAZE on the landing. World head yaw = dir*2π*spin + neck.y, so the neck
  // target to hold world-forward (the downhill riding gaze) is DOWNHILL_LOOK −
  // dir*2π*spin, capped at the neck limit. She holds the gaze forward as long as
  // she anatomically can, then the body drags her head around FAST (a quick apex
  // glance, not the old slow blind lead-the-spin sweep) and she RE-FIXATES
  // forward — measured from the END of the revolution — landing looking downhill.
  // (Frontside holds a touch longer than backside because she spins toward her
  // downhill gaze; that small asymmetry is physical, not a bug.)
  const H = dir < 0 ? HEAD_TUNING_BS : HEAD_TUNING;
  const bodyYaw = dir * Math.PI * 2 * spin;
  const holdLead = clamp(H.DOWNHILL - bodyYaw, -H.NECK_CAP, H.NECK_CAP);
  const reFixLead = clamp(H.DOWNHILL - dir * Math.PI * 2 * (spin - 1), -H.NECK_CAP, H.NECK_CAP);
  const whip = easeInOut(clamp01((spin - H.HOLD_FRAC) / (H.WHIP_END - H.HOLD_FRAC)));
  // LEAD the spin: as she pops she turns to look over her BACK shoulder to
  // initiate the rotation (H.LEAD signed — negative = over the right/back
  // shoulder for a regular-stance backside), peaking early and fading into the
  // spot by H.LEAD_END. Clamped to the neck limit.
  // Peaks AT the pop (before she's really rotating — the anticipation look) and
  // fades over the first LEAD_END of the air, so she's already looking over her
  // back shoulder as she leaves the lip.
  const leadArc = pop < 1 ? easeInOut(pop) : clamp01(1 - air / Math.max(0.05, H.LEAD_END));
  // At the pop she LOOKS over her back shoulder (gaze = DOWNHILL + LEAD); as
  // leadArc fades, the normal hold→whip spot model takes over. Lerp (not add) so
  // the lead DOMINATES at the pop instead of just nudging the downhill hold.
  const leadLook = clamp(H.DOWNHILL + H.LEAD, -H.NECK_CAP, H.NECK_CAP);
  // Two head styles, blended by H.FOLLOW:
  //  SPOT (0): neck COUNTER-rotates to hold the gaze, then whips → reads as a
  //   mid-spin PAUSE. FOLLOW (1): the head rides around WITH the body (a steady
  //   lead, no counter-rotation) so head + shoulders are ONE smooth rotation
  //   that carries through the whole spin and slows to a stop at the settle.
  const spotLead = lerp(holdLead, reFixLead, whip);
  const followLead = clamp(H.DOWNHILL + H.LEAD * 0.4, -H.NECK_CAP, H.NECK_CAP);
  const baseLead = lerp(spotLead, followLead, H.FOLLOW);
  let headLead = lerp(baseLead, leadLook, leadArc);
  // Chin/roll: whip-peaked when spotting; a smooth rise-and-fall over the spin
  // when following (no mid-spin chin bob).
  const arc = lerp(Math.sin(Math.PI * whip), Math.sin(Math.PI * clamp01(spin)), H.FOLLOW);
  let headSpot = lerp(DOWNHILL_CHIN, H.SPOT, arc);
  let headRoll = dir * H.ROLL * arc;
  if (settle > 0) {
    // End on the exact downhill riding gaze she started from.
    const s = easeInOut(settle);
    headLead = lerp(headLead, H.DOWNHILL, s);
    headSpot = lerp(headSpot, DOWNHILL_CHIN, s);
    headRoll = lerp(headRoll, 0, s);
  }

  return {
    ...REST_POSE,
    spin,
    pitch: 0, // pure yaw spin — no flip
    height,
    crouch,
    coil,
    tuck,
    balance,
    headLead,
    headSpot,
    headRoll,
    backLegLift: 0,
    frontLegLift: 0,
    boardTilt: 0,
    dir,
  };
}

/** Frontside 360 — CCW / +Y. */
function frontside360PoseAt(t: number): RiderPose {
  return spin360PoseAt(t, 1);
}

/** Backside 360 — CW / -Y (mirror). */
function backside360PoseAt(t: number): RiderPose {
  return spin360PoseAt(t, -1);
}

/**
 * A more STYLISH frontside 360: she lifts her back leg as she spins so the
 * board angles (tail up), then ~3/4 through she pushes the back leg down and
 * lifts the front leg (board angles the other way) to set up a tail-first
 * landing, slapping the board down tail-then-nose. Head/shoulder work is
 * inherited from the base FS360. (First pass — tune the leg/board amounts and
 * the tilt axis/sign on-device.)
 */
function frontside360StylishPoseAt(t: number): RiderPose {
  const base = frontside360PoseAt(t);
  const air = phase(t, FS360_POP_END, FS360_AIR_END);
  const land = phase(t, FS360_AIR_END, FS360_LAND_END);
  const airborne = air > 0 && land === 0;

  // First ~3/4 of the spin vs the last quarter, measured off the spin progress.
  const early = clamp01(base.spin / 0.72);
  const late = clamp01((base.spin - 0.72) / 0.28);

  // Only the LEGS move here — the board is locked to the feet in KaoriStage and
  // its angle follows them, so lifting a leg tilts that end of the board.
  // First ~3/4: lift the BACK leg (tail rises). Last quarter: drop it and lift
  // the FRONT leg (board angles the other way).
  let backLegLift = airborne ? 0.9 * easeInOut(early) * (1 - easeInOut(late)) : 0;
  let frontLegLift = airborne ? 0.7 * easeInOut(late) : 0;

  if (land > 0) {
    // Land tail-first: the front foot stays up (nose up / tail down) at contact,
    // then drops so the nose slaps down after it.
    frontLegLift = 0.5 * (1 - easeInOut(clamp01(land * 2)));
    backLegLift = 0;
  }

  // boardTilt is unused now (the board derives its angle from the feet).
  return { ...base, backLegLift, frontLegLift, boardTilt: 0 };
}

/** Live-tunable leg tweak for the STYLISH backside 360 (the Trick Lab binds a
 *  Style panel to it). Amounts are leg-lift magnitudes; P1_END/P2_END are the
 *  spin fractions where the nose-up → tail-up → nose-down phases hand off. */
export const STYLE_BS = {
  FRONT_EARLY: 0.85, // nose UP off the lip (front foot lifts first)
  BACK_MID: 0.9, // tail UP through the middle (back foot lifts)
  FRONT_LATE: 0.6, // nose UP again into the landing (front foot lifts)
  P1_END: 0.33, // spin fraction the nose-up (front) phase ends
  P2_END: 0.66, // spin fraction the tail-up (back) phase ends
  LAND_FRONT: 0.5, // nose-up at touchdown so the TAIL lands first, then the nose slaps
};

/**
 * A STYLISH backside 360 — a boned-out board play through the spin, driven by
 * the LEGS (the board is locked to the feet in KaoriStage, so lifting a foot
 * tilts that end): front up → nose up off the lip; ~1/3 in the back foot lifts
 * (tail up) as the front extends (nose points down); then it switches back so
 * the nose is up and the TAIL lands first, then the nose slaps down. Arms + head
 * inherit from the base backside 360 (dir < 0). Tune it in the lab (STYLE_BS).
 */
function backside360StylishPoseAt(t: number): RiderPose {
  const base = backside360PoseAt(t);
  const air = phase(t, FS360_POP_END, FS360_AIR_END);
  const land = phase(t, FS360_AIR_END, FS360_LAND_END);
  const airborne = air > 0 && land === 0;
  const s = base.spin;

  const p1 = clamp01(s / STYLE_BS.P1_END); // front UP (nose up)
  const p2 = clamp01((s - STYLE_BS.P1_END) / Math.max(0.05, STYLE_BS.P2_END - STYLE_BS.P1_END)); // back UP, front extends
  const p3 = clamp01((s - STYLE_BS.P2_END) / Math.max(0.05, 1 - STYLE_BS.P2_END)); // switch back

  // Front foot: UP early (nose up) → extends DOWN mid (nose down) → UP again late.
  let frontLegLift = airborne
    ? STYLE_BS.FRONT_EARLY * easeInOut(p1) * (1 - easeInOut(p2)) +
      STYLE_BS.FRONT_LATE * easeInOut(p3)
    : 0;
  // Back foot: 0 early → UP mid (tail up) → DOWN late (drops to land).
  let backLegLift = airborne ? STYLE_BS.BACK_MID * easeInOut(p2) * (1 - easeInOut(p3)) : 0;

  if (land > 0) {
    // Tail-first landing: the nose stays up at contact, then drops (nose slaps).
    frontLegLift = STYLE_BS.LAND_FRONT * (1 - easeInOut(clamp01(land * 2)));
    backLegLift = 0;
  }

  return { ...base, backLegLift, frontLegLift, boardTilt: 0 };
}

// --- Flips: wildcat (BACKFLIP over the tail) + tamedog (FRONTFLIP over the nose)
// A flip is a whole-body PITCH about the board's long axis, pivoted at the CoM
// (hip) in KaoriStage, coordinated with a bigger jump arc. It reuses the 360
// phase skeleton but drives pose.PITCH (not pose.spin), so rootYaw stays pure
// STANCE_YAW*ease (totalSpin=0) and applyArms' spin-driven Y cross-body wrap
// stays ~0 (flip arms are SAGITTAL: tuck draw-in + balance fling, no Y whip).
const FLIP_PEAK_HEIGHT = 0.62; // bigger air than the 360's 0.55
const FLIP_TUCK_PEAK = 0.9; // tighter than the 360 (knees-to-chest)

/**
 * Shared flip core. `dir` = -1 wildcat (backward / over the tail) or +1 tamedog
 * (forward / over the nose). The actual rotation SIGN is carried by the trick's
 * signed totalFlip in driveDemo; here `dir` only shapes the HEAD spot — the
 * biggest read difference (wildcat spots the landing LATE/blind, tamedog EARLY).
 */
function flipPoseAt(t: number, dir: 1 | -1): RiderPose {
  const setup = phase(t, 0, FS360_SETUP_END);
  const pop = phase(t, FS360_SETUP_END, FS360_POP_END);
  const air = phase(t, FS360_POP_END, FS360_AIR_END);
  const land = phase(t, FS360_AIR_END, FS360_LAND_END);
  const settle = phase(t, FS360_LAND_END, FS360_SETTLE_END);

  // FLIP progress → pose.pitch. Same 0.06 / easeInOut(air) / 0.06 shape as the
  // 360's spin (velocity-matched at the pop/land edges) and parks EXACTLY at
  // 1.0 == full 2π == identity (no landing snap). Fastest through the apex.
  const pitch = pop > 0 ? clamp01(0.06 * pop + 0.88 * easeInOut(air) + 0.06 * land) : 0;

  // Bigger, slightly longer air than a 360.
  const height = jumpArc(phase(t, FS360_POP_END - 0.08, FS360_AIR_END + 0.15), FLIP_PEAK_HEIGHT);

  // Crouch: deep vertical LOAD, explode at pop, refold through the air, absorb.
  let crouch = lerp(STANCE_CROUCH, 0.7, easeInOut(setup));
  if (pop > 0) crouch = lerp(0.7, 0.08, easeInOut(pop));
  // Knees-to-chest through the inversion: fold DEEP fast off the pop, hold the
  // tuck through the apex, open back up for the landing. (The `tuck` channel
  // only shapes the spine/arms — the actual knee fold is this crouch.)
  if (air > 0) crouch = lerp(0.08, 0.72, easeInOut(clamp01(air * 1.9)));
  if (air > 0.62) crouch = lerp(0.72, 0.35, easeInOut((air - 0.62) / 0.38));
  if (land > 0) crouch = lerp(0.35, 0.72, easeInOut(clamp01(land * 2)));
  if (land > 0.5) crouch = lerp(0.72, 0.35, easeInOut((land - 0.5) * 2));
  if (settle > 0) crouch = lerp(0.35, STANCE_CROUCH, easeInOut(settle));

  // COIL: NO Y-wind for a flip — stay ON-AXIS (a shoulder/hip twist corkscrews
  // it off-axis). Just a small vertical load feel in setup, ~0 through the air.
  let coil = -0.35 * easeInOut(setup);
  if (pop > 0) coil = lerp(-0.35, 0, easeInOut(pop));

  // TUCK: tighter than a 360 (knees-to-chest), bell across the air.
  const airBell = air > 0 && land === 0 ? Math.sin(Math.PI * air) : 0;
  const tuck = FLIP_TUCK_PEAK * airBell;
  const balance = land > 0 ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle) : 0;

  // Deep-researched styling (PUSH / Snowboard Addiction / Shred School):
  // — wildcat rides the tuck with an INDY grab (rear hand, toe edge);
  // — the pop is ollie-like off the TAIL (nose rises first); tamedog pops
  //   nollie-style off the NOSE (tail rises first);
  // — touchdown is slightly TAIL-FIRST (nose kept up through contact).
  const grabRear = dir < 0 ? clamp01(airBell * 1.5) : 0;
  const popLift =
    pop > 0 && air < 0.3 ? 0.45 * Math.sin(Math.PI * clamp01(pop * 0.6 + air * 1.4)) : 0;
  let frontLegLift = dir < 0 ? popLift : 0;
  let backLegLift = dir > 0 ? popLift : 0;
  if (land > 0) {
    frontLegLift = 0.42 * (1 - easeInOut(clamp01(land * 2)));
    backLegLift = 0;
  }

  // HEAD — pitch-based (headSpot = chin up/down), the signature flip read.
  // wildcat (dir<0): throw the head BACK/up at pop (headSpot NEGATIVE), blind
  //   through the inverted apex, re-spot the snow LATE (~p 0.7, swings POSITIVE).
  // tamedog (dir>0): throw the head DOWN/forward early (headSpot POSITIVE), and
  //   because she flips toward her gaze she re-fixates the landing cleanly ~2/3.
  const p = pitch;
  const headLead = DOWNHILL_LOOK; // no yaw here — just hold the downhill gaze
  let headSpot: number;
  if (dir < 0) {
    // Eyes LEAD the rotation continuously (research: spot early, not blind):
    // a moderate head-back through the first half, re-spotting from ~0.55.
    const throwBack = Math.sin(Math.PI * clamp01(p / 0.7));
    const reSpot = easeInOut(clamp01((p - 0.55) / 0.4));
    headSpot = lerp(-0.42 * throwBack, 0.45, reSpot);
  } else {
    const throwDown = easeInOut(clamp01(p / 0.44));
    const reFix = easeInOut(clamp01((p - 0.66) / 0.34));
    headSpot = lerp(0.25 + 0.2 * throwDown, 0.45, reFix);
  }
  // Subtle head-over-shoulder roll toward the flip direction reads as commitment.
  let headRoll = dir * 0.14 * Math.sin(Math.PI * clamp01(p));

  if (settle > 0) {
    const s = easeInOut(settle);
    headSpot = lerp(headSpot, DOWNHILL_CHIN, s);
    headRoll = lerp(headRoll, 0, s);
  }

  return {
    ...REST_POSE,
    spin: 0, // FLIP: no yaw — rootYaw stays STANCE_YAW*ease
    pitch,
    height,
    crouch,
    coil,
    tuck,
    balance,
    headLead,
    headSpot,
    headRoll,
    backLegLift,
    frontLegLift,
    grabRear,
    grabSide: 1,
    grabReach: 0,
    boardTilt: 0,
    dir,
  };
}

/** Wildcat = BACKFLIP (over the tail, backward). */
function wildcatPoseAt(t: number): RiderPose {
  return flipPoseAt(t, -1);
}

/** Tamedog = FRONTFLIP (over the nose, forward). */
function tamedogPoseAt(t: number): RiderPose {
  return flipPoseAt(t, 1);
}

// =============================================================================
// GENERALIZED CORES — every Trickipedia snowboard trick is one of six motion
// families. Each `make*` returns a TrickTimeline; the registry below is data.
// The verified 360s/flips above keep their exact original code paths.
// =============================================================================

// --- Any-rotation spin (180 → 1080, frontside/backside, optional switch start).
// Air time scales with rotation; the head rides WITH multi-rev spins (spot-and-
// whip per rev reads robotic) and re-fixates downhill off the landing.
function makeSpin(revs: number, dir: 1 | -1, yawOffset = 0): TrickTimeline {
  const SETUP = 1.5;
  const POP = SETUP + 0.3;
  const AIR = POP + 0.9 + 0.42 * revs;
  const LAND = AIR + 0.6;
  const SETTLE = LAND + (Number.isInteger(revs) ? 0.5 : 0.85);
  const totalSpin = dir * Math.PI * 2 * revs;
  // Where pose.spin must END so the final yaw ≡ stance (mod 2π): fractional
  // spins pivot FORWARD on the snow through the settle to complete the turn
  // (reads as a rider revert). Cab tricks bake their switch start into this.
  const endTarget =
    (Math.round((yawOffset + totalSpin) / (Math.PI * 2)) * Math.PI * 2 - yawOffset) / totalSpin;

  const poseAt = (t: number): RiderPose => {
    const setup = phase(t, 0, SETUP);
    const pop = phase(t, SETUP, POP);
    const air = phase(t, POP, AIR);
    const land = phase(t, AIR, LAND);
    const settle = phase(t, LAND, SETTLE);

    let spin = pop > 0 ? clamp01(0.08 * pop + 0.84 * easeInOut(air) + 0.08 * land) : 0;
    if (settle > 0) spin = lerp(1, endTarget, easeInOut(settle));
    const height = jumpArc(
      phase(t, POP - 0.08, AIR + 0.15),
      Math.min(0.75, 0.55 + 0.06 * (revs - 1)),
    );

    let crouch = lerp(STANCE_CROUCH, 0.68, easeInOut(setup));
    if (pop > 0) crouch = lerp(0.68, 0.06, easeInOut(pop));
    if (air > 0) crouch = lerp(0.06, 0.32, easeInOut(air));
    if (land > 0) crouch = lerp(0.32, 0.72, easeInOut(clamp01(land * 2)));
    if (land > 0.5) crouch = lerp(0.72, 0.35, easeInOut((land - 0.5) * 2));
    if (settle > 0) crouch = lerp(0.35, STANCE_CROUCH, easeInOut(settle));

    // Bigger spins wind up HARDER (more stored rotation).
    const coilMag = Math.min(0.85, 0.6 + 0.1 * revs);
    let coil = -coilMag * easeInOut(setup);
    if (pop > 0) coil = lerp(-coilMag, 0.5, easeInOut(pop));
    if (air > 0) coil = lerp(0.5, 0.05, easeInOut(air));
    if (land > 0) coil = lerp(0.05, 0, land);

    const tuck =
      air > 0 && land === 0 ? Math.sin(Math.PI * air) * Math.min(1, 0.7 + 0.15 * revs) : 0;
    const balance = land > 0 ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle) : 0;

    // Head: ride with the rotation (a steady lead over the leading shoulder),
    // re-fixate downhill over the last quarter revolution.
    const H = dir < 0 ? HEAD_TUNING_BS : HEAD_TUNING;
    const followLead = clamp(H.DOWNHILL + dir * 0.45, -H.NECK_CAP, H.NECK_CAP);
    const reFix = clamp(
      H.DOWNHILL - dir * Math.PI * 2 * revs * (Math.min(spin, 1) - 1),
      -H.NECK_CAP,
      H.NECK_CAP,
    );
    const refixW = easeInOut(clamp01((spin - (1 - 0.25 / revs)) / (0.25 / revs)));
    let headLead = lerp(followLead, reFix, refixW);
    const arc = Math.sin(Math.PI * clamp01(spin));
    let headSpot = lerp(DOWNHILL_CHIN, H.SPOT, arc);
    let headRoll = dir * H.ROLL * arc;
    if (settle > 0) {
      const s = easeInOut(settle);
      headLead = lerp(headLead, H.DOWNHILL, s);
      headSpot = lerp(headSpot, DOWNHILL_CHIN, s);
      headRoll = lerp(headRoll, 0, s);
    }

    return {
      ...REST_POSE,
      spin,
      height,
      crouch,
      coil,
      tuck,
      balance,
      headLead,
      headSpot,
      headRoll,
      dir,
    };
  };
  return { duration: SETTLE, totalSpin, yawOffset, poseAt };
}

// --- Off-axis: corks + rodeos. A spin whose body dips off-axis mid-air (pitch
// bell peaks at the apex, returns to 0 for the landing). corkPeak > ~2 rad
// reads properly inverted (rodeo); ~1.2 rad is a shoulder-dip cork.
function makeCork(revs: number, dir: 1 | -1, corkPeak: number): TrickTimeline {
  const base = makeSpin(revs, dir);
  const POP = 1.8;
  const AIR = POP + 0.9 + 0.42 * revs;
  const poseAt = (t: number): RiderPose => {
    const pose = base.poseAt(t);
    const air = phase(t, POP, AIR);
    // Bell 0→1→0 across the air — driveDemo multiplies by totalFlip (the peak).
    pose.pitch = air > 0 && air < 1 ? Math.sin(Math.PI * air) : 0;
    // Corked spins throw the head INTO the dip instead of holding downhill.
    pose.headSpot += 0.2 * pose.pitch * Math.sign(corkPeak);
    return pose;
  };
  return { ...base, totalFlip: corkPeak, poseAt };
}

// --- Grab airs. Straight air + a grab spec: which hand, where on the board,
// which edge, plus leg pokes/lifts and back-arch styling per trick.
interface GrabSpec {
  front?: number; // 0..1 front-hand grab amount
  rear?: number; // 0..1 rear-hand grab amount
  reach?: number; // -1 nose … 0 between feet … +1 tail
  side?: number; // +1 toe edge, -1 heel edge
  tuck?: number; // knees-to-board fold (default 0.5 — brings the board in reach)
  pokeFront?: number;
  pokeBack?: number;
  frontLegLift?: number;
  backLegLift?: number;
  arch?: number;
  balance?: number; // arms-out styling for grab-less straight air
}
function makeGrabAir(spec: GrabSpec): TrickTimeline {
  const SETUP = 1.1;
  const POP = SETUP + 0.25;
  const AIR = POP + 1.5;
  const LAND = AIR + 0.6;
  const SETTLE = LAND + 0.5;
  const poseAt = (t: number): RiderPose => {
    const setup = phase(t, 0, SETUP);
    const pop = phase(t, SETUP, POP);
    const air = phase(t, POP, AIR);
    const land = phase(t, AIR, LAND);
    const settle = phase(t, LAND, SETTLE);

    const height = jumpArc(phase(t, POP - 0.08, AIR + 0.12), 0.6);
    let crouch = lerp(STANCE_CROUCH, 0.62, easeInOut(setup));
    if (pop > 0) crouch = lerp(0.62, 0.08, easeInOut(pop));
    // Fold the knees well up mid-air — with the board locked to the feet this
    // is what brings the board UP into the grabbing hand's reach.
    if (air > 0) crouch = lerp(0.08, 0.62, easeInOut(clamp01(air * 1.6)));
    if (air > 0.7) crouch = lerp(0.62, 0.3, easeInOut((air - 0.7) / 0.3));
    if (land > 0) crouch = lerp(0.3, 0.68, easeInOut(clamp01(land * 2)));
    if (land > 0.5) crouch = lerp(0.68, 0.35, easeInOut((land - 0.5) * 2));
    if (settle > 0) crouch = lerp(0.35, STANCE_CROUCH, easeInOut(settle));

    // Straight takeoff — barely any wind.
    let coil = -0.15 * easeInOut(setup);
    if (pop > 0) coil = lerp(-0.15, 0.1, easeInOut(pop));
    if (air > 0) coil = lerp(0.1, 0, air);

    const airBell = air > 0 && land === 0 ? Math.sin(Math.PI * air) : 0;
    // Fast reach-in, held plateau, fast release.
    const g = clamp01(airBell * 1.7);
    const tuck = (spec.tuck ?? 0.5) * airBell;
    const balance =
      land > 0
        ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle)
        : (spec.balance ?? 0) * airBell;

    let headSpot = DOWNHILL_CHIN + 0.22 * g; // glance down at the grab
    let headRoll = 0.1 * g;
    if (settle > 0) {
      const s = easeInOut(settle);
      headSpot = lerp(headSpot, DOWNHILL_CHIN, s);
      headRoll = lerp(headRoll, 0, s);
    }

    return {
      ...REST_POSE,
      height,
      crouch,
      coil,
      tuck,
      balance,
      headLead: DOWNHILL_LOOK,
      headSpot,
      headRoll,
      grabFront: (spec.front ?? 0) * g,
      grabRear: (spec.rear ?? 0) * g,
      grabReach: spec.reach ?? 0,
      grabSide: spec.side ?? 1,
      pokeFront: (spec.pokeFront ?? 0) * g,
      pokeBack: (spec.pokeBack ?? 0) * g,
      frontLegLift: (spec.frontLegLift ?? 0) * airBell,
      backLegLift: (spec.backLegLift ?? 0) * airBell,
      arch: (spec.arch ?? 0) * g,
    };
  };
  return { duration: SETTLE, totalSpin: 0, poseAt };
}

// --- Ground family: presses, butters, rolls, ollie/nollie, carve, switch.
// All flatground (height ≈ 0 except the pops); rotation via totalSpin = 1 so
// pose.spin carries SIGNED RADIANS directly (full freedom for wiggles/rolls).
function makePress(
  end: 'nose' | 'tail',
  opts?: { spinWiggle?: number; roll?: number },
): TrickTimeline {
  const IN = 0.7;
  const HOLD = IN + 1.8;
  const OUT = HOLD + 0.6;
  const roll = opts?.roll ?? 0; // signed radians of flat rotation during the press
  const wiggle = opts?.spinWiggle ?? 0;
  const poseAt = (t: number): RiderPose => {
    const tin = phase(t, 0, IN);
    const tout = phase(t, HOLD, OUT);
    const amt = easeInOut(tin) * (1 - easeInOut(tout));
    // Tail press: weight back, FRONT foot lifts → nose rises (feet-lock).
    const lift = 0.62 * amt + Math.sin(t * 2.1) * 0.04 * amt; // held with a wobble
    let spin = 0;
    if (roll) spin = roll * easeInOut(phase(t, IN * 0.6, HOLD * 0.85));
    if (wiggle) spin += wiggle * Math.sin((t - IN) * 2.2) * amt;
    if (roll && tout > 0) {
      // Complete the rotation forward to a full 2π so she ends facing stance.
      const rest = Math.sign(roll) * (Math.PI * 2 - Math.abs(roll));
      spin = roll + rest * easeInOut(tout);
    }
    return {
      ...REST_POSE,
      spin,
      crouch: lerp(STANCE_CROUCH, end === 'tail' ? 0.5 : 0.42, amt),
      frontLegLift: end === 'tail' ? lift : 0,
      backLegLift: end === 'nose' ? lift : 0,
      balance: 0.42 * amt,
      arch: end === 'tail' ? 0.18 * amt : 0,
      headLead: DOWNHILL_LOOK,
      headSpot: DOWNHILL_CHIN + (end === 'nose' ? 0.22 * amt : 0),
    };
  };
  return { duration: OUT, totalSpin: 1, poseAt };
}

function makePop(kind: 'ollie' | 'nollie'): TrickTimeline {
  const SNAP = 0.55; // load
  const POP = SNAP + 0.22; // the snap off tail (ollie) / nose (nollie)
  const AIR = POP + 0.55;
  const LAND = AIR + 0.5;
  const SETTLE = LAND + 0.45;
  const poseAt = (t: number): RiderPose => {
    const load = phase(t, 0, SNAP);
    const snap = phase(t, SNAP, POP);
    const air = phase(t, POP, AIR);
    const land = phase(t, AIR, LAND);
    const settle = phase(t, LAND, SETTLE);
    const height = jumpArc(phase(t, SNAP + 0.1, AIR + 0.1), 0.34);
    // The snap: one end rises FIRST (nose for ollie), levels mid-air.
    const snapLift = snap > 0 ? Math.sin(Math.PI * clamp01(snap + air * 0.5)) * 0.55 : 0;
    let crouch = lerp(STANCE_CROUCH, 0.6, easeInOut(load));
    if (snap > 0) crouch = lerp(0.6, 0.12, easeInOut(snap));
    if (air > 0) crouch = lerp(0.12, 0.3, air);
    if (land > 0) crouch = lerp(0.3, 0.55, easeInOut(clamp01(land * 2)));
    if (settle > 0) crouch = lerp(0.55, STANCE_CROUCH, easeInOut(settle));
    return {
      ...REST_POSE,
      height,
      crouch,
      frontLegLift: kind === 'ollie' ? snapLift : 0,
      backLegLift: kind === 'nollie' ? snapLift : 0,
      balance: land > 0 ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle) : 0,
      headLead: DOWNHILL_LOOK,
      headSpot: DOWNHILL_CHIN,
    };
  };
  return { duration: SETTLE, totalSpin: 0, poseAt };
}

function makeCarve(): TrickTimeline {
  const D = 4.0;
  const poseAt = (t: number): RiderPose => {
    // Toe-side carve, release, heel-side carve — lean + a yaw sweep each way.
    const toe = easeInOut(phase(t, 0.2, 1.0)) * (1 - easeInOut(phase(t, 1.4, 2.0)));
    const heel = easeInOut(phase(t, 2.1, 2.9)) * (1 - easeInOut(phase(t, 3.3, 3.9)));
    const lean = toe * 0.9 - heel * 0.9;
    return {
      ...REST_POSE,
      spin: toe * 0.5 - heel * 0.5, // totalSpin=1 → radians of yaw sweep
      crouch: STANCE_CROUCH + (toe + heel) * 0.3,
      edgeLean: lean,
      balance: (toe + heel) * 0.25,
      headLead: DOWNHILL_LOOK + (toe - heel) * 0.2,
      headSpot: DOWNHILL_CHIN,
      coil: (toe - heel) * 0.15,
    };
  };
  return { duration: D, totalSpin: 1, poseAt };
}

function makeRideSwitch(): TrickTimeline {
  const HOP_IN = 0.7;
  const RIDE = HOP_IN + 1.6;
  const SETTLE = RIDE + 0.8;
  const poseAt = (t: number): RiderPose => {
    const hopIn = phase(t, 0.3, HOP_IN);
    const settle = phase(t, RIDE, SETTLE);
    let spin = easeInOut(hopIn); // flat 180 pivot to switch
    if (settle > 0) spin = lerp(1, 2, easeInOut(settle)); // pivot on through to regular
    const height = jumpArc(hopIn, 0.16) + (settle > 0 ? jumpArc(settle, 0.14) : 0);
    return {
      ...REST_POSE,
      spin,
      height,
      crouch: STANCE_CROUCH + 0.1,
      balance: 0.2,
      headLead: DOWNHILL_LOOK,
      headSpot: DOWNHILL_CHIN,
    };
  };
  return { duration: SETTLE, totalSpin: Math.PI, poseAt };
}

function makeTripod(): TrickTimeline {
  const IN = 0.8;
  const HOLD = IN + 1.6;
  const OUT = HOLD + 0.7;
  const poseAt = (t: number): RiderPose => {
    const tin = phase(t, 0, IN);
    const tout = phase(t, HOLD, OUT);
    const amt = easeInOut(tin) * (1 - easeInOut(tout));
    return {
      ...REST_POSE,
      crouch: lerp(STANCE_CROUCH, 0.85, amt), // fold deep
      backLegLift: 0.9 * amt, // tail up → nose digs in
      grabFront: amt, // both hands reach down toward the snow by the nose
      grabRear: amt,
      grabReach: -0.9,
      grabSide: 1,
      headSpot: DOWNHILL_CHIN + 0.45 * amt,
      headLead: DOWNHILL_LOOK * (1 - amt * 0.5),
    };
  };
  return { duration: OUT, totalSpin: 0, poseAt };
}

// --- Jibs: 50-50 (straight balanced ride) + boardslides (hop to 90°, hold, out).
function makeFiftyFifty(): TrickTimeline {
  const D = 3.0;
  const poseAt = (t: number): RiderPose => {
    const on = easeInOut(phase(t, 0, 0.5)) * (1 - easeInOut(phase(t, 2.4, 3.0)));
    return {
      ...REST_POSE,
      crouch: STANCE_CROUCH + 0.14 * on + Math.sin(t * 3.1) * 0.02 * on,
      balance: 0.35 * on,
      headLead: DOWNHILL_LOOK,
      headSpot: DOWNHILL_CHIN + 0.12 * on, // eyes on the rail
    };
  };
  return { duration: D, totalSpin: 0, poseAt };
}

function makeBoardslide(dir: 1 | -1): TrickTimeline {
  const HOP_IN = 0.55;
  const ON = HOP_IN + 0.3;
  const SLIDE = ON + 1.4;
  const OUT = SLIDE + 0.35;
  const SETTLE = OUT + 0.5;
  const poseAt = (t: number): RiderPose => {
    const hopIn = phase(t, HOP_IN - 0.25, ON);
    const out = phase(t, SLIDE, OUT);
    const settle = phase(t, OUT, SETTLE);
    const spin = easeInOut(hopIn) * (1 - easeInOut(out)); // to 90° and back
    const height = jumpArc(hopIn, 0.24) + (out > 0 ? jumpArc(out, 0.2) : 0);
    const sliding = spin > 0.9 ? 1 : 0;
    return {
      ...REST_POSE,
      spin,
      height,
      crouch:
        lerp(STANCE_CROUCH, 0.45, easeInOut(hopIn)) -
        (settle > 0 ? (0.45 - STANCE_CROUCH) * easeInOut(settle) : 0),
      balance: 0.5 * spin,
      // Look along the DIRECTION OF TRAVEL (counter-rotate the head off the 90°).
      headLead: DOWNHILL_LOOK - dir * 1.1 * spin,
      headSpot: DOWNHILL_CHIN + 0.15 * sliding,
      coil: -0.15 * spin * dir,
      dir,
    };
  };
  return { duration: SETTLE, totalSpin: dir * (Math.PI / 2), poseAt };
}

export const TRICKS: Record<TrickId, TrickTimeline> = {
  'frontside-360': {
    duration: FS360_SETTLE_END,
    totalSpin: Math.PI * 2,
    poseAt: frontside360PoseAt,
  },
  'frontside-360-stylish': {
    duration: FS360_SETTLE_END,
    totalSpin: Math.PI * 2,
    poseAt: frontside360StylishPoseAt,
  },
  'backside-360': {
    duration: FS360_SETTLE_END,
    // NEGATIVE = clockwise from above (the mirror of frontside's +2π).
    totalSpin: -Math.PI * 2,
    poseAt: backside360PoseAt,
  },
  'backside-360-stylish': {
    duration: FS360_SETTLE_END,
    totalSpin: -Math.PI * 2,
    poseAt: backside360StylishPoseAt,
  },
  wildcat: {
    duration: FS360_SETTLE_END,
    totalSpin: 0,
    totalFlip: Math.PI * 2, // wildcat: end over end in the TAIL direction — nose up and over backward (verify sign on device)
    poseAt: wildcatPoseAt,
  },
  tamedog: {
    duration: FS360_SETTLE_END,
    totalSpin: 0,
    totalFlip: -Math.PI * 2, // tamedog: end over end in the NOSE direction — nose dives, tail comes over
    poseAt: tamedogPoseAt,
  },

  // --- Spins (generalized core) ---
  'frontside-180': makeSpin(0.5, 1),
  'backside-180': makeSpin(0.5, -1),
  'frontside-540': makeSpin(1.5, 1),
  'backside-540': makeSpin(1.5, -1),
  'frontside-720': makeSpin(2, 1),
  'backside-720': makeSpin(2, -1),
  'frontside-900': makeSpin(2.5, 1),
  'backside-900': makeSpin(2.5, -1),
  'frontside-1080': makeSpin(3, 1),
  'backside-1080': makeSpin(3, -1),
  // Cab = switch-stance frontside (starts with the yaw offset baked in).
  'cab-180': makeSpin(0.5, 1, Math.PI),
  'cab-360': makeSpin(1, 1, Math.PI),

  // --- Off-axis ---
  'backside-rodeo': makeCork(1.5, -1, 2.4), // BS 540 with a proper inverted dip
  'frontside-cork': makeCork(2, 1, -1.25), // corked FS 720, shoulder dips forward
  'backside-cork': makeCork(2, -1, 1.25),

  // --- Grab airs (specs per the Trickipedia definitions) ---
  'straight-air': makeGrabAir({ tuck: 0.35, balance: 0.35 }),
  indy: makeGrabAir({ rear: 1, side: 1, reach: 0 }),
  'indy-nosebone': makeGrabAir({ rear: 1, side: 1, reach: 0, pokeFront: 0.9, backLegLift: 0.45 }),
  weddle: makeGrabAir({ front: 1, side: 1, reach: 0 }),
  melon: makeGrabAir({ front: 1, side: -1, reach: 0 }),
  method: makeGrabAir({
    front: 1,
    side: -1,
    reach: 0,
    arch: 0.85,
    backLegLift: 0.8,
    frontLegLift: 0.5,
    tuck: 0.25,
  }),
  'nose-grab': makeGrabAir({ front: 1, side: 0.3, reach: -1, frontLegLift: 0.5, pokeBack: 0.6 }),
  'tail-grab': makeGrabAir({ rear: 1, side: 0.3, reach: 1, backLegLift: 0.55, pokeFront: 0.7 }),
  stalefish: makeGrabAir({ rear: 1, side: -1, reach: 0, backLegLift: 0.3 }),
  japan: makeGrabAir({ front: 1, side: 1, reach: 0, arch: 0.7, frontLegLift: 0.4, tuck: 0.65 }),
  crail: makeGrabAir({ rear: 1, side: 1, reach: -0.9 }),
  'roast-beef': makeGrabAir({ rear: 1, side: -1, reach: 0, tuck: 0.7, pokeFront: 0.7 }),
  'chicken-salad': makeGrabAir({
    rear: 1,
    side: -1,
    reach: 0,
    tuck: 0.7,
    backLegLift: 0.35,
    arch: 0.25,
  }),
  'canadian-bacon': makeGrabAir({ rear: 1, side: 1, reach: 0, tuck: 0.7, backLegLift: 0.5 }),
  seatbelt: makeGrabAir({ front: 1, side: 0.5, reach: 1, backLegLift: 0.5, pokeFront: 0.8 }),
  taipan: makeGrabAir({ front: 1, side: 1, reach: 0, tuck: 0.75, frontLegLift: 0.45, arch: 0.2 }),

  // --- Ground / flatland ---
  ollie: makePop('ollie'),
  nollie: makePop('nollie'),
  'nose-press': makePress('nose'),
  'tail-press': makePress('tail'),
  butter: makePress('tail', { spinWiggle: 0.55 }),
  'nose-roll-180': makePress('nose', { roll: Math.PI }),
  'tail-roll-180': makePress('tail', { roll: -Math.PI }),
  tripod: makeTripod(),
  'carved-turn': makeCarve(),
  'ride-switch': makeRideSwitch(),

  // --- Jibs ---
  'fifty-fifty': makeFiftyFifty(),
  boardslide: makeBoardslide(-1),
  'frontside-boardslide': makeBoardslide(1),
};

// --- Demo state machine ---

export interface TrickDemoState {
  /** On-board demo session — enter when the demo reply starts. */
  session: boolean;
  trick: TrickId;
  action: DemoAction;
  actionT: number;
  /** Time spent in stance since the last action — drives the auto-loop. */
  gapT: number;
  /** Post-activity grace timer. Board presence is NOT tied to the exact
   *  `session` flag (Kith flips it false mid-reply on a ~500ms audio-drain
   *  grace during between-sentence pauses); this holds the board up across any
   *  gap before/between moves and only lets it retract once she's truly done. */
  holdT: number;
  /** Smoothed on-board weight (drives board fade + stance width + yaw). */
  stance: number;
  idleT: number;
  /** Outputs for the frame loop + board renderer. */
  rootYaw: number;
  /** Whole-body flip angle this frame (radians, signed). 0 for spins. */
  rootPitch: number;
  /** The composed whole-body quaternion [x,y,z,w] KaoriStage applied this frame
   *  (yaw*pitch). Written by KaoriStage; read by lockBoardToFeet so the board
   *  rolls with her through a flip inversion instead of staying world-flat. */
  rootQuat: [number, number, number, number];
  rootY: number;
  /** Board height — follows the jump but NOT the crouch hip-drop. */
  boardY: number;
  boardOpacity: number;
  /** Board angle around its long axis (tail up/down) for stylish variants. */
  boardTilt: number;
  /** Board world transform locked to the actual feet (computed in KaoriStage
   *  from the raw foot bones so the bindings stay under the soles and the board
   *  angle follows the feet). Plain arrays to keep this module three-free. */
  boardPos: [number, number, number];
  boardQuat: [number, number, number, number];
  boardLocked: boolean;
}

export const createTrickDemoState = (): TrickDemoState => ({
  session: false,
  trick: 'frontside-360-stylish', // both 360s demo the stylish variant

  action: 'none',
  actionT: 0,
  gapT: 0,
  holdT: 0,
  stance: 0,
  idleT: 0,
  rootYaw: 0,
  rootPitch: 0,
  rootQuat: [0, 0, 0, 1],
  rootY: 0,
  boardY: 0,
  boardOpacity: 0,
  boardTilt: 0,
  boardPos: [0, 0, 0],
  boardQuat: [0, 0, 0, 1],
  boardLocked: false,
});

/** True while the demo system should own the body. */
export const isDemoActive = (state: TrickDemoState) =>
  state.session || state.action !== 'none' || state.stance > 0.005;

/** Breather in stance between auto-looped trick runs. */
const LOOP_GAP_SECONDS = 0.9;
/** How long the board stays up after the last activity (session or action)
 *  before it retracts. Must exceed LOOP_GAP_SECONDS and the TTS drain grace
 *  (~0.5s) + any between-sentence pause so the board never drops mid-demo. */
const BOARD_HOLD_SECONDS = 1.2;

function actionDuration(state: TrickDemoState): number {
  switch (state.action) {
    case 'full':
      return TRICKS[state.trick].duration;
    case 'setup':
      return WIND_UP_DEMO_DURATION;
    case 'pop':
      return POP_DEMO_DURATION;
    case 'land':
      return LAND_DEMO_DURATION;
    default:
      return 0;
  }
}

function actionPose(state: TrickDemoState): RiderPose {
  switch (state.action) {
    case 'full':
      return TRICKS[state.trick].poseAt(state.actionT);
    case 'setup':
      return windUpDemoPose(state.actionT);
    case 'pop':
      return popDemoPose(state.actionT);
    case 'land':
      return landDemoPose(state.actionT);
    default:
      return stanceIdlePose(state.idleT);
  }
}

/** Start an action (cued by what Kaori is saying). Full runs are never cut. */
export function startAction(state: TrickDemoState, action: Exclude<DemoAction, 'none'>) {
  if (state.action === 'full' && state.actionT < TRICKS[state.trick].duration) return;
  state.action = action;
  state.actionT = 0;
  state.gapT = 0;
  // Re-anchor the board grace so a late final-sentence cue keeps the board
  // continuously visible for the last move (no fade-then-pop-back).
  state.holdT = 0;
}

/**
 * Advance the demo by dt. Returns false once the session has ended and
 * the stance has fully blended out (caller resumes idle animation).
 */
export function riderRootAt(pose: RiderPose, timeline: TrickTimeline, stanceEase = 1) {
  return {
    rootYaw: (STANCE_YAW + (timeline.yawOffset ?? 0)) * stanceEase + timeline.totalSpin * pose.spin,
    rootPitch: (timeline.totalFlip ?? 0) * pose.pitch * stanceEase,
    rootY: pose.height - hipDropFor(pose.crouch * stanceEase),
  };
}

export function driveDemo(vrm: VRM, state: TrickDemoState, dt: number): boolean {
  // Board/stance presence is DECOUPLED from the exact `session` flag. Kith
  // infers end-of-reply from a ~500ms audio-drain grace, which can flip
  // session=false mid-reply during a between-sentence pause — and the board was
  // hard-bound to it, so it vanished in the sub-second gap before the last 360.
  // A grace-hold (holdT) keeps the board pinned through any gap before/between
  // moves and only lets it retract a beat after she's genuinely done.
  const activeNow = state.session || state.action !== 'none';
  if (activeNow) state.holdT = 0;
  else state.holdT += dt;
  const onBoard = activeNow || state.holdT < BOARD_HOLD_SECONDS;
  const target = onBoard ? 1 : 0;
  state.stance += (target - state.stance) * Math.min(1, (onBoard ? 2.5 : 3.5) * dt);
  state.idleT += dt;

  if (state.action !== 'none') {
    state.gapT = 0;
    state.actionT += dt;
    if (state.actionT >= actionDuration(state)) {
      state.action = 'none';
      state.actionT = 0;
    }
  } else if (state.session) {
    // Keep performing while she explains: after a short breather in stance, run
    // the full trick again. Sentence cues can still fire early or mix in phase
    // demos during the gap.
    state.gapT += dt;
    if (state.gapT > LOOP_GAP_SECONDS) {
      state.action = 'full';
      state.actionT = 0;
      state.gapT = 0;
      // Both 360s always demo the STYLISH variant (clean variants retired per
      // request) — upgrade clean → stylish and stay there; never swap back.
      if (state.trick === 'frontside-360') state.trick = 'frontside-360-stylish';
      if (state.trick === 'backside-360') state.trick = 'backside-360-stylish';
    }
  }

  // action==='none' → actionPose returns the downhill stance-idle, so the
  // blend-out after the session ends stays in the riding stance (no REST snap).
  const pose = actionPose(state);
  const stanceEase = easeInOut(clamp01(state.stance));

  const humanoid = vrm.humanoid;
  if (humanoid) {
    applyRiderPose(humanoid, pose, stanceEase);
  }

  const timeline = TRICKS[state.trick];
  const root = riderRootAt(pose, timeline, stanceEase);
  state.rootYaw = root.rootYaw;
  // Flip pitch: signed totalFlip carried by pose.pitch, gated by stanceEase so a
  // partial strap-in never half-flips her. 0 for all spins (totalFlip omitted),
  // and spins keep pitch=0 / flips keep spin=0, so the two channels never fight.
  state.rootPitch = root.rootPitch;
  // Hips sink with the knee fold so the feet stay planted on the board (for a
  // flip this is the CoM/hip height on the jump arc that KaoriStage pivots around).
  state.rootY = root.rootY;
  state.boardY = pose.height;
  state.boardOpacity = stanceEase;
  state.boardTilt = pose.boardTilt * stanceEase;

  if (
    !state.session &&
    state.action === 'none' &&
    state.holdT >= BOARD_HOLD_SECONDS &&
    state.stance < 0.005
  ) {
    state.stance = 0;
    state.rootYaw = 0;
    state.rootPitch = 0; // no leftover flip tilt into idle
    state.rootY = 0;
    state.boardY = 0;
    state.boardOpacity = 0;
    state.boardTilt = 0;
    if (humanoid) resetRiderBones(humanoid);
    return false;
  }
  return true;
}

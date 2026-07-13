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
  type RiderPose,
  resetRiderBones,
  STANCE_CROUCH,
  STANCE_YAW,
  stanceIdlePose,
  WIND_UP_DEMO_DURATION,
  windUpDemoPose,
} from './riderFundamentals';

export type TrickId =
  | 'frontside-360'
  | 'frontside-360-stylish'
  | 'backside-360'
  | 'wildcat'
  | 'tamedog';

export type DemoAction = 'none' | 'full' | 'setup' | 'pop' | 'land';

export interface TrickTimeline {
  duration: number;
  /** Total root YAW over the trick (radians; + is frontside/CCW). */
  totalSpin: number;
  /** Total root PITCH/flip over the trick (radians, SIGNED: negative = backflip
   *  /wildcat over the tail, positive = frontflip/tamedog over the nose). Omit
   *  for pure spins (treated as 0). Yaw is about vertical, pitch about the
   *  board's long axis — the two compose independently. */
  totalFlip?: number;
  poseAt: (t: number) => RiderPose;
}

// --- 360 spins (frontside + backside share one core) ---
const FS360_SETUP_END = 1.5;
const FS360_POP_END = 1.8;
const FS360_AIR_END = 3.1;
const FS360_LAND_END = 3.7;
const FS360_SETTLE_END = 4.2;

// Head-spotting knobs (see the head block in spin360PoseAt).
const NECK_CAP = 1.3; // anatomical neck-yaw limit (~75°) — forces the hold→whip
const HEAD_HOLD_FRAC = 0.5; // spin fraction she holds the gaze forward before whipping
const HEAD_WHIP_END = 0.9; // spin fraction the head has re-fixated forward by

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
  const bodyYaw = dir * Math.PI * 2 * spin;
  const holdLead = clamp(DOWNHILL_LOOK - bodyYaw, -NECK_CAP, NECK_CAP);
  const reFixLead = clamp(DOWNHILL_LOOK - dir * Math.PI * 2 * (spin - 1), -NECK_CAP, NECK_CAP);
  const whip = easeInOut(clamp01((spin - HEAD_HOLD_FRAC) / (HEAD_WHIP_END - HEAD_HOLD_FRAC)));
  let headLead = lerp(holdLead, reFixLead, whip);
  // Chin drops and head rolls over the shoulder AS she whips her eyes around to
  // re-spot the snow, then relaxes — peaks mid-whip, zero at both ends.
  const spotArc = Math.sin(Math.PI * whip);
  let headSpot = lerp(DOWNHILL_CHIN, 0.32, spotArc);
  let headRoll = dir * 0.26 * spotArc;
  if (settle > 0) {
    // End on the exact downhill riding gaze she started from.
    const s = easeInOut(settle);
    headLead = lerp(headLead, DOWNHILL_LOOK, s);
    headSpot = lerp(headSpot, DOWNHILL_CHIN, s);
    headRoll = lerp(headRoll, 0, s);
  }

  return {
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
  if (air > 0) crouch = lerp(0.08, 0.35, easeInOut(air));
  if (land > 0) crouch = lerp(0.35, 0.72, easeInOut(clamp01(land * 2)));
  if (land > 0.5) crouch = lerp(0.72, 0.35, easeInOut((land - 0.5) * 2));
  if (settle > 0) crouch = lerp(0.35, STANCE_CROUCH, easeInOut(settle));

  // COIL: NO Y-wind for a flip — stay ON-AXIS (a shoulder/hip twist corkscrews
  // it off-axis). Just a small vertical load feel in setup, ~0 through the air.
  let coil = -0.35 * easeInOut(setup);
  if (pop > 0) coil = lerp(-0.35, 0, easeInOut(pop));

  // TUCK: tighter than a 360 (knees-to-chest), bell across the air.
  const tuck = air > 0 && land === 0 ? FLIP_TUCK_PEAK * Math.sin(Math.PI * air) : 0;
  const balance = land > 0 ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle) : 0;

  // HEAD — pitch-based (headSpot = chin up/down), the signature flip read.
  // wildcat (dir<0): throw the head BACK/up at pop (headSpot NEGATIVE), blind
  //   through the inverted apex, re-spot the snow LATE (~p 0.7, swings POSITIVE).
  // tamedog (dir>0): throw the head DOWN/forward early (headSpot POSITIVE), and
  //   because she flips toward her gaze she re-fixates the landing cleanly ~2/3.
  const p = pitch;
  const headLead = DOWNHILL_LOOK; // no yaw here — just hold the downhill gaze
  let headSpot: number;
  if (dir < 0) {
    const throwBack = Math.sin(Math.PI * clamp01(p / 0.7));
    const reSpot = easeInOut(clamp01((p - 0.7) / 0.3));
    headSpot = lerp(-0.55 * throwBack, 0.45, reSpot);
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
    backLegLift: 0,
    frontLegLift: 0,
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
  wildcat: {
    duration: FS360_SETTLE_END,
    totalSpin: 0,
    totalFlip: -Math.PI * 2, // backflip: backward over the tail (verify sign on device)
    poseAt: wildcatPoseAt,
  },
  tamedog: {
    duration: FS360_SETTLE_END,
    totalSpin: 0,
    totalFlip: Math.PI * 2, // frontflip: forward over the nose
    poseAt: tamedogPoseAt,
  },
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
  trick: 'frontside-360',
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
      // Alternate ONLY within the requested trick's family — frontside cycles
      // clean↔stylish so both show; backside just re-runs (no stylish variant
      // yet). Never drag a backside session back to frontside.
      if (state.trick === 'frontside-360') state.trick = 'frontside-360-stylish';
      else if (state.trick === 'frontside-360-stylish') state.trick = 'frontside-360';
    }
  }

  // action==='none' → actionPose returns the downhill stance-idle, so the
  // blend-out after the session ends stays in the riding stance (no REST snap).
  const pose = actionPose(state);
  const stanceEase = easeInOut(clamp01(state.stance));
  const effectiveCrouch = pose.crouch * stanceEase;

  const humanoid = vrm.humanoid;
  if (humanoid) {
    applyRiderPose(humanoid, pose, stanceEase);
  }

  const timeline = TRICKS[state.trick];
  state.rootYaw = STANCE_YAW * stanceEase + timeline.totalSpin * pose.spin;
  // Flip pitch: signed totalFlip carried by pose.pitch, gated by stanceEase so a
  // partial strap-in never half-flips her. 0 for all spins (totalFlip omitted),
  // and spins keep pitch=0 / flips keep spin=0, so the two channels never fight.
  state.rootPitch = (timeline.totalFlip ?? 0) * pose.pitch * stanceEase;
  // Hips sink with the knee fold so the feet stay planted on the board (for a
  // flip this is the CoM/hip height on the jump arc that KaoriStage pivots around).
  state.rootY = pose.height - hipDropFor(effectiveCrouch);
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

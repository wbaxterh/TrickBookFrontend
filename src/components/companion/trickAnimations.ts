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
  clamp01,
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

export type TrickId = 'frontside-360' | 'frontside-360-stylish';

export type DemoAction = 'none' | 'full' | 'setup' | 'pop' | 'land';

export interface TrickTimeline {
  duration: number;
  /** Total root rotation over the trick (radians; + is frontside/CCW). */
  totalSpin: number;
  poseAt: (t: number) => RiderPose;
}

// --- Frontside 360 ---
const FS360_SETUP_END = 1.5;
const FS360_POP_END = 1.8;
const FS360_AIR_END = 3.1;
const FS360_LAND_END = 3.7;
const FS360_SETTLE_END = 4.2;

function frontside360PoseAt(t: number): RiderPose {
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

  // Coil: wind away during setup, whip through at pop. Through the air the
  // SHOULDERS lead the rotation (chest twists more than the hips — that's the
  // coil ratio in applyTorsoAndHead) and the hips catch up as she comes
  // around — "shoulders move first to spot the landing, then the hips follow".
  let coil = -0.7 * easeInOut(setup);
  if (pop > 0) coil = lerp(-0.7, 0.5, easeInOut(pop));
  if (air > 0) coil = lerp(0.5, 0.05, easeInOut(air));
  if (land > 0) coil = lerp(0.05, 0, land);

  const tuck = air > 0 && land === 0 ? Math.sin(Math.PI * air) : 0;
  const balance = land > 0 ? Math.sin(Math.PI * clamp01(land + settle * 0.4)) * (1 - settle) : 0;

  // Head: lead the spin HARD and tilt over the leading shoulder through the air,
  // spot the landing from ~270°, then settle looking downhill (not at camera).
  const spotting = spin > 0.72;
  let headLead = 0;
  let headSpot = 0;
  let headRoll = 0;
  if (air > 0 && !spotting) {
    headLead = 0.65; // head cranks around ahead of the body
    headRoll = 0.28 * Math.sin(Math.PI * air); // tip the head over the shoulder mid-air
  }
  if (spotting && land < 1) {
    headLead = 0.5; // still turned toward where she's landing
    headSpot = 0.32; // chin down to spot the snow
    headRoll = 0.15;
  }
  if (settle > 0) {
    // End looking downhill / forward, not straight at the camera.
    headLead = lerp(headLead, DOWNHILL_LOOK, easeInOut(settle));
    headSpot = lerp(headSpot, 0, easeInOut(settle));
    headRoll = lerp(headRoll, 0, easeInOut(settle));
  }

  return {
    spin,
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
  };
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
  const settle = phase(t, FS360_LAND_END, FS360_SETTLE_END);
  const airborne = air > 0 && land === 0;

  // First ~3/4 of the spin vs the last quarter, measured off the spin progress.
  const early = clamp01(base.spin / 0.72);
  const late = clamp01((base.spin - 0.72) / 0.28);

  let backLegLift = airborne ? 0.9 * easeInOut(early) * (1 - easeInOut(late)) : 0;
  let frontLegLift = airborne ? 0.7 * easeInOut(late) : 0;
  // Tail-up while the back leg is lifted, swinging nose-up in the last quarter.
  let boardTilt = airborne ? 0.5 * easeInOut(early) * (1 - late) - 0.4 * easeInOut(late) : 0;

  if (land > 0) {
    // Slap it down tail-first: board pitches tail-down and levels out.
    const slap = Math.sin(Math.PI * clamp01(land * 1.6));
    boardTilt = lerp(-0.4, 0, easeInOut(land)) + 0.35 * slap;
    frontLegLift = 0.4 * (1 - easeInOut(clamp01(land * 2)));
    backLegLift = 0;
  }
  if (settle > 0) boardTilt = lerp(boardTilt, 0, easeInOut(settle));

  return { ...base, backLegLift, frontLegLift, boardTilt };
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
  /** Smoothed on-board weight (drives board fade + stance width + yaw). */
  stance: number;
  idleT: number;
  /** Outputs for the frame loop + board renderer. */
  rootYaw: number;
  rootY: number;
  /** Board height — follows the jump but NOT the crouch hip-drop. */
  boardY: number;
  boardOpacity: number;
  /** Board angle around its long axis (tail up/down) for stylish variants. */
  boardTilt: number;
}

export const createTrickDemoState = (): TrickDemoState => ({
  session: false,
  trick: 'frontside-360',
  action: 'none',
  actionT: 0,
  gapT: 0,
  stance: 0,
  idleT: 0,
  rootYaw: 0,
  rootY: 0,
  boardY: 0,
  boardOpacity: 0,
  boardTilt: 0,
});

/** True while the demo system should own the body. */
export const isDemoActive = (state: TrickDemoState) =>
  state.session || state.action !== 'none' || state.stance > 0.005;

/** Breather in stance between auto-looped trick runs. */
const LOOP_GAP_SECONDS = 0.9;

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
}

/**
 * Advance the demo by dt. Returns false once the session has ended and
 * the stance has fully blended out (caller resumes idle animation).
 */
export function driveDemo(vrm: VRM, state: TrickDemoState, dt: number): boolean {
  // Smooth the on-board weight toward the session target. Blend OUT a little
  // faster so the stance return and the board fade finish together crisply
  // (no lingering ghost board after she's already standing).
  const target = state.session ? 1 : 0;
  state.stance += (target - state.stance) * Math.min(1, (state.session ? 2.5 : 3.5) * dt);
  state.idleT += dt;

  if (state.action !== 'none') {
    state.gapT = 0;
    state.actionT += dt;
    if (state.actionT >= actionDuration(state)) {
      state.action = 'none';
      state.actionT = 0;
    }
  } else if (state.session) {
    // Keep performing while she explains: after a short breather in
    // stance, run the full trick again — alternating the clean and the
    // stylish FS360 so both get shown. Sentence cues can still fire early
    // or mix in phase demos during the gap.
    state.gapT += dt;
    if (state.gapT > LOOP_GAP_SECONDS) {
      state.action = 'full';
      state.actionT = 0;
      state.gapT = 0;
      state.trick = state.trick === 'frontside-360' ? 'frontside-360-stylish' : 'frontside-360';
    }
  }

  const pose = state.action === 'none' && !state.session ? REST_POSE : actionPose(state);
  const stanceEase = easeInOut(clamp01(state.stance));
  const effectiveCrouch = pose.crouch * stanceEase;

  const humanoid = vrm.humanoid;
  if (humanoid) {
    applyRiderPose(humanoid, pose, stanceEase);
  }

  state.rootYaw = STANCE_YAW * stanceEase + TRICKS[state.trick].totalSpin * pose.spin;
  // Hips sink with the knee fold so the feet stay planted on the board
  state.rootY = pose.height - hipDropFor(effectiveCrouch);
  state.boardY = pose.height;
  state.boardOpacity = stanceEase;
  state.boardTilt = pose.boardTilt * stanceEase;

  if (!state.session && state.stance < 0.005 && state.action === 'none') {
    state.stance = 0;
    state.rootYaw = 0;
    state.rootY = 0;
    state.boardY = 0;
    state.boardOpacity = 0;
    state.boardTilt = 0;
    if (humanoid) resetRiderBones(humanoid);
    return false;
  }
  return true;
}

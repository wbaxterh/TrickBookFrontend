/** Model-scale calibration for the board tuck and body hinge. Metres/radians. */
export interface GrabProfile { kneeOut: number; lift: number; forward: number; along: number; lean: number; route?: number; elbowOffset?: number; }
export const GRAB_PROFILES: GrabProfile[] = [
  { kneeOut: .6, lift: .13, forward: 2, along: 0, lean: 1.1 }, // toe edge / Indy
  { kneeOut: .6, lift: .18, forward: 0, along: 0, lean: -.4 }, // heel edge
  { kneeOut: .6, lift: .12, forward: 0, along: 0, lean: -.4 }, // method
  { kneeOut: 0, lift: .12, forward: 2, along: 0, lean: .3 }, // nose
  { kneeOut: 1, lift: .12, forward: 0, along: 0, lean: .7 }, // tail
  { kneeOut: .6, lift: .18, forward: 2, along: 0, lean: 1.1 }, // deep tuck
  { kneeOut: 1, lift: .12, forward: 1, along: -.1, lean: 1.1 }, // nosebone
  { kneeOut: .6, lift: .15, forward: 2, along: -.2, lean: 1.1 }, // cross-body nose
  { kneeOut: 0, lift: .12, forward: -2, along: 0, lean: -.4 }, // cross-body tail
  { kneeOut: 1, lift: .18, forward: 2, along: 0, lean: .7, route: 1, elbowOffset: -3.2 }, // through-knee heel reach
];
export function grabProfile(index = 0) { return GRAB_PROFILES[index] ?? GRAB_PROFILES[0]; }

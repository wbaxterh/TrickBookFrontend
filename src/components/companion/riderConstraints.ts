import type { Object3D, Vector3 } from 'three';
import type { Humanoid } from './riderFundamentals';

import { grabProfile } from './grabProfiles';
export function worldPosition(node: Object3D) { return node.getWorldPosition(node.position.clone()); }
export function rotateBone(node: Object3D, from: Vector3, to: Vector3) {
  if(from.lengthSq()<1e-10 || to.lengthSq()<1e-10)return;
  const world=node.getWorldQuaternion(node.quaternion.clone());
  const delta=node.quaternion.clone().setFromUnitVectors(from.normalize(),to.normalize());
  const parent=node.parent!.getWorldQuaternion(node.quaternion.clone()).invert();
  node.quaternion.copy(parent.multiply(delta.multiply(world)));node.updateWorldMatrix(false,true);
}
export function solveLimb(upper: Object3D, lower: Object3D, tip: Object3D, goal: Vector3, bend: Vector3) {
  const A=worldPosition(upper),B=worldPosition(lower),D=worldPosition(tip);
  const l1=A.distanceTo(B),l2=B.distanceTo(D),axis=goal.clone().sub(A);
  const d=Math.max(Math.abs(l1-l2)+.00001,Math.min(axis.length(),l1+l2-.00001));axis.normalize();
  const pole=bend.clone().addScaledVector(axis,-bend.dot(axis)).normalize();
  const x=(l1*l1-l2*l2+d*d)/(2*d),y=Math.sqrt(Math.max(0,l1*l1-x*x));
  const joint=A.clone().addScaledVector(axis,x).addScaledVector(pole,y);
  const end=A.clone().addScaledVector(axis,d);
  rotateBone(upper,B.sub(A),joint.sub(A));
  const current=worldPosition(lower);rotateBone(lower,worldPosition(tip).sub(current),end.sub(current));
}

/** Solve both feet to a rigid .48 m binding stance. Never move bindings to chase feet. */
export function lockRiderBindings(h: Humanoid, stanceWeight: number, grabLift = 0, profile = grabProfile()) {
  if(stanceWeight<=0)return;
  const hips=h.getNormalizedBoneNode('hips'),lf=h.getNormalizedBoneNode('leftFoot'),rf=h.getNormalizedBoneNode('rightFoot');
  if(!hips||!lf||!rf)return;
  hips.updateWorldMatrix(true,true);
  const L=worldPosition(lf),R=worldPosition(rf),center=L.clone().add(R).multiplyScalar(.5);
  const along=L.clone().sub(R).normalize();
  const rootQ=hips.parent!.getWorldQuaternion(hips.quaternion.clone());
  const bodyUp=L.clone().set(0,1,0).applyQuaternion(rootQ);
  const toe=along.clone().cross(bodyUp).normalize(),up=toe.clone().cross(along).normalize();
  center.addScaledVector(up, grabLift * stanceWeight).addScaledVector(toe, profile.forward * grabLift * stanceWeight);
  center.addScaledVector(along, profile.along * (profile.lift ? grabLift / profile.lift : 0) * stanceWeight);
  const boardQ=hips.quaternion.clone().setFromRotationMatrix(hips.matrixWorld.clone().makeBasis(along,up,toe));
  // Raise the rigid board just enough if the planned stance exceeds a leg's reach.
  // Both binding targets move together; neither ankle is allowed to fall short.
  for(let pass=0;pass<2;pass++)for(const side of ['left','right'] as const) {
    const upper=h.getNormalizedBoneNode(`${side}UpperLeg`)!,lower=h.getNormalizedBoneNode(`${side}LowerLeg`)!,foot=h.getNormalizedBoneNode(`${side}Foot`)!;
    const A=worldPosition(upper),B=worldPosition(lower),D=worldPosition(foot),reach=A.distanceTo(B)+B.distanceTo(D)-.0001;
    const target=center.clone().addScaledVector(along,side==='left'?.24:-.24),delta=A.clone().sub(target);
    const vertical=delta.dot(up),lateral=delta.lengthSq()-vertical*vertical;
    const allowed=Math.sqrt(Math.max(0,reach*reach-lateral));
    if(vertical>allowed)center.addScaledVector(up,vertical-allowed);
  }
  for(const side of ['left','right'] as const) {
    const upper=h.getNormalizedBoneNode(`${side}UpperLeg`),lower=h.getNormalizedBoneNode(`${side}LowerLeg`),foot=h.getNormalizedBoneNode(`${side}Foot`);
    if(!upper||!lower||!foot)continue;
    const target=center.clone().addScaledVector(along,side==='left'?.24:-.24);
    const current=worldPosition(foot);target.lerp(current,1-stanceWeight);
    const bend=toe.clone().multiplyScalar(.35).add(up).addScaledVector(along, (side === 'left' ? 1 : -1) * profile.kneeOut);
    solveLimb(upper,lower,foot,target,bend);
    // Bindings use a fixed duck stance; ankle orientation remains board-relative.
    const localYaw=foot.quaternion.clone().setFromAxisAngle(up,side==='left'?-.18:.18);
    const desired=localYaw.multiply(boardQ);
    const parent=foot.parent!.getWorldQuaternion(foot.quaternion.clone()).invert();
    foot.quaternion.slerp(parent.multiply(desired),stanceWeight);foot.updateWorldMatrix(false,true);
  }
}

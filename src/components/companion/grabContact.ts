/** Board-relative wrist targets shared by the app and Trick Lab.
 * Two-bone reach preserves limb lengths; unreachable targets stay measurable.
 */
import type { Humanoid, RiderPose } from './riderFundamentals';

function targetFor(h: Humanoid, pose: RiderPose) {
  const left=h.getNormalizedBoneNode('leftFoot'), right=h.getNormalizedBoneNode('rightFoot'), hips=h.getNormalizedBoneNode('hips');
  if (!left || !right || !hips) return null;
  hips.updateWorldMatrix(true,true);
  const a=left.getWorldPosition(left.position.clone()), b=right.getWorldPosition(right.position.clone());
  const along=a.clone().sub(b).normalize();
  const rootQ=hips.parent!.getWorldQuaternion(hips.quaternion.clone());
  const up=a.clone().set(0,1,0).applyQuaternion(rootQ);
  const toe=along.clone().cross(up).normalize();
  const boardUp=toe.clone().cross(along).normalize();
  // Board is 1.15 x .26 m. Wrist sits above the edge; fingers extend to it.
  const reach=Math.max(-1,Math.min(1,pose.grabReach));
  const edge=Math.abs(reach)>.95 ? .03 : .13;
  return a.add(b).multiplyScalar(.5).addScaledVector(boardUp,-.015)
    .addScaledVector(along,-reach*.55).addScaledVector(toe,Math.sign(pose.grabSide || 1)*edge);
}

export function solveGrabContact(h: Humanoid, pose: RiderPose, weight: number) {
  const target=targetFor(h,pose); if (!target) return;
  const grip=Math.max(pose.grabFront,pose.grabRear)*weight;
  const spine=h.getNormalizedBoneNode('spine');
  // Find a reachable torso lean before solving the arm. No bone translation or scaling.
  if(spine && grip>0) {
    const original=spine.rotation.clone();
    const score=() => {
      spine.updateWorldMatrix(true,true);let error=0;
      for(const side of ['left','right'] as const) {
        const amount=(side==='left'?pose.grabFront:pose.grabRear)*weight;if(amount<=0)continue;
        const u=h.getNormalizedBoneNode(`${side}UpperArm`),l=h.getNormalizedBoneNode(`${side}LowerArm`),d=h.getNormalizedBoneNode(`${side}Hand`);if(!u||!l||!d)continue;
        const A=u.getWorldPosition(u.position.clone()),B=l.getWorldPosition(l.position.clone()),D=d.getWorldPosition(d.position.clone());
        const gap=Math.max(0,A.distanceTo(target)-A.distanceTo(B)-B.distanceTo(D)+.015);
        error+=gap*gap*amount;
      }
      return error + 0.00001 * ((spine.rotation.x-original.x)**2 + (spine.rotation.y-original.y)**2 + (spine.rotation.z-original.z)**2);
    };
    const bounds={x:[-1.05,.9],y:[original.y-.9,original.y+.9],z:[-.9,.9]};
    for(const step of [.25,.12,.06,.025])for(let pass=0;pass<3;pass++)for(const axis of ['x','z','y'] as const) {
      const start=spine.rotation[axis];let best=start,bestScore=score();
      for(const sign of [-1,1]) {
        spine.rotation[axis]=Math.max(bounds[axis][0],Math.min(bounds[axis][1],start+sign*step));
        const value=score();if(value<bestScore-1e-9){best=spine.rotation[axis];bestScore=value;}
      }
      spine.rotation[axis]=best;
    }
    const solved=spine.rotation.clone();spine.rotation.set(original.x+(solved.x-original.x)*grip,original.y+(solved.y-original.y)*grip,original.z+(solved.z-original.z)*grip);spine.updateWorldMatrix(true,true);
  }
  for (const side of ['left','right'] as const) {
    const amount=(side==='left'?pose.grabFront:pose.grabRear)*weight;
    if (amount<=0) continue;
    const upper=h.getNormalizedBoneNode(`${side}UpperArm`), lower=h.getNormalizedBoneNode(`${side}LowerArm`), hand=h.getNormalizedBoneNode(`${side}Hand`);
    if (!upper || !lower || !hand) continue;
    const A=upper.getWorldPosition(upper.position.clone()), B=lower.getWorldPosition(lower.position.clone()), D=hand.getWorldPosition(hand.position.clone());
    const goal=D.clone().lerp(target,Math.min(1,amount));
    const l1=A.distanceTo(B),l2=B.distanceTo(D),axis=goal.clone().sub(A);
    const distance=Math.max(.0001,Math.min(axis.length(),l1+l2-.0001));axis.normalize();
    const pole=B.clone().sub(A);pole.addScaledVector(axis,-pole.dot(axis));
    if (pole.lengthSq()<1e-8) {pole.set(0,1,0);pole.addScaledVector(axis,-pole.dot(axis));}
    pole.normalize();
    const x=(l1*l1-l2*l2+distance*distance)/(2*distance), y=Math.sqrt(Math.max(0,l1*l1-x*x));
    const elbow=A.clone().addScaledVector(axis,x).addScaledVector(pole,y);
    const endpoint=A.clone().addScaledVector(axis,distance);
    const rotate=(node: typeof upper, from: typeof A, to: typeof A) => {
      const world=node.getWorldQuaternion(node.quaternion.clone());
      const delta=node.quaternion.clone().setFromUnitVectors(from.normalize(),to.normalize());
      const parent=node.parent!.getWorldQuaternion(node.quaternion.clone()).invert();
      node.quaternion.copy(parent.multiply(delta.multiply(world)));node.updateWorldMatrix(false,true);
    };
    rotate(upper,B.clone().sub(A),elbow.clone().sub(A));
    const current=lower.getWorldPosition(lower.position.clone());
    rotate(lower,hand.getWorldPosition(hand.position.clone()).sub(current),endpoint.sub(current));
  }
}

export function grabContactDistances(h: Humanoid, pose: RiderPose) {
  const target=targetFor(h,pose); const result: Record<string,number>={};if(!target)return result;
  for(const side of ['left','right'] as const) {
    if((side==='left'?pose.grabFront:pose.grabRear)<.99)continue;
    const hand=h.getNormalizedBoneNode(`${side}Hand`);
    if(hand)result[side]=hand.getWorldPosition(hand.position.clone()).distanceTo(target);
  }
  return result;
}

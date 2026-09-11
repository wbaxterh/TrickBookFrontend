import type { Vector3 } from 'three';
/** Board-relative wrist targets shared by the app and Trick Lab.
 * Two-bone reach preserves limb lengths; unreachable targets stay measurable.
 */
import type { Humanoid, RiderPose } from './riderFundamentals';

import { grabProfile } from './grabProfiles';
function segmentDistance(point: Vector3, a: Vector3, b: Vector3) {
  const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z;
  const length=x*x+y*y+z*z;
  const t=length ? Math.max(0,Math.min(1,((point.x-a.x)*x+(point.y-a.y)*y+(point.z-a.z)*z)/length)) : 0;
  return Math.hypot(point.x-a.x-t*x,point.y-a.y-t*y,point.z-a.z-t*z);
}
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
  const profile = grabProfile(pose.grabFit);
  const amount=Math.max(pose.grabFront,pose.grabRear);
  const grip=(pose.grabFit === 9 ? Math.min(1,amount*1.5) : amount)*weight;
  const spine=h.getNormalizedBoneNode('spine');
  // A compact forward hinge, without twisting the torso to chase the wrist.
  if (spine && grip > 0) {
    spine.rotation.x += (profile.lean - spine.rotation.x) * grip;
    spine.rotation.z *= 1 - grip;
    const neck = h.getNormalizedBoneNode('neck');
    if (neck) neck.rotation.x -= Math.max(0, profile.lean) * .8 * grip;
    const head = h.getNormalizedBoneNode('head');
    if (head) head.rotation.x -= .3 * grip;
    spine.updateWorldMatrix(true, true);
  }  for (const side of ['left','right'] as const) {
    const amount=(side==='left'?pose.grabFront:pose.grabRear)*weight;
    if (amount<=0) continue;
    const upper=h.getNormalizedBoneNode(`${side}UpperArm`), lower=h.getNormalizedBoneNode(`${side}LowerArm`), hand=h.getNormalizedBoneNode(`${side}Hand`);
    if (!upper || !lower || !hand) continue;
    const A=upper.getWorldPosition(upper.position.clone()), B=lower.getWorldPosition(lower.position.clone()), D=hand.getWorldPosition(hand.position.clone());
    const hips=h.getNormalizedBoneNode('hips')!;
    const rootQ=hips.parent!.getWorldQuaternion(hips.quaternion.clone());
    const outward=D.clone().set(side==='left'?1:-1,0,0).applyQuaternion(rootQ);
    const forward=D.clone().set(0,0,1).applyQuaternion(rootQ);
    const route = profile.route ?? (pose.grabFit === 8 ? -1 : Math.sign(pose.grabSide || 1));
    const control=A.clone().addScaledVector(forward, .32 * route).addScaledVector(outward, .12);
    const goal=D.clone().multiplyScalar((1-amount)**2).addScaledVector(control,2*amount*(1-amount)).addScaledVector(target,amount*amount);
    // The reach/release waypoint also stays outside the legs, not only the held pose.
    if(amount<.999)for(let pass=0;pass<3;pass++)for(const leg of ['left','right'] as const) {
      const joints=['UpperLeg','LowerLeg','Foot'].map(n=>h.getNormalizedBoneNode(`${leg}${n}` as any)!);
      const p=joints.map(n=>n.getWorldPosition(n.position.clone()));
      for(let i=0;i<2;i++) {
        const v=p[i+1].clone().sub(p[i]),u=Math.max(0,Math.min(1,goal.clone().sub(p[i]).dot(v)/v.lengthSq()));
        const closest=p[i].clone().addScaledVector(v,u),direction=goal.clone().sub(closest),radius=i===0?.14:.115;
        if(direction.length()<radius)goal.copy(closest).addScaledVector(direction.lengthSq()>1e-8?direction.normalize():forward,radius);
      }
    }
    const l1=A.distanceTo(B),l2=B.distanceTo(D),axis=goal.clone().sub(A);
    const distance=Math.max(Math.abs(l1-l2)+.0001,Math.min(axis.length(),l1+l2-.0001));axis.normalize();
    const endpoint=A.clone().addScaledVector(axis,distance);
    const pole=B.clone().sub(A);pole.addScaledVector(axis,-pole.dot(axis));
    if (pole.lengthSq()<1e-8) {pole.set(0,1,0);pole.addScaledVector(axis,-pole.dot(axis));}
    pole.normalize();
    const x=(l1*l1-l2*l2+distance*distance)/(2*distance), y=Math.sqrt(Math.max(0,l1*l1-x*x));
    // Choose a bend plane whose arm segments clear both leg capsules.
    // A consistent outward/front preference avoids arbitrary elbow flips.
    const preferred=outward.clone().addScaledVector(forward,.5 * (pose.grabFit === 9 ? -1 : route));
    const desiredPole=preferred.clone().addScaledVector(axis,-preferred.dot(axis)).normalize();
    let turn=Math.atan2(axis.dot(pole.clone().cross(desiredPole)),pole.dot(desiredPole));
    if (pose.grabFit === 9 && turn < 0) turn += Math.PI * 2;
    const base=pole.clone().applyAxisAngle(axis,turn*amount);
    if (profile.elbowOffset) base.applyAxisAngle(axis, profile.elbowOffset * amount);
    const tangent=axis.clone().cross(base).normalize();
    const center=A.clone().addScaledVector(axis,x);
    const legSegments: Array<[Vector3,Vector3,number]> = [];
    for(const leg of ['left','right'] as const) {
      const u=h.getNormalizedBoneNode(`${leg}UpperLeg`)!,l=h.getNormalizedBoneNode(`${leg}LowerLeg`)!,f=h.getNormalizedBoneNode(`${leg}Foot`)!;
      legSegments.push([u.getWorldPosition(u.position.clone()),l.getWorldPosition(l.position.clone()),.09]);
      legSegments.push([l.getWorldPosition(l.position.clone()),f.getWorldPosition(f.position.clone()),.065]);
    }
    let elbow=center.clone().addScaledVector(base,y),best=Infinity;
    const searchSteps = pose.grabFit === 9 ? 0 : 18;
    for(let i=-searchSteps;i<=searchSteps;i++) {
      const angle=i*Math.PI/18*amount;
      const candidate=center.clone().addScaledVector(base,y*Math.cos(angle)).addScaledVector(tangent,y*Math.sin(angle));
      let cost=.000001*angle*angle;
      for(const [start,end] of [[A,candidate],[candidate,endpoint]])for(let j=0;j<=12;j++) {
        const point=start.clone().lerp(end,j/12);
        for(const [a,b,radius] of legSegments) {
          const gap=segmentDistance(point,a,b)-(radius+.045);
          if(gap<0)cost+=gap*gap;
        }
      }
      if(cost<best){best=cost;elbow=candidate;}
    }
    const rotate=(node: typeof upper, from: typeof A, to: typeof A) => {
      const world=node.getWorldQuaternion(node.quaternion.clone());
      const delta=node.quaternion.clone().setFromUnitVectors(from.normalize(),to.normalize());
      const parent=node.parent!.getWorldQuaternion(node.quaternion.clone()).invert();
      node.quaternion.copy(parent.multiply(delta.multiply(world)));node.updateWorldMatrix(false,true);
    };
    rotate(upper,B.clone().sub(A),elbow.clone().sub(A));
    const current=lower.getWorldPosition(lower.position.clone());
    rotate(lower,hand.getWorldPosition(hand.position.clone()).sub(current),endpoint.sub(current));
    // Roll the palm over the edge instead of leaving a straight hand pointing
    // through the deck. Finger flexion fades out with the reach/release envelope.
    const up = forward.clone().set(0, 1, 0).applyQuaternion(rootQ);
    const edge = Math.sign(pose.grabSide || 1);
    const finger = forward.clone().multiplyScalar(edge * .65).addScaledVector(up, -.76).normalize();
    const palmX = finger.clone().multiplyScalar(side === 'left' ? 1 : -1);
    const palmY = up.clone().multiplyScalar(.65).addScaledVector(forward, edge * .76).normalize();
    const palmZ = palmX.clone().cross(palmY).normalize();
    palmY.copy(palmZ).cross(palmX).normalize();
    const desired = hand.quaternion.clone().setFromRotationMatrix(hand.matrixWorld.clone().makeBasis(palmX, palmY, palmZ));
    const parent = hand.parent!.getWorldQuaternion(hand.quaternion.clone()).invert();
    hand.quaternion.slerp(parent.multiply(desired), amount);
    for (const digit of ['Index', 'Middle', 'Ring', 'Little']) {
      for (const [joint, angle] of [['Proximal', .35], ['Intermediate', .8], ['Distal', .5]] as const) {
        const bone = h.getNormalizedBoneNode(`${side}${digit}${joint}` as any);
        if (bone) bone.rotation.z = (side === 'left' ? -1 : 1) * angle * amount;
      }
    }
    hand.updateWorldMatrix(false, true);
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

/** Conservative leg-capsule clearance; negative means a possible arm/leg intersection. */
export function riderClearance(h: Humanoid, pose: RiderPose) {
  const left=h.getNormalizedBoneNode('leftFoot')!,right=h.getNormalizedBoneNode('rightFoot')!;
  left.updateWorldMatrix(true,false);right.updateWorldMatrix(true,false);
  const spacing=Math.abs(left.getWorldPosition(left.position.clone()).distanceTo(right.getWorldPosition(right.position.clone()))-.48);
  let clearance=Infinity;
  for(const side of ['left','right'] as const) {
    if((side==='left'?pose.grabFront:pose.grabRear)<.1)continue;
    const nodes=['UpperArm','LowerArm','Hand'].map(n=>h.getNormalizedBoneNode(`${side}${n}` as any)!);
    const points=nodes.map(n=>n.getWorldPosition(n.position.clone()));
    for(const leg of ['left','right'] as const) {
      const legs=['UpperLeg','LowerLeg','Foot'].map(n=>h.getNormalizedBoneNode(`${leg}${n}` as any)!);
      const p=legs.map(n=>n.getWorldPosition(n.position.clone()));
      for(let segment=0;segment<2;segment++)for(let limb=0;limb<2;limb++)for(let j=0;j<=20;j++) {
        const point=points[limb].clone().lerp(points[limb+1],j/20);
        clearance=Math.min(clearance,segmentDistance(point,p[segment],p[segment+1])-(segment===0?.125:.1));
      }
    }
  }
  return {bindingErrorMm:spacing*1000,armClearanceMm:Number.isFinite(clearance)?clearance*1000:null};
}

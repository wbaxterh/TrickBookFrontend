const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const THREE = require('three');
const esbuild = require('esbuild');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'kaori-rig-'));
const entry = path.join(folder, 'engine.cjs');
esbuild.buildSync({stdin:{contents:`export * from '../src/components/companion/riderFundamentals'; export * from '../src/components/companion/trickAnimations'; export * from '../src/components/companion/grabContact';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:entry,tsconfigRaw:{}});
const engine = require(entry);
// Actual normalized bind-pose hierarchy exported by the Trick Lab from Kaori.
const rest = require('./fixtures/kaori-rig.json');
const root = new THREE.Object3D(), bones = {};
for (const name of Object.keys(rest)) bones[name] = new THREE.Object3D();
for (const [name, value] of Object.entries(rest)) (bones[value.parent] ?? root).add(bones[name]);
const humanoid = {getNormalizedBoneNode: name => bones[name]};
const position = name => bones[name].getWorldPosition(new THREE.Vector3());
function reset() {
  root.position.set(0,0,0); root.quaternion.identity();
  for (const [name, value] of Object.entries(rest)) {
    bones[name].position.fromArray(value.position); bones[name].quaternion.fromArray(value.quaternion);
  }
}
const results = []; let maxBindingErrorMm=0, maxRepeatError=0, maxCrossingMm=0, maxStep=0;
for (const [id, trick] of Object.entries(engine.TRICKS)) {
  const row={trick:id,samples:0,minArmClearanceMm:Infinity,maxWristGapMm:0,maxBindingErrorMm:0,maxKneeCrossingMm:0,maxElbowStepMm:0,worstPhase:0};
  let previous;
  for (let i=0;i<=400;i++) {
    reset(); const phase=i/400, pose=trick.poseAt(phase*trick.duration);
    engine.applyRiderPose(humanoid,pose,1); root.updateMatrixWorld(true);
    const fit=engine.riderClearance(humanoid,pose);
    row.maxBindingErrorMm=Math.max(row.maxBindingErrorMm,fit.bindingErrorMm);
    for(const [name,bone] of Object.entries(bones)) {
      assert.ok(bone.quaternion.toArray().every(Number.isFinite),`${id}: finite ${name} at ${phase}`);
      assert.ok(bone.position.distanceTo(new THREE.Vector3().fromArray(rest[name].position))<1e-9,`${id}: no limb stretching`);
    }
    const elbows=['leftLowerArm','rightLowerArm'].map(position);
    if(previous) { const step = Math.max(...elbows.map((p,j)=>p.distanceTo(previous[j])*1000)); if(step>row.maxElbowStepMm) {row.maxElbowStepMm=step;row.elbowJumpPhase=phase;} }
    previous=elbows;
    if(pose.height>.02 && Math.max(pose.grabFront,pose.grabRear)>=.1) {
      row.samples++;
      if(fit.armClearanceMm<row.minArmClearanceMm){row.minArmClearanceMm=fit.armClearanceMm;row.worstPhase=phase;}
      row.maxWristGapMm=Math.max(row.maxWristGapMm,...Object.values(engine.grabContactDistances(humanoid,pose)).map(n=>n*1000));
      const midpoint=position('leftUpperLeg').add(position('rightUpperLeg')).multiplyScalar(.5);
      row.maxKneeCrossingMm=Math.max(row.maxKneeCrossingMm,(position('rightLowerLeg').x-position('leftLowerLeg').x)*1000);
    }
    if(i%40===0) {
      const snapshot=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.matrixWorld.clone()]));
      // App playback reuses the skeleton; it must agree with fresh scrubbing.
      engine.applyRiderPose(humanoid,pose,1);root.updateMatrixWorld(true);
      for(const [n,b] of Object.entries(bones)) maxRepeatError=Math.max(maxRepeatError,...b.matrixWorld.elements.map((v,j)=>Math.abs(v-snapshot[n].elements[j])));
      // A root spin/flip must rotate the same pose without changing its fit.
      root.quaternion.setFromEuler(new THREE.Euler(.4,1.2,-.7));root.position.set(2,3,-1);
      engine.applyRiderPose(humanoid,pose,1);root.updateMatrixWorld(true);
      for(const [n,b] of Object.entries(bones)) {
        const expected=root.matrixWorld.clone().multiply(snapshot[n]);
        assert.ok(b.matrixWorld.elements.every((v,j)=>Math.abs(v-expected.elements[j])<1e-6),`${id}: root covariance ${n}`);
      }
    }
  }
  maxBindingErrorMm=Math.max(maxBindingErrorMm,row.maxBindingErrorMm);
  maxCrossingMm=Math.max(maxCrossingMm,row.maxKneeCrossingMm);maxStep=Math.max(maxStep,row.maxElbowStepMm);
  if(row.samples)results.push(row);
}
const report={version:2,poses:Object.keys(engine.TRICKS).length*401,maxBindingErrorMm,maxRepeatError,maxCrossingMm,maxElbowStepMm:maxStep,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
console.log(`Checked ${report.poses} poses; ${results.length} grabs; minimum arm clearance ${Math.min(...results.map(r=>r.minArmClearanceMm)).toFixed(2)} mm; worst wrist gap ${Math.max(...results.map(r=>r.maxWristGapMm)).toFixed(2)} mm.`);
assert.ok(maxBindingErrorMm<.01,'Feet remain at the rigid binding spacing');
assert.ok(maxRepeatError<1e-6,'Repeated application must not accumulate rotations');
for(const row of results) {
 assert.ok(row.minArmClearanceMm>=0,`${row.trick}: arm/leg clearance at ${row.worstPhase}`);
 assert.ok(row.maxWristGapMm<5,`${row.trick}: held wrist gap`);
 assert.ok(row.maxElbowStepMm<60,`${row.trick}: discontinuous elbow path`);
 assert.ok(row.maxKneeCrossingMm<1,`${row.trick}: knees must not cross each other`);
}
console.log('PASS: rigid binding spacing, unchanged bone lengths, no sampled arm/leg capsule intersections, held wrists within 5 mm, uncrossed knees, deterministic repeated playback and root covariance.');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tricklab-tests-'));
for (const [name, source] of [['workflow','src/workflow.ts'],['engine','../src/components/companion/trickAnimations.ts'],['fundamentals','../src/components/companion/riderFundamentals.ts']]) {
  esbuild.buildSync({ entryPoints: [source], bundle:true, platform:'node', format:'cjs', outfile:path.join(out,name+'.cjs'), tsconfigRaw:{} });
}
const {advanceTime,validatePreset}=require(path.join(out,'workflow.cjs'));
const engine=require(path.join(out,'engine.cjs'));
const f=require(path.join(out,'fundamentals.cjs'));
const {TRICKS,riderRootAt}=engine;
for(const trick of Object.values(TRICKS)) {
  assert.ok(trick.duration>0);
  for(let i=0;i<=100;i++) {
    const pose=trick.poseAt(trick.duration*i/100);
    for(const n of Object.values(pose)) assert.ok(Number.isFinite(n));
    for(const w of [0,.4,1]) {
      const root=riderRootAt(pose,trick,w);
      assert.equal(root.rootY,pose.height-f.hipDropFor(pose.crouch*w));
      assert.equal(root.rootYaw,(f.STANCE_YAW+(trick.yawOffset??0))*w+trick.totalSpin*pose.spin);
      assert.equal(root.rootPitch,(trick.totalFlip??0)*pose.pitch*w);
    }
  }
  assert.ok(Math.abs(advanceTime(0,trick.duration*.25,trick.duration,1)-.25)<1e-9);
  assert.ok(Math.abs(advanceTime(0,trick.duration*.5,trick.duration,.5)-.25)<1e-9);
}
const groups={ARM_TUNING:f.ARM_TUNING,ARM_TUNING_BS:f.ARM_TUNING_BS,GRAB_TUNING:f.GRAB_TUNING,HEAD_TUNING:engine.HEAD_TUNING,HEAD_TUNING_BS:engine.HEAD_TUNING_BS,STYLE_BS:engine.STYLE_BS};
const preset={version:1,trick:'indy',tuning:JSON.parse(JSON.stringify(groups))};
assert.equal(validatePreset(preset,groups,Object.keys(TRICKS)).trick,'indy');
for(const mutate of [p=>p.version=3,p=>p.trick='invented',p=>p.tuning.ARM_TUNING.rest.uz='bad',p=>delete p.tuning.GRAB_TUNING,p=>p.tuning.HEAD_TUNING.WHIP_END=.01,p=>p.tuning.STYLE_BS.P2_END=0]) {
  const invalid=JSON.parse(JSON.stringify(preset));mutate(invalid);
  assert.throws(()=>validatePreset(invalid,groups,Object.keys(TRICKS)));
}
console.log(`PASS: ${Object.keys(TRICKS).length} tricks, 101 timestamps each, root parity at 3 stance weights, duration-aware speeds, nested preset validation and 6 invalid inputs.`);

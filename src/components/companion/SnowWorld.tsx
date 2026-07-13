/**
 * SnowWorld — a self-contained alpine scene that crossfades IN as Kaori straps
 * onto her board and OUT as she steps off. Rendered inside the KaoriStage Canvas
 * alongside StageSet, driven by ONE scalar: the demo's `stance` weight (the same
 * 0→1 signal that fades the board in). Zero React re-renders during the fade —
 * every frame it reads demo.current.stance and mutates materials / fog /
 * background in place.
 *
 * expo-gl constraints honored: three@0.170, NO drei, PNG-free (everything is
 * procedural / vertex-colored), light geometry, alloc-free per-frame.
 */
import { useFrame, useThree } from '@react-three/fiber/native';
import { type MutableRefObject, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp01, easeInOut } from './riderFundamentals';
import type { TrickDemoState } from './trickAnimations';

// Studio (weight 0) vs snow (weight 1) clear color. scene.background is a Color
// (rendered by CLEARING — can't be alpha-faded), so we lerp its RGB in place.
const STUDIO_BG = new THREE.Color('#0b0e17'); // matches the seed <color> tag
const SNOW_BG = new THREE.Color('#bcd3ea');
const FOG_COLOR = new THREE.Color('#cfe0f2');
const SNOW_FOG_DENSITY = 0.032;

const SNOW_BOX = 14; // XZ spread of the flake volume (centered on origin)
const SNOW_TOP = 9; // Y ceiling flakes wrap back to
const SNOW_COUNT = 700; // keep <= ~900 (the Hermes JS wrap loop, not the GPU, is the cost)

/** Deterministic RNG so remounts look identical (no build-time Math.random). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SKY: one inverted, vertex-colored icosahedron (unlit, BackSide, never fogged). */
function makeSkyGeometry(): THREE.BufferGeometry {
  const R = 40;
  const geo = new THREE.IcosahedronGeometry(R, 2); // ~320 tris
  const pos = geo.attributes.position;
  const top = new THREE.Color('#2b5c9e'); // deep cool blue overhead
  const horizon = new THREE.Color('#dfeaf7'); // pale ice at the horizon
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / R; // -1..1
    const t = THREE.MathUtils.clamp((y + 0.15) / 0.9, 0, 1);
    c.copy(horizon).lerp(top, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** MOUNTAINS: a ring of low-poly vertex-colored cones (slate base → white cap). */
function makeMountains(): THREE.BufferGeometry[] {
  const base = new THREE.Color('#5b708c');
  const cap = new THREE.Color('#f2f7ff');
  const geos: THREE.BufferGeometry[] = [];
  const rng = mulberry32(1337);
  for (let i = 0; i < 14; i++) {
    const h = 6 + rng() * 10;
    const r = 3 + rng() * 4;
    const g = new THREE.ConeGeometry(r, h, 5 + Math.floor(rng() * 3), 1);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      const yy = pos.getY(v) / h + 0.5; // 0 base .. 1 tip
      c.copy(base).lerp(cap, THREE.MathUtils.smoothstep(yy, 0.55, 0.9));
      cols[v * 3] = c.r;
      cols[v * 3 + 1] = c.g;
      cols[v * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ang = (i / 14) * Math.PI * 2 + rng() * 0.3;
    const dist = 20 + rng() * 10;
    g.translate(Math.sin(ang) * dist, h / 2 - 0.5, Math.cos(ang) * dist);
    geos.push(g);
  }
  return geos;
}

function makeSnowPoints(count: number, box: number, top: number) {
  const positions = new Float32Array(count * 3);
  const vel = new Float32Array(count);
  const rng = mulberry32(7);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rng() - 0.5) * box;
    positions[i * 3 + 1] = rng() * top;
    positions[i * 3 + 2] = (rng() - 0.5) * box;
    vel[i] = 0.6 + rng() * 0.7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return { geo, vel };
}

export function SnowWorld({ demo }: { demo: MutableRefObject<TrickDemoState> }) {
  const { scene } = useThree();

  const skyGeo = useMemo(makeSkyGeometry, []);
  const mountainGeos = useMemo(makeMountains, []);
  const snow = useMemo(() => makeSnowPoints(SNOW_COUNT, SNOW_BOX, SNOW_TOP), []);

  const skyMat = useRef<THREE.MeshBasicMaterial>(null);
  const groundMat = useRef<THREE.MeshStandardMaterial>(null);
  const mountainMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const snowMat = useRef<THREE.PointsMaterial>(null);
  const snowRef = useRef<THREE.Points>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const fillLight = useRef<THREE.AmbientLight>(null);

  // Fog owned here so density is animatable. FogExp2 = cheap per-pixel exp fog.
  const fog = useMemo(() => new THREE.FogExp2(FOG_COLOR.getHex(), 0), []);
  // Only flip scene.fog (a #define → shader recompile) at the threshold, not every frame.
  const fogOn = useRef(false);
  const bg = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    // Same eased weight the board uses (boardOpacity = easeInOut(clamp01(stance))).
    const w = easeInOut(clamp01(demo.current.stance));

    // Background crossfade (mutate the existing Color in place — no GC churn).
    bg.copy(STUDIO_BG).lerp(SNOW_BG, w);
    if (scene.background instanceof THREE.Color) scene.background.copy(bg);
    else scene.background = bg.clone();

    // Fog fades in; toggle scene.fog only at the threshold.
    fog.density = SNOW_FOG_DENSITY * w;
    const wantFog = w > 0.01;
    if (wantFog !== fogOn.current) {
      scene.fog = wantFog ? fog : null;
      fogOn.current = wantFog;
    }

    // Opacity crossfades (all fade materials are transparent).
    if (skyMat.current) skyMat.current.opacity = w;
    if (groundMat.current) groundMat.current.opacity = w;
    for (const m of mountainMats.current) if (m) m.opacity = w;
    if (snowMat.current) snowMat.current.opacity = 0.85 * w;

    // Alpine lights ramp in (studio lights stay; these ADD a cool key + fill).
    if (keyLight.current) keyLight.current.intensity = 1.6 * w;
    if (fillLight.current) fillLight.current.intensity = 0.5 * w;

    // Animate snow only when visible (studio mode = nearly free).
    if (w > 0.02 && snowRef.current) {
      const p = snowRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = p.array as Float32Array;
      for (let i = 0; i < SNOW_COUNT; i++) {
        const iy = i * 3 + 1;
        arr[iy] -= snow.vel[i] * delta;
        arr[i * 3] += Math.sin((arr[iy] + i) * 0.6) * 0.01; // gentle sway
        if (arr[iy] < 0) {
          arr[iy] = SNOW_TOP; // wrap to ceiling, re-scatter XZ
          arr[i * 3] = (Math.random() - 0.5) * SNOW_BOX;
          arr[i * 3 + 2] = (Math.random() - 0.5) * SNOW_BOX;
        }
      }
      p.needsUpdate = true; // reuse the Float32Array; never recreate the geometry
    }
  });

  return (
    <group>
      {/* SKY — inverted vertex-colored sphere, never fogged, drawn first */}
      <mesh geometry={skyGeo} renderOrder={-10}>
        <meshBasicMaterial
          ref={skyMat}
          vertexColors
          side={THREE.BackSide}
          fog={false}
          depthWrite={false}
          transparent
          opacity={0}
        />
      </mesh>

      {/* GROUND — big lit snow plane at y=0.02, just above the studio disc/ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[34, 64]} />
        <meshStandardMaterial
          ref={groundMat}
          color="#eef4ff"
          roughness={0.95}
          metalness={0}
          transparent
          opacity={0}
        />
      </mesh>

      {/* MOUNTAINS — distant vertex-colored cones (fog ON so they recede) */}
      {mountainGeos.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={-5}>
          <meshStandardMaterial
            ref={(m) => {
              if (m) mountainMats.current[i] = m as THREE.MeshStandardMaterial;
            }}
            vertexColors
            roughness={1}
            metalness={0}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      {/* SNOW — one THREE.Points, plain white square points (expo-gl safe: NO map) */}
      <points ref={snowRef} geometry={snow.geo} renderOrder={5} frustumCulled={false}>
        <pointsMaterial
          ref={snowMat}
          color="#ffffff"
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
        />
      </points>

      {/* Alpine lights (fade in via intensity; Kaori is unlit so pays nothing) */}
      <ambientLight ref={fillLight} color="#dfeeff" intensity={0} />
      <directionalLight ref={keyLight} color="#fff4e0" intensity={0} position={[6, 10, 4]} />
    </group>
  );
}

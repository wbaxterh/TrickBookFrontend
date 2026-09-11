/**
 * KaoriStage — interactive 3D companion stage
 *
 * Renders the Kaori VRM avatar with a fully procedural idle animation
 * (breathing, sway, blink, eye tracking) ported from the website's
 * kaori-live stage so web and mobile share one motion language.
 *
 * One-finger drag orbits the camera, pinch zooms. Textures inside the
 * VRM must be PNG/JPEG — expo-gl's native decoder supports only those.
 *
 * NOTE: Canvas/useLoader MUST come from '@react-three/fiber/native'.
 * Importing that entry installs the polyfills (FileLoader, TextureLoader,
 * BlobManager, URL.createObjectURL) that make GLTFLoader work on Hermes.
 */

import { type VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber/native';
import * as Device from 'expo-device';
import { Component, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { brandColors } from '@/constants/colors';
import { SnowWorld } from './SnowWorld';
import {
  createTrickDemoState,
  driveDemo,
  isDemoActive,
  type TrickDemoState,
} from './trickAnimations';

// three r170's GLTFLoader sniffs navigator.userAgent for Safari/Firefox
// workarounds; React Native defines navigator WITHOUT userAgent, so the
// probe throws ("Cannot read property 'match' of undefined"). Any
// non-browser string routes it to the polyfilled TextureLoader path.
if (typeof navigator !== 'undefined' && typeof navigator.userAgent !== 'string') {
  try {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'ReactNative',
      configurable: true,
    });
  } catch {
    // navigator is frozen — leave it; GLTFLoader will fail loudly instead
  }
}

const KAORI_MODEL = require('../../../assets/models/kaori.vrm') as number;

const CAMERA_TARGET = new THREE.Vector3(0, 0.95, 0);
const MIN_DISTANCE = 1.1;
const MAX_DISTANCE = 4.5;
const MIN_POLAR = 0.35;
const MAX_POLAR = 1.5;

interface OrbitState {
  azimuth: number;
  polar: number;
  distance: number;
}

const INITIAL_ORBIT: OrbitState = { azimuth: 0, polar: 1.32, distance: 2.4 };

/** Character interaction state, driven by the voice/chat layer. */
export type CompanionMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export type CompanionEmotion = 'neutral' | 'excited' | 'calm' | 'happy' | 'sad';

/**
 * Mutable state shared between the voice/chat layer (outside the Canvas)
 * and the per-frame animation loop — same ref pattern as the orbit state.
 */
export interface CompanionVoiceState {
  mode: CompanionMode;
  emotion: CompanionEmotion;
  emotionIntensity: number;
}

export const createVoiceState = (): CompanionVoiceState => ({
  mode: 'idle',
  emotion: 'neutral',
  emotionIntensity: 0,
});

/** VRoid exports vary in expression naming — try candidates in order. */
const EXPRESSION_CANDIDATES: Record<string, string[]> = {
  blink: ['blink', 'Blink', 'blinkLeft'],
  happy: ['happy', 'Happy', 'relaxed', 'Relaxed'],
  aa: ['aa', 'Aa', 'a', 'A', 'vowelA'],
  oh: ['oh', 'Oh', 'o', 'O', 'vowelO'],
  ee: ['ee', 'Ee', 'e', 'E', 'vowelE'],
  ih: ['ih', 'Ih', 'i', 'I', 'vowelI'],
  sad: ['sad', 'Sad', 'sorrow', 'Sorrow'],
  surprised: ['surprised', 'Surprised'],
};

function setExpression(vrm: VRM, name: string, value: number) {
  const manager = vrm.expressionManager;
  if (!manager) return;
  for (const candidate of EXPRESSION_CANDIDATES[name] ?? [name]) {
    if (manager.getExpression(candidate)) {
      manager.setValue(candidate, value);
      return;
    }
  }
}

type Humanoid = NonNullable<VRM['humanoid']>;
type HumanBoneName = Parameters<Humanoid['getNormalizedBoneNode']>[0];

function driveTorso(humanoid: Humanoid, t: number, mode: CompanionMode) {
  const neck = humanoid.getNormalizedBoneNode('neck');
  const spine = humanoid.getNormalizedBoneNode('spine');
  const chest = humanoid.getNormalizedBoneNode('chest');
  const hips = humanoid.getNormalizedBoneNode('hips');

  const breathe = Math.sin(t * 1.2) * 0.015;
  const idleSway = Math.sin(t * 0.4) * 0.02;
  const headDrift = Math.sin(t * 0.55) * 0.04;

  if (hips) {
    hips.rotation.z = Math.sin(t * 0.3) * 0.015;
    hips.rotation.y = Math.sin(t * 0.2) * 0.01;
  }
  if (neck) {
    neck.rotation.y = headDrift;
    neck.rotation.x = breathe * 0.8;
    neck.rotation.z = Math.sin(t * 0.35) * 0.02;
  }
  if (spine) {
    spine.rotation.z = idleSway;
    spine.rotation.x = breathe * 0.4;
  }
  if (chest) chest.rotation.x = breathe * 0.6;

  // Attentive lean while listening; pondering head-tilt while thinking
  if (mode === 'listening') {
    if (neck) neck.rotation.x += 0.08;
    if (spine) spine.rotation.x = 0.04;
  }
  if (mode === 'thinking') {
    if (neck) neck.rotation.y += Math.sin(t * 2.2) * 0.05;
    if (spine) spine.rotation.x = 0.06;
  }
}

/** Damp one axis of a named bone toward a target angle. */
function dampBone(
  humanoid: Humanoid,
  bone: HumanBoneName,
  axis: 'x' | 'z',
  target: number,
  damping: number,
  dt: number,
) {
  const node = humanoid.getNormalizedBoneNode(bone);
  if (!node) return;
  node.rotation[axis] = THREE.MathUtils.damp(node.rotation[axis], target, damping, dt);
}

/**
 * Conversational gesture poses (ported from kaori-live.js) — held ~2s each
 * with smooth damped blending while speaking. Pose 0 is the resting pose.
 * lUZ/rUZ = upper arm Z, lUX/rUX = upper arm X (forward), lFZ/rFZ = forearm
 * Z, lHX/rHX = wrist tilt, nX/nY = neck nod/turn, sX = spine lean.
 */
const GESTURE_POSES = [
  // Resting — both arms at sides, neutral
  {
    lUZ: -1.15,
    rUZ: 1.2,
    lUX: 0.08,
    rUX: 0.05,
    lFZ: -0.15,
    rFZ: 0.15,
    lHX: 0.1,
    rHX: 0.1,
    nX: 0,
    nY: 0,
    sX: 0,
  },
  // Right hand out — explaining, palm up
  {
    lUZ: -1.1,
    rUZ: 0.7,
    lUX: 0.1,
    rUX: 0.4,
    lFZ: -0.15,
    rFZ: -0.3,
    lHX: 0.1,
    rHX: -0.3,
    nX: 0.03,
    nY: -0.04,
    sX: 0.02,
  },
  // Left hand out — presenting, palm open
  {
    lUZ: -0.7,
    rUZ: 1.15,
    lUX: 0.4,
    rUX: 0.08,
    lFZ: 0.3,
    rFZ: 0.15,
    lHX: -0.3,
    rHX: 0.1,
    nX: 0.02,
    nY: 0.05,
    sX: 0.01,
  },
  // Both hands forward — emphasis, open palms
  {
    lUZ: -0.85,
    rUZ: 0.85,
    lUX: 0.35,
    rUX: 0.35,
    lFZ: 0.1,
    rFZ: -0.1,
    lHX: -0.2,
    rHX: -0.2,
    nX: 0.04,
    nY: 0,
    sX: 0.02,
  },
  // Right hand gesture — counting/listing
  {
    lUZ: -1.1,
    rUZ: 0.6,
    lUX: 0.1,
    rUX: 0.5,
    lFZ: -0.15,
    rFZ: -0.45,
    lHX: 0.1,
    rHX: -0.15,
    nX: 0.02,
    nY: -0.06,
    sX: 0.015,
  },
  // Nodding emphasis — both arms subtly forward
  {
    lUZ: -1.0,
    rUZ: 1.0,
    lUX: 0.2,
    rUX: 0.2,
    lFZ: -0.1,
    rFZ: 0.1,
    lHX: 0,
    rHX: 0,
    nX: 0.05,
    nY: 0.02,
    sX: 0.015,
  },
] as const;

const GESTURE_POSE_INTERVAL = 2.0;

function driveArms(humanoid: Humanoid, t: number, dt: number, mode: CompanionMode) {
  const breathSway = Math.sin(t * 0.5) * 0.015;
  const damping = 2.5;

  // While speaking, cycle through conversational gestures; otherwise rest
  const speaking = mode === 'speaking';
  const poseIndex = speaking
    ? 1 + (Math.floor(t / GESTURE_POSE_INTERVAL) % (GESTURE_POSES.length - 1))
    : 0;
  const pose = GESTURE_POSES[poseIndex];

  dampBone(humanoid, 'leftUpperArm', 'z', pose.lUZ + breathSway, damping, dt);
  dampBone(humanoid, 'leftUpperArm', 'x', pose.lUX, damping, dt);
  dampBone(humanoid, 'rightUpperArm', 'z', pose.rUZ - breathSway, damping, dt);
  dampBone(humanoid, 'rightUpperArm', 'x', pose.rUX, damping, dt);
  dampBone(humanoid, 'leftLowerArm', 'z', pose.lFZ, damping, dt);
  dampBone(humanoid, 'rightLowerArm', 'z', pose.rFZ, damping, dt);
  dampBone(humanoid, 'leftHand', 'x', pose.lHX, damping, dt);
  dampBone(humanoid, 'rightHand', 'x', pose.rHX, damping, dt);

  // Gesture head/spine accents on top of the torso motion
  const neck = humanoid.getNormalizedBoneNode('neck');
  const spine = humanoid.getNormalizedBoneNode('spine');
  const chest = humanoid.getNormalizedBoneNode('chest');
  if (neck) {
    neck.rotation.x += pose.nX;
    neck.rotation.y += pose.nY;
  }
  if (speaking) {
    if (spine) spine.rotation.x += pose.sX;
    if (chest) chest.rotation.x += pose.sX * 0.5;
  }
}

/** Relaxed-hand curl targets per finger joint, computed once at module load. */
const FINGER_CURL_TARGETS: ReadonlyArray<{ bone: HumanBoneName; curl: number }> = (
  ['left', 'right'] as const
).flatMap((side) =>
  (['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const).flatMap((finger) =>
    (
      [
        ['Proximal', 0.3],
        ['Intermediate', 0.35],
        ['Distal', 0.25],
      ] as const
    ).map(([joint, amount]) => ({
      bone: `${side}${finger}${joint}` as HumanBoneName,
      curl: side === 'left' ? -amount : amount,
    })),
  ),
);

function driveFingers(humanoid: Humanoid, dt: number) {
  for (const { bone, curl } of FINGER_CURL_TARGETS) {
    dampBone(humanoid, bone, 'z', curl, 2, dt);
  }
}

function driveFace(vrm: VRM, t: number, voice: CompanionVoiceState) {
  // Natural blinking — every ~3.5s, quick 150ms close/open
  const blinkInterval = 3.5;
  const blinkDuration = 0.15;
  const blinkT = t % blinkInterval;
  const blinkValue = blinkT < blinkDuration ? Math.sin((blinkT / blinkDuration) * Math.PI) : 0;
  setExpression(vrm, 'blink', blinkValue);

  // Mouth shapes — simulated speech cycling (same frequencies as web stage)
  if (voice.mode === 'speaking') {
    setExpression(vrm, 'aa', Math.max(0, Math.sin(t * 5.5)) * 0.5);
    setExpression(vrm, 'oh', Math.max(0, Math.sin(t * 4.2 + 1.2)) * 0.35);
    setExpression(vrm, 'ee', Math.max(0, Math.sin(t * 6.8 + 2.5)) * 0.3);
  } else {
    setExpression(vrm, 'aa', 0);
    setExpression(vrm, 'oh', 0);
    setExpression(vrm, 'ee', 0);
  }
  setExpression(vrm, 'ih', voice.mode === 'thinking' ? 0.1 : 0);

  // Emotion layer from Kith emotion_state events, on top of a resting smile
  const restSmile = voice.mode === 'listening' ? 0.18 : voice.mode === 'speaking' ? 0.25 : 0.12;
  const intensity = THREE.MathUtils.clamp(voice.emotionIntensity, 0, 1);
  let happy = restSmile;
  let sad = 0;
  let surprised = 0;
  if (voice.emotion === 'happy' || voice.emotion === 'excited') {
    happy = Math.max(restSmile, intensity * 0.8);
    if (voice.emotion === 'excited') surprised = intensity * 0.3;
  } else if (voice.emotion === 'sad') {
    happy = 0;
    sad = intensity * 0.7;
  }
  setExpression(vrm, 'happy', happy);
  setExpression(vrm, 'sad', sad);
  setExpression(vrm, 'surprised', surprised);
}

/**
 * Procedural character animation — port of the web stage's motion system
 * (kaori-live.js): breathing/sway idle, attentive listening, pondering
 * thinking, gesture-cycling speech with simulated mouth shapes, and an
 * emotion layer driven by Kith emotion_state events.
 */
function driveCharacter(vrm: VRM, t: number, dt: number, voice: CompanionVoiceState) {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  driveTorso(humanoid, t, voice.mode);
  driveArms(humanoid, t, dt, voice.mode);
  driveFingers(humanoid, dt);
  driveFace(vrm, t, voice);
}

/**
 * fiber's texture polyfill hands three `image = { data: { localUri } }`
 * objects, but three's texStorage2D+texSubImage2D upload of those silently
 * produces empty textures on expo-gl (no GL error — verified on device:
 * unlit red renders, unlit textured doesn't). Bypass: decode the image
 * through expo-gl's one battle-tested path (plain texImage2D + localUri),
 * read the raw RGBA back from a framebuffer, and hand three a real
 * DataTexture with a typed array — an upload path verified working.
 */
function rebakeTexture(
  glCtx: WebGL2RenderingContext,
  source: THREE.Texture,
  cache: Map<string, THREE.Texture | null>,
): THREE.Texture | null {
  const cached = cache.get(source.uuid);
  if (cached !== undefined) return cached;

  const image = source.image as
    | { data?: { localUri?: string }; width?: number; height?: number }
    | undefined;
  const localUri = image?.data?.localUri;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!localUri || !width || !height) {
    cache.set(source.uuid, null);
    return null;
  }
  if (width * height > 4 * 1024 * 1024) {
    // Refuse pathological sizes — 4Mpx RGBA is a 16MB readback
    cache.set(source.uuid, null);
    return null;
  }

  // Decode natively into a scratch texture (documented EXGL localUri path)
  glCtx.pixelStorei(glCtx.UNPACK_FLIP_Y_WEBGL, 0);
  const scratch = glCtx.createTexture();
  glCtx.bindTexture(glCtx.TEXTURE_2D, scratch);
  (
    glCtx.texImage2D as unknown as (
      target: number,
      level: number,
      internalformat: number,
      format: number,
      type: number,
      source: { localUri: string },
    ) => void
  )(glCtx.TEXTURE_2D, 0, glCtx.RGBA, glCtx.RGBA, glCtx.UNSIGNED_BYTE, { localUri });

  // Read the decoded pixels back
  const framebuffer = glCtx.createFramebuffer();
  glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, framebuffer);
  glCtx.framebufferTexture2D(
    glCtx.FRAMEBUFFER,
    glCtx.COLOR_ATTACHMENT0,
    glCtx.TEXTURE_2D,
    scratch,
    0,
  );
  const complete = glCtx.checkFramebufferStatus(glCtx.FRAMEBUFFER) === glCtx.FRAMEBUFFER_COMPLETE;
  const pixels = new Uint8Array(width * height * 4);
  if (complete) {
    glCtx.readPixels(0, 0, width, height, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);
  }
  glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, null);
  glCtx.deleteFramebuffer(framebuffer);
  glCtx.deleteTexture(scratch);
  if (!complete) {
    cache.set(source.uuid, null);
    return null;
  }

  const baked = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  baked.colorSpace = source.colorSpace;
  baked.wrapS = source.wrapS;
  baked.wrapT = source.wrapT;
  baked.offset.copy(source.offset);
  baked.repeat.copy(source.repeat);
  baked.flipY = false;
  baked.generateMipmaps = false;
  baked.minFilter = THREE.LinearFilter;
  baked.magFilter = THREE.LinearFilter;
  baked.needsUpdate = true;
  // Release the CPU copy once three has uploaded it to the GPU
  baked.onUpdate = () => {
    (baked.image as { data: Uint8Array | null }).data = null;
  };
  cache.set(source.uuid, baked);
  return baked;
}

/**
 * three-vrm's MToon ShaderMaterial does not survive expo-gl's shader
 * compiler: on-device the program silently fails (character never draws)
 * and the iOS Simulator's GL shader JIT hard-crashes (SIGBUS in
 * cvmsServerElementBuild). Swap every MToon for an unlit textured material
 * — the closest match to MToon's anime look — with textures rebaked
 * through the working upload path.
 */
function downgradeMToonMaterials(root: THREE.Object3D, glCtx: WebGL2RenderingContext) {
  const rebakeCache = new Map<string, THREE.Texture | null>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const swapped = materials.map((material) => {
      const mtoon = material as THREE.Material & {
        isMToonMaterial?: boolean;
        map?: THREE.Texture | null;
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveMap?: THREE.Texture | null;
      };
      if (!mtoon?.isMToonMaterial && mtoon?.type !== 'MToonMaterial') return material;
      const baked = mtoon.map ? rebakeTexture(glCtx, mtoon.map, rebakeCache) : null;
      const replacement = new THREE.MeshBasicMaterial({
        map: baked,
        color: mtoon.color?.clone() ?? new THREE.Color(0xffffff),
        transparent: mtoon.transparent,
        opacity: mtoon.opacity,
        alphaTest: mtoon.alphaTest,
        side: mtoon.side,
        depthWrite: mtoon.depthWrite,
        depthTest: mtoon.depthTest,
        // Kaori is unlit and always in the foreground — never fog her (the snow
        // world adds scene fog; MeshBasicMaterial.fog defaults to true).
        fog: false,
      });
      replacement.name = mtoon.name;
      mtoon.dispose();
      return replacement;
    });
    mesh.material = Array.isArray(mesh.material) ? swapped : swapped[0];
  });
}

function KaoriModel({
  onReady,
  voice,
  demo,
}: {
  onReady: () => void;
  voice: React.MutableRefObject<CompanionVoiceState>;
  demo: React.MutableRefObject<TrickDemoState>;
}) {
  const gltf = useLoader(GLTFLoader, KAORI_MODEL as unknown as string, (loader) => {
    (loader as GLTFLoader).register((parser) => new VRMLoaderPlugin(parser));
  });
  const vrm = (gltf.userData as { vrm: VRM }).vrm;
  const camera = useThree((state) => state.camera);
  const renderer = useThree((state) => state.gl);

  // One-time scene preparation; useLoader caches the parsed model,
  // so guard against re-running on remount.
  const prepared = vrm.scene.userData as { kaoriStagePrepared?: boolean };
  if (!prepared.kaoriStagePrepared) {
    prepared.kaoriStagePrepared = true;
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    downgradeMToonMaterials(vrm.scene, renderer.getContext() as WebGL2RenderingContext);
    // Skinned meshes keep their rest-pose bounding sphere; once bones move,
    // stale bounds get frustum-culled and the whole character disappears.
    vrm.scene.traverse((node) => {
      node.frustumCulled = false;
    });
  }

  useEffect(() => {
    onReady();
  }, [onReady]);

  // Eyes follow the orbiting camera
  useEffect(() => {
    if (vrm.lookAt) vrm.lookAt.target = camera;
    return () => {
      if (vrm.lookAt) vrm.lookAt.target = null;
    };
  }, [vrm, camera]);

  // Own time accumulator — r3f resets state.clock whenever frameloop
  // toggles ('always'/'never'), which would snap the idle pose and force
  // a blink on every screen refocus.
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const demoActive = isDemoActive(demo.current);
    if (demoActive) {
      // The demo session owns the body; face keeps talking (mouth/blink/
      // emotes) so she narrates while riding and performing.
      const active = driveDemo(vrm, demo.current, delta);
      driveFace(vrm, elapsed.current, voice.current);
      const st = demo.current;
      // Compose the whole-body orientation: YAW (stance + spin, about Y) THEN
      // PITCH (flip, about her local toe-heel axis — end over end). q = qYaw * qPitch so the
      // flip axis rotates WITH her facing. Pure 360 → rootPitch=0 → qPitch=
      // identity → q is pure Y yaw, identical to before.
      _flipQYaw.setFromAxisAngle(_flipYAxis, st.rootYaw);
      _flipQPitch.setFromAxisAngle(_flipPitchAxis, st.rootPitch);
      _flipQ.copy(_flipQYaw).multiply(_flipQPitch);
      vrm.scene.quaternion.copy(_flipQ);
      // Publish the root quaternion so lockBoardToFeet can roll the deck with her
      // through a flip inversion (else it stays world-flat while she inverts).
      st.rootQuat[0] = _flipQ.x;
      st.rootQuat[1] = _flipQ.y;
      st.rootQuat[2] = _flipQ.z;
      st.rootQuat[3] = _flipQ.w;
      // Pivot around the CoM/hip, not the feet: place the scene origin at
      // arcCoM − q·comLocal so the hip sits at (0, rootY + COM_LOCAL_Y, 0) for
      // every pitch angle (the body orbits the hip). pitch=0 → position.y=rootY.
      _flipComOffset.set(0, COM_LOCAL_Y, 0).applyQuaternion(_flipQ);
      vrm.scene.position.set(
        -_flipComOffset.x,
        st.rootY + COM_LOCAL_Y - _flipComOffset.y,
        -_flipComOffset.z,
      );
      if (!active) {
        vrm.scene.quaternion.identity();
        vrm.scene.position.set(0, 0, 0);
      }
    } else {
      driveCharacter(vrm, elapsed.current, delta, voice.current);
    }
    vrm.update(delta);
    // With the skeleton fully updated, lock the trick board under the actual
    // feet so the bindings stay attached and the board angle follows the legs.
    if (demoActive && demo.current.boardOpacity > 0.05) {
      lockBoardToFeet(vrm, demo.current);
    } else {
      demo.current.boardLocked = false;
    }
  });

  return <primitive object={vrm.scene} />;
}

/**
 * Snowboard deck shape: a segmented box vertex-warped so the nose and
 * tail round off (circular outline taper) and kick upward (rocker).
 */
function makeBoardGeometry(
  length: number,
  thickness: number,
  width: number,
  kick: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(length, thickness, width, 48, 1, 8);
  const positions = geometry.attributes.position;
  const half = length / 2;
  const tipStart = 0.74; // outline starts rounding here (fraction of half-length)
  const kickStart = 0.62; // tips start curving up here
  for (let i = 0; i < positions.count; i++) {
    const u = Math.abs(positions.getX(i)) / half;
    if (u > tipStart) {
      const v = (u - tipStart) / (1 - tipStart);
      positions.setZ(i, positions.getZ(i) * Math.sqrt(Math.max(0, 1 - v * v)));
    }
    if (u > kickStart) {
      const k = (u - kickStart) / (1 - kickStart);
      positions.setY(i, positions.getY(i) + kick * k * k);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Scratch objects reused every frame so locking the board allocates nothing.
const _footL = new THREE.Vector3();
const _footR = new THREE.Vector3();
const _boardX = new THREE.Vector3();
const _boardY = new THREE.Vector3();
const _boardZ = new THREE.Vector3();
const _worldFwd = new THREE.Vector3(0, 0, 1);
const _boardBasis = new THREE.Matrix4();
const _boardQuat = new THREE.Quaternion();
// Board "up" derived from her body (for flips) — see lockBoardToFeet.
const _bodyUp = new THREE.Vector3();
const _rootQ = new THREE.Quaternion();

// --- Whole-body flip transform (yaw*pitch quaternion pivoted at the CoM) ---
// Hip/CoM height in the VRM scene-local frame (feet ~y=0; THIGH_LEN+SHIN_LEN ≈
// 0.84 straight-leg foot→hip). The fixed pivot height for a flip — NOT rootY.
// Tune 0.80–0.90 on device if a flip orbits her waist/chest instead of her hips.
const COM_LOCAL_Y = 0.85;
const _flipQ = new THREE.Quaternion();
const _flipQYaw = new THREE.Quaternion();
const _flipQPitch = new THREE.Quaternion();
const _flipYAxis = new THREE.Vector3(0, 1, 0);
// Flip axis = toe-heel line in her LOCAL frame (+Z), horizontal and
// PERPENDICULAR to the board. A wildcat/tamedog tumbles END OVER END — the
// nose sweeps up and over while the tail dives (board pitches nose-over-tail
// with her). The old axis (1,0,0) was the foot-to-foot line, which produced a
// gymnast-style backflip over the heel edge with the board staying crossways —
// wrong trick. If flips now tumble over the WRONG edge (toe vs heel plane),
// flip this to (0,0,-1); tail-vs-nose direction is the totalFlip sign in TRICKS.
const _flipPitchAxis = new THREE.Vector3(0, 0, 1);
const _flipComOffset = new THREE.Vector3();
/** Foot bone ≈ ankle; drop the deck this far below the midpoint so the soles
 *  sit on top of the board rather than through it. */
const BOARD_SOLE_DROP = 0.07;

/**
 * Lock the trick board to the rider's actual feet. The board's long axis (+X,
 * where the bindings live at ±0.24) is aimed straight down the line between the
 * two foot bones and the deck kept facing up, so the bindings stay under the
 * soles and the board ANGLE follows the legs — lift the back leg and the tail
 * rises because that foot rose. Writes the world transform into demo state for
 * TrickBoard to copy. Must run after vrm.update() so the foot bones are posed.
 */
function lockBoardToFeet(vrm: VRM, state: TrickDemoState) {
  const humanoid = vrm.humanoid;
  const lf = humanoid?.getRawBoneNode('leftFoot');
  const rf = humanoid?.getRawBoneNode('rightFoot');
  if (!lf || !rf) {
    state.boardLocked = false;
    return;
  }
  lf.getWorldPosition(_footL);
  rf.getWorldPosition(_footR);

  // Board long axis (+X) runs foot-to-foot; build an orthonormal, up-facing
  // basis around it. Feet coincident (never really happens) keeps the last
  // transform; a near-VERTICAL axis (big stylish leg-lift) rebuilds off
  // world-forward so the board STAYS locked instead of unlocking and getting
  // flung to the origin.
  _boardX.subVectors(_footR, _footL);
  if (_boardX.lengthSq() < 1e-6) {
    state.boardLocked = false;
    return;
  }
  _boardX.normalize();
  // Board "up" comes from HER body, not the world — so through a flip inversion
  // the deck ROLLS with her and stays soles-down instead of lying world-flat
  // under an upside-down rider. rootPitch=0 (spins) → body-up == world-up →
  // unchanged. (The flip axis IS the foot line, so foot-to-foot never goes
  // vertical; the world-fwd fallback is only for the near-degenerate stylish lift.)
  _bodyUp.set(0, 1, 0);
  if (state.rootPitch) {
    _rootQ.set(state.rootQuat[0], state.rootQuat[1], state.rootQuat[2], state.rootQuat[3]);
    _bodyUp.applyQuaternion(_rootQ);
  }
  _boardZ.crossVectors(_boardX, _bodyUp);
  if (_boardZ.lengthSq() < 1e-4) {
    _boardZ.crossVectors(_boardX, _worldFwd);
  }
  _boardZ.normalize();
  _boardY.crossVectors(_boardZ, _boardX).normalize();
  _boardBasis.makeBasis(_boardX, _boardY, _boardZ);
  _boardQuat.setFromRotationMatrix(_boardBasis);

  state.boardPos[0] = (_footL.x + _footR.x) / 2 - _boardY.x * BOARD_SOLE_DROP;
  state.boardPos[1] = (_footL.y + _footR.y) / 2 - _boardY.y * BOARD_SOLE_DROP;
  state.boardPos[2] = (_footL.z + _footR.z) / 2 - _boardY.z * BOARD_SOLE_DROP;
  state.boardQuat[0] = _boardQuat.x;
  state.boardQuat[1] = _boardQuat.y;
  state.boardQuat[2] = _boardQuat.z;
  state.boardQuat[3] = _boardQuat.w;
  state.boardLocked = true;
}

/** Stylized snowboard that appears under Kaori's feet during trick demos. */
function TrickBoard({ demo }: { demo: React.MutableRefObject<TrickDemoState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const deckRef = useRef<THREE.MeshStandardMaterial>(null);
  const baseRef = useRef<THREE.MeshStandardMaterial>(null);

  const deckGeometry = useMemo(() => makeBoardGeometry(1.15, 0.03, 0.27, 0.09), []);
  const baseGeometry = useMemo(() => makeBoardGeometry(1.19, 0.014, 0.3, 0.09), []);
  useEffect(
    () => () => {
      deckGeometry.dispose();
      baseGeometry.dispose();
    },
    [deckGeometry, baseGeometry],
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const { boardOpacity, boardPos, boardQuat } = demo.current;
    // Cut off a bit higher than 0 so the board doesn't linger as a faint ghost
    // after she's already stood back up (stance return + board vanish together).
    group.visible = boardOpacity > 0.05;
    if (!group.visible) return;
    // Bindings stay glued to the feet — lockBoardToFeet writes boardPos/boardQuat
    // each frame after the skeleton is posed. If a frame fails to lock (first
    // frame / missing bone / degenerate basis) these hold the LAST good
    // transform, so the deck never flings to the world origin under an airborne,
    // spinning Kaori (barely visible during fade-in anyway).
    group.position.set(boardPos[0], boardPos[1], boardPos[2]);
    group.quaternion.set(boardQuat[0], boardQuat[1], boardQuat[2], boardQuat[3]);
    if (deckRef.current) deckRef.current.opacity = boardOpacity;
    if (baseRef.current) baseRef.current.opacity = boardOpacity;
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Deck — sakura-pink topsheet (matches Kaori's jacket, pops against
          the dark floor), long axis through the rider's feet */}
      <mesh geometry={deckGeometry}>
        <meshStandardMaterial
          ref={deckRef}
          color="#f48fb8"
          roughness={0.35}
          transparent
          fog={false}
        />
      </mesh>
      {/* White rails/base peeking out around the deck */}
      <mesh geometry={baseGeometry} position={[0, -0.004, 0]}>
        <meshStandardMaterial
          ref={baseRef}
          color="#f4f6fb"
          roughness={0.3}
          transparent
          fog={false}
        />
      </mesh>
      {/* Binding hints */}
      <mesh position={[-0.24, 0.035, 0]} rotation={[0, 0.18, 0]}>
        <boxGeometry args={[0.16, 0.04, 0.2]} />
        <meshStandardMaterial color="#101319" roughness={0.7} />
      </mesh>
      <mesh position={[0.24, 0.035, 0]} rotation={[0, -0.18, 0]}>
        <boxGeometry args={[0.16, 0.04, 0.2]} />
        <meshStandardMaterial color="#101319" roughness={0.7} />
      </mesh>
    </group>
  );
}

function CameraRig({ orbit }: { orbit: React.MutableRefObject<OrbitState> }) {
  useFrame(({ camera }) => {
    const { azimuth, polar, distance } = orbit.current;
    camera.position.set(
      CAMERA_TARGET.x + distance * Math.sin(polar) * Math.sin(azimuth),
      CAMERA_TARGET.y + distance * Math.cos(polar),
      CAMERA_TARGET.z + distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(CAMERA_TARGET);
  });
  return null;
}

function StageSet() {
  return (
    <>
      <ambientLight color="#d8e6ff" intensity={1.1} />
      <directionalLight color="#9fd5ff" intensity={1.45} position={[2.6, 3.2, 3.4]} />
      <directionalLight color="#ff9ad5" intensity={0.9} position={[-2.5, 1.2, -1.8]} />
      {/* Ground disc */}
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.8, 48]} />
        <meshStandardMaterial color="#181c26" metalness={0.05} roughness={0.9} />
      </mesh>
      {/* Brand-yellow stage ring */}
      <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.35, 1.42, 64]} />
        <meshBasicMaterial color={brandColors.primary} side={THREE.DoubleSide} fog={false} />
      </mesh>
    </>
  );
}

interface StageErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class StageErrorBoundary extends Component<StageErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export interface KaoriStageProps {
  /** Keep rendering only while the screen is focused (battery / GL safety). */
  active?: boolean;
  /**
   * Shared mutable voice/emotion state (see createVoiceState). The voice
   * layer mutates it; the animation loop reads it every frame.
   */
  voiceState?: React.MutableRefObject<CompanionVoiceState>;
  /** Shared trick-demo state (see createTrickDemoState) — set trick+t to start. */
  demoState?: React.MutableRefObject<TrickDemoState>;
}

export function KaoriStage({ active = true, voiceState, demoState }: KaoriStageProps) {
  const orbit = useRef<OrbitState>({ ...INITIAL_ORBIT });
  const pinchStartDistance = useRef(INITIAL_ORBIT.distance);
  const internalVoice = useRef<CompanionVoiceState>(createVoiceState());
  const voice = voiceState ?? internalVoice;
  const internalDemo = useRef<TrickDemoState>(createTrickDemoState());
  const demo = demoState ?? internalDemo;
  const [ready, setReady] = useState(false);

  // Bumping this key remounts the error boundary + Canvas for a clean retry
  const [attempt, setAttempt] = useState(0);

  // Simulator/emulator GL cannot compile these shaders — the iOS Simulator's
  // shader JIT hard-crashes (SIGBUS in cvmsServerElementBuild). Real 3D is
  // device-only; show an honest fallback everywhere else.
  if (!Device.isDevice) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Kaori's 3D stage needs a real device</Text>
        <Text style={styles.fallbackBody}>
          The simulator's OpenGL stack can't compile the stage shaders. Run this on a physical phone
          to meet Kaori in 3D.
        </Text>
      </View>
    );
  }

  const handleRetry = () => {
    // useLoader caches rejections module-wide — clear it or the retry
    // would instantly re-throw the same cached error.
    useLoader.clear(GLTFLoader, KAORI_MODEL as unknown as string);
    setReady(false);
    setAttempt((n) => n + 1);
  };

  const pan = Gesture.Pan()
    .maxPointers(1)
    .runOnJS(true)
    .onChange((event) => {
      const next = orbit.current;
      next.azimuth -= event.changeX * 0.008;
      next.polar = THREE.MathUtils.clamp(next.polar - event.changeY * 0.006, MIN_POLAR, MAX_POLAR);
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchStartDistance.current = orbit.current.distance;
    })
    .onUpdate((event) => {
      orbit.current.distance = THREE.MathUtils.clamp(
        pinchStartDistance.current / event.scale,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    });

  const gestures = Gesture.Simultaneous(pan, pinch);

  const errorFallback = (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>Kaori couldn't load</Text>
      <Text style={styles.fallbackBody}>
        Something went wrong loading the 3D stage. You can retry, or chat with Kaori instead!
      </Text>
      <Pressable onPress={handleRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );

  return (
    <StageErrorBoundary fallback={errorFallback} key={attempt}>
      <GestureDetector gesture={gestures}>
        <View style={styles.container}>
          <Canvas
            camera={{ fov: 42, near: 0.1, far: 60, position: [0, 1.25, 2.4] }}
            flat
            frameloop={active ? 'always' : 'never'}
            gl={{ antialias: true }}
            onCreated={({ gl }) => {
              // expo-gl only implements UNPACK_FLIP_Y_WEBGL — silence the
              // warning spam from three probing other pixelStorei params.
              const context = gl.getContext();
              const original = context.pixelStorei.bind(context);
              context.pixelStorei = ((pname: number, param: number | boolean) => {
                if (pname === context.UNPACK_FLIP_Y_WEBGL) original(pname, param as number);
              }) as typeof context.pixelStorei;
              // Surface shader compile/link failures — a failed material
              // otherwise silently skips drawing (invisible character).
              gl.debug.onShaderError = (glCtx, _program, vs, fs) => {
                const vsLog = glCtx.getShaderInfoLog(vs);
                const fsLog = glCtx.getShaderInfoLog(fs);
                console.error('[KaoriStage] Shader error:', vsLog || '(vs ok)', fsLog || '(fs ok)');
              };
            }}
            style={styles.canvas}
          >
            {/* Seeds scene.background for frame 0; SnowWorld owns it per-frame after. */}
            <color args={['#0b0e17']} attach="background" />
            <StageSet />
            {/* Alpine world that crossfades in as she straps onto the board. */}
            <SnowWorld demo={demo} />
            <CameraRig orbit={orbit} />
            <TrickBoard demo={demo} />
            <Suspense fallback={null}>
              <KaoriModel demo={demo} onReady={() => setReady(true)} voice={voice} />
            </Suspense>
          </Canvas>
          {!ready && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={brandColors.primary} size="large" />
              <Text style={styles.loadingText}>Kaori is getting ready…</Text>
            </View>
          )}
        </View>
      </GestureDetector>
    </StageErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e17',
  },
  canvas: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0b0e17',
  },
  loadingText: {
    color: '#9aa3b5',
    fontSize: 14,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
    backgroundColor: '#0b0e17',
  },
  fallbackTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  fallbackBody: {
    color: '#9aa3b5',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: brandColors.primary,
  },
  retryText: {
    color: brandColors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
});

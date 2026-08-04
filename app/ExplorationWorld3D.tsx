"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  ENDLESS_BIOMES,
  ENDLESS_CHUNK_LENGTH,
  EXPLORATION_ENCOUNTERS,
  getCompletedEncounterCount,
  getEndlessBiome,
  getEndlessEncounter,
  getExplorationCheckpoint,
  getExplorationEncounter,
  type ExplorationEncounterId,
} from "./exploration-engine";

type ExplorationMode = "explore" | "encounter" | "paused" | "complete";

type ExplorationWorld3DProps = {
  mode: ExplorationMode;
  completedWords: number;
  endlessMode: boolean;
  endlessWords: number;
  reducedMotion: boolean;
  cosmeticColor: string;
  onEncounter: (id: ExplorationEncounterId) => void;
  onCheckpoint: (message: string) => void;
  onWorldStatus: (status: ExplorationWorldStatus) => void;
};

export type ExplorationWorldStatus = { distance: number; zone: number; biome: string; movingByClick: boolean };

type LiveState = ExplorationWorld3DProps;
type MoveKey = "forward" | "back" | "left" | "right" | "jump";

function getLiveEncounter(live: LiveState) {
  return live.endlessMode ? getEndlessEncounter(live.endlessWords) : getExplorationEncounter(live.completedWords);
}

const KEY_TO_MOVE: Record<string, MoveKey | undefined> = {
  ArrowUp: "forward",
  w: "forward",
  W: "forward",
  ArrowDown: "back",
  s: "back",
  S: "back",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  " ": "jump",
};

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    const renderable = object as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
    materials.forEach((material) => material.dispose());
  });
}

function createGroundTexture(base: string, flecks: string[], seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = base;
  context.fillRect(0, 0, 128, 128);
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = 0; index < 440; index += 1) {
    context.globalAlpha = 0.1 + random() * 0.2;
    context.fillStyle = flecks[index % flecks.length];
    const size = 0.45 + random() * 1.6;
    context.beginPath();
    context.ellipse(random() * 128, random() * 128, size * 0.42, size, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function enableSoftShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function addFlower(parent: THREE.Object3D, x: number, z: number, color: number, scale = 1) {
  const flower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.38, 6), new THREE.MeshStandardMaterial({ color: 0x527b4d, roughness: 0.92 }));
  stem.position.y = 0.19;
  flower.add(stem);
  const petalMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide });
  for (let index = 0; index < 6; index += 1) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.064, 8, 5), petalMaterial);
    const angle = (index / 6) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.074, 0.4 + Math.sin(angle) * 0.025, Math.sin(angle) * 0.074);
    petal.scale.set(0.7, 0.26, 1.15);
    petal.rotation.y = angle;
    flower.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe3b24b, roughness: 0.72 }));
  center.position.y = 0.41;
  flower.add(center);
  flower.position.set(x, 0.04, z);
  flower.scale.setScalar(scale);
  parent.add(flower);
}

function addTree(parent: THREE.Object3D, x: number, z: number, scale: number, color: number) {
  const tree = new THREE.Group();
  const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x6f5549, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.27, 1.9, 10), barkMaterial);
  trunk.position.y = 1.05;
  trunk.castShadow = true;
  tree.add(trunk);
  [[-0.2, 1.7, 0.04, -0.55], [0.24, 1.72, -0.03, 0.56], [0.03, 1.9, -0.12, 0.12]].forEach(([px, py, pz, angle]) => {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.92, 7), barkMaterial);
    branch.position.set(px, py, pz);
    branch.rotation.z = angle;
    tree.add(branch);
  });
  const blossomMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  [[0, 2.15, 0], [-0.48, 1.98, 0.06], [0.46, 2.01, -0.08], [-0.2, 2.45, 0.04], [0.28, 2.38, 0.1], [-0.62, 2.28, -0.02], [0.62, 2.3, 0.02]].forEach(([px, py, pz], index) => {
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(index === 0 ? 0.57 : 0.43, 1), blossomMaterial);
    crown.position.set(px, py, pz);
    crown.scale.set(1, 0.82 + (index % 3) * 0.08, 0.92);
    crown.castShadow = true;
    tree.add(crown);
  });
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  parent.add(tree);
}

function addLantern(parent: THREE.Object3D, x: number, z: number) {
  const lantern = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a315a, roughness: 0.62, metalness: 0.28 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.55, 8), dark);
  pole.position.y = 0.82;
  lantern.add(pole);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 8), dark);
  cap.position.y = 1.65;
  lantern.add(cap);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 9), new THREE.MeshStandardMaterial({ color: 0xffefb0, emissive: 0xffd066, emissiveIntensity: 2.2 }));
  glow.position.y = 1.45;
  lantern.add(glow);
  const light = new THREE.PointLight(0xffd985, 1.2, 5, 2);
  light.position.y = 1.45;
  lantern.add(light);
  lantern.position.set(x, 0, z);
  parent.add(lantern);
}

function makeAvatar(color: string) {
  const avatar = new THREE.Group();
  const rig = new THREE.Group();
  avatar.add(rig);
  const fur = new THREE.MeshStandardMaterial({ color: 0xfffbf2, roughness: 0.98, metalness: 0 });
  const warmFur = new THREE.MeshStandardMaterial({ color: 0xf2e9dc, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x211d27, roughness: 0.68 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.03 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf5c866, roughness: 0.48, metalness: 0.22 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.43, 22, 17), fur);
  body.position.set(0, 0.03, -0.02);
  body.scale.set(1.08, 0.9, 1.02);
  rig.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 14), warmFur);
  chest.position.set(0, 0.05, 0.29);
  chest.scale.set(1.05, 1.15, 0.54);
  rig.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 18), fur);
  head.position.set(0, 0.55, 0.08);
  head.scale.set(1.08, 1.03, 0.98);
  rig.add(head);
  const curlGeometry = new THREE.DodecahedronGeometry(0.15, 1);
  [[-0.3, 0.72, 0.08], [0.3, 0.72, 0.08], [-0.2, 0.88, 0.04], [0.2, 0.88, 0.04], [0, 0.91, 0.08], [-0.36, 0.5, 0.1], [0.36, 0.5, 0.1]].forEach(([x, y, z], index) => {
    const curl = new THREE.Mesh(curlGeometry, index % 3 === 0 ? warmFur : fur);
    curl.position.set(x, y, z);
    curl.scale.setScalar(0.9 + (index % 2) * 0.12);
    rig.add(curl);
  });

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 13), warmFur);
  muzzle.position.set(0, 0.49, 0.39);
  muzzle.scale.set(1.1, 0.72, 0.78);
  rig.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.064, 14, 10), dark);
  nose.position.set(0, 0.53, 0.54);
  nose.scale.set(1.08, 0.8, 0.72);
  rig.add(nose);
  const eyes: THREE.Mesh[] = [];
  for (const x of [-0.145, 0.145]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.057, 14, 10), dark);
    eye.position.set(x, 0.66, 0.42);
    eye.scale.set(0.9, 1.08, 0.62);
    rig.add(eye);
    const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sparkle.position.set(x - 0.014, 0.681, 0.455);
    rig.add(sparkle);
    eyes.push(eye);
  }

  const ears: THREE.Mesh[] = [];
  for (const x of [-0.39, 0.39]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.25, 6, 12), warmFur);
    ear.position.set(x, 0.51, 0.03);
    ear.rotation.z = x < 0 ? 0.2 : -0.2;
    ear.scale.set(0.86, 1.08, 0.76);
    rig.add(ear);
    ears.push(ear);
  }

  const legs: THREE.Mesh[] = [];
  [[-0.25, 0.2], [0.25, 0.2], [-0.25, -0.2], [0.25, -0.2]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.18, 5, 10), fur);
    leg.position.set(x, -0.36, z);
    rig.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), warmFur);
    paw.position.set(x, -0.52, z + 0.035);
    paw.scale.set(1, 0.62, 1.24);
    rig.add(paw);
    legs.push(leg);
  });

  const tail = new THREE.Group();
  tail.position.set(0.27, 0.12, -0.38);
  [[0, 0, 0], [0.08, 0.13, -0.03], [0.03, 0.26, 0.02]].forEach(([x, y, z], index) => {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 - index * 0.012, 1), fur);
    puff.position.set(x, y, z);
    tail.add(puff);
  });
  rig.add(tail);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 8, 24), accent);
  collar.position.set(0, 0.3, 0.06);
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.92;
  rig.add(collar);
  const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), gold);
  tag.position.set(0, 0.25, 0.37);
  tag.rotation.z = Math.PI / 4;
  rig.add(tag);
  const bow = new THREE.Group();
  for (const x of [-0.11, 0.11]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 9), accent);
    wing.position.x = x;
    wing.scale.set(1.3, 0.72, 0.46);
    bow.add(wing);
  }
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.057, 10, 8), gold);
  bow.add(bowCenter);
  bow.position.set(0, 0.42, -0.39);
  rig.add(bow);

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 28),
    new THREE.MeshBasicMaterial({ color: 0x25352f, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -0.565;
  avatar.add(contactShadow);
  enableSoftShadows(rig);
  eyes.forEach((eye) => { eye.castShadow = false; });
  avatar.userData.rig = rig;
  avatar.userData.body = body;
  avatar.userData.head = head;
  avatar.userData.legs = legs;
  avatar.userData.tail = tail;
  avatar.userData.ears = ears;
  avatar.userData.shadow = contactShadow;
  return avatar;
}

function makeCompanion() {
  const lumi = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 9), new THREE.MeshBasicMaterial({ color: 0xffefb0 }));
  lumi.add(core);
  const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xe5f7ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const wings: THREE.Mesh[] = [];
  for (const x of [-0.12, 0.12]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 7), wingMaterial);
    wing.position.x = x;
    wing.scale.set(0.78, 0.34, 1.28);
    lumi.add(wing);
    wings.push(wing);
  }
  const glow = new THREE.PointLight(0xffdc78, 0.85, 3.4, 2);
  lumi.add(glow);
  lumi.userData.wings = wings;
  return lumi;
}

export function ExplorationWorld3D(props: ExplorationWorld3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<LiveState>(props);
  const moveRef = useRef<Record<MoveKey, boolean>>({ forward: false, back: false, left: false, right: false, jump: false });
  const resetRef = useRef<(() => void) | null>(null);
  const previousWordsRef = useRef(props.completedWords);
  const previousEndlessModeRef = useRef(props.endlessMode);
  const nearbyRef = useRef<ExplorationEncounterId | null>(null);
  const [nearby, setNearby] = useState<ExplorationEncounterId | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    liveRef.current = props;
    if (props.completedWords < previousWordsRef.current || (props.endlessMode && !previousEndlessModeRef.current)) resetRef.current?.();
    previousWordsRef.current = props.completedWords;
    previousEndlessModeRef.current = props.endlessMode;
  }, [props]);

  const setMove = useCallback((key: MoveKey, pressed: boolean) => {
    moveRef.current[key] = pressed;
  }, []);

  const interact = useCallback(() => {
    if (liveRef.current.mode !== "explore") return;
    const id = nearbyRef.current;
    if (id) liveRef.current.onEncounter(id);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || fallback) return;
    if (!window.WebGLRenderingContext) {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    const compactViewport = window.innerWidth < 800;
    const lightweight = (navigator.hardwareConcurrency ?? 8) <= 4;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !lightweight, alpha: false, powerPreference: "high-performance", stencil: false });
    } catch {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    const pixelRatioCap = lightweight ? 1.08 : compactViewport ? 1.35 : 1.55;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !lightweight;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8dbdd1);
    scene.fog = new THREE.FogExp2(0xc1ccd0, 0.0175);
    const camera = new THREE.PerspectiveCamera(49, 1, 0.1, 145);
    camera.position.set(0, 4.7, 10.5);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(72, 28, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(0x4f94bd) },
          horizonColor: { value: new THREE.Color(0xf1d7c9) },
          sunColor: { value: new THREE.Color(0xfff2c4) },
          offset: { value: 7 },
          exponent: { value: 0.68 },
        },
        vertexShader: "varying vec3 vWorldPosition; void main(){vec4 worldPosition=modelMatrix*vec4(position,1.0);vWorldPosition=worldPosition.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: "uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 sunColor;uniform float offset;uniform float exponent;varying vec3 vWorldPosition;void main(){vec3 d=normalize(vWorldPosition);float h=normalize(vWorldPosition+offset).y;float sun=pow(max(dot(d,normalize(vec3(-0.34,0.48,-0.81))),0.0),180.0);float haze=pow(1.0-abs(d.y),5.0);vec3 sky=mix(horizonColor,topColor,max(pow(max(h,0.0),exponent),0.0));sky=mix(sky,horizonColor,haze*0.3);sky+=sunColor*sun*1.35;gl_FragColor=vec4(sky,1.0);}",
      }),
    );
    scene.add(sky);
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x53664c, 1.65));
    const sun = new THREE.DirectionalLight(0xffefd5, 3.65);
    sun.position.set(-9, 15, 7);
    sun.castShadow = !lightweight;
    sun.shadow.mapSize.set(lightweight ? 512 : 1024, lightweight ? 512 : 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);
    const grassTexture = createGroundTexture("#719872", ["#486c51", "#91ab77", "#587c59", "#b0b883"], 9417);
    const pathTexture = createGroundTexture("#c7b392", ["#9f896d", "#e2d2b5", "#b19b7b"], 2183);
    if (grassTexture) {
      grassTexture.repeat.set(9, 14);
      grassTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    if (pathTexture) {
      pathTexture.repeat.set(3, 8);
      pathTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: grassTexture, roughness: 1 });
    const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: pathTexture, roughness: 0.96 });
    const walkableMeshes: THREE.Mesh[] = [];
    const bank = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 39), grassMaterial);
    bank.position.set(0, -0.5, -7);
    bank.receiveShadow = true;
    world.add(bank);
    walkableMeshes.push(bank);
    const pathSegments = [[0, 3.2, 5.4, 10], [0, -5.8, 5.2, 8], [0, -17.2, 5.4, 9], [0, -24, 9, 5], [-5.2, -6.8, 4.3, 4.5], [5.4, -17.5, 4.6, 5.2]];
    pathSegments.forEach(([x, z, width, depth]) => {
      const path = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), pathMaterial);
      path.position.set(x, 0, z);
      path.receiveShadow = true;
      world.add(path);
      walkableMeshes.push(path);
    });
    const streamMaterial = new THREE.MeshPhysicalMaterial({ color: 0x62b8cb, roughness: 0.14, metalness: 0.02, transparent: true, opacity: 0.83, clearcoat: 0.72, clearcoatRoughness: 0.18, depthWrite: false });
    const stream = new THREE.Mesh(new THREE.BoxGeometry(19, 0.12, 4), streamMaterial);
    stream.position.set(0, 0.035, -11.8);
    world.add(stream);

    const distantScenery = new THREE.Group();
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x6f8580, roughness: 1, flatShading: true });
    const distantMountainMaterial = new THREE.MeshStandardMaterial({ color: 0x91a2a1, roughness: 1, flatShading: true });
    for (let index = 0; index < 11; index += 1) {
      const distant = index % 2 === 0;
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(6 + (index % 3) * 1.4, 8 + (index % 4) * 1.5, 7), distant ? distantMountainMaterial : mountainMaterial);
      mountain.position.set(-31 + index * 6.3, 2.6 + (index % 2) * 0.7, -48 - (distant ? 10 : 0));
      mountain.rotation.y = index * 0.47;
      distantScenery.add(mountain);
    }
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xf7f3ed, transparent: true, opacity: 0.52, depthWrite: false });
    for (let index = 0; index < 7; index += 1) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.9 + (index % 2) * 0.7, 12, 8), cloudMaterial);
      cloud.position.set(-18 + index * 6.4, 10 + (index % 3) * 1.1, -34 - (index % 2) * 9);
      cloud.scale.set(1.8, 0.38, 0.7);
      distantScenery.add(cloud);
    }
    world.add(distantScenery);

    for (let index = 0; index < 24; index += 1) {
      const z = 7 - index * 1.45;
      const side = index % 2 === 0 ? -1 : 1;
      addTree(world, side * (7.2 + (index % 3) * 0.75), z, 0.72 + (index % 4) * 0.08, index % 3 === 0 ? 0xf4c7cf : 0xeab7c5);
      if (index < 20) addFlower(world, -side * (3.2 + (index % 2) * 1.2), z - 0.6, index % 2 ? 0xe89ab3 : 0xb7a7d8, 0.8 + (index % 3) * 0.1);
    }

    const grassTuftMaterial = new THREE.MeshStandardMaterial({ color: 0x3f6d49, roughness: 1, side: THREE.DoubleSide });
    const grassTufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.055, 0.42, 4), grassTuftMaterial, lightweight ? 70 : 130);
    const stoneInstances = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0x817f78, roughness: 1 }),
      lightweight ? 18 : 32,
    );
    const natureMatrix = new THREE.Matrix4();
    const natureRotation = new THREE.Quaternion();
    const natureScale = new THREE.Vector3();
    const naturePosition = new THREE.Vector3();
    for (let index = 0; index < grassTufts.count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      naturePosition.set(side * (3.6 + ((index * 17) % 54) / 10), 0.18, 7 - ((index * 29) % 360) / 10);
      natureRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (index * 1.71) % Math.PI);
      const size = 0.72 + (index % 5) * 0.1;
      natureScale.set(size, size, size);
      natureMatrix.compose(naturePosition, natureRotation, natureScale);
      grassTufts.setMatrixAt(index, natureMatrix);
    }
    for (let index = 0; index < stoneInstances.count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      naturePosition.set(side * (4.6 + ((index * 13) % 47) / 10), 0.09, 6 - ((index * 31) % 350) / 10);
      natureRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 0.73);
      const size = 0.55 + (index % 4) * 0.16;
      natureScale.set(size * 1.25, size * 0.68, size);
      natureMatrix.compose(naturePosition, natureRotation, natureScale);
      stoneInstances.setMatrixAt(index, natureMatrix);
    }
    grassTufts.receiveShadow = true;
    stoneInstances.castShadow = !lightweight;
    stoneInstances.receiveShadow = true;
    world.add(grassTufts, stoneInstances);
    [-6.3, -16.5].forEach((z) => {
      addLantern(world, -2.7, z);
      addLantern(world, 2.7, z);
    });

    const endlessChunks: THREE.Group[] = [];
    const bouncePads: THREE.Mesh[] = [];
    const createEndlessChunk = (slot: number) => {
      const group = new THREE.Group();
      const biome = ENDLESS_BIOMES[slot % ENDLESS_BIOMES.length];
      group.userData.chunkIndex = slot;
      group.userData.biomeIndex = slot % ENDLESS_BIOMES.length;
      group.position.z = -34 - slot * ENDLESS_CHUNK_LENGTH;
      const terrainTint = new THREE.Color(biome.grass).lerp(new THREE.Color(0xdce2d1), 0.22);
      const terrainMaterial = new THREE.MeshStandardMaterial({ color: terrainTint, map: grassTexture, roughness: 1 });
      const terrain = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, ENDLESS_CHUNK_LENGTH + 0.35), terrainMaterial);
      terrain.position.y = -0.5;
      terrain.receiveShadow = true;
      group.add(terrain);
      walkableMeshes.push(terrain);
      const bend = slot % 2 === 0 ? -2.4 : 2.4;
      const mainPath = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.13, ENDLESS_CHUNK_LENGTH + 0.2), pathMaterial);
      mainPath.position.set(bend * 0.35, 0, 0);
      mainPath.rotation.y = slot % 2 === 0 ? -0.035 : 0.035;
      mainPath.receiveShadow = true;
      group.add(mainPath);
      walkableMeshes.push(mainPath);
      const partyIsland = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.5, 0.5, 12), terrainMaterial);
      partyIsland.position.set(bend * 2.7, -0.23, -2.2);
      partyIsland.receiveShadow = true;
      group.add(partyIsland);
      walkableMeshes.push(partyIsland);
      const accentMaterial = new THREE.MeshStandardMaterial({ color: biome.accent, emissive: biome.accent, emissiveIntensity: 0.1, roughness: 0.62 });
      const bouncePad = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.96, 0.18, 18), accentMaterial);
      bouncePad.position.set(-bend * 2.25, 0.12, 2.2);
      bouncePad.userData.baseY = 0.12;
      group.add(bouncePad);
      bouncePads.push(bouncePad);
      const partyArch = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.16, 8, 28, Math.PI), accentMaterial);
      partyArch.position.set(bend * 0.35, 2.15, -4.6);
      partyArch.rotation.z = Math.PI;
      group.add(partyArch);
      for (let index = 0; index < 5; index += 1) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + (index % 2) * 0.08, 0), accentMaterial);
        crystal.position.set((index % 2 ? -1 : 1) * (5.4 + (index % 3)), 0.4 + (index % 2) * 0.15, 6.5 - index * 3.2);
        crystal.rotation.z = index * 0.4;
        group.add(crystal);
      }
      addTree(group, -7.8, 5.2, 0.85, biome.accent);
      addTree(group, 8.2, 1.4, 0.9, biome.accent);
      addTree(group, -8.4, -5.8, 0.78, biome.accent);
      addFlower(group, bend * 1.8, 4.5, biome.accent, 1.1);
      addFlower(group, -bend * 1.4, -5.3, biome.accent, 0.95);
      group.visible = false;
      endlessChunks.push(group);
      world.add(group);
    };
    for (let slot = 0; slot < (lightweight ? 6 : 8); slot += 1) createEndlessChunk(slot);

    const gate = new THREE.Group();
    const gateStone = new THREE.MeshStandardMaterial({ color: 0xb8afa5, roughness: 0.96, metalness: 0 });
    const gateGlow = new THREE.MeshStandardMaterial({ color: 0xffa8d0, emissive: 0xff69aa, emissiveIntensity: 1.5, roughness: 0.35 });
    for (const x of [-2.1, 2.1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.47, 3.2, 8), gateStone);
      pillar.position.set(x, 1.55, -2.4);
      pillar.castShadow = true;
      gate.add(pillar);
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), gateGlow);
      flower.position.set(x, 3.25, -2.4);
      gate.add(flower);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.26, 10, 28, Math.PI), gateStone);
    arch.position.set(0, 2.85, -2.4);
    gate.add(arch);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.055, 8, 30), gateGlow);
    rune.position.set(0, 1.7, -2.35);
    gate.add(rune);
    world.add(gate);

    const bridgePieces: THREE.Mesh[] = [];
    for (let index = 0; index < 5; index += 1) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 0.62), new THREE.MeshStandardMaterial({ color: 0xcfc7eb, roughness: 0.65, emissive: 0x8e7fe8, emissiveIntensity: 0.12 }));
      stone.position.set(0, 0.25, -10.15 - index * 0.82);
      stone.castShadow = true;
      stone.receiveShadow = true;
      bridgePieces.push(stone);
      world.add(stone);
    }

    const beacon = new THREE.Group();
    const beaconStone = new THREE.MeshStandardMaterial({ color: 0xaaa7a0, roughness: 0.94 });
    const beaconGlow = new THREE.MeshStandardMaterial({ color: 0xffe48a, emissive: 0xffb63e, emissiveIntensity: 2.4, roughness: 0.28 });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 0.75, 10), beaconStone);
    pedestal.position.y = 0.38;
    pedestal.castShadow = true;
    beacon.add(pedestal);
    const flowerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 1), beaconGlow);
    flowerCore.position.y = 1.8;
    beacon.add(flowerCore);
    const rings: THREE.Mesh[] = [];
    [1.05, 1.38, 1.72].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 7, 36), beaconGlow);
      ring.position.y = 1.8;
      ring.rotation.x = Math.PI / 2 + index * 0.3;
      rings.push(ring);
      beacon.add(ring);
    });
    const beaconLight = new THREE.PointLight(0xffcc72, 2.8, 10, 2);
    beaconLight.position.y = 2.1;
    beacon.add(beaconLight);
    beacon.position.set(0, 0, -22.2);
    world.add(beacon);

    const endlessPortal = new THREE.Group();
    const portalGlowMaterial = new THREE.MeshStandardMaterial({ color: 0x8ff0d4, emissive: 0x54d8c0, emissiveIntensity: 1.8, roughness: 0.32 });
    const portalStoneMaterial = new THREE.MeshStandardMaterial({ color: 0xddd5ea, roughness: 0.68 });
    const portalBase = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.55, 0.48, 12), portalStoneMaterial);
    portalBase.position.y = 0.23;
    endlessPortal.add(portalBase);
    const portalRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.095, 9, 38), portalGlowMaterial);
    portalRing.position.y = 1.55;
    endlessPortal.add(portalRing);
    const portalCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), portalGlowMaterial);
    portalCore.position.y = 1.55;
    endlessPortal.add(portalCore);
    const portalLight = new THREE.PointLight(0x7cebd3, 2.8, 8, 2);
    portalLight.position.y = 1.6;
    endlessPortal.add(portalLight);
    endlessPortal.visible = false;
    world.add(endlessPortal);

    const checkpointMarkers: THREE.Group[] = [];
    [-6.2, -16.4].forEach((z) => {
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 30), new THREE.MeshStandardMaterial({ color: 0x8ff3d6, emissive: 0x5ce3c5, emissiveIntensity: 1.5 }));
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);
      marker.position.set(0, 0.11, z);
      checkpointMarkers.push(marker);
      world.add(marker);
    });

    const avatar = makeAvatar(liveRef.current.cosmeticColor);
    scene.add(avatar);
    const lumi = makeCompanion();
    scene.add(lumi);
    const spawn = liveRef.current.endlessMode ? { x: 0, y: 0.58, z: -26.2 } : getExplorationCheckpoint(liveRef.current.completedWords);
    avatar.position.set(spawn.x, spawn.y, spawn.z);
    let verticalVelocity = 0;
    let grounded = true;
    let lastCheckpointCount = getCompletedEncounterCount(liveRef.current.completedWords);
    resetRef.current = () => {
      const point = liveRef.current.endlessMode ? { x: 0, y: 0.58, z: -26.2 } : getExplorationCheckpoint(liveRef.current.completedWords);
      avatar.position.set(point.x, point.y, point.z);
      verticalVelocity = 0;
      grounded = true;
    };

    const clickTarget = new THREE.Vector3();
    let hasClickTarget = false;
    const destinationMarker = new THREE.Group();
    const destinationRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.5, 28), new THREE.MeshBasicMaterial({ color: 0xffef9b, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    destinationRing.rotation.x = -Math.PI / 2;
    destinationMarker.add(destinationRing);
    const destinationStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffb8d6 }));
    destinationStar.position.y = 0.22;
    destinationMarker.add(destinationStar);
    destinationMarker.visible = false;
    scene.add(destinationMarker);

    const petals: THREE.Mesh[] = [];
    const petalGeometry = new THREE.SphereGeometry(0.045, 6, 4);
    const petalMaterial = new THREE.MeshBasicMaterial({ color: 0xffbad5, transparent: true, opacity: 0.76 });
    const petalCount = lightweight ? 30 : 58;
    for (let index = 0; index < petalCount; index += 1) {
      const petal = new THREE.Mesh(petalGeometry, petalMaterial);
      petal.scale.set(1.8, 0.65, 0.7);
      petal.position.set((Math.random() - 0.5) * 17, 1.2 + Math.random() * 7, 8 - Math.random() * 36);
      petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      petals.push(petal);
      scene.add(petal);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (liveRef.current.mode !== "explore" || event.metaKey || event.ctrlKey || event.altKey) return;
      const move = KEY_TO_MOVE[event.key];
      if (move) {
        event.preventDefault();
        moveRef.current[move] = true;
      } else if (event.key === "Enter" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        interact();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const move = KEY_TO_MOVE[event.key];
      if (move) moveRef.current[move] = false;
    };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onGroundClick = (event: PointerEvent) => {
      if (liveRef.current.mode !== "explore" || event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const intersection = raycaster.intersectObjects(walkableMeshes, false).find((hit) => hit.point.y > -0.2);
      if (!intersection) return;
      clickTarget.set(Math.max(-10.5, Math.min(10.5, intersection.point.x)), 0.58, intersection.point.z);
      hasClickTarget = true;
      destinationMarker.position.set(clickTarget.x, 0.12, clickTarget.z);
      destinationMarker.visible = true;
      liveRef.current.onWorldStatus({
        distance: Math.max(0, Math.floor(-avatar.position.z - 24)),
        zone: liveRef.current.endlessMode ? Math.floor(liveRef.current.endlessWords / 5) + 1 : 0,
        biome: liveRef.current.endlessMode ? getEndlessBiome(Math.floor(liveRef.current.endlessWords / 5)).name : "樱花谷",
        movingByClick: true,
      });
    };
    const releaseKeys = () => Object.keys(moveRef.current).forEach((key) => { moveRef.current[key as MoveKey] = false; });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseKeys);
    renderer.domElement.addEventListener("pointerdown", onGroundClick);

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const storySkyColor = new THREE.Color(0x8dbdd1);
    const storyFogColor = new THREE.Color(0xc1ccd0);
    const targetSkyColor = storySkyColor.clone();
    const targetFogColor = storyFogColor.clone();
    const targetAccentColor = new THREE.Color(0x8ff0d4);
    let frame = 0;
    let previousFrameTime = performance.now();
    let elapsedTime = 0;
    let lastBiomeVisualIndex = -1;
    let endlessVisibility = !liveRef.current.endlessMode;
    let pageVisible = !document.hidden;
    let lastNearby: ExplorationEncounterId | null = null;
    let lastStatusDistance = -1;
    let lastStatusZone = -1;
    let lastClickStatus = false;
    let lastBounceAt = -10;
    const cameraTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const padWorldPosition = new THREE.Vector3();
    const bichonRig = avatar.userData.rig as THREE.Group;
    const bichonBody = avatar.userData.body as THREE.Mesh;
    const bichonHead = avatar.userData.head as THREE.Mesh;
    const bichonLegs = avatar.userData.legs as THREE.Mesh[];
    const bichonTail = avatar.userData.tail as THREE.Group;
    const bichonEars = avatar.userData.ears as THREE.Mesh[];
    const bichonShadow = avatar.userData.shadow as THREE.Mesh;
    const fireflyWings = lumi.userData.wings as THREE.Mesh[];

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      previousFrameTime = performance.now();
      if (!pageVisible) releaseKeys();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      window.requestAnimationFrame(() => setFallback(true));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const resize = () => {
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = (frameTime = performance.now()) => {
      frame = window.requestAnimationFrame(animate);
      const delta = Math.min(0.035, Math.max(0.001, (frameTime - previousFrameTime) / 1000));
      previousFrameTime = frameTime;
      if (!pageVisible) return;
      elapsedTime += delta;
      const time = elapsedTime;
      const live = liveRef.current;
      const currentEncounter = getLiveEncounter(live);
      const motionReduced = live.reducedMotion || reducedMotionQuery.matches;
      const move = moveRef.current;
      let moving = false;

      if (live.mode === "explore") {
        let inputX = (move.right ? 1 : 0) - (move.left ? 1 : 0);
        let inputZ = (move.back ? 1 : 0) - (move.forward ? 1 : 0);
        const keyboardMoving = Math.abs(inputX) + Math.abs(inputZ) > 0;
        if (keyboardMoving && hasClickTarget) {
          hasClickTarget = false;
          destinationMarker.visible = false;
        }
        if (!keyboardMoving && hasClickTarget) {
          const targetX = clickTarget.x - avatar.position.x;
          const targetZ = clickTarget.z - avatar.position.z;
          const targetDistance = Math.hypot(targetX, targetZ);
          if (targetDistance < 0.22) {
            hasClickTarget = false;
            destinationMarker.visible = false;
          } else {
            inputX = targetX / targetDistance;
            inputZ = targetZ / targetDistance;
          }
        }
        const length = Math.hypot(inputX, inputZ) || 1;
        const speed = live.endlessMode ? 5.65 : 5.2;
        let nextX = avatar.position.x + (inputX / length) * speed * delta;
        let nextZ = avatar.position.z + (inputZ / length) * speed * delta;
        nextX = Math.max(-10.5, Math.min(10.5, nextX));
        if (live.endlessMode) {
          nextZ = Math.min(-24.4, nextZ);
          if (currentEncounter && nextZ < currentEncounter.position.z + 1.55) nextZ = currentEncounter.position.z + 1.55;
        } else {
          nextZ = Math.max(-24, Math.min(7.2, nextZ));
          if (live.completedWords < 5 && nextZ < -0.95) nextZ = -0.95;
          if (live.completedWords >= 5 && live.completedWords < 10 && nextZ < -9.55) nextZ = -9.55;
          if (live.completedWords >= 10 && live.completedWords < 15 && nextZ < -20.35) nextZ = -20.35;
        }
        moving = Math.abs(inputX) + Math.abs(inputZ) > 0;
        if (moving) {
          avatar.position.x = nextX;
          avatar.position.z = nextZ;
          const targetYaw = Math.atan2(inputX, inputZ);
          avatar.rotation.y += Math.atan2(Math.sin(targetYaw - avatar.rotation.y), Math.cos(targetYaw - avatar.rotation.y)) * Math.min(1, delta * 11);
        }
        if (move.jump && grounded) {
          verticalVelocity = 5.2;
          grounded = false;
          move.jump = false;
        }
      } else {
        releaseKeys();
        destinationMarker.visible = false;
      }

      if (live.endlessMode && live.mode === "explore" && grounded && time - lastBounceAt > 0.9) {
        const activePad = bouncePads.find((pad) => {
          if (!pad.parent?.visible) return false;
          pad.getWorldPosition(padWorldPosition);
          return Math.hypot(avatar.position.x - padWorldPosition.x, avatar.position.z - padWorldPosition.z) < 0.82;
        });
        if (activePad) {
          verticalVelocity = 6.7;
          grounded = false;
          lastBounceAt = time;
        }
      }

      if (!grounded) {
        verticalVelocity -= 13.5 * delta;
        avatar.position.y += verticalVelocity * delta;
        if (avatar.position.y <= 0.58) {
          avatar.position.y = 0.58;
          verticalVelocity = 0;
          grounded = true;
        }
      }

      const animationAlpha = 1 - Math.exp(-delta * 11);
      const gait = moving && !motionReduced ? Math.sin(time * 13.5) : 0;
      const targetRigY = moving && !motionReduced ? Math.abs(gait) * 0.035 : Math.sin(time * 1.8) * 0.007;
      bichonRig.position.y = THREE.MathUtils.lerp(bichonRig.position.y, targetRigY, animationAlpha);
      bichonRig.rotation.z = THREE.MathUtils.lerp(bichonRig.rotation.z, moving && !motionReduced ? gait * 0.025 : 0, animationAlpha);
      bichonBody.scale.y = THREE.MathUtils.lerp(bichonBody.scale.y, moving && !motionReduced ? 0.9 - Math.abs(gait) * 0.025 : 0.9 + Math.sin(time * 1.8) * 0.006, animationAlpha);
      bichonHead.rotation.y = motionReduced ? 0 : Math.sin(time * (moving ? 2.6 : 1.15)) * (moving ? 0.025 : 0.06);
      bichonLegs.forEach((leg, index) => {
        const stride = gait * (index % 2 === 0 ? 1 : -1);
        leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, moving && !motionReduced ? stride * 0.5 : 0, animationAlpha);
      });
      bichonTail.rotation.z = 0.28 + (motionReduced ? 0 : Math.sin(time * (moving ? 13 : 5.2)) * (moving ? 0.32 : 0.18));
      bichonEars.forEach((ear, index) => {
        const restingAngle = index === 0 ? 0.2 : -0.2;
        ear.rotation.z = restingAngle + (moving && !motionReduced ? gait * (index === 0 ? 0.08 : -0.08) : 0);
      });
      const jumpHeight = Math.max(0, avatar.position.y - 0.58);
      bichonShadow.scale.setScalar(Math.max(0.62, 1 - jumpHeight * 0.2));
      (bichonShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.07, 0.2 - jumpHeight * 0.06);

      const followAlpha = 1 - Math.exp(-delta * 5.4);
      lumi.position.x = THREE.MathUtils.lerp(lumi.position.x, avatar.position.x - 0.75, followAlpha);
      lumi.position.z = THREE.MathUtils.lerp(lumi.position.z, avatar.position.z + 0.62, followAlpha);
      lumi.position.y = 1.2 + (motionReduced ? 0 : Math.sin(time * 3.2) * 0.13);
      fireflyWings.forEach((wing, index) => {
        wing.rotation.y = (index === 0 ? -1 : 1) * (0.36 + Math.sin(time * 16) * 0.52);
      });

      const distance = currentEncounter ? Math.hypot(avatar.position.x - currentEncounter.position.x, avatar.position.z - currentEncounter.position.z) : Infinity;
      const nextNearby = live.mode === "explore" && currentEncounter && distance < 2.35 ? currentEncounter.id : null;
      if (nextNearby !== lastNearby) {
        lastNearby = nextNearby;
        nearbyRef.current = nextNearby;
        setNearby(nextNearby);
      }

      const completedCount = getCompletedEncounterCount(live.completedWords);
      if (completedCount > lastCheckpointCount) {
        lastCheckpointCount = completedCount;
        const completed = EXPLORATION_ENCOUNTERS[completedCount - 1];
        live.onCheckpoint(completed.success);
      } else if (completedCount < lastCheckpointCount) {
        lastCheckpointCount = completedCount;
      }

      if (endlessVisibility !== live.endlessMode) {
        endlessVisibility = live.endlessMode;
        endlessChunks.forEach((chunk) => { chunk.visible = endlessVisibility; });
        endlessPortal.visible = endlessVisibility;
      }
      if (live.endlessMode && currentEncounter) {
        const eventIndex = Math.floor(live.endlessWords / 5);
        const biome = getEndlessBiome(eventIndex);
        if (eventIndex !== lastBiomeVisualIndex) {
          lastBiomeVisualIndex = eventIndex;
          targetAccentColor.set(biome.accent);
          targetSkyColor.set(biome.sky);
          targetFogColor.set(biome.fog);
        }
        endlessPortal.position.set(currentEncounter.position.x, 0, currentEncounter.position.z);
        portalRing.rotation.z = time * 0.65;
        portalCore.rotation.x = time * 0.42;
        portalCore.rotation.y = time * 0.58;
        const biomeBlend = 1 - Math.exp(-delta * 4.8);
        portalGlowMaterial.color.lerp(targetAccentColor, biomeBlend);
        portalGlowMaterial.emissive.lerp(targetAccentColor, biomeBlend);
        (scene.background as THREE.Color).lerp(targetSkyColor, 1 - Math.exp(-delta * 0.75));
        (scene.fog as THREE.FogExp2).color.lerp(targetFogColor, 1 - Math.exp(-delta * 0.75));
        let farthestZ = Infinity;
        let greatestChunkIndex = -Infinity;
        endlessChunks.forEach((chunk) => {
          farthestZ = Math.min(farthestZ, chunk.position.z);
          greatestChunkIndex = Math.max(greatestChunkIndex, chunk.userData.chunkIndex as number);
        });
        endlessChunks.forEach((chunk) => {
          if (chunk.position.z > avatar.position.z + ENDLESS_CHUNK_LENGTH * 2.3) {
            chunk.position.z = farthestZ - ENDLESS_CHUNK_LENGTH;
            greatestChunkIndex += 1;
            chunk.userData.chunkIndex = greatestChunkIndex;
            farthestZ = chunk.position.z;
          }
        });
        const distanceTravelled = Math.max(0, Math.floor(-avatar.position.z - 24));
        const zone = eventIndex + 1;
        if (Math.abs(distanceTravelled - lastStatusDistance) >= 2 || zone !== lastStatusZone || hasClickTarget !== lastClickStatus) {
          lastStatusDistance = distanceTravelled;
          lastStatusZone = zone;
          lastClickStatus = hasClickTarget;
          live.onWorldStatus({ distance: distanceTravelled, zone, biome: biome.name, movingByClick: hasClickTarget });
        }
      } else {
        lastBiomeVisualIndex = -1;
        const storyBlend = 1 - Math.exp(-delta * 0.75);
        (scene.background as THREE.Color).lerp(storySkyColor, storyBlend);
        (scene.fog as THREE.FogExp2).color.lerp(storyFogColor, storyBlend);
      }

      rune.rotation.z = time * 0.55;
      rune.scale.setScalar(live.completedWords >= 5 ? 1 + Math.sin(time * 2) * 0.04 : 0.96);
      gate.children.forEach((child, index) => {
        if (index < 4) return;
        child.visible = live.completedWords < 5;
      });
      bridgePieces.forEach((piece, index) => {
        const summoned = Math.max(0, Math.min(5, live.completedWords - 5)) > index;
        const targetScale = summoned ? 1 : 0.16;
        piece.scale.y = THREE.MathUtils.lerp(piece.scale.y, targetScale, motionReduced ? 1 : 1 - Math.exp(-delta * 5));
        piece.position.y = summoned ? 0.25 + Math.sin(time * 1.8 + index) * 0.025 : -0.2;
      });
      beacon.rotation.y = motionReduced ? 0 : Math.sin(time * 0.35) * 0.08;
      flowerCore.rotation.y = time * 0.6;
      rings.forEach((ring, index) => {
        ring.rotation.z = (index % 2 ? -1 : 1) * time * (0.35 + index * 0.12);
        ring.visible = live.completedWords >= 10;
      });
      beaconLight.intensity = live.completedWords >= 10 ? 3.2 : 0.55;
      checkpointMarkers.forEach((marker, index) => {
        marker.visible = live.completedWords >= (index + 1) * 5;
        marker.rotation.y = time * 0.5;
      });
      bouncePads.forEach((pad, index) => {
        pad.scale.y = 0.82 + Math.sin(time * 3.2 + index) * 0.12;
        pad.rotation.y = time * 0.4 + index;
      });
      if (destinationMarker.visible) {
        destinationMarker.rotation.y = time * 1.4;
        destinationMarker.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
      }

      if (!motionReduced) {
        petals.forEach((petal, index) => {
          petal.position.y -= delta * (0.22 + (index % 5) * 0.035);
          petal.position.x += Math.sin(time * 0.7 + index) * delta * 0.08;
          petal.rotation.z += delta * 0.45;
          if (petal.position.y < 0.25) petal.position.y = 5.5 + (index % 4);
        });
      }

      const cameraDistance = mount.clientWidth < 700 ? 5.65 : 6.45;
      desiredCamera.set(avatar.position.x * 0.28, avatar.position.y + 3.35, avatar.position.z + cameraDistance);
      camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * (motionReduced ? 12 : 6.2)));
      cameraTarget.set(avatar.position.x, avatar.position.y + 0.52, avatar.position.z - 1.55);
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseKeys);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer.domElement.removeEventListener("pointerdown", onGroundClick);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      resizeObserver.disconnect();
      resetRef.current = null;
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fallback, interact]);

  const current = props.endlessMode ? getEndlessEncounter(props.endlessWords) : getExplorationEncounter(props.completedWords);
  const nearbyEncounter = current?.id === nearby ? current : EXPLORATION_ENCOUNTERS.find((encounter) => encounter.id === nearby) ?? null;

  if (fallback) {
    return (
      <div className="exploration-fallback garden-stage" role="region" aria-label="樱花谷探索关简洁模式">
        <div className="fallback-adventure-card">
          <span>{current?.icon ?? "✓"}</span>
          <small>{props.endlessMode ? `无限世界 · 第 ${current?.number ?? 1} 次奇遇` : `简洁探索模式 · 第 ${Math.min(3, getCompletedEncounterCount(props.completedWords) + 1)} 站`}</small>
          <h2>{current?.title ?? "樱花谷已点亮"}</h2>
          <p>{current?.story ?? "你已经完成了这次探索。"}</p>
          {current && <button onClick={() => props.onEncounter(current.id)}>开始机关打字 <b>→</b></button>}
        </div>
      </div>
    );
  }

  const bindMove = (key: MoveKey) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setMove(key, true); },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); setMove(key, false); },
    onPointerCancel: () => setMove(key, false),
    onPointerLeave: () => setMove(key, false),
  });

  return (
    <div className={`exploration-stage garden-stage mode-${props.mode} ${props.endlessMode ? "endless-world" : "story-world"}`} aria-label={props.endlessMode ? "安琪打字机无限探索世界" : "樱花谷第三人称探索关"}>
      <div ref={mountRef} className="exploration-canvas" aria-hidden="true" />
      {props.mode === "explore" && (
        <>
          <div className={`interaction-prompt ${nearbyEncounter ? "visible" : ""}`} aria-live="polite">
            <span>{nearbyEncounter?.icon ?? "⌁"}</span>
            <div><small>{nearbyEncounter ? props.endlessMode ? `发现随机奇遇 · 第 ${nearbyEncounter.number} 区` : `发现机关 · 第 ${nearbyEncounter.number}/3 站` : props.endlessMode ? "点击远处路面，安琪会自动前往" : "沿花瓣小路探索"}</small><strong>{nearbyEncounter?.title ?? (props.endlessMode ? "寻找下一座星愿碑" : "寻找发光的花印")}</strong></div>
            {nearbyEncounter && <button onClick={interact}><kbd>Enter</kbd> 开始解谜</button>}
          </div>
          <div className="explore-controls-hint"><span><kbd>鼠标点击</kbd> 自动前往</span><span><kbd>↑↓←→</kbd> 自由移动</span><span><kbd>Space</kbd> 跳跃</span><span><kbd>Enter</kbd> 互动</span></div>
          <div className="mobile-explore-controls" aria-label="触屏探索控制">
            <div className="mobile-move-pad">
              <button className="move-up" aria-label="向前移动" {...bindMove("forward")}>▲</button>
              <button className="move-left" aria-label="向左移动" {...bindMove("left")}>◀</button>
              <i aria-hidden="true">✦</i>
              <button className="move-right" aria-label="向右移动" {...bindMove("right")}>▶</button>
              <button className="move-down" aria-label="向后移动" {...bindMove("back")}>▼</button>
            </div>
            <div className="mobile-action-pad">
              <button className="jump-action" aria-label="跳跃" {...bindMove("jump")}><i>↑</i><span>跳跃</span></button>
              <button className="interact-action" aria-label="与机关互动" onClick={interact} disabled={!nearbyEncounter}><i>✦</i><span>互动</span></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

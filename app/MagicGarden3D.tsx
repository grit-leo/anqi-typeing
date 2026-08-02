"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { MissionType } from "./game-engine";

type GamePhase = "lobby" | "playing" | "paused" | "complete";

type MagicGarden3DProps = {
  phase: GamePhase;
  worldIndex: number;
  mission: MissionType;
  cosmeticColor: string;
  word: string;
  typedLength: number;
  correctHits: number;
  mistakes: number;
  completedWords: number;
  combo: number;
  reducedMotion: boolean;
};

type LiveState = MagicGarden3DProps;

const PALETTES = [
  { sky: 0x241b58, fog: 0x4f3d85, bloom: 0xff9fc6, glow: 0xffd26f, magic: 0x73f2d0 },
  { sky: 0x171746, fog: 0x493f8f, bloom: 0xb59cff, glow: 0xf4ecff, magic: 0x7edfff },
  { sky: 0x164262, fog: 0x4b8da2, bloom: 0x8cdcf3, glow: 0xffe299, magic: 0xff92c5 },
  { sky: 0x082f42, fog: 0x245c68, bloom: 0x62e0c9, glow: 0xffd77b, magic: 0xff8fc5 },
] as const;

function seeded(seedStart: number) {
  let seed = seedStart;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function paintWord(canvas: HTMLCanvasElement, word: string, typedLength: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const panel = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  panel.addColorStop(0, "rgba(38, 25, 90, .96)");
  panel.addColorStop(1, "rgba(92, 50, 118, .94)");
  context.fillStyle = panel;
  roundedRect(context, 14, 18, canvas.width - 28, canvas.height - 36, 42);
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = "rgba(255, 221, 242, .72)";
  context.stroke();

  const display = word.toUpperCase().replaceAll(" ", "·");
  context.font = "900 76px ui-rounded, system-ui, sans-serif";
  context.textBaseline = "middle";
  const widths = [...display].map((letter) => context.measureText(letter).width + 4);
  let cursor = (canvas.width - widths.reduce((sum, value) => sum + value, 0)) / 2;
  [...display].forEach((letter, index) => {
    context.fillStyle = index < typedLength ? "#74f0cf" : index === typedLength ? "#ffd66f" : "#fff9ff";
    context.shadowColor = index === typedLength ? "rgba(255, 214, 111, .92)" : "rgba(255,255,255,.2)";
    context.shadowBlur = index === typedLength ? 22 : 5;
    context.fillText(letter, cursor, canvas.height / 2 + 4);
    cursor += widths[index];
  });
  context.shadowBlur = 0;
}

function makePetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.28, 0.1, 0.3, 0.45, 0, 0.68);
  shape.bezierCurveTo(-0.3, 0.45, -0.28, 0.1, 0, 0);
  return new THREE.ShapeGeometry(shape, 6);
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    const renderable = object as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
    materials.forEach((material) => {
      const mapped = material as THREE.Material & { map?: THREE.Texture };
      mapped.map?.dispose();
      material.dispose();
    });
  });
}

export function MagicGarden3D(props: MagicGarden3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<LiveState>(props);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    liveRef.current = props;
  }, [props]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || fallback) return;
    if (!window.WebGLRenderingContext) {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    const random = seeded(20260802);
    const systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paletteColors = PALETTES.map((palette) => ({
      sky: new THREE.Color(palette.sky),
      fog: new THREE.Color(palette.fog),
      bloom: new THREE.Color(palette.bloom),
      glow: new THREE.Color(palette.glow),
      magic: new THREE.Color(palette.magic),
    }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "garden-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const initialPalette = PALETTES[liveRef.current.worldIndex] ?? PALETTES[0];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialPalette.sky);
    scene.fog = new THREE.FogExp2(initialPalette.fog, 0.026);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 90);
    camera.position.set(0, 3.2, 11.7);

    const ambient = new THREE.HemisphereLight(0xffe8fa, 0x24376f, 2.8);
    scene.add(ambient);
    const moonLight = new THREE.DirectionalLight(0xffe5f4, 4.2);
    moonLight.position.set(-6, 10, 7);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    scene.add(moonLight);
    const magicLight = new THREE.PointLight(initialPalette.magic, 20, 16, 2);
    magicLight.position.set(0, 2.2, 2.6);
    scene.add(magicLight);
    const missLight = new THREE.PointLight(0xff5e7f, 0, 9, 2);
    missLight.position.set(0, 2, 4);
    scene.add(missLight);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xffeafa }),
    );
    moon.position.set(-7.3, 6.6, -10.5);
    scene.add(moon);
    const moonHalo = new THREE.Mesh(
      new THREE.SphereGeometry(2.65, 32, 22),
      new THREE.MeshBasicMaterial({ color: 0xf0b7ff, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
    );
    moonHalo.position.copy(moon.position);
    scene.add(moonHalo);

    const starCount = 680;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const radius = 18 + random() * 34;
      const angle = random() * Math.PI * 2;
      starPositions[index * 3] = Math.cos(angle) * radius;
      starPositions[index * 3 + 1] = random() * 26 - 3;
      starPositions[index * 3 + 2] = Math.sin(angle) * radius - 10;
      const tint = random();
      starColors[index * 3] = 0.72 + tint * 0.28;
      starColors[index * 3 + 1] = 0.72 + tint * 0.2;
      starColors[index * 3 + 2] = 1;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.075, transparent: true, opacity: 0.9, vertexColors: true, depthWrite: false }));
    scene.add(stars);

    const garden = new THREE.Group();
    garden.position.set(0, -1.4, -2.8);
    scene.add(garden);

    const earthMaterial = new THREE.MeshStandardMaterial({ color: 0x536c62, roughness: 0.92, flatShading: true });
    const lawnMaterial = new THREE.MeshStandardMaterial({ color: 0x79a66f, roughness: 0.88, emissive: 0x1a3229, emissiveIntensity: 0.22 });
    const island = new THREE.Mesh(new THREE.CylinderGeometry(9.7, 7.5, 2.3, 64, 3), earthMaterial);
    island.receiveShadow = true;
    island.position.y = -1.15;
    garden.add(island);
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(9.72, 9.62, 0.34, 64), lawnMaterial);
    lawn.receiveShadow = true;
    garden.add(lawn);

    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(2.55, 64),
      new THREE.MeshPhysicalMaterial({ color: 0x6ee6e1, transparent: true, opacity: 0.66, roughness: 0.05, metalness: 0.05, clearcoat: 1 }),
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(3.6, 0.2, 0.4);
    garden.add(pond);
    const pondRing = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.1, 9, 72), new THREE.MeshStandardMaterial({ color: 0xb6d38c, roughness: 0.9 }));
    pondRing.rotation.x = Math.PI / 2;
    pondRing.position.copy(pond.position);
    garden.add(pondRing);

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6f4569, roughness: 0.88 });
    const blossomMaterial = new THREE.MeshStandardMaterial({ color: initialPalette.bloom, roughness: 0.66, emissive: initialPalette.bloom, emissiveIntensity: 0.12 });
    const tree = new THREE.Group();
    tree.position.set(-5.25, 0.08, -1.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 4.2, 12), trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);
    [-1, 1].forEach((side) => {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.28, 2.7, 9), trunkMaterial);
      branch.position.set(side * 0.72, 3.5, 0);
      branch.rotation.z = side * -0.72;
      branch.castShadow = true;
      tree.add(branch);
    });
    const blossomClouds: THREE.Mesh[] = [];
    for (let index = 0; index < 16; index += 1) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72 + random() * 0.45, 2), blossomMaterial);
      const angle = (index / 16) * Math.PI * 2;
      cloud.position.set(Math.cos(angle) * (1.45 + random() * 0.65), 4.15 + Math.sin(index * 1.7) * 0.65, Math.sin(angle) * 0.9);
      cloud.scale.y = 0.82 + random() * 0.35;
      cloud.castShadow = true;
      tree.add(cloud);
      blossomClouds.push(cloud);
    }
    garden.add(tree);

    const flowerGroup = new THREE.Group();
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4c9b70, roughness: 0.9 });
    const petalGeometry = makePetalGeometry();
    const petalMaterials = [0xff9fbd, 0xb8a2ff, 0xffdc83, 0x76dfcf].map((color) => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.75 }));
    for (let index = 0; index < 38; index += 1) {
      const flower = new THREE.Group();
      const angle = random() * Math.PI * 2;
      const radius = 2.8 + random() * 6.1;
      flower.position.set(Math.cos(angle) * radius, 0.18, Math.sin(angle) * radius);
      const height = 0.28 + random() * 0.32;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, height, 5), stemMaterial);
      stem.position.y = height / 2;
      flower.add(stem);
      const material = petalMaterials[index % petalMaterials.length];
      for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
        const petal = new THREE.Mesh(petalGeometry, material);
        petal.scale.setScalar(0.18 + random() * 0.07);
        petal.rotation.z = (petalIndex / 5) * Math.PI * 2;
        petal.position.y = height;
        flower.add(petal);
      }
      flower.scale.setScalar(0.8 + random() * 0.55);
      flowerGroup.add(flower);
    }
    garden.add(flowerGroup);

    const crystalMaterial = new THREE.MeshStandardMaterial({ color: 0xbfa9ff, roughness: 0.18, metalness: 0.12, emissive: 0x5740a8, emissiveIntensity: 0.65, transparent: true, opacity: 0.92 });
    const crystalWorld = new THREE.Group();
    [[-2.9, -1.2], [5.8, -1.7], [6.3, 2.5], [-6.8, 2.2]].forEach(([x, z], groupIndex) => {
      const cluster = new THREE.Group();
      cluster.position.set(x, 0.25, z);
      for (let index = 0; index < 3; index += 1) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24 + index * 0.08, 0), crystalMaterial);
        crystal.position.set((index - 1) * 0.28, 0.2 + index * 0.08, index % 2 ? 0.12 : -0.1);
        crystal.scale.y = 1.7 + groupIndex * 0.08;
        cluster.add(crystal);
      }
      crystalWorld.add(cluster);
    });
    garden.add(crystalWorld);

    const cloudWorld = new THREE.Group();
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f8ff, roughness: 0.82, transparent: true, opacity: 0.88 });
    for (let index = 0; index < 9; index += 1) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65 + random() * 0.55, 2), cloudMaterial);
      cloud.position.set((random() - 0.5) * 14, 2.3 + random() * 3.5, -4 - random() * 5);
      cloud.scale.set(1.5 + random(), 0.45 + random() * 0.35, 0.85);
      cloudWorld.add(cloud);
    }
    const skyTowerMaterial = new THREE.MeshStandardMaterial({ color: 0xffe29a, roughness: 0.52, emissive: 0x8a622d, emissiveIntensity: 0.22 });
    [-4.7, 4.8].forEach((x, index) => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.62, 3.2 + index * 0.6, 10), skyTowerMaterial);
      tower.position.set(x, 1.75, -4.3 - index);
      tower.castShadow = true;
      cloudWorld.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.15, 10), new THREE.MeshStandardMaterial({ color: 0x7bbde8, roughness: 0.62 }));
      roof.position.set(x, 3.9 + index * 0.3, -4.3 - index);
      cloudWorld.add(roof);
    });
    scene.add(cloudWorld);

    const auroraWorld = new THREE.Group();
    const auroraColors = [0x5ff0ce, 0xff89c3, 0x9c8cff];
    auroraColors.forEach((color, index) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-8, 5.8 + index * 0.7, -7 - index),
        new THREE.Vector3(-3, 7.1 + index * 0.35, -9),
        new THREE.Vector3(2, 5.7 + index * 0.65, -8),
        new THREE.Vector3(8, 7.4 - index * 0.2, -10),
      ]);
      const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 0.035 + index * 0.012, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }));
      auroraWorld.add(ribbon);
    });
    [-5.4, 5.2].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 4.8, 10), new THREE.MeshStandardMaterial({ color: 0x76d9c7, roughness: 0.3, metalness: 0.18, emissive: 0x1b6c68, emissiveIntensity: 0.5 }));
      pillar.position.set(x, 1.8, -3.8);
      auroraWorld.add(pillar);
    });
    scene.add(auroraWorld);

    const heroine = new THREE.Group();
    heroine.position.set(-2.25, -0.95, 3.2);
    heroine.scale.setScalar(0.93);
    scene.add(heroine);
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd4bd, roughness: 0.78 });
    const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x49316e, roughness: 0.68 });
    const dressMaterial = new THREE.MeshStandardMaterial({ color: 0x9e7af0, roughness: 0.48, metalness: 0.08, emissive: 0x2e1e6e, emissiveIntensity: 0.28 });
    const cosmeticTarget = new THREE.Color(liveRef.current.cosmeticColor);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 18), skinMaterial);
    head.position.y = 2.18;
    head.castShadow = true;
    heroine.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.66), hairMaterial);
    hair.position.set(0, 2.29, -0.05);
    hair.rotation.x = -0.15;
    heroine.add(hair);
    [-1, 1].forEach((side) => {
      const curl = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.65, 5, 10), hairMaterial);
      curl.position.set(side * 0.34, 1.82, -0.06);
      curl.rotation.z = side * 0.16;
      heroine.add(curl);
    });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x34234f });
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), eyeMaterial);
      eye.position.set(side * 0.15, 2.21, 0.4);
      heroine.add(eye);
    });
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 24), dressMaterial);
    dress.position.y = 1.12;
    dress.castShadow = true;
    heroine.add(dress);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 8, 22), new THREE.MeshStandardMaterial({ color: 0xffd76c, roughness: 0.4 }));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.75;
    heroine.add(collar);
    const wandArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.58, 4, 8), skinMaterial);
    wandArm.position.set(0.52, 1.55, 0);
    wandArm.rotation.z = -0.65;
    heroine.add(wandArm);
    const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.35, 8), new THREE.MeshStandardMaterial({ color: 0xffd369, metalness: 0.25, roughness: 0.32 }));
    wand.position.set(0.93, 1.85, 0.08);
    wand.rotation.z = -0.68;
    heroine.add(wand);
    const wandStar = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: 0xffef9b, emissive: 0xffbf55, emissiveIntensity: 1.2 }));
    wandStar.position.set(1.38, 2.37, 0.1);
    heroine.add(wandStar);

    const bunny = new THREE.Group();
    bunny.position.set(-0.6, -0.97, 3.5);
    bunny.scale.setScalar(0.78);
    scene.add(bunny);
    const bunnyMaterial = new THREE.MeshStandardMaterial({ color: 0xfff5fb, roughness: 0.82 });
    const bunnyBody = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), bunnyMaterial);
    bunnyBody.scale.y = 1.2;
    bunnyBody.position.y = 0.43;
    bunny.add(bunnyBody);
    const bunnyHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), bunnyMaterial);
    bunnyHead.position.set(0, 0.95, 0.07);
    bunny.add(bunnyHead);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 8), bunnyMaterial);
      ear.position.set(side * 0.13, 1.35, 0);
      ear.rotation.z = side * 0.1;
      bunny.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), eyeMaterial);
      eye.position.set(side * 0.1, 1, 0.28);
      bunny.add(eye);
    });

    const wisp = new THREE.Group();
    wisp.position.set(1.15, 1.7, 1.2);
    scene.add(wisp);
    const wispMaterial = new THREE.MeshStandardMaterial({ color: initialPalette.bloom, emissive: initialPalette.bloom, emissiveIntensity: 1.15, roughness: 0.25, transparent: true, opacity: 0.94 });
    const guardianColor = new THREE.Color(0x8a3f88);
    const guardianEmissive = new THREE.Color(0xff477e);
    const wispCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 2), wispMaterial);
    wisp.add(wispCore);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.025, 8, 72), new THREE.MeshBasicMaterial({ color: initialPalette.magic, transparent: true, opacity: 0.72 }));
    halo.rotation.x = Math.PI / 2;
    wisp.add(halo);
    const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xffeefa, transparent: true, opacity: 0.46, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), wingMaterial);
      wing.scale.set(0.45, 0.9, 0.12);
      wing.position.set(side * 0.68, 0.08, 0);
      wing.rotation.z = side * -0.48;
      wisp.add(wing);
    });

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 760;
    labelCanvas.height = 220;
    paintWord(labelCanvas, liveRef.current.word, liveRef.current.typedLength);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const wordSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
    wordSprite.position.set(0, 1.28, 0);
    wordSprite.scale.set(5.5, 1.6, 1);
    wordSprite.renderOrder = 10;
    wisp.add(wordSprite);

    const backgroundWisps: THREE.Group[] = [];
    [[-4.2, 2.6, -2.8], [4.7, 3.4, -4.4], [5.6, 1.4, -1.8]].forEach(([x, y, z], index) => {
      const mote = new THREE.Group();
      mote.position.set(x, y, z);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + index * 0.05, 1), new THREE.MeshBasicMaterial({ color: index === 1 ? 0xffd67a : 0xd6adff, transparent: true, opacity: 0.85 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36 + index * 0.04, 0.015, 6, 42), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
      ring.rotation.x = Math.PI / 2;
      mote.add(core, ring);
      scene.add(mote);
      backgroundWisps.push(mote);
    });

    const beamGeometry = new THREE.BufferGeometry();
    beamGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const beamMaterial = new THREE.LineBasicMaterial({ color: initialPalette.magic, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const beam = new THREE.Line(beamGeometry, beamMaterial);
    scene.add(beam);

    const burstCount = 86;
    const burstPositions = new Float32Array(burstCount * 3);
    const burstDirections = new Float32Array(burstCount * 3);
    for (let index = 0; index < burstCount; index += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const velocity = 0.8 + random() * 2.6;
      burstDirections[index * 3] = Math.sin(phi) * Math.cos(theta) * velocity;
      burstDirections[index * 3 + 1] = Math.cos(phi) * velocity;
      burstDirections[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * velocity;
    }
    const burstGeometry = new THREE.BufferGeometry();
    burstGeometry.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3));
    const burstMaterial = new THREE.PointsMaterial({ color: initialPalette.glow, size: 0.13, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const burst = new THREE.Points(burstGeometry, burstMaterial);
    burst.visible = false;
    scene.add(burst);

    const fireflyCount = 92;
    const fireflyPositions = new Float32Array(fireflyCount * 3);
    for (let index = 0; index < fireflyCount; index += 1) {
      fireflyPositions[index * 3] = (random() - 0.5) * 18;
      fireflyPositions[index * 3 + 1] = random() * 6 - 0.2;
      fireflyPositions[index * 3 + 2] = (random() - 0.5) * 12 - 1;
    }
    const fireflyGeometry = new THREE.BufferGeometry();
    fireflyGeometry.setAttribute("position", new THREE.BufferAttribute(fireflyPositions, 3));
    const fireflies = new THREE.Points(fireflyGeometry, new THREE.PointsMaterial({ color: 0xffdf78, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(fireflies);

    const pointerTarget = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    const cameraTarget = new THREE.Vector3(0, 1.05, -1.8);
    const clock = new THREE.Clock();
    let frame = 0;
    let visible = true;
    let lastWord = liveRef.current.word;
    let lastTyped = liveRef.current.typedLength;
    let lastCorrect = liveRef.current.correctHits;
    let lastMistakes = liveRef.current.mistakes;
    let lastCompleted = liveRef.current.completedWords;
    let beamUntil = 0;
    let pulse = 0;
    let shake = 0;
    let burstAge = 4;

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(420, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.02 });
    intersectionObserver.observe(mount);

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointerTarget.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2);
    };
    const onPointerLeave = () => pointerTarget.set(0, 0);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerleave", onPointerLeave);

    const triggerBurst = () => {
      burst.position.copy(wisp.position);
      burstPositions.fill(0);
      burstGeometry.attributes.position.needsUpdate = true;
      burstMaterial.opacity = 1;
      burst.visible = true;
      burstAge = 0;
      pulse = 1;
    };

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      if (!visible || document.hidden) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const live = liveRef.current;
      const motionOff = live.reducedMotion || systemReducedMotion;
      const palette = paletteColors[live.worldIndex] ?? paletteColors[0];

      (scene.background as THREE.Color).lerp(palette.sky, 0.025);
      (scene.fog as THREE.FogExp2).color.lerp(palette.fog, 0.025);
      blossomMaterial.color.lerp(palette.bloom, 0.03);
      blossomMaterial.emissive.lerp(palette.bloom, 0.03);
      wispMaterial.color.lerp(live.mission === "guardian" ? guardianColor : palette.bloom, 0.04);
      wispMaterial.emissive.lerp(live.mission === "guardian" ? guardianEmissive : palette.bloom, 0.04);
      magicLight.color.lerp(palette.magic, 0.04);
      beamMaterial.color.lerp(palette.magic, 0.05);
      burstMaterial.color.lerp(palette.glow, 0.05);
      cosmeticTarget.set(live.cosmeticColor);
      dressMaterial.color.lerp(cosmeticTarget, 0.05);
      tree.visible = live.worldIndex === 0;
      pond.visible = live.worldIndex <= 1;
      pondRing.visible = live.worldIndex <= 1;
      crystalWorld.visible = live.worldIndex === 1 || live.worldIndex === 3;
      cloudWorld.visible = live.worldIndex === 2;
      auroraWorld.visible = live.worldIndex === 3;

      if (live.word !== lastWord) {
        paintWord(labelCanvas, live.word, live.typedLength);
        labelTexture.needsUpdate = true;
        lastWord = live.word;
        lastTyped = live.typedLength;
      } else if (live.typedLength !== lastTyped) {
        paintWord(labelCanvas, live.word, live.typedLength);
        labelTexture.needsUpdate = true;
        lastTyped = live.typedLength;
      }

      if (live.correctHits > lastCorrect) {
        const positions = beamGeometry.attributes.position as THREE.BufferAttribute;
        const from = new THREE.Vector3();
        const to = new THREE.Vector3();
        wandStar.getWorldPosition(from);
        wispCore.getWorldPosition(to);
        positions.setXYZ(0, from.x, from.y, from.z);
        positions.setXYZ(1, to.x, to.y, to.z);
        positions.needsUpdate = true;
        beamUntil = time + 0.12;
        beamMaterial.opacity = 1;
        pulse = 0.5;
        lastCorrect = live.correctHits;
      }
      if (live.completedWords > lastCompleted) {
        triggerBurst();
        lastCompleted = live.completedWords;
      }
      if (live.mistakes > lastMistakes) {
        missLight.intensity = 18;
        shake = motionOff ? 0 : 0.16;
        lastMistakes = live.mistakes;
      }

      const phaseFocus = live.phase === "lobby" ? 0 : live.phase === "playing" ? 1 : 0.55;
      wisp.position.x = THREE.MathUtils.lerp(wisp.position.x, phaseFocus ? 1.2 : 2.1, 0.025);
      wisp.position.y = 1.7 + (motionOff ? 0 : Math.sin(time * 1.35) * 0.16);
      wispCore.rotation.x += delta * 0.35;
      wispCore.rotation.y += delta * 0.55;
      halo.rotation.z -= delta * (0.5 + live.combo * 0.012);
      pulse = Math.max(0, pulse - delta * 4.5);
      const missionScale = live.mission === "guardian" ? 1.42 : live.mission === "firefly" ? 0.88 : 1;
      wispCore.scale.setScalar(missionScale + pulse * 0.22);
      halo.scale.setScalar(live.mission === "guardian" ? 1.2 : 1);
      magicLight.intensity = 18 + Math.min(20, live.combo * 0.7) + pulse * 20 + (live.mission === "guardian" ? 8 : 0);
      missLight.intensity = THREE.MathUtils.lerp(missLight.intensity, 0, 0.12);
      beamMaterial.opacity = time < beamUntil ? Math.max(0, (beamUntil - time) * 8.2) : 0;

      if (burstAge < 1.25) {
        burstAge += delta;
        const attribute = burstGeometry.attributes.position as THREE.BufferAttribute;
        for (let index = 0; index < burstCount; index += 1) {
          const distance = burstAge * (1 - burstAge * 0.25);
          attribute.setXYZ(index, burstDirections[index * 3] * distance, burstDirections[index * 3 + 1] * distance, burstDirections[index * 3 + 2] * distance);
        }
        attribute.needsUpdate = true;
        burstMaterial.opacity = Math.max(0, 1 - burstAge / 1.25);
      } else {
        burst.visible = false;
      }

      if (!motionOff) {
        heroine.position.y = -0.95 + Math.sin(time * 1.8) * 0.035;
        heroine.rotation.y = Math.sin(time * 0.42) * 0.04;
        bunny.position.y = -0.97 + Math.abs(Math.sin(time * 2.15)) * 0.055;
        flowerGroup.rotation.y = Math.sin(time * 0.12) * 0.01;
        blossomClouds.forEach((cloud, index) => { cloud.rotation.y += delta * (0.025 + index * 0.001); });
        backgroundWisps.forEach((mote, index) => {
          mote.position.y += Math.sin(time * (0.55 + index * 0.07) + index) * 0.0008;
          mote.rotation.z += delta * (0.16 + index * 0.04);
        });
        fireflies.rotation.y += delta * 0.012;
        fireflies.position.y = Math.sin(time * 0.35) * 0.18;
        pond.material.opacity = 0.62 + Math.sin(time * 0.9) * 0.05;
        cloudWorld.rotation.y = Math.sin(time * 0.12) * 0.035;
        auroraWorld.position.y = Math.sin(time * 0.32) * 0.13;
      }

      pointerCurrent.lerp(pointerTarget, motionOff ? 0 : 0.035);
      const jitterX = shake > 0 ? (random() - 0.5) * shake : 0;
      const jitterY = shake > 0 ? (random() - 0.5) * shake : 0;
      shake = Math.max(0, shake - delta * 1.5);
      const lobby = live.phase === "lobby";
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, (lobby ? -0.2 : 0.45) + pointerCurrent.x * 0.42 + jitterX, 0.028);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, (lobby ? 3.7 : 3.05) - pointerCurrent.y * 0.25 + jitterY, 0.028);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, lobby ? 12.9 : 11.2, 0.028);
      cameraTarget.set(pointerCurrent.x * 0.16, lobby ? 1.0 : 1.12, -1.7 - pointerCurrent.y * 0.1);
      camera.lookAt(cameraTarget);
      stars.rotation.y += delta * 0.0025;
      moonHalo.scale.setScalar(1 + Math.sin(time * 0.45) * 0.035);
      renderer.render(scene, camera);
    };
    animate();

    const onContextLost = (event: Event) => {
      event.preventDefault();
      window.requestAnimationFrame(() => setFallback(true));
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeScene(scene);
      labelTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fallback]);

  return (
    <div className={`garden-stage ${fallback ? "garden-stage-fallback" : ""}`} aria-hidden="true">
      <div ref={mountRef} className="garden-mount" />
      {fallback && <><div className="fallback-moon" /><div className="fallback-hills"><i /><i /><i /></div><div className="fallback-garden">✦　❀　✧　❀　✦</div></>}
    </div>
  );
}

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
  { sky: 0x21164f, zenith: 0x17113d, horizon: 0xc45b9f, fog: 0x60468e, ground: 0x355d55, bloom: 0xffa6ca, glow: 0xffd783, magic: 0x73f2d0 },
  { sky: 0x151641, zenith: 0x090d2c, horizon: 0x725cb3, fog: 0x514799, ground: 0x304a67, bloom: 0xbca8ff, glow: 0xf7eeff, magic: 0x7edfff },
  { sky: 0x174966, zenith: 0x0b2f4f, horizon: 0x83cad1, fog: 0x5b9caf, ground: 0x4b7a79, bloom: 0x95e4f5, glow: 0xffe39b, magic: 0xff98cb },
  { sky: 0x073449, zenith: 0x031d35, horizon: 0x307b79, fog: 0x2b6670, ground: 0x244f55, bloom: 0x67e5ce, glow: 0xffda88, magic: 0xff92c8 },
] as const;

const WORLD_BACKGROUNDS = [
  "/worlds/blossom-real-v1.webp",
  "/worlds/moonlake-real-v1.webp",
  "/worlds/cloud-real-v1.webp",
  "/worlds/aurora-real-v1.webp",
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

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.18, "rgba(255,255,255,.74)");
    glow.addColorStop(0.55, "rgba(255,255,255,.18)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCloudPuff(material: THREE.Material, random: () => number, size = 1) {
  const cloud = new THREE.Group();
  const pieces = 4;
  for (let index = 0; index < pieces; index += 1) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(size * (0.58 + random() * 0.24), 1), material);
    puff.position.set((index - 1.5) * size * 0.58, Math.sin(index * 1.8) * size * 0.18, (random() - 0.5) * size * 0.32);
    puff.scale.y = 0.72 + random() * 0.18;
    cloud.add(puff);
  }
  return cloud;
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

    const lightweight = window.innerWidth < 800 || (navigator.hardwareConcurrency ?? 8) <= 4;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !lightweight, alpha: false, powerPreference: "high-performance" });
    } catch {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    const random = seeded(20260802);
    const systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paletteColors = PALETTES.map((palette) => ({
      sky: new THREE.Color(palette.sky),
      zenith: new THREE.Color(palette.zenith),
      horizon: new THREE.Color(palette.horizon),
      fog: new THREE.Color(palette.fog),
      ground: new THREE.Color(palette.ground),
      bloom: new THREE.Color(palette.bloom),
      glow: new THREE.Color(palette.glow),
      magic: new THREE.Color(palette.magic),
    }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lightweight ? 1.15 : 1.45));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = !lightweight;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "garden-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const initialPalette = PALETTES[liveRef.current.worldIndex] ?? PALETTES[0];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialPalette.sky);
    scene.fog = new THREE.FogExp2(initialPalette.fog, 0.026);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 90);
    camera.position.set(0, 3.2, 11.7);
    scene.add(camera);

    const textureLoader = new THREE.TextureLoader();
    const backdropTextures = new Map<number, THREE.Texture>();
    const loadingBackdrops = new Set<number>();
    let sceneDisposed = false;
    // Keep the photographic plate in the opaque render pass. A transparent
    // sprite is sorted after opaque meshes and can cover the heroine even with
    // a lower renderOrder.
    const realBackdropMaterial = new THREE.SpriteMaterial({ transparent: false, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const realBackdrop = new THREE.Sprite(realBackdropMaterial);
    realBackdrop.name = "realisticWorldBackdrop";
    realBackdrop.position.set(0, 0, -60);
    realBackdrop.renderOrder = -100;
    realBackdrop.visible = false;
    camera.add(realBackdrop);
    let activeBackdropWorld = -1;

    const loadBackdrop = (worldIndex: number) => {
      const cached = backdropTextures.get(worldIndex);
      if (cached) {
        realBackdropMaterial.map = cached;
        realBackdropMaterial.needsUpdate = true;
        activeBackdropWorld = worldIndex;
        return;
      }
      if (loadingBackdrops.has(worldIndex)) return;
      loadingBackdrops.add(worldIndex);
      textureLoader.load(
        WORLD_BACKGROUNDS[worldIndex] ?? WORLD_BACKGROUNDS[0],
        (texture) => {
          if (sceneDisposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          backdropTextures.set(worldIndex, texture);
          loadingBackdrops.delete(worldIndex);
          if (liveRef.current.worldIndex === worldIndex) {
            realBackdropMaterial.map = texture;
            realBackdropMaterial.needsUpdate = true;
            realBackdrop.visible = true;
            activeBackdropWorld = worldIndex;
          }
        },
        undefined,
        () => loadingBackdrops.delete(worldIndex),
      );
    };
    loadBackdrop(liveRef.current.worldIndex);

    const skyUniforms = {
      zenithColor: { value: new THREE.Color(initialPalette.zenith) },
      skyColor: { value: new THREE.Color(initialPalette.sky) },
      horizonColor: { value: new THREE.Color(initialPalette.horizon) },
      opacity: { value: 1 },
    };
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(58, lightweight ? 20 : 32, lightweight ? 12 : 20),
      new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        transparent: true,
        fog: false,
        vertexShader: `varying float vHeight; void main(){ vHeight = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 zenithColor;
          uniform vec3 skyColor;
          uniform vec3 horizonColor;
          uniform float opacity;
          varying float vHeight;
          void main(){
            float upper = smoothstep(-0.05, 0.75, vHeight);
            float horizon = 1.0 - smoothstep(-0.16, 0.18, abs(vHeight));
            vec3 color = mix(skyColor, zenithColor, upper);
            color = mix(color, horizonColor, horizon * 0.78);
            gl_FragColor = vec4(color, opacity);
          }
        `,
      }),
    );
    skyDome.renderOrder = -20;
    scene.add(skyDome);

    const glowTexture = makeGlowTexture();
    const horizonGlowMaterial = new THREE.SpriteMaterial({ color: initialPalette.horizon, map: glowTexture, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false });
    const horizonGlow = new THREE.Sprite(horizonGlowMaterial);
    horizonGlow.position.set(0, 2.7, -22);
    horizonGlow.scale.set(34, 15, 1);
    scene.add(horizonGlow);

    const farBackdrop = new THREE.Group();
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: initialPalette.ground, roughness: 1, flatShading: true });
    const mountainGlowMaterial = new THREE.MeshBasicMaterial({ color: initialPalette.horizon, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let index = 0; index < (lightweight ? 7 : 11); index += 1) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(4.1 + random() * 2.5, 5.2 + random() * 3.8, 7), mountainMaterial);
      peak.position.set(-25 + index * 5 + (random() - 0.5) * 2, -2.35, -24 - random() * 6);
      peak.rotation.y = random() * Math.PI;
      peak.scale.z = 0.58 + random() * 0.3;
      farBackdrop.add(peak);
      if (!lightweight && index % 2 === 0) {
        const rim = new THREE.Mesh(new THREE.ConeGeometry(4.25 + random() * 1.35, 5.4 + random() * 2.4, 7, 1, true), mountainGlowMaterial);
        rim.position.copy(peak.position);
        rim.position.z += 0.08;
        rim.rotation.copy(peak.rotation);
        rim.scale.copy(peak.scale);
        farBackdrop.add(rim);
      }
    }
    scene.add(farBackdrop);

    const mistMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: initialPalette.fog, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    const groundMist = new THREE.Group();
    for (let index = 0; index < (lightweight ? 5 : 9); index += 1) {
      const mist = new THREE.Sprite(mistMaterial);
      mist.position.set(-13 + index * 3.3 + random() * 1.8, -0.2 + random() * 1.1, -7 - random() * 12);
      mist.scale.set(8 + random() * 5, 2 + random() * 1.8, 1);
      groundMist.add(mist);
    }
    scene.add(groundMist);

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
      new THREE.SphereGeometry(1.55, 42, 28),
      new THREE.MeshBasicMaterial({ color: 0xffeafa }),
    );
    moon.position.set(-7.1, 7.05, -12.2);
    scene.add(moon);
    const moonHalo = new THREE.Mesh(
      new THREE.SphereGeometry(1.95, 30, 20),
      new THREE.MeshBasicMaterial({ color: 0xf0b7ff, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
    );
    moonHalo.position.copy(moon.position);
    scene.add(moonHalo);

    const starCount = lightweight ? 380 : 680;
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
    const blossomWorld = new THREE.Group();
    blossomWorld.name = "blossomWorld";
    garden.add(blossomWorld);
    const tree = new THREE.Group();
    tree.position.set(-6.25, -0.05, -4.8);
    tree.scale.setScalar(0.58);
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
    blossomWorld.add(tree);

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
    blossomWorld.add(flowerGroup);

    const blossomGate = new THREE.Group();
    blossomGate.position.set(4.9, 0.18, -3.4);
    const gateMaterial = new THREE.MeshStandardMaterial({ color: 0xb95c82, roughness: 0.72, emissive: 0x4f1e4a, emissiveIntensity: 0.38 });
    [-1, 1].forEach((side) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 3.15, 10), gateMaterial);
      pillar.position.set(side * 1.32, 1.45, 0);
      blossomGate.add(pillar);
      const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffd28a, transparent: true, opacity: 0.66, blending: THREE.AdditiveBlending, depthWrite: false }));
      lantern.position.set(side * 1.32, 2.2, 0.12);
      lantern.scale.set(1.25, 1.25, 1);
      blossomGate.add(lantern);
    });
    const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.26, 0.36), gateMaterial);
    gateBeam.position.y = 2.9;
    blossomGate.add(gateBeam);
    const gateCrown = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.18, 0.5), gateMaterial);
    gateCrown.position.y = 3.28;
    blossomGate.add(gateCrown);
    blossomWorld.add(blossomGate);

    for (let index = 0; index < (lightweight ? 3 : 6); index += 1) {
      const sapling = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.8 + random(), 8), trunkMaterial);
      trunk.position.y = 0.9;
      sapling.add(trunk);
      for (let crownIndex = 0; crownIndex < 4; crownIndex += 1) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 + random() * 0.2, 1), blossomMaterial);
        crown.position.set((crownIndex - 1.5) * 0.3, 1.8 + Math.sin(crownIndex) * 0.28, (random() - 0.5) * 0.35);
        sapling.add(crown);
      }
      sapling.position.set(-8 + index * 3.1, 0, -6.4 - random() * 2.6);
      sapling.scale.setScalar(0.7 + random() * 0.35);
      blossomWorld.add(sapling);
    }

    const blossomPetalCount = lightweight ? 34 : 68;
    const blossomPetalPositions = new Float32Array(blossomPetalCount * 3);
    for (let index = 0; index < blossomPetalCount; index += 1) {
      blossomPetalPositions[index * 3] = (random() - 0.5) * 19;
      blossomPetalPositions[index * 3 + 1] = 0.8 + random() * 6.2;
      blossomPetalPositions[index * 3 + 2] = -2 - random() * 11;
    }
    const blossomPetalGeometry = new THREE.BufferGeometry();
    blossomPetalGeometry.setAttribute("position", new THREE.BufferAttribute(blossomPetalPositions, 3));
    const blossomPetals = new THREE.Points(blossomPetalGeometry, new THREE.PointsMaterial({ color: 0xffc0dd, size: 0.105, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending }));
    blossomWorld.add(blossomPetals);

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

    const moonLakeWorld = new THREE.Group();
    moonLakeWorld.name = "moonLakeWorld";
    const moonLakeMaterial = new THREE.MeshPhysicalMaterial({ color: 0x526fc8, transparent: true, opacity: 0.7, roughness: 0.08, metalness: 0.08, clearcoat: 1, emissive: 0x1a2c66, emissiveIntensity: 0.38 });
    const moonLake = new THREE.Mesh(new THREE.CircleGeometry(7.7, lightweight ? 40 : 72), moonLakeMaterial);
    moonLake.rotation.x = -Math.PI / 2;
    moonLake.position.set(0.7, 0.24, -1.6);
    moonLakeWorld.add(moonLake);
    const lakeRippleMaterial = new THREE.MeshBasicMaterial({ color: 0xb8e8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    const lakeRipples: THREE.Mesh[] = [];
    [1.6, 2.9, 4.4, 6].forEach((radius) => {
      const ripple = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 6, lightweight ? 48 : 84), lakeRippleMaterial);
      ripple.rotation.x = Math.PI / 2;
      ripple.position.copy(moonLake.position);
      ripple.position.y += 0.025;
      moonLakeWorld.add(ripple);
      lakeRipples.push(ripple);
    });
    const moonReflection = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xd6e5ff, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending, depthWrite: false }));
    moonReflection.position.set(-2.9, 0.42, -3.9);
    moonReflection.scale.set(4.2, 1.15, 1);
    moonLakeWorld.add(moonReflection);

    const bridge = new THREE.Group();
    bridge.position.set(1.35, 0.5, 2.3);
    bridge.rotation.y = -0.08;
    const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0xd19ab0, roughness: 0.74, emissive: 0x452449, emissiveIntensity: 0.24 });
    for (let index = 0; index < 10; index += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 1.7), bridgeMaterial);
      const x = (index - 4.5) * 0.6;
      plank.position.set(x, Math.cos((x / 3) * Math.PI / 2) * 0.9, 0);
      plank.rotation.z = -Math.sin((x / 3) * Math.PI / 2) * 0.16;
      bridge.add(plank);
    }
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 5; index += 1) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.72, 7), bridgeMaterial);
        const x = (index - 2) * 1.22;
        post.position.set(x, 0.45 + Math.cos((x / 3) * Math.PI / 2) * 0.9, side * 0.72);
        bridge.add(post);
      }
    });
    moonLakeWorld.add(bridge);
    garden.add(moonLakeWorld);

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
    const cloudIslandMaterial = new THREE.MeshStandardMaterial({ color: 0x6ea59d, roughness: 0.92, flatShading: true, emissive: 0x173e4f, emissiveIntensity: 0.28 });
    const cloudLawnMaterial = new THREE.MeshStandardMaterial({ color: 0x9ed8a7, roughness: 0.86, emissive: 0x285845, emissiveIntensity: 0.2 });
    const skyPalace = new THREE.Group();
    const islandLayout = [[0, -7, 3.4], [-6.5, -10, 1.4], [6.8, -11.5, 1.2], [-9.5, -16, 0.9], [9.8, -17, 0.95]];
    islandLayout.slice(0, lightweight ? 3 : 5).forEach(([x, z, scale], index) => {
      const floatingIsland = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(scale, scale * 0.16, scale * 1.4, 7, 2), cloudIslandMaterial);
      rock.position.y = -scale * 0.58;
      floatingIsland.add(rock);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(scale * 1.02, scale * 0.96, 0.24, 28), cloudLawnMaterial);
      cap.position.y = 0.08;
      floatingIsland.add(cap);
      floatingIsland.position.set(x, 1.3 + index * 0.7, z);
      skyPalace.add(floatingIsland);
    });
    const palaceMaterial = new THREE.MeshStandardMaterial({ color: 0xffe5b3, roughness: 0.48, emissive: 0x795735, emissiveIntensity: 0.32 });
    [-1.5, 0, 1.5].forEach((x, index) => {
      const palaceTower = new THREE.Mesh(new THREE.CylinderGeometry(0.42 + index % 2 * 0.12, 0.58, 2.8 + (index === 1 ? 1.5 : 0), 10), palaceMaterial);
      palaceTower.position.set(x, 4.2 + (index === 1 ? 0.75 : 0), -7);
      skyPalace.add(palaceTower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.35, 10), new THREE.MeshStandardMaterial({ color: index === 1 ? 0xffa6ca : 0x83c8e8, roughness: 0.58, emissive: 0x372d6b, emissiveIntensity: 0.18 }));
      roof.position.set(x, 6.22 + (index === 1 ? 1.5 : 0), -7);
      skyPalace.add(roof);
    });
    cloudWorld.add(skyPalace);

    const cloudSeaMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xc7f5ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
    const cloudSea = new THREE.Group();
    for (let index = 0; index < (lightweight ? 7 : 13); index += 1) {
      const bank = new THREE.Sprite(cloudSeaMaterial);
      bank.position.set(-14 + index * 2.4, -0.2 + random() * 1.2, -8 - random() * 11);
      bank.scale.set(7 + random() * 5, 2.1 + random() * 1.2, 1);
      cloudSea.add(bank);
    }
    cloudWorld.add(cloudSea);
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
    const templeMaterial = new THREE.MeshStandardMaterial({ color: 0x285f68, roughness: 0.52, metalness: 0.1, emissive: 0x123f50, emissiveIntensity: 0.52 });
    const templeTrimMaterial = new THREE.MeshStandardMaterial({ color: 0x76e4cf, roughness: 0.32, metalness: 0.24, emissive: 0x267e7b, emissiveIntensity: 0.72 });
    const auroraTemple = new THREE.Group();
    for (let index = 0; index < 4; index += 1) {
      const step = new THREE.Mesh(new THREE.CylinderGeometry(5.2 - index * 0.65, 5.45 - index * 0.62, 0.45, 12), index % 2 ? templeTrimMaterial : templeMaterial);
      step.position.set(0, -1.15 + index * 0.38, -6.2);
      auroraTemple.add(step);
    }
    const portal = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 10, 72), templeTrimMaterial);
    portal.position.set(0, 2.4, -7.4);
    auroraTemple.add(portal);
    const portalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0x77f3d4, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }));
    portalGlow.position.set(0, 2.4, -7.55);
    portalGlow.scale.set(6.6, 6.6, 1);
    auroraTemple.add(portalGlow);
    for (let index = 0; index < (lightweight ? 4 : 8); index += 1) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 + random() * 0.25, 0), templeTrimMaterial);
      const angle = (index / (lightweight ? 4 : 8)) * Math.PI * 2;
      crystal.position.set(Math.cos(angle) * 4.2, 0.3 + random() * 0.55, -6.2 + Math.sin(angle) * 2.2);
      crystal.scale.y = 1.6 + random();
      auroraTemple.add(crystal);
    }
    auroraWorld.add(auroraTemple);
    scene.add(auroraWorld);

    const heroine = new THREE.Group();
    heroine.position.set(-3.35, -0.08, 1.75);
    heroine.scale.setScalar(1.02);
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
    bunny.position.set(-1.7, -0.12, 2.05);
    bunny.scale.setScalar(0.82);
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
    wisp.position.set(1.25, 1.78, 1.2);
    wisp.scale.setScalar(0.54);
    scene.add(wisp);
    const wispMaterial = new THREE.MeshPhysicalMaterial({ color: initialPalette.bloom, emissive: initialPalette.bloom, emissiveIntensity: 0.82, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.16, transparent: true, opacity: 0.86 });
    const guardianColor = new THREE.Color(0x8a3f88);
    const guardianEmissive = new THREE.Color(0xff477e);
    const wispCore = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24), wispMaterial);
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

    const rhythmRings = new THREE.Group();
    [0.92, 1.12, 1.34].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.018 + index * 0.006, 7, 72),
        new THREE.MeshBasicMaterial({ color: index === 1 ? 0xffd86f : 0x77e7dc, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending }),
      );
      ring.rotation.x = Math.PI / 2;
      rhythmRings.add(ring);
    });
    wisp.add(rhythmRings);

    const guardianCrown = new THREE.Group();
    for (let index = 0; index < 5; index += 1) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.55, 7),
        new THREE.MeshStandardMaterial({ color: 0xff668f, emissive: 0x8d234e, emissiveIntensity: 0.9, roughness: 0.34 }),
      );
      const angle = (index / 5) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.58, 0.56, Math.sin(angle) * 0.58);
      spike.rotation.z = Math.cos(angle) * 0.45;
      guardianCrown.add(spike);
    }
    wisp.add(guardianCrown);

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
    // The HTML typing console is clearer and accessible; keeping this duplicate hidden
    // opens the center of the scene for the world art and character reactions.
    wordSprite.visible = false;
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

    const burstCount = lightweight ? 48 : 86;
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

    const fireflyCount = lightweight ? 52 : 92;
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

    const atmosphereMoteCount = lightweight ? 46 : 94;
    const atmosphereMotePositions = new Float32Array(atmosphereMoteCount * 3);
    for (let index = 0; index < atmosphereMoteCount; index += 1) {
      atmosphereMotePositions[index * 3] = (random() - 0.5) * 22;
      atmosphereMotePositions[index * 3 + 1] = random() * 8 - 0.6;
      atmosphereMotePositions[index * 3 + 2] = 4 - random() * 20;
    }
    const atmosphereMoteGeometry = new THREE.BufferGeometry();
    atmosphereMoteGeometry.setAttribute("position", new THREE.BufferAttribute(atmosphereMotePositions, 3));
    const atmosphereMoteMaterial = new THREE.PointsMaterial({ color: initialPalette.magic, size: lightweight ? 0.075 : 0.095, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending, depthWrite: false });
    const atmosphereMotes = new THREE.Points(atmosphereMoteGeometry, atmosphereMoteMaterial);
    scene.add(atmosphereMotes);

    const rhythmSkyRings = new THREE.Group();
    [1.5, 2.25, 3.05].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.025 + index * 0.008, 7, lightweight ? 48 : 80),
        new THREE.MeshBasicMaterial({ color: index === 1 ? 0xffdc82 : 0x82f3ea, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      rhythmSkyRings.add(ring);
    });
    rhythmSkyRings.position.set(5.9, 4.4, -8.5);
    scene.add(rhythmSkyRings);

    const guardianStorm = new THREE.Group();
    const stormCloudMaterial = new THREE.MeshStandardMaterial({ color: 0x352449, roughness: 0.96, emissive: 0x34142f, emissiveIntensity: 0.56, transparent: true, opacity: 0.86 });
    for (let index = 0; index < (lightweight ? 3 : 6); index += 1) {
      const stormCloud = makeCloudPuff(stormCloudMaterial, random, 0.85 + random() * 0.55);
      stormCloud.position.set(-7 + index * 2.8, 5.7 + Math.sin(index) * 0.8, -9 - random() * 4);
      guardianStorm.add(stormCloud);
    }
    const guardianPortalMaterial = new THREE.MeshBasicMaterial({ color: 0xff5d98, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false });
    const guardianPortal = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.12, 8, lightweight ? 54 : 88), guardianPortalMaterial);
    guardianPortal.position.set(0, 3.1, -10.5);
    guardianStorm.add(guardianPortal);
    const lightningGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.8, 6.1, -8.7),
      new THREE.Vector3(-4.2, 4.9, -8.5),
      new THREE.Vector3(-4.55, 4.2, -8.2),
      new THREE.Vector3(-3.95, 3.2, -8),
    ]);
    const lightning = new THREE.Line(lightningGeometry, new THREE.LineBasicMaterial({ color: 0xffd9f4, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending }));
    guardianStorm.add(lightning);
    scene.add(guardianStorm);

    const pointerTarget = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    const cameraTarget = new THREE.Vector3(0, 1.05, -1.8);
    const bloomScaleTarget = new THREE.Vector3(1, 1, 1);
    let frame = 0;
    let lastFrameTime = performance.now();
    let elapsedTime = 0;
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
      const backdropDistance = Math.abs(realBackdrop.position.z);
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * backdropDistance;
      const visibleWidth = visibleHeight * camera.aspect;
      const imageAspect = 1672 / 941;
      if (visibleWidth / visibleHeight > imageAspect) {
        realBackdrop.scale.set(visibleWidth * 1.02, (visibleWidth / imageAspect) * 1.02, 1);
      } else {
        realBackdrop.scale.set(visibleHeight * imageAspect * 1.02, visibleHeight * 1.02, 1);
      }
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
      const now = performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      elapsedTime += delta;
      const time = elapsedTime;
      const live = liveRef.current;
      const motionOff = live.reducedMotion || systemReducedMotion;
      const palette = paletteColors[live.worldIndex] ?? paletteColors[0];
      if (activeBackdropWorld !== live.worldIndex) loadBackdrop(live.worldIndex);
      const backdropReady = backdropTextures.has(live.worldIndex) && activeBackdropWorld === live.worldIndex;
      realBackdrop.visible = backdropReady;
      skyUniforms.opacity.value = THREE.MathUtils.lerp(skyUniforms.opacity.value, backdropReady ? 0 : 1, 0.055);
      const realisticScene = backdropReady;

      (scene.background as THREE.Color).lerp(palette.sky, 0.025);
      const fog = scene.fog as THREE.FogExp2;
      fog.color.lerp(palette.fog, 0.025);
      fog.density = THREE.MathUtils.lerp(fog.density, live.mission === "guardian" ? 0.034 : live.worldIndex === 2 ? 0.021 : 0.026, 0.025);
      skyUniforms.zenithColor.value.lerp(palette.zenith, 0.025);
      skyUniforms.skyColor.value.lerp(palette.sky, 0.025);
      skyUniforms.horizonColor.value.lerp(live.mission === "guardian" ? guardianEmissive : palette.horizon, 0.025);
      horizonGlowMaterial.color.lerp(live.mission === "guardian" ? guardianEmissive : palette.horizon, 0.035);
      horizonGlowMaterial.opacity = THREE.MathUtils.lerp(horizonGlowMaterial.opacity, (realisticScene ? 0.12 : 0.38) + Math.min(0.18, live.combo * 0.006) + pulse * 0.14, 0.05);
      mountainMaterial.color.lerp(palette.ground, 0.025);
      mountainGlowMaterial.color.lerp(palette.horizon, 0.025);
      mistMaterial.color.lerp(palette.fog, 0.025);
      atmosphereMoteMaterial.color.lerp(palette.magic, 0.035);
      earthMaterial.color.lerp(palette.ground, 0.02);
      blossomMaterial.color.lerp(palette.bloom, 0.03);
      blossomMaterial.emissive.lerp(palette.bloom, 0.03);
      wispMaterial.color.lerp(live.mission === "guardian" ? guardianColor : palette.bloom, 0.04);
      wispMaterial.emissive.lerp(live.mission === "guardian" ? guardianEmissive : palette.bloom, 0.04);
      magicLight.color.lerp(palette.magic, 0.04);
      beamMaterial.color.lerp(palette.magic, 0.05);
      burstMaterial.color.lerp(palette.glow, 0.05);
      cosmeticTarget.set(live.cosmeticColor);
      dressMaterial.color.lerp(cosmeticTarget, 0.05);
      island.visible = !realisticScene;
      lawn.visible = !realisticScene;
      blossomWorld.visible = !realisticScene && live.worldIndex === 0;
      moonLakeWorld.visible = !realisticScene && live.worldIndex === 1;
      tree.visible = !realisticScene && live.worldIndex === 0;
      pond.visible = !realisticScene && live.worldIndex === 0;
      pondRing.visible = !realisticScene && live.worldIndex === 0;
      crystalWorld.visible = !realisticScene && (live.worldIndex === 1 || live.worldIndex === 3);
      cloudWorld.visible = !realisticScene && live.worldIndex === 2;
      auroraWorld.visible = !realisticScene && live.worldIndex === 3;
      farBackdrop.visible = !realisticScene && live.worldIndex !== 2;
      moon.visible = !realisticScene && live.worldIndex <= 1;
      moonHalo.visible = moon.visible;
      backgroundWisps.forEach((mote) => { mote.visible = !realisticScene; });
      fireflies.visible = live.mission === "firefly";
      rhythmRings.visible = live.mission === "rhythm";
      rhythmSkyRings.visible = live.mission === "rhythm";
      guardianCrown.visible = live.mission === "guardian";
      guardianStorm.visible = live.mission === "guardian";

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
      const bloomScale = live.mission === "bloom" ? 0.82 + Math.min(0.32, live.completedWords * 0.025) : 1;
      bloomScaleTarget.setScalar(bloomScale);
      flowerGroup.scale.lerp(bloomScaleTarget, 0.035);
      guardianCrown.rotation.y += delta * (0.45 + live.combo * 0.01);
      rhythmRings.children.forEach((ring, index) => {
        const beat = 1 + Math.sin(time * Math.PI * 2 + index * 0.6) * 0.1;
        ring.scale.setScalar(beat);
      });
      rhythmSkyRings.children.forEach((ring, index) => {
        const beat = 1 + Math.sin(time * Math.PI * 1.35 - index * 0.68) * (motionOff ? 0 : 0.08);
        ring.scale.setScalar(beat);
        (ring as THREE.Mesh).rotation.z = time * (index % 2 ? -0.025 : 0.018);
      });
      lakeRipples.forEach((ripple, index) => {
        const breathe = 1 + Math.sin(time * 0.72 + index * 0.8) * (motionOff ? 0 : 0.025);
        ripple.scale.setScalar(breathe);
      });
      atmosphereMoteMaterial.opacity = 0.38 + Math.min(0.24, live.combo * 0.009) + pulse * 0.16;
      moonLakeMaterial.emissiveIntensity = 0.34 + Math.min(0.26, live.combo * 0.01);
      guardianPortalMaterial.opacity = live.mission === "guardian" ? 0.3 + Math.sin(time * 1.4) * (motionOff ? 0 : 0.08) : 0;
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
        heroine.position.y = -0.08 + Math.sin(time * 1.8) * 0.035;
        heroine.rotation.y = Math.sin(time * 0.42) * 0.04;
        bunny.position.y = -0.12 + Math.abs(Math.sin(time * 2.15)) * 0.055;
        flowerGroup.rotation.y = Math.sin(time * 0.12) * 0.01;
        blossomClouds.forEach((cloud, index) => { cloud.rotation.y += delta * (0.025 + index * 0.001); });
        blossomPetals.rotation.y += delta * 0.025;
        blossomPetals.position.y = Math.sin(time * 0.42) * 0.28;
        backgroundWisps.forEach((mote, index) => {
          mote.position.y += Math.sin(time * (0.55 + index * 0.07) + index) * 0.0008;
          mote.rotation.z += delta * (0.16 + index * 0.04);
        });
        fireflies.rotation.y += delta * (live.mission === "firefly" ? 0.16 : 0.012);
        fireflies.position.y = Math.sin(time * (live.mission === "firefly" ? 1.4 : 0.35)) * 0.18;
        atmosphereMotes.rotation.y += delta * (0.008 + Math.min(0.025, live.combo * 0.0008));
        atmosphereMotes.position.y = Math.sin(time * 0.24) * 0.12;
        pond.material.opacity = 0.62 + Math.sin(time * 0.9) * 0.05;
        moonLakeMaterial.opacity = 0.66 + Math.sin(time * 0.62) * 0.045;
        moonReflection.scale.x = 4.2 + Math.sin(time * 0.74) * 0.38;
        cloudWorld.rotation.y = Math.sin(time * 0.12) * 0.035;
        skyPalace.position.y = Math.sin(time * 0.42) * 0.14;
        auroraWorld.position.y = Math.sin(time * 0.32) * 0.13;
        portal.rotation.z += delta * 0.045;
        guardianStorm.position.x = Math.sin(time * 0.16) * 0.42;
        guardianPortal.rotation.z -= delta * 0.11;
        (lightning.material as THREE.LineBasicMaterial).opacity = 0.25 + Math.max(0, Math.sin(time * 6.2)) * 0.42;
        groundMist.position.x = Math.sin(time * 0.08) * 0.45;
      }

      pointerCurrent.lerp(pointerTarget, motionOff ? 0 : 0.035);
      realBackdrop.position.x = THREE.MathUtils.lerp(realBackdrop.position.x, motionOff ? 0 : -pointerCurrent.x * 0.42, 0.045);
      realBackdrop.position.y = THREE.MathUtils.lerp(realBackdrop.position.y, motionOff ? 0 : pointerCurrent.y * 0.2, 0.045);
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
      sceneDisposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeScene(scene);
      backdropTextures.forEach((texture) => {
        if (texture !== realBackdropMaterial.map) texture.dispose();
      });
      labelTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fallback]);

  return (
    <div className={`garden-stage world-scene-${props.worldIndex} ${fallback ? "garden-stage-fallback" : ""}`} aria-hidden="true">
      <div ref={mountRef} className="garden-mount" />
      {fallback && <><div className="fallback-moon" /><div className="fallback-hills"><i /><i /><i /></div><div className="fallback-garden">✦　❀　✧　❀　✦</div></>}
    </div>
  );
}

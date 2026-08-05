"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as pc from "playcanvas";
import {
  ENDLESS_BIOMES,
  EXPLORATION_ENCOUNTERS,
  getCompletedEncounterCount,
  getEndlessBiome,
  getEndlessEncounter,
  getExplorationEncounter,
  getWorldDiscovery,
  type ExplorationEncounterId,
  type WorldDiscovery,
  type WorldDiscoveryId,
} from "./exploration-engine";
import { BLOSSOM_TRAIL_LEVEL, type Point3 } from "./level-schema";

type ExplorationMode = "explore" | "encounter" | "paused" | "complete";
type TypingFeedback = "correct" | "wrong" | "word" | null;
type MoveKey = "forward" | "back" | "left" | "right" | "jump";

export type ExplorationWorldStatus = {
  distance: number;
  zone: number;
  biome: string;
  movingByClick: boolean;
  quality: "精细" | "流畅";
};

type PlayCanvasWorld3DProps = {
  mode: ExplorationMode;
  completedWords: number;
  endlessMode: boolean;
  endlessWords: number;
  reducedMotion: boolean;
  cosmeticColor: string;
  feedback: TypingFeedback;
  discoveredIds: string[];
  onEncounter: (id: ExplorationEncounterId) => void;
  onDiscover: (discovery: WorldDiscovery) => void;
  onMovementAudio: (kind: "step" | "jump" | "land") => void;
  onCheckpoint: (message: string) => void;
  onWorldStatus: (status: ExplorationWorldStatus) => void;
};

type RuntimeInteraction = {
  encounter: ExplorationEncounterId | null;
  discovery: WorldDiscoveryId | null;
};

type RuntimeBridge = {
  interact: () => void;
  reset: () => void;
};

const KEY_TO_MOVE: Record<string, MoveKey | undefined> = {
  ArrowUp: "forward", w: "forward", W: "forward",
  ArrowDown: "back", s: "back", S: "back",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  " ": "jump",
};

function color(hex: string) {
  return new pc.Color().fromString(hex);
}

function colorNumber(value: number) {
  return `#${Math.max(0, value).toString(16).padStart(6, "0").slice(-6)}`;
}

function material(hex: string, options: { roughness?: number; metalness?: number; emissive?: string; opacity?: number } = {}) {
  const result = new pc.StandardMaterial();
  result.diffuse = color(hex);
  result.gloss = 1 - (options.roughness ?? 0.92);
  result.metalness = options.metalness ?? 0;
  if (options.emissive) {
    result.emissive = color(options.emissive);
    result.emissiveIntensity = 0.5;
  }
  if (options.opacity !== undefined) {
    result.opacity = options.opacity;
    result.blendType = pc.BLEND_NORMAL;
    result.depthWrite = options.opacity > 0.85;
  }
  result.update();
  return result;
}

function primitive(
  parent: pc.Entity,
  name: string,
  type: "box" | "capsule" | "cone" | "cylinder" | "plane" | "sphere",
  position: Point3,
  scale: Point3,
  surface: pc.Material,
  shadows = true,
) {
  const entity = new pc.Entity(name);
  entity.setLocalPosition(...position);
  entity.setLocalScale(...scale);
  entity.addComponent("render", { type, material: surface, castShadows: shadows, receiveShadows: true });
  parent.addChild(entity);
  return entity;
}

function seeded(index: number) {
  const value = Math.sin(index * 91.731 + 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function makeTree(parent: pc.Entity, index: number, x: number, z: number, foliage: pc.Material, trunk: pc.Material) {
  const tree = new pc.Entity(`Tree-${index}`);
  tree.setLocalPosition(x, 0, z);
  const scale = 0.75 + seeded(index + 4) * 0.72;
  primitive(tree, "Trunk", "cylinder", [0, 1.25 * scale, 0], [0.22 * scale, 1.25 * scale, 0.22 * scale], trunk);
  primitive(tree, "Crown", "sphere", [0, 2.55 * scale, 0], [1.02 * scale, 1.18 * scale, 0.9 * scale], foliage);
  primitive(tree, "CrownSide", "sphere", [0.48 * scale, 2.35 * scale, 0.06], [0.68 * scale, 0.74 * scale, 0.65 * scale], foliage);
  primitive(tree, "CrownTop", "sphere", [-0.28 * scale, 3.05 * scale, -0.08], [0.66 * scale, 0.7 * scale, 0.62 * scale], foliage);
  parent.addChild(tree);
  return tree;
}

function makeEncounterMarker(parent: pc.Entity, id: string, position: Point3, stone: pc.Material, accent: pc.Material) {
  const marker = new pc.Entity(`Encounter-${id}`);
  marker.setLocalPosition(...position);
  primitive(marker, "StoneBase", "cylinder", [0, 0.3, 0], [0.72, 0.3, 0.72], stone);
  primitive(marker, "Post", "cylinder", [0, 1.08, 0], [0.12, 0.78, 0.12], stone);
  const signal = primitive(marker, "Signal", "sphere", [0, 1.9, 0], [0.28, 0.28, 0.28], accent, false);
  signal.addComponent("light", { type: "omni", color: color("#d2bd94"), intensity: 0.6, range: 4, castShadows: false });
  parent.addChild(marker);
  return marker;
}

function makeFallbackBichon() {
  const root = new pc.Entity("FallbackBichon");
  const coat = material("#eee9df", { roughness: 1 });
  const shadowCoat = material("#cfc7ba", { roughness: 1 });
  const dark = material("#171719", { roughness: 0.35 });
  primitive(root, "Body", "capsule", [0, 0, 0], [0.36, 0.55, 0.36], coat).setLocalEulerAngles(90, 0, 0);
  primitive(root, "Head", "sphere", [0, 0.52, 0.42], [0.35, 0.34, 0.32], coat);
  primitive(root, "Muzzle", "sphere", [0, 0.45, 0.7], [0.18, 0.12, 0.15], shadowCoat);
  primitive(root, "Nose", "sphere", [0, 0.49, 0.82], [0.06, 0.045, 0.045], dark, false);
  for (const x of [-0.13, 0.13]) primitive(root, x < 0 ? "EyeL" : "EyeR", "sphere", [x, 0.59, 0.69], [0.05, 0.055, 0.04], dark, false);
  for (const [x, z] of [[-0.24, 0.27], [0.24, 0.27], [-0.24, -0.34], [0.24, -0.34]] as const) {
    primitive(root, "Leg", "capsule", [x, -0.36, z], [0.095, 0.24, 0.095], coat);
  }
  return root;
}

function activeEncounter(live: PlayCanvasWorld3DProps) {
  return live.endlessMode ? getEndlessEncounter(live.endlessWords) : getExplorationEncounter(live.completedWords);
}

export function PlayCanvasWorld3D(props: PlayCanvasWorld3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(props);
  const moveRef = useRef<Record<MoveKey, boolean>>({ forward: false, back: false, left: false, right: false, jump: false });
  const runtimeRef = useRef<RuntimeBridge | null>(null);
  const interactionRef = useRef<RuntimeInteraction>({ encounter: null, discovery: null });
  const [interaction, setInteraction] = useState<RuntimeInteraction>({ encounter: null, discovery: null });
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => { liveRef.current = props; }, [props]);

  const updateInteraction = useCallback((next: RuntimeInteraction) => {
    const current = interactionRef.current;
    if (current.encounter === next.encounter && current.discovery === next.discovery) return;
    interactionRef.current = next;
    setInteraction(next);
  }, []);

  const interact = useCallback(() => runtimeRef.current?.interact(), []);
  const setMove = useCallback((key: MoveKey, active: boolean) => { moveRef.current[key] = active; }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fallback) return;
    let destroyed = false;
    let app: pc.Application;
    try {
      app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        touch: "ontouchstart" in window ? new pc.TouchDevice(canvas) : undefined,
        keyboard: new pc.Keyboard(window),
        graphicsDeviceOptions: { antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false },
      });
    } catch {
      queueMicrotask(() => setFallback(true));
      return;
    }

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const lowMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4;
    const quality: ExplorationWorldStatus["quality"] = coarsePointer || lowMemory ? "流畅" : "精细";
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, quality === "精细" ? 1.75 : 1.1);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.scene.ambientLight = color("#82958a");
    app.scene.exposure = 1.08;
    app.scene.fog.type = pc.FOG_EXP2;
    app.scene.fog.color = color(BLOSSOM_TRAIL_LEVEL.palette.fog);
    app.scene.fog.density = 0.012;

    const camera = new pc.Entity("PlayerCamera");
    camera.addComponent("camera", { clearColor: new pc.Color(0, 0, 0, 0), fov: 48, nearClip: 0.08, farClip: 130 });
    app.root.addChild(camera);

    const sunlight = new pc.Entity("MorningSun");
    sunlight.addComponent("light", {
      type: "directional",
      color: color("#fff1d6"),
      intensity: 1.55,
      castShadows: quality === "精细",
      shadowResolution: quality === "精细" ? 2048 : 1024,
      shadowBias: 0.18,
      normalOffsetBias: 0.08,
    });
    sunlight.setEulerAngles(52, -28, 18);
    app.root.addChild(sunlight);

    const ground = material(BLOSSOM_TRAIL_LEVEL.palette.ground, { roughness: 1 });
    const path = material(BLOSSOM_TRAIL_LEVEL.palette.path, { roughness: 0.96 });
    const stone = material("#77776f", { roughness: 0.98 });
    const trunk = material("#594a3b", { roughness: 1 });
    const leaves = material(BLOSSOM_TRAIL_LEVEL.palette.foliage, { roughness: 1 });
    const accent = material(BLOSSOM_TRAIL_LEVEL.palette.accent, { roughness: 0.62, emissive: "#5d4c35" });
    const discoverySurface = material("#a9b9a5", { roughness: 0.75, emissive: "#293f32" });

    const storyRoot = new pc.Entity("StoryLevel-blossom-trail-pc");
    app.root.addChild(storyRoot);
    primitive(storyRoot, "Ground", "box", [0, -0.18, -12], [20, 0.18, 40], ground, false);
    for (let index = 0; index < 20; index += 1) {
      const z = 5.2 - index * 1.55;
      const x = Math.sin(index * 0.48) * 0.36;
      const slab = primitive(storyRoot, `Path-${index}`, "box", [x, 0.015, z], [3.1, 0.045, 1.7], path, false);
      slab.setLocalEulerAngles(0, Math.cos(index * 0.51) * 2.7, 0);
    }
    const treeCount = quality === "精细" ? 36 : 22;
    for (let index = 0; index < treeCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (4.6 + seeded(index) * 4.2);
      const z = 6 - seeded(index + 30) * 38;
      makeTree(storyRoot, index, x, z, leaves, trunk);
    }
    for (let index = 0; index < 22; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      primitive(storyRoot, `Rock-${index}`, "sphere", [side * (3.8 + seeded(index + 80) * 5.2), 0.12, 4 - seeded(index + 100) * 36], [0.28 + seeded(index) * 0.32, 0.17, 0.35], stone, false);
    }

    const encounterEntities = new Map<ExplorationEncounterId, pc.Entity>();
    BLOSSOM_TRAIL_LEVEL.encounters.forEach((node) => {
      encounterEntities.set(node.id, makeEncounterMarker(storyRoot, node.id, node.position, stone, accent));
    });
    const discoveryEntities = new Map<WorldDiscoveryId, pc.Entity>();
    BLOSSOM_TRAIL_LEVEL.discoveries.forEach((node) => {
      const marker = new pc.Entity(`Discovery-${node.id}`);
      marker.setLocalPosition(node.position[0], node.position[1], node.position[2]);
      primitive(marker, "Marker", "sphere", [0, 0.3, 0], [0.2, 0.2, 0.2], discoverySurface, false);
      storyRoot.addChild(marker);
      discoveryEntities.set(node.id, marker);
    });

    const endlessRoot = new pc.Entity("EndlessLevel-streamed-chunks");
    app.root.addChild(endlessRoot);
    const chunks: pc.Entity[] = [];
    for (let index = 0; index < BLOSSOM_TRAIL_LEVEL.endless.visibleChunks; index += 1) {
      const chunk = new pc.Entity(`Chunk-${index}`);
      chunk.setLocalPosition(0, 0, 6 - index * BLOSSOM_TRAIL_LEVEL.endless.chunkLength);
      const biome = ENDLESS_BIOMES[index % ENDLESS_BIOMES.length];
      const chunkGround = material(colorNumber(biome.grass), { roughness: 1 });
      const chunkFoliage = material(colorNumber(biome.accent), { roughness: 1 });
      primitive(chunk, "Terrain", "box", [0, -0.18, 0], [20, 0.18, BLOSSOM_TRAIL_LEVEL.endless.chunkLength], chunkGround, false);
      for (let pathIndex = 0; pathIndex < 9; pathIndex += 1) {
        primitive(chunk, `Trail-${pathIndex}`, "box", [Math.sin((index + pathIndex) * 0.6) * 0.35, 0.015, 10 - pathIndex * 2.7], [3.2, 0.045, 2.9], path, false);
      }
      for (let treeIndex = 0; treeIndex < (quality === "精细" ? 8 : 5); treeIndex += 1) {
        const side = treeIndex % 2 === 0 ? -1 : 1;
        makeTree(chunk, 200 + index * 12 + treeIndex, side * (5 + seeded(index * 20 + treeIndex) * 3.2), 9 - treeIndex * 2.8, chunkFoliage, trunk);
      }
      chunks.push(chunk);
      endlessRoot.addChild(chunk);
    }
    const endlessStation = makeEncounterMarker(endlessRoot, "endless", [0, 0, -18], stone, accent);

    const destination = new pc.Entity("ClickDestination");
    primitive(destination, "Destination", "cylinder", [0, 0, 0], [0.42, 0.018, 0.42], accent, false);
    destination.enabled = false;
    app.root.addChild(destination);

    const avatar = new pc.Entity("AnqiAvatar");
    avatar.setPosition(...BLOSSOM_TRAIL_LEVEL.spawn);
    app.root.addChild(avatar);
    let avatarVisual: pc.Entity | null = null;
    let currentAnimation = "";
    const playAnimation = (name: "idle" | "run" | "jump" | "sniff" | "celebrate") => {
      if (currentAnimation === name || !avatarVisual?.animation) return;
      const animationNames = Object.keys(avatarVisual.animation.animations);
      const resolved = animationNames.find((entry) => entry.toLowerCase().includes(name));
      if (!resolved) return;
      avatarVisual.animation.loop = name !== "celebrate";
      avatarVisual.animation.play(resolved, 0.16);
      currentAnimation = name;
    };

    app.assets.loadFromUrl("/models/anqi-bichon.glb", "container", (error, asset) => {
      if (destroyed) return;
      if (error || !asset) {
        avatarVisual = makeFallbackBichon();
        avatar.addChild(avatarVisual);
        setReady(true);
        return;
      }
      const container = asset.resource as pc.ContainerResource;
      const model = container.instantiateModelEntity({ castShadows: quality === "精细", receiveShadows: true });
      model.name = "AnqiBichonGLB";
      model.setLocalEulerAngles(0, 0, 0);
      const animations = (container as pc.ContainerResource & { animations: pc.Asset[] }).animations ?? [];
      if (animations.length > 0) model.addComponent("animation", { assets: animations, speed: 1, activate: true, loop: true });
      avatar.addChild(model);
      avatarVisual = model;
      playAnimation("idle");
      setReady(true);
    });

    let clickTarget: pc.Vec3 | null = null;
    let verticalVelocity = 0;
    let grounded = true;
    let elapsed = 0;
    let stepTimer = 0;
    let statusTimer = 0;
    let lastEndlessMode = liveRef.current.endlessMode;
    let lastCompletedWords = liveRef.current.completedWords;
    let lastCheckpoint = -1;
    const cameraPosition = new pc.Vec3();
    const desiredCamera = new pc.Vec3();
    const lookTarget = new pc.Vec3();
    const direction = new pc.Vec3();

    const resetPosition = () => {
      const live = liveRef.current;
      const spawn = live.endlessMode ? new pc.Vec3(0, 0.58, -24.5) : new pc.Vec3(...BLOSSOM_TRAIL_LEVEL.spawn);
      avatar.setPosition(spawn);
      clickTarget = null;
      destination.enabled = false;
      verticalVelocity = 0;
      grounded = true;
    };

    runtimeRef.current = {
      reset: resetPosition,
      interact: () => {
        const live = liveRef.current;
        const nearby = interactionRef.current;
        if (nearby.discovery) {
          const discovery = getWorldDiscovery(nearby.discovery);
          if (!discovery) return;
          live.onDiscover(discovery);
          const marker = discoveryEntities.get(nearby.discovery);
          if (marker) marker.enabled = false;
          updateInteraction({ encounter: nearby.encounter, discovery: null });
          return;
        }
        if (nearby.encounter) live.onEncounter(nearby.encounter);
      },
    };

    const releaseKeys = () => {
      (Object.keys(moveRef.current) as MoveKey[]).forEach((key) => { moveRef.current[key] = false; });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (liveRef.current.mode !== "explore" || event.metaKey || event.ctrlKey || event.altKey) return;
      const move = KEY_TO_MOVE[event.key];
      if (move) {
        event.preventDefault();
        moveRef.current[move] = true;
      } else if (event.key === "Enter" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        runtimeRef.current?.interact();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const move = KEY_TO_MOVE[event.key];
      if (move) moveRef.current[move] = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (liveRef.current.mode !== "explore" || event.button !== 0 || !camera.camera) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * app.graphicsDevice.width;
      const y = ((event.clientY - rect.top) / rect.height) * app.graphicsDevice.height;
      const near = camera.camera.screenToWorld(x, y, camera.camera.nearClip);
      const far = camera.camera.screenToWorld(x, y, camera.camera.farClip);
      direction.sub2(far, near);
      if (Math.abs(direction.y) < 0.0001) return;
      const distance = -near.y / direction.y;
      if (distance <= 0) return;
      const point = near.clone().add(direction.clone().mulScalar(distance));
      point.x = pc.math.clamp(point.x, BLOSSOM_TRAIL_LEVEL.bounds.minX, BLOSSOM_TRAIL_LEVEL.bounds.maxX);
      if (!liveRef.current.endlessMode) point.z = pc.math.clamp(point.z, BLOSSOM_TRAIL_LEVEL.bounds.minZ, BLOSSOM_TRAIL_LEVEL.bounds.maxZ);
      clickTarget = point;
      destination.setPosition(point.x, 0.035, point.z);
      destination.enabled = true;
    };
    const onContextLost = (event: Event) => { event.preventDefault(); if (!destroyed) setFallback(true); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseKeys);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("webglcontextlost", onContextLost);

    const resize = () => app.resizeCanvas(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    app.on("update", (dt: number) => {
      if (destroyed) return;
      const live = liveRef.current;
      const delta = Math.min(dt, 0.04);
      elapsed += delta;
      storyRoot.enabled = !live.endlessMode;
      endlessRoot.enabled = live.endlessMode;

      if (live.endlessMode !== lastEndlessMode) {
        lastEndlessMode = live.endlessMode;
        resetPosition();
        lastCheckpoint = -1;
      }
      if (live.completedWords !== lastCompletedWords) {
        lastCompletedWords = live.completedWords;
        playAnimation(live.feedback === "word" ? "celebrate" : "idle");
      }

      let moving = false;
      if (live.mode === "explore") {
        let inputX = Number(moveRef.current.right) - Number(moveRef.current.left);
        let inputZ = Number(moveRef.current.back) - Number(moveRef.current.forward);
        if (Math.abs(inputX) + Math.abs(inputZ) === 0 && clickTarget) {
          inputX = clickTarget.x - avatar.getPosition().x;
          inputZ = clickTarget.z - avatar.getPosition().z;
          const targetDistance = Math.hypot(inputX, inputZ);
          if (targetDistance < 0.24) {
            clickTarget = null;
            destination.enabled = false;
          } else {
            inputX /= targetDistance;
            inputZ /= targetDistance;
          }
        }
        const inputLength = Math.hypot(inputX, inputZ);
        if (inputLength > 0.01) {
          moving = true;
          const position = avatar.getPosition().clone();
          const speed = live.endlessMode ? 5.6 : 5.15;
          position.x += (inputX / inputLength) * speed * delta;
          position.z += (inputZ / inputLength) * speed * delta;
          position.x = pc.math.clamp(position.x, BLOSSOM_TRAIL_LEVEL.bounds.minX, BLOSSOM_TRAIL_LEVEL.bounds.maxX);
          if (!live.endlessMode) position.z = pc.math.clamp(position.z, BLOSSOM_TRAIL_LEVEL.bounds.minZ, BLOSSOM_TRAIL_LEVEL.bounds.maxZ);
          avatar.setPosition(position);
          const targetYaw = Math.atan2(inputX, inputZ) * pc.math.RAD_TO_DEG;
          const currentYaw = avatar.getEulerAngles().y;
          const yawDelta = ((targetYaw - currentYaw + 540) % 360) - 180;
          avatar.setEulerAngles(0, currentYaw + yawDelta * Math.min(1, delta * 11), 0);
        }
        if (moveRef.current.jump && grounded) {
          moveRef.current.jump = false;
          grounded = false;
          verticalVelocity = 4.8;
          live.onMovementAudio("jump");
        }
      } else {
        releaseKeys();
        clickTarget = null;
        destination.enabled = false;
      }

      const position = avatar.getPosition().clone();
      if (!grounded) {
        verticalVelocity -= 12.8 * delta;
        position.y += verticalVelocity * delta;
        if (position.y <= 0.58) {
          if (verticalVelocity < -2) live.onMovementAudio("land");
          position.y = 0.58;
          verticalVelocity = 0;
          grounded = true;
        }
        avatar.setPosition(position);
      }

      if (!live.reducedMotion && avatarVisual && !moving && grounded) avatarVisual.setLocalPosition(0, Math.sin(elapsed * 1.7) * 0.006, 0);
      playAnimation(!grounded ? "jump" : moving ? "run" : elapsed % 10 > 7.5 ? "sniff" : "idle");
      stepTimer += moving && grounded ? delta : 0;
      if (moving && grounded && stepTimer > 0.31) {
        stepTimer = 0;
        live.onMovementAudio("step");
      }

      if (live.endlessMode) {
        let minimumChunkZ = Math.min(...chunks.map((chunk) => chunk.getPosition().z));
        chunks.forEach((chunk) => {
          if (chunk.getPosition().z > avatar.getPosition().z + BLOSSOM_TRAIL_LEVEL.endless.recycleBehind * BLOSSOM_TRAIL_LEVEL.endless.chunkLength) {
            minimumChunkZ -= BLOSSOM_TRAIL_LEVEL.endless.chunkLength;
            chunk.setPosition(0, 0, minimumChunkZ);
          }
        });
        const stationZ = -34 - live.endlessWords * 16;
        endlessStation.setPosition(Math.sin(live.endlessWords * 1.7) * 2.1, 0, stationZ);
      }

      const avatarPosition = avatar.getPosition();
      const current = activeEncounter(live);
      let nearbyEncounter: ExplorationEncounterId | null = null;
      if (current) {
        if (live.endlessMode) {
          if (avatarPosition.distance(endlessStation.getPosition()) < 2.4) nearbyEncounter = current.id;
        } else {
          const node = BLOSSOM_TRAIL_LEVEL.encounters.find((entry) => entry.id === current.id);
          if (node && Math.hypot(avatarPosition.x - node.position[0], avatarPosition.z - node.position[2]) < node.triggerRadius) nearbyEncounter = current.id;
        }
      }
      let nearbyDiscovery: WorldDiscoveryId | null = null;
      if (!live.endlessMode) {
        const node = BLOSSOM_TRAIL_LEVEL.discoveries.find((entry) => !live.discoveredIds.includes(entry.id) && Math.hypot(avatarPosition.x - entry.position[0], avatarPosition.z - entry.position[2]) < entry.triggerRadius);
        nearbyDiscovery = node?.id ?? null;
      }
      updateInteraction({ encounter: nearbyEncounter, discovery: nearbyDiscovery });

      encounterEntities.forEach((entity, id) => {
        const index = BLOSSOM_TRAIL_LEVEL.encounters.findIndex((node) => node.id === id);
        entity.enabled = index >= getCompletedEncounterCount(live.completedWords);
        const signal = entity.findByName("Signal");
        if (signal && !live.reducedMotion) signal.setLocalScale(0.28 + Math.sin(elapsed * 2.4 + index) * 0.025, 0.28 + Math.sin(elapsed * 2.4 + index) * 0.025, 0.28 + Math.sin(elapsed * 2.4 + index) * 0.025);
      });
      discoveryEntities.forEach((entity, id) => { entity.enabled = !live.discoveredIds.includes(id); });

      if (!live.endlessMode) {
        BLOSSOM_TRAIL_LEVEL.checkpoints.forEach((checkpoint, index) => {
          if (avatarPosition.z <= checkpoint.z && lastCheckpoint < index) {
            lastCheckpoint = index;
            live.onCheckpoint(checkpoint.message);
          }
        });
      }

      const cameraSettings = BLOSSOM_TRAIL_LEVEL.camera;
      desiredCamera.set(avatarPosition.x * 0.3, avatarPosition.y + cameraSettings.height, avatarPosition.z + cameraSettings.distance);
      cameraPosition.lerp(camera.getPosition(), desiredCamera, 1 - Math.exp(-delta * (live.reducedMotion ? 12 : 6.4)));
      camera.setPosition(cameraPosition);
      lookTarget.set(avatarPosition.x, avatarPosition.y + 0.46, avatarPosition.z - cameraSettings.lookAhead);
      camera.lookAt(lookTarget);
      destination.rotate(0, live.reducedMotion ? 0 : delta * 42, 0);

      statusTimer += delta;
      if (statusTimer > 0.45) {
        statusTimer = 0;
        const distance = live.endlessMode ? Math.max(0, Math.floor(-avatarPosition.z - 24)) : Math.max(0, Math.floor(5.5 - avatarPosition.z));
        const zone = live.endlessMode ? Math.floor(live.endlessWords / 5) + 1 : 0;
        live.onWorldStatus({ distance, zone, biome: live.endlessMode ? getEndlessBiome(zone - 1).name : "樱花谷", movingByClick: Boolean(clickTarget), quality });
      }
    });

    app.start();
    return () => {
      destroyed = true;
      runtimeRef.current = null;
      releaseKeys();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseKeys);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      resizeObserver.disconnect();
      app.destroy();
    };
  }, [fallback, updateInteraction]);

  const current = activeEncounter(props);
  const nearbyEncounter = current?.id === interaction.encounter ? current : EXPLORATION_ENCOUNTERS.find((encounter) => encounter.id === interaction.encounter) ?? null;
  const discovery = interaction.discovery ? getWorldDiscovery(interaction.discovery) : null;

  if (fallback) {
    return (
      <div className="exploration-fallback garden-stage" role="region" aria-label="自然探索简洁模式">
        <div className="fallback-adventure-card">
          <span>{current?.icon ?? "✓"}</span>
          <small>设备暂时无法运行 3D 场景</small>
          <h2>{current?.title ?? "本段探索已完成"}</h2>
          <p>{current?.story ?? "学习进度已经安全保存，你仍然可以继续打字任务。"}</p>
          {current && <button onClick={() => props.onEncounter(current.id)}>继续打字任务 <b>→</b></button>}
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
    <div className={`playcanvas-world exploration-stage garden-stage mode-${props.mode} ${props.endlessMode ? "endless-world" : "story-world"}`} aria-label={props.endlessMode ? "PlayCanvas 无限探索世界" : "PlayCanvas 樱花谷探索关"}>
      <canvas ref={canvasRef} className="exploration-canvas playcanvas-canvas" aria-label="可点击移动的三维自然场景" />
      {!ready && <div className="playcanvas-loading" aria-live="polite"><i /><span>正在准备自然探索场景</span></div>}
      {props.mode === "explore" && (
        <>
          <div className={`interaction-prompt ${nearbyEncounter || discovery ? "visible" : ""}`} aria-live="polite">
            <span>{discovery ? discovery.kind === "npc" ? "友" : "藏" : nearbyEncounter ? "题" : "路"}</span>
            <div><small>{discovery ? discovery.kind === "npc" ? "遇见自然伙伴" : "发现隐藏记录" : nearbyEncounter ? props.endlessMode ? `发现随机任务 · 第 ${nearbyEncounter.number} 区` : `发现打字任务 · 第 ${nearbyEncounter.number}/3 站` : props.endlessMode ? "点击远处路面，安琪会自动前往" : "沿自然步道探索"}</small><strong>{discovery?.name ?? nearbyEncounter?.title ?? (props.endlessMode ? "寻找下一座任务碑" : "寻找沿途的打字任务")}</strong></div>
            {(nearbyEncounter || discovery) && <button onClick={interact}><kbd>Enter</kbd> {discovery ? discovery.kind === "npc" ? "打招呼" : "记录" : "开始任务"}</button>}
          </div>
          <div className="mobile-explore-controls" aria-label="触屏探索控制">
            <div className="mobile-move-pad">
              <button className="move-up" aria-label="向前移动" {...bindMove("forward")}>▲</button>
              <button className="move-left" aria-label="向左移动" {...bindMove("left")}>◀</button>
              <i aria-hidden="true">A</i>
              <button className="move-right" aria-label="向右移动" {...bindMove("right")}>▶</button>
              <button className="move-down" aria-label="向后移动" {...bindMove("back")}>▼</button>
            </div>
            <div className="mobile-action-pad">
              <button className="jump-action" aria-label="跳跃" {...bindMove("jump")}><i>↑</i><span>跳跃</span></button>
              <button className="interact-action" aria-label="与任务、记录或伙伴互动" onClick={interact} disabled={!nearbyEncounter && !discovery}><i>E</i><span>互动</span></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

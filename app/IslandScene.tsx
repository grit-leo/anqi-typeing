"use client";

import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { planIslandWalk } from "./island-engine";
import { PROJECTS } from "./island-journey";
import { createBichonCompanion } from "./BichonCompanion";

type Props = {
  chapter: number; growth: number; pulse: number; celebrate: boolean;
  reducedMotion: boolean; paused: boolean; exploring: boolean;
  available: number; onQuest: (station: number) => void;
  training: boolean; focus: number; projects: number[];
};

const PALETTES = [
  { grass: 0xa2b889, foliage: 0xe8b9ba, roof: 0xa98488, water: 0x82b7bb, flowers: [0xf3d6ce, 0xf8efdc, 0xbaa7ca] },
  { grass: 0x91b09a, foliage: 0x92b89d, roof: 0x849c85, water: 0x7db6b1, flowers: [0xffe3a9, 0xd8cde4, 0xf3b7a6] },
  { grass: 0x9fadc4, foliage: 0xbab7d8, roof: 0x8c8caa, water: 0x83abc9, flowers: [0xe5d8f2, 0xf9e1ba, 0xe2c8db] },
  { grass: 0xb9bc96, foliage: 0xe4c49b, roof: 0xb68d76, water: 0x98c7c7, flowers: [0xffd2b0, 0xe3d2e9, 0xfff0dc] },
];

export function IslandScene(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [companionView, setCompanionView] = useState(false);
  const companionViewRef = useRef(false);
  const companionAngleRef = useRef("portrait");
  useEffect(() => { live.current = props; }, [props]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && companionViewRef.current && !live.current.training && !live.current.paused) {
        event.preventDefault(); companionViewRef.current = false; setCompanionView(false);
      }
    };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" }); }
    // This effect synchronizes React's loading state with the external WebGL renderer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setStatus("error"); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("aria-label", "实时三维花语岛，拖动旋转视角，探索时点击地面移动棉棉");
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, .1, 150);
    camera.position.set(8.5, 7, 10.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .2, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = .065;
    controls.minDistance = 11;
    controls.maxDistance = 24;
    controls.minPolarAngle = .48;
    controls.maxPolarAngle = 1.18;
    controls.enableZoom = true;
    controls.update();
    scene.add(new T.HemisphereLight(0xfff4e3, 0x8b98a5, 1.7));
    const sun = new T.DirectionalLight(0xfff0d8, 3.1);
    sun.position.set(-5, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -8;
    sun.shadow.camera.right = sun.shadow.camera.top = 8;
    sun.shadow.normalBias = .035;
    sun.shadow.bias = -.0005;
    sun.shadow.radius = 3;
    scene.add(sun);
    const fill = new T.DirectionalLight(0xcbd8f5, .85);
    fill.position.set(6, 6, -7);
    scene.add(fill);

    const palette = PALETTES[props.chapter];
    let seed = 1837;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const materials = new Map<string, T.MeshStandardMaterial>();
    const mat = (color: number, roughness = .85) => {
      const key = `${color}-${roughness}`;
      if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness }));
      return materials.get(key)!;
    };
    const sphere = new T.SphereGeometry(1, 16, 12);
    const cube = new T.BoxGeometry(1, 1, 1);
    function mesh(parent: T.Object3D, geometry: T.BufferGeometry, color: number, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
      const m = new T.Mesh<T.BufferGeometry, T.Material>(geometry, mat(color));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    const ball = (p: T.Object3D, c: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => mesh(p, sphere, c, x, y, z, sx, sy, sz);
    const box = (p: T.Object3D, c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => mesh(p, cube, c, x, y, z, sx, sy, sz);
    function pole(p: T.Object3D, c: number, x: number, y: number, z: number, r: number, height: number) { return mesh(p, new T.CylinderGeometry(r * .8, r, height, 10), c, x, y, z); }
    const island = new T.Group(); scene.add(island);
    mesh(island, new T.CylinderGeometry(5.2, 4.65, .7, 80), 0xb5a792, 0, -.4, 0, 1, 1, .83);
    mesh(island, new T.CylinderGeometry(4.65, 3.1, .95, 72), 0x9d948b, 0, -1.15, 0, 1, 1, .83);
    mesh(island, new T.CylinderGeometry(5.24, 5.18, .2, 80), palette.grass, 0, .015, 0, 1, 1, .83);
    const ground = new T.Mesh(new T.CircleGeometry(5.1, 80), new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }));
    ground.rotation.x = -Math.PI / 2; ground.scale.y = .81; ground.position.y = .14; island.add(ground);
    // Rounded stones break the silhouette of the floating island.
    for (let i = 0; i < 35; i++) {
      const a = i / 35 * Math.PI * 2;
      const r = 4.9 + random() * .22;
      ball(island, [0xa99f93, 0xc3b9a9, 0xb7ae9e][i % 3], Math.cos(a) * r, -.23 - random() * .24, Math.sin(a) * r * .83, .23 + random() * .24, .25, .2);
    }
    // Winding stepping stones lead to the cottage.
    for (let i = 0; i < 14; i++) {
      const z = 3.35 - i * .34; const x = -.55 + Math.sin(i * .29) * .55;
      const stone = mesh(island, new T.CylinderGeometry(.28, .3, .055, 7), i % 2 ? 0xe3d7bf : 0xdcd0b9, x, .15, z, 1.2, 1, .75);
      stone.rotation.y = random() * 3;
    }
    // Pond, reed banks and moving rings.
    const water = mesh(island, new T.CylinderGeometry(1.35, 1.39, .035, 64), palette.water, 2.2, .14, 1.6, 1, 1, .7);
    water.material = new T.MeshStandardMaterial({ color: palette.water, roughness: .2, metalness: .15 });
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      ball(island, 0xd6cfb9, 2.2 + Math.cos(a) * 1.39, .18, 1.6 + Math.sin(a) * .96, .12 + random() * .1, .09, .14);
    }
    const ripples: T.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(new T.RingGeometry(.14, .15, 48), new T.MeshBasicMaterial({ color: 0xf1ffff, transparent: true, opacity: .45, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(2.15, .165 + i * .002, 1.55); island.add(ring); ripples.push(ring);
    }
    for (let i = 0; i < 4; i++) {
      const lily = mesh(island, new T.CylinderGeometry(.17, .16, .015, 16), 0x7b9c78, 2.6 + random() * .3, .18, 1.3 + random() * .7, 1, 1, .85);
      ball(lily, 0xf3d1d0, 0, .06, 0, .07, .08, .07);
    }
    const bridge = new T.Group(); bridge.position.set(.98, .23, 1.6); bridge.rotation.y = -.18; island.add(bridge);
    const bridgePlanks: T.Mesh[] = [], bridgeRails: T.Mesh[] = [];
    for (let i = 0; i < 6; i++) { const z = (i - 2.5) * .19; const plank = box(bridge, i % 2 ? 0xb9a58c : 0xc6b093, 0, Math.cos(z) * .04, z, .66, .065, .175); plank.userData.baseY = plank.position.y; bridgePlanks.push(plank); }
    [-.33, .33].forEach(x => { [-.61, .61].forEach(z => pole(bridge, 0x917c65, x, .23, z, .035, .52)); bridgeRails.push(box(bridge, 0xaf997e, x, .45, 0, .045, .055, 1.25)); });

    function tree(x: number, z: number, scale: number, foliage: number) {
      const t = new T.Group(); t.position.set(x, .14, z); t.scale.setScalar(scale); island.add(t);
      const trunk = pole(t, 0x9b826c, 0, .75, 0, .13, 1.5); trunk.rotation.z = -.07;
      const branch = pole(t, 0x9b826c, .17, 1.25, .02, .065, .8); branch.rotation.z = -.65;
      const leafColor = new T.Color(foliage);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4; const r = i === 8 ? 0 : .4;
        const c = leafColor.clone().offsetHSL(0, -.015, (random() - .5) * .07).getHex();
        ball(t, c, Math.cos(a) * r, 1.75 + random() * .5, Math.sin(a) * r * .8, .48 + random() * .13, .48, .48);
      }
      return t;
    }
    const trees = [tree(-3, -1.4, 1.35, palette.foliage), tree(-3.9, .4, .88, palette.foliage), tree(2.7, -2, .95, 0xa1b69a), tree(-.1, -3.05, .9, palette.foliage), tree(3.7, -.65, .77, palette.foliage)];
    // Cottage with layered roof tiles, chimney, glass windows and planter boxes.
    const house = new T.Group(); house.position.set(-.9, .13, -1.45); house.rotation.y = .16; island.add(house);
    box(house, 0xd7c8b0, 0, .1, 0, 2.12, .2, 1.65);
    box(house, 0xf5e9d3, 0, .91, 0, 1.82, 1.62, 1.43);
    const gable = new T.Shape(); gable.moveTo(-1.05, 0); gable.lineTo(0, .9); gable.lineTo(1.05, 0); gable.closePath();
    const roof = new T.Mesh(new T.ExtrudeGeometry(gable, { depth: 1.8, bevelEnabled: true, bevelThickness: .045, bevelSize: .045, bevelSegments: 2 }), mat(palette.roof));
    roof.position.set(0, 1.73, -.9); roof.castShadow = true; roof.receiveShadow = true; house.add(roof);
    for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 5; i++) {
      const slat = box(house, palette.roof, side * (.13 + i * .215), 2.58 - i * .182, 0, .24, .07, 1.88); slat.rotation.z = side * -.71;
    }
    box(house, 0xc2aa94, .53, 2.54, -.38, .28, .85, .31); box(house, 0xdbc5ac, .53, 2.97, -.38, .38, .1, .4);
    const door = box(house, 0x91a296, -.22, .59, .741, .54, 1.02, .08); ball(door, 0xc5a367, .27, -.08, .65, .06);
    const glass = new T.MeshStandardMaterial({ color: 0x839d98, emissive: 0xffc875, emissiveIntensity: 0, roughness: .25 });
    function windowAt(x: number, y: number, z: number, side = false) {
      const w = new T.Group(); w.position.set(x, y, z); if (side) w.rotation.y = Math.PI / 2; house.add(w);
      box(w, 0xbfa38c, 0, 0, 0, .52, .59, .065); const pane = box(w, 0xffd990, 0, 0, .05, .4, .48, .03); pane.material = glass;
      box(w, 0xf6eddf, 0, 0, .08, .035, .5, .035); box(w, 0xf6eddf, 0, 0, .08, .43, .035, .035);
      box(w, 0xb7937d, 0, -.35, .07, .66, .16, .23);
      for (let i = 0; i < 4; i++) ball(w, i % 2 ? 0xe1b0ae : 0x8f9e77, -.2 + i * .14, -.23, .1, .085);
    }
    windowAt(.52, 1.02, .75); windowAt(.94, .97, .07, true);
    const attic = mesh(house, new T.CylinderGeometry(.2, .2, .08, 32), 0xeed7b0, 0, 2.01, .94); attic.rotation.x = Math.PI / 2;
    box(house, 0xf3e6cd, 0, 2.01, 1, .025, .32, .025); box(house, 0xf3e6cd, 0, 2.01, 1, .32, .025, .025);
    box(house, 0xd5c1a4, -.23, .065, 1.01, .8, .14, .5);
    const cottageLight = new T.PointLight(0xffca7a, 0, 4); cottageLight.position.set(-.3, 1, 1.05); house.add(cottageLight);
    const gardenLamps: T.MeshStandardMaterial[] = [];
    for (let i = 0; i < 6; i++) {
      const z = 2.6 - i * .43, x = -.5 + Math.sin(i * .5) * .3;
      pole(island, 0x7b8070, x - .55, .43, z, .025, .57);
      const lantern = box(island, 0xe4d9b8, x - .55, .76, z, .17, .23, .17);
      const material = new T.MeshStandardMaterial({ color: 0x98a99a, emissive: 0xffc273, emissiveIntensity: 0 }); lantern.material = material; gardenLamps.push(material);
      box(island, 0x7b8070, x - .55, .9, z, .22, .04, .22);
    }
    const chimeStand = new T.Group(); chimeStand.position.set(-2.7, .14, .2); island.add(chimeStand);
    [-.55, .55].forEach(x => pole(chimeStand, 0x948574, x, .85, 0, .04, 1.7)); box(chimeStand, 0x948574, 0, 1.68, 0, 1.2, .065, .065);
    const chimePipes: T.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const bell = new T.Group(); bell.position.set((i - 2.5) * .16, 1.65, 0); chimeStand.add(bell);
      pole(bell, 0xc3b29a, 0, -.13, 0, .008, .26);
      pole(bell, [0xd0aa73, 0xacb9ab, 0xbfb2c6][i % 3], 0, -.47, 0, .035, .36 + (i % 3) * .1);
      chimePipes.push(bell);
    }
    const smoke: T.Mesh[] = [];
    for (let i = 0; i < 4; i++) { const puff = ball(house, 0xffffff, .53, 3.2 + i * .3, -.38, .15 + i * .06); puff.material = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .3 - i * .06, depthWrite: false }); puff.castShadow = false; smoke.push(puff); }

    // Windmill is a recognizable moving landmark.
    const mill = new T.Group(); mill.position.set(1.55, .13, -2.1); island.add(mill);
    mesh(mill, new T.CylinderGeometry(.3, .43, 1.4, 16), 0xf0dfc6, 0, .7, 0);
    mesh(mill, new T.ConeGeometry(.49, .65, 16), palette.roof, 0, 1.66, 0);
    const blades = new T.Group(); blades.position.set(0, 1.2, .45); mill.add(blades);
    for (let i = 0; i < 4; i++) {
      const arm = new T.Group(); arm.rotation.z = Math.PI * .5 * i; blades.add(arm);
      box(arm, 0xa68c72, 0, .48, 0, .045, .98, .05); box(arm, 0xffefce, .115, .55, .02, .23, .58, .035);
      for (let j = 0; j < 4; j++) box(arm, 0xd4bb97, .115, .31 + j * .15, .05, .24, .018, .02);
    }
    ball(blades, 0xb89877, 0, 0, .04, .1);
    // Every chapter adds its own landmarks as well as its own light and palette.
    if (props.chapter === 1) {
      [[-3.9, -1.3], [3.1, -1.4], [-1.2, -3.1]].forEach(([x, z], i) => {
        pole(island, 0x8e8068, x, .65, z, .09, 1.15);
        for (let layer = 0; layer < 3; layer++) mesh(island, new T.ConeGeometry(.68 - layer * .12, .96, 10), i % 2 ? 0x7c9c82 : 0x8ea780, x, 1 + layer * .42, z);
      });
      const lantern = ball(island, 0xffe6a8, -3.3, .9, 1.05, .13, .18, .13);
      lantern.material = new T.MeshStandardMaterial({ color: 0xffe1a0, emissive: 0xffd488, emissiveIntensity: 1.2 });
    }
    if (props.chapter === 2) {
      for (let i = 0; i < 7; i++) {
        const crystal = mesh(island, new T.OctahedronGeometry(.23), i % 2 ? 0xb5cce3 : 0xbeb6dd, 3.1 + Math.sin(i * 2) * .4, .3 + i % 3 * .09, -.9 + Math.cos(i * 2) * .4, .8, 1.8, .8);
        crystal.rotation.z = (i - 3) * .07;
      }
      const boat = new T.Group(); boat.position.set(2.13, .23, 1.66); boat.rotation.y = -.4; island.add(boat);
      const hull = mesh(boat, new T.ConeGeometry(.26, .65, 4), 0xf1e8d8, 0, .06, 0); hull.rotation.z = Math.PI / 2; hull.scale.set(.6, 1, .65);
      pole(boat, 0xb9a38a, 0, .27, 0, .009, .4);
      const sail = new T.Shape(); sail.moveTo(0, 0); sail.lineTo(0, .32); sail.lineTo(.25, 0); sail.closePath();
      const cloth = new T.Mesh(new T.ShapeGeometry(sail), new T.MeshStandardMaterial({ color: 0xfff9e9, side: T.DoubleSide })); cloth.position.set(.02, .17, 0); boat.add(cloth);
    }
    if (props.chapter === 3) {
      const post = new T.Group(); post.position.set(-2.3, .14, .85); post.rotation.y = .2; island.add(post);
      pole(post, 0xb9a48b, 0, .4, 0, .045, .8); box(post, 0xc09a8f, 0, .9, 0, .4, .32, .33); box(post, 0x897965, 0, .94, .17, .22, .025, .02);
      for (let i = 0; i < 3; i++) {
        const x = 2.9 + i * .3;
        pole(island, 0xc9bba4, x, 1.1 + i * .12, -.8, .008, 1.8 + i * .24);
        ball(island, [0xc9b7d4, 0xf1c6b0, 0xc4d6b5][i], x, 2.15 + i * .24, -.8, .23, .31, .23);
      }
    }
    // Garden fences, mushrooms and a bench.
    for (let i = 0; i < 7; i++) { const x = -3.15 + i * .35; box(island, 0xe8dfca, x, .44, 2.28, .065, .6, .065); }
    box(island, 0xe0d6be, -2.1, .42, 2.28, 2.35, .065, .055); box(island, 0xe0d6be, -2.1, .65, 2.28, 2.35, .065, .055);
    const bench = new T.Group(); bench.position.set(-3.25, .14, 1.05); bench.rotation.y = .6; island.add(bench);
    for (let i = 0; i < 3; i++) box(bench, 0xc1a58a, 0, .38, (i - 1) * .12, .85, .065, .1);
    [-.31, .31].forEach(x => { box(bench, 0x8e8070, x, .2, 0, .075, .4, .28); box(bench, 0x8e8070, x, .58, -.17, .06, .5, .06); });
    box(bench, 0xc1a58a, 0, .77, -.17, .87, .16, .055);
    for (let i = 0; i < 8; i++) { const x = -2.8 + random() * .6; const z = -.1 + random() * .5; pole(island, 0xf0dfc2, x, .22, z, .03, .2); ball(island, i % 2 ? 0xc7988e : 0xc4ad8a, x, .32, z, .12, .075, .12); }
    // Instancing keeps the ground vegetation light on the GPU.
    const grassGeo = new T.ConeGeometry(.045, .2, 4);
    const grassMesh = new T.InstancedMesh(grassGeo, mat(0x859e74), 160);
    const dummy = new T.Object3D();
    for (let i = 0; i < 160; i++) {
      const a = random() * Math.PI * 2, radius = 2.8 + random() * 2.2;
      dummy.position.set(Math.cos(a) * radius, .22, Math.sin(a) * radius * .8);
      dummy.rotation.z = (random() - .5) * .3; dummy.scale.setScalar(.6 + random() * .7); dummy.updateMatrix(); grassMesh.setMatrixAt(i, dummy.matrix);
    }
    island.add(grassMesh);
    const flowerGroups: T.Group[] = [];
    const petalGeo = new T.SphereGeometry(1, 7, 5);
    function flower(x: number, z: number, i: number) {
      const f = new T.Group(); f.position.set(x, .14, z); const h = .21 + random() * .16;
      pole(f, 0x7c9471, 0, h / 2, 0, .015, h);
      ball(f, 0x91a67a, .055, h * .5, 0, .075, .024, .035).rotation.z = .5;
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; mesh(f, petalGeo, palette.flowers[i % 3], Math.cos(a) * .062, h + .018, Math.sin(a) * .062, .055, .025, .06); }
      ball(f, 0xe4be6e, 0, h + .035, 0, .033, .027, .033); island.add(f); flowerGroups.push(f);
    }
    for (let i = 0; i < 55; i++) {
      const a = random() * Math.PI * 2, radius = 3.7 + random() * 1.15;
      flower(Math.cos(a) * radius, Math.sin(a) * radius * .8, i);
    }
    for (let plot = 0; plot < 6; plot++) {
      const x = -2.75 + (plot % 3) * .56, z = 1.4 + Math.floor(plot / 3) * .42;
      box(island, 0xa69b7b, x, .16, z, .5, .075, .35);
      for (let i = 0; i < 4; i++) flower(x + (i % 2 - .5) * .22, z + (Math.floor(i / 2) - .5) * .16, plot * 4 + i);
    }
    const companion = createBichonCompanion();
    const dog = companion.root; island.add(dog); dog.position.set(.2, .18, 2.4); dog.scale.setScalar(.82);
    // The same live model can be inspected without scenery covering its face or paws.
    const portraitScene = new T.Scene(); portraitScene.background = new T.Color(0xe9e8e0);
    portraitScene.fog = new T.Fog(0xe9e8e0, 8, 30);
    portraitScene.add(new T.HemisphereLight(0xfffcf4, 0xaaa79c, 1.5));
    const portraitKey = new T.DirectionalLight(0xfff6e9, 2.5); portraitKey.position.set(-3, 6, 7); portraitKey.castShadow = true;
    portraitKey.shadow.mapSize.set(1024, 1024); portraitKey.shadow.camera.left = portraitKey.shadow.camera.bottom = -5;
    portraitKey.shadow.camera.right = portraitKey.shadow.camera.top = 5; portraitKey.shadow.normalBias = .006; portraitKey.shadow.bias = -.0001;
    portraitScene.add(portraitKey);
    const portraitFill = new T.DirectionalLight(0xf3f7ff, .75); portraitFill.position.set(5, 3, 2); portraitScene.add(portraitFill);
    const portraitGround = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0xe9e8e0, roughness: 1 }));
    portraitGround.rotation.x = -Math.PI / 2; portraitGround.position.y = .145; portraitGround.receiveShadow = true; portraitScene.add(portraitGround);
    // Floating task markers are also clickable in the 3D world.
    const stations: T.Group[] = [], pickables: T.Object3D[] = [];
    const points = [[-.55, 2.55], [2.65, .12], [-2.2, -.2], [.3, -2.7]];
    const labels = [["F · J", "D · K", "S · L", "A · ;"], ["G · H", "R · U", "E · I", "W · P"], ["V · M", "C · Z", "Aa", "123"], ["Hello", "Brave", "Mimi", "Story"]][props.chapter];
    points.forEach(([x, z], i) => {
      const station = new T.Group(); station.position.set(x, .2, z); island.add(station); stations.push(station);
      const pedestal = mesh(station, new T.CylinderGeometry(.24, .28, .11, 32), 0xf3e5ce, 0, 0, 0); pedestal.userData.station = i; pickables.push(pedestal);
      const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.roundRect(5, 5, 246, 104, 36); ctx.fill();
      ctx.fillStyle = "#657e70"; ctx.font = "600 45px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(labels[i], 128, 59);
      ctx.beginPath(); ctx.moveTo(113, 107); ctx.lineTo(143, 107); ctx.lineTo(128, 123); ctx.fillStyle = "#fffaf0"; ctx.fill();
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.position.y = .85; sprite.scale.set(.94, .47, 1); sprite.userData.station = i; station.add(sprite); pickables.push(sprite);
    });
    // Distant clouds, butterflies, and a tied balloon.
    const clouds: T.Group[] = [];
    [[-6, .5, -3], [5, -.4, -4], [-5, -1.4, 3], [4, 2.9, -5]].forEach(([x, y, z], i) => {
      const cloud = new T.Group(); cloud.position.set(x, y, z); scene.add(cloud); clouds.push(cloud);
      const cm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .66 });
      for (let j = 0; j < 5; j++) { const puff = ball(cloud, 0xffffff, (j - 2) * .35, Math.sin(j) * .1, 0, .44, .23 + (j % 2) * .1, .35); puff.material = cm; puff.castShadow = false; }
      cloud.userData.baseX = x; cloud.userData.seed = i;
    });
    const butterflies: T.Group[] = [];
    for (let i = 0; i < 5; i++) { const b = new T.Group(); island.add(b); [-1, 1].forEach(side => { const wing = ball(b, palette.flowers[i % 3], side * .065, 0, 0, .065, .012, .08); wing.castShadow = false; }); butterflies.push(b); }
    const balloon = new T.Group(); balloon.position.set(-2, .4, -2.2); island.add(balloon);
    pole(balloon, 0xc8b6a3, 0, 1.4, 0, .008, 2.8);
    ball(balloon, 0xe4b4ae, 0, 2.92, 0, .3, .39, .3);
    mesh(balloon, new T.ConeGeometry(.05, .09, 8), 0xc99897, 0, 2.56, 0).rotation.z = Math.PI;

    const sparks = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color: 0xffe4aa, size: .09, transparent: true, opacity: 0, depthWrite: false }));
    const sparkPositions = new Float32Array(40 * 3); sparks.geometry.setAttribute("position", new T.BufferAttribute(sparkPositions, 3)); island.add(sparks);
    let burstAt = -100, lastPulse = live.current.pulse, lastCelebrate = false;
    const target = new T.Vector3(.2, .18, 2.4);
    let questTarget: number | null = null, lastAuto = 0, dragging = false, downX = 0, downY = 0;
    let walkRoute: T.Vector3[] = [], wasExploring = live.current.exploring;
    let wasTraining = false, lastFocus = -1, wasCompanionView = false, lastCompanionAngle = "";
    const companionOverviewPosition = camera.position.clone(), companionOverviewTarget = controls.target.clone();
    const overviewPosition = camera.position.clone(), overviewTarget = controls.target.clone();
    const focusTarget = new T.Vector3(), focusCamera = new T.Vector3(), fittedCamera = new T.Vector3();
    function walkTo(x: number, z: number, station: number | null) {
      const path = planIslandWalk(dog.position, { x, z }, live.current.projects[1] >= 6);
      if (!path.length) return;
      walkRoute = path.map(p => new T.Vector3(p.x, .18, p.z));
      target.copy(walkRoute.shift()!); questTarget = station;
    }
    const raycaster = new T.Raycaster(); const pointer = new T.Vector2();
    const down = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; dragging = false; };
    const move = (e: PointerEvent) => { if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 8) dragging = true; };
    const up = (e: PointerEvent) => {
      if (dragging || live.current.paused || live.current.training || companionViewRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const picked = raycaster.intersectObjects(pickables).find(hit => Number(hit.object.userData.station) <= live.current.available);
      if (picked && !live.current.celebrate) {
        const i = Number(picked.object.userData.station);
        if (!live.current.exploring) { live.current.onQuest(i); return; }
        walkTo(points[i][0], points[i][1], i);
      } else if (live.current.exploring) {
        const hits = raycaster.intersectObject(ground); if (hits[0]) walkTo(hits[0].point.x, hits[0].point.z, null);
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    const lost = (e: Event) => { e.preventDefault(); setStatus("error"); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.fov = camera.aspect < 1.1 ? 43 : 34; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0, previous = 0, time = 0;
    const direction = new T.Vector3();
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      const delta = Math.min((now - previous) / 1000, .05); previous = now;
      if (document.hidden) return;
      const state = live.current;
      const closeCompanion = companionViewRef.current && !state.training && !state.celebrate;
      if (closeCompanion !== wasCompanionView) {
        if (closeCompanion) {
          portraitScene.add(dog);
          companionOverviewPosition.copy(camera.position); companionOverviewTarget.copy(controls.target);
          walkRoute = []; questTarget = null; target.copy(dog.position);
          lastCompanionAngle = ""; controls.minDistance = 1.8; controls.maxDistance = 5;
          controls.minPolarAngle = .65; controls.maxPolarAngle = 1.52;
          renderer.domElement.setAttribute("aria-label", "棉棉的实时三维近景，可拖动旋转，观察比熊的卷毛、垂耳和尾巴");
        } else {
          island.add(dog);
          camera.position.copy(companionOverviewPosition); controls.target.copy(companionOverviewTarget);
          controls.minDistance = 11; controls.maxDistance = 24;
          controls.minPolarAngle = .48; controls.maxPolarAngle = 1.18;
          renderer.domElement.setAttribute("aria-label", "实时三维花语岛，拖动旋转视角，探索时点击地面移动棉棉");
        }
        wasCompanionView = closeCompanion;
      }
      if (closeCompanion && lastCompanionAngle !== companionAngleRef.current) {
        const angle = companionAngleRef.current;
        const offset = (angle === "front" ? new T.Vector3(0, .42, 2.9) : angle === "side" ? new T.Vector3(2.85, .42, .1) : new T.Vector3(1.2, .65, 2.65)).applyAxisAngle(new T.Vector3(0, 1, 0), dog.rotation.y);
        controls.target.copy(dog.position).add(new T.Vector3(0, .61, 0)); camera.position.copy(controls.target).add(offset);
        lastCompanionAngle = angle;
      }
      if (wasExploring !== state.exploring) { walkRoute = []; questTarget = null; target.copy(dog.position); wasExploring = state.exploring; }
      if (state.training && (!wasTraining || lastFocus !== state.focus)) {
        if (!wasTraining) { overviewPosition.copy(camera.position); overviewTarget.copy(controls.target); }
        const [x, z] = PROJECTS[state.focus].position;
        focusTarget.set(x, state.focus === 3 ? 1 : .5, z);
        focusCamera.set(x + 3.4, state.focus === 3 ? 4.5 : 4.6, z + 5.2);
        const companions = [[-1.2, 2.5], [.98, 2.6], [-2.3, .85], [.2, -.2]];
        walkTo(companions[state.focus][0], companions[state.focus][1], null);
      }
      if (!state.training && wasTraining) { camera.position.copy(overviewPosition); controls.target.copy(overviewTarget); controls.minDistance = 11; }
      if (state.training) {
        controls.minDistance = 3;
        const blend = state.reducedMotion ? 1 : 1 - Math.exp(-delta * 4);
        fittedCamera.copy(focusCamera).sub(focusTarget).multiplyScalar(Math.min(1, 3.2 / camera.aspect)).add(focusTarget);
        camera.position.lerp(fittedCamera, blend); controls.target.lerp(focusTarget, blend);
      }
      wasTraining = state.training; lastFocus = state.focus;
      if (!state.paused) time += delta;
      const movingWorld = !state.reducedMotion && !state.paused;
      controls.enabled = !state.paused && !state.training;
      controls.enableDamping = !state.training;
      controls.update();
      if (movingWorld) {
        blades.rotation.z = -time * .42;
        trees.forEach((tree, i) => { tree.rotation.z = Math.sin(time * .7 + i) * .009; });
        clouds.forEach((cloud, i) => { cloud.position.x = cloud.userData.baseX + Math.sin(time * .07 + i) * .35; });
        smoke.forEach((s, i) => { s.position.x = .53 + Math.sin(time * .7 + i) * .09; s.position.y = 3.2 + i * .3 + Math.sin(time + i) * .06; });
        balloon.rotation.z = Math.sin(time * .7) * .04;
        butterflies.forEach((b, i) => { b.position.set(Math.sin(time * .32 + i * 1.4) * 2.8, .7 + Math.sin(time * .8 + i) * .17, Math.cos(time * .22 + i * 1.4) * 2.4); b.rotation.y = -time * .25; b.children.forEach((wing, j) => { wing.rotation.z = Math.sin(time * 9 + i) * .75 * (j ? 1 : -1); }); });
      }
      ripples.forEach((r, i) => { const a = (time * .22 + i / 3) % 1; r.scale.setScalar(.5 + a * 4); (r.material as T.MeshBasicMaterial).opacity = (1 - a) * .3; });
      stations.forEach((s, i) => { s.visible = !state.training; s.children[1].position.y = .85 + (movingWorld ? Math.sin(time * 1.4 + i) * .045 : 0); (s.children[1] as T.Sprite).material.opacity = i <= state.available ? 1 : .42; });
      const constructionDelta = state.paused ? 0 : delta;
      bridgePlanks.forEach((plank, i) => { const built = i < state.projects[1]; plank.visible = built; if (built) plank.position.y = T.MathUtils.damp(plank.position.y, plank.userData.baseY, 5, constructionDelta); else plank.position.y = plank.userData.baseY + .65; });
      bridgeRails.forEach(rail => { rail.visible = state.projects[1] === 6; });
      chimePipes.forEach((bell, i) => { bell.visible = i < state.projects[2]; if (movingWorld) bell.rotation.x = Math.sin(time * 2.5 + i) * .13; });
      gardenLamps.forEach((m, i) => { m.emissiveIntensity = i < state.projects[3] ? 2 : 0; m.color.setHex(i < state.projects[3] ? 0xffd890 : 0x98a99a); });
      glass.emissiveIntensity = state.projects[3] / 6 * 1.4; glass.color.setHex(state.projects[3] ? 0xffdfa1 : 0x839d98); cottageLight.intensity = state.projects[3] / 6 * 3;
      flowerGroups.forEach((f, i) => { const unlocked = i < 55 || i - 55 < state.projects[0] * 4; const scale = unlocked ? 1 : .001; const next = state.reducedMotion ? scale : T.MathUtils.damp(f.scale.x, scale, 5, constructionDelta); f.scale.setScalar(next); f.visible = unlocked; if (movingWorld) f.rotation.z = Math.sin(time * 1.1 + i) * .04; });
      if (movingWorld && !closeCompanion && !state.training && !walkRoute.length && questTarget === null && time - lastAuto > 10) { lastAuto = time; walkTo(.2 + Math.sin(time * .2) * .9, 2.65 + Math.cos(time * .3) * .25, null); }
      direction.subVectors(target, dog.position); direction.y = 0;
      const distance = direction.length(); const walking = distance > .09 && !state.paused && (!state.reducedMotion || state.exploring);
      if (walking) {
        direction.normalize(); dog.position.addScaledVector(direction, Math.min(distance, delta * 1.05));
        const desired = Math.atan2(direction.x, direction.z); dog.rotation.y += Math.atan2(Math.sin(desired - dog.rotation.y), Math.cos(desired - dog.rotation.y)) * Math.min(1, delta * 8);
      } else if (walkRoute.length && !state.paused) target.copy(walkRoute.shift()!);
      else if (questTarget !== null && !state.paused) { const i = questTarget; questTarget = null; state.onQuest(i); }
      companion.update({ time, delta, walking, paused: state.paused, reducedMotion: state.reducedMotion, celebrate: state.celebrate, cameraDistance: camera.position.distanceTo(dog.position) });
      if (state.pulse !== lastPulse || (state.celebrate && !lastCelebrate)) { burstAt = state.pulse > lastPulse || state.celebrate ? time : -100; lastPulse = state.pulse; }
      lastCelebrate = state.celebrate;
      const age = time - burstAt;
      sparks.visible = age < 1.1 && !state.reducedMotion;
      if (sparks.visible) {
        const [x, z] = PROJECTS[state.focus].position;
        for (let i = 0; i < 40; i++) { const a = i * 2.399; sparkPositions[i * 3] = x + Math.cos(a) * age * (1 + i % 3 * .2); sparkPositions[i * 3 + 1] = .8 + Math.sin(i) * age + age * 2 - age * age * 1.8; sparkPositions[i * 3 + 2] = z + Math.sin(a) * age; }
        sparks.geometry.attributes.position.needsUpdate = true; (sparks.material as T.PointsMaterial).opacity = 1 - age / 1.1;
      }
      renderer.render(closeCompanion ? portraitScene : scene, camera);
    }
    frame = requestAnimationFrame(animate); setStatus("ready");
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("webglcontextlost", lost);
      dog.removeFromParent(); companion.dispose();
      portraitGround.geometry.dispose(); portraitGround.material.dispose(); portraitKey.shadow.dispose();
      const geometries = new Set<T.BufferGeometry>(), mats = new Set<T.Material>(), textures = new Set<T.Texture>();
      scene.traverse(object => { const o = object as T.Mesh; if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { mats.add(m); const texture = (m as T.MeshBasicMaterial).map; if (texture) textures.add(texture); }); });
      geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [props.chapter, retry]);

  return <div className="island-render" data-render-status={status} data-projects={props.projects.join(",")}>
    <div ref={mountRef} className="island-canvas-mount" />
    {status === "ready" && !props.training && !props.celebrate && <div className="companion-view-tools">
      <button className="world-map-button" aria-pressed={companionView} disabled={props.paused} onClick={() => { companionViewRef.current = !companionView; setCompanionView(!companionView); }}>{companionView ? "返回小岛" : "近看棉棉"}</button>
      {companionView && <><span>拖动看看它 · 滚轮拉近</span><div className="companion-angle-buttons"><button disabled={props.paused} onClick={() => { companionAngleRef.current = "front"; }}>正面</button><button disabled={props.paused} onClick={() => { companionAngleRef.current = "side"; }}>侧面</button><button disabled={props.paused} onClick={() => { companionAngleRef.current = "portrait"; }}>斜侧面</button></div></>}
    </div>}
    {companionView && !props.training && !props.celebrate && <div className="companion-caption"><p>MEET YOUR LITTLE COMPANION</p><h2>你好呀，我是棉棉。</h2><span>卷卷的毛，轻轻摇的尾巴。<br/>下一段小冒险，我还陪着你。</span><small>实时 3D 伙伴 · 比熊犬</small></div>}
    {status === "loading" && <div className="scene-loading"><span className="loading-flower">✿</span><p>正在唤醒小岛…</p></div>}
    {status === "error" && <div className="scene-loading"><h3>小岛需要重新加载</h3><p>请开启浏览器图形加速，或使用新版 Chrome。<br/>也可以继续使用练习小屋学习打字。</p><button className="secondary-button" onClick={() => { setStatus("loading"); setRetry(v => v + 1); }}>重新加载 3D</button></div>}
  </div>;
}

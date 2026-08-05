import { writeFile } from "node:fs/promises";
import { CanvasElement, createCanvas, ImageData } from "@napi-rs/canvas";
import {
  AnimationClip,
  CapsuleGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  VectorKeyframeTrack,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader = NodeFileReader;
globalThis.HTMLCanvasElement = CanvasElement;
globalThis.ImageData = ImageData;
globalThis.document = {
  createElement(tagName) {
    if (tagName !== "canvas") throw new Error(`Unsupported export element: ${tagName}`);
    return createCanvas(1, 1);
  },
};

function createCurlNormalMap(size = 256) {
  const data = new Uint8ClampedArray(size * size * 4);
  const wrap = (value) => (value + size) % size;
  const heightAt = (x, y) => {
    const u = (wrap(x) / size) * Math.PI * 2;
    const v = (wrap(y) / size) * Math.PI * 2;
    const broadCurl = Math.sin(u * 7 + Math.sin(v * 3) * 2.15);
    const crossingCurl = Math.cos(v * 8 + Math.sin(u * 4) * 1.65);
    const fineCurl = Math.sin((u + v) * 15 + Math.cos(u * 5) * 0.9);
    return broadCurl * 0.44 + crossingCurl * 0.4 + fineCurl * 0.16;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 2.9;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 2.9;
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round((-dx * inverseLength * 0.5 + 0.5) * 255);
      data[offset + 1] = Math.round((-dy * inverseLength * 0.5 + 0.5) * 255);
      data[offset + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      data[offset + 3] = 255;
    }
  }

  const canvas = createCanvas(size, size);
  canvas.getContext("2d").putImageData(new ImageData(data, size, size), 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.name = "FineBichonCurlNormal";
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4.5, 4.5);
  texture.needsUpdate = true;
  texture.flipY = false;
  return texture;
}

const curlNormalMap = createCurlNormalMap();

const root = new Group();
root.name = "AnqiBichon";
const rig = new Group();
rig.name = "BichonRig";
root.add(rig);

// A warm, highly diffuse coat avoids the pearl/plastic look of the old model.
const fur = new MeshPhysicalMaterial({
  name: "NaturalBichonCoat",
  color: 0xf4f0e7,
  roughness: 0.98,
  metalness: 0,
  sheen: 0.22,
  sheenColor: new Color(0xfffbf1),
  sheenRoughness: 0.94,
  normalMap: curlNormalMap,
  normalScale: new Vector2(0.34, 0.34),
});
const deepFur = new MeshPhysicalMaterial({
  name: "NaturalBichonShadowCoat",
  color: 0xd8d0c2,
  roughness: 1,
  metalness: 0,
  sheen: 0.12,
  sheenColor: new Color(0xf4eadc),
  sheenRoughness: 1,
  normalMap: curlNormalMap,
  normalScale: new Vector2(0.28, 0.28),
});
const coatTip = new MeshPhysicalMaterial({
  name: "FineFurTipLayer",
  color: 0xfffdf7,
  roughness: 1,
  metalness: 0,
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
  sheen: 0.35,
  sheenColor: new Color(0xffffff),
  sheenRoughness: 0.9,
});
const warmFur = new MeshPhysicalMaterial({
  name: "WarmEarAndPawFur",
  color: 0xe8ddce,
  roughness: 1,
  metalness: 0,
  sheen: 0.16,
  sheenColor: new Color(0xfff5e8),
  sheenRoughness: 0.96,
  normalMap: curlNormalMap,
  normalScale: new Vector2(0.24, 0.24),
});
const curlFur = new MeshPhysicalMaterial({
  name: "IndividualCurlLayer",
  color: 0xf8f3e9,
  roughness: 1,
  metalness: 0,
  sheen: 0.28,
  sheenColor: new Color(0xffffff),
  sheenRoughness: 0.92,
  normalMap: curlNormalMap,
  normalScale: new Vector2(0.38, 0.38),
});
const dark = new MeshStandardMaterial({ name: "EyesAndNose", color: 0x171719, roughness: 0.32 });
const eyeGlint = new MeshStandardMaterial({ name: "EyeReflection", color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.1 });
const mouth = new MeshStandardMaterial({ name: "Mouth", color: 0x2a1717, roughness: 0.72 });
const tongue = new MeshStandardMaterial({ name: "Tongue", color: 0x9d5957, roughness: 0.82 });
const leather = new MeshPhysicalMaterial({ name: "AnqiRose", color: 0x9b5e54, roughness: 0.82, metalness: 0.02 });
const brass = new MeshStandardMaterial({ name: "CollarBrass", color: 0xb89254, roughness: 0.54, metalness: 0.38 });

function mesh(parent, name, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new Mesh(geometry, material);
  item.name = name;
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

// A few recessed tufts break up the silhouette. Fine curl detail now comes from
// the embedded normal texture instead of dozens of toy-like surface bubbles.
const curlGeometry = new IcosahedronGeometry(0.026, 2);

function seeded(index) {
  const value = Math.sin(index * 79.317 + 11.73) * 43758.5453;
  return value - Math.floor(value);
}

function addFurCurls(parent, prefix, count, radii, center = [0, 0, 0], exclude = () => false) {
  for (let index = 0; index < count; index += 1) {
    const y = 1 - ((index + 0.5) / count) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    const direction = new Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
    if (exclude(direction)) continue;
    const curl = mesh(
      parent,
      `${prefix}${index}`,
      curlGeometry,
      index % 5 === 0 ? warmFur : curlFur,
      [
        center[0] + direction.x * radii[0],
        center[1] + direction.y * radii[1],
        center[2] + direction.z * radii[2],
      ],
    );
    const base = 0.62 + seeded(index + count * 3) * 0.34;
    curl.scale.set(base * (0.9 + Math.abs(direction.x) * 0.16), base * (0.78 + Math.abs(direction.y) * 0.18), base);
    curl.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
    curl.castShadow = false;
  }
}

// Long torso, visible brisket and tucked waist establish a believable small-dog silhouette.
const body = new Group();
body.name = "Body";
body.position.set(0, 0.02, -0.12);
rig.add(body);
const torso = mesh(body, "Torso", new CapsuleGeometry(0.31, 0.38, 12, 28), fur, [0, 0, 0], [1.05, 1, 0.96]);
torso.rotation.x = Math.PI / 2;
const torsoTips = mesh(body, "FurShellBody", new CapsuleGeometry(0.322, 0.395, 10, 24), coatTip, [0, 0.004, 0], [1.05, 1, 0.96]);
torsoTips.rotation.x = Math.PI / 2;
mesh(body, "Brisket", new SphereGeometry(0.31, 28, 20), deepFur, [0, 0.005, 0.31], [1.06, 1.08, 0.78]);
mesh(body, "Waist", new SphereGeometry(0.275, 26, 18), fur, [0, 0.02, -0.34], [1.02, 0.9, 0.82]);
addFurCurls(body, "BodyCurl", 14, [0.326, 0.286, 0.456], [0, 0.02, -0.015], (direction) => direction.y < -0.62 || direction.z > 0.72);

const neck = mesh(rig, "Neck", new SphereGeometry(0.255, 24, 18), deepFur, [0, 0.245, 0.285], [1.04, 0.9, 0.96]);
neck.rotation.x = -0.18;

// Everything facial is parented to the head, so sniffing and looking feel anatomical.
const head = new Group();
head.name = "Head";
head.position.set(0, 0.5, 0.34);
rig.add(head);
mesh(head, "Skull", new SphereGeometry(0.42, 36, 28), fur, [0, 0, 0], [1.08, 1.06, 0.98]);
mesh(head, "FurShellHead", new SphereGeometry(0.433, 32, 24), coatTip, [0, 0.004, -0.002], [1.08, 1.06, 0.98]);
mesh(head, "Crown", new SphereGeometry(0.295, 30, 22), fur, [0, 0.292, -0.02], [1.2, 0.7, 1]);
mesh(head, "Muzzle", new SphereGeometry(0.195, 28, 20), deepFur, [0, -0.085, 0.355], [1.22, 0.7, 0.96]);
mesh(head, "CheekL", new SphereGeometry(0.13, 22, 16), fur, [-0.13, -0.09, 0.325], [1.1, 0.88, 0.8]);
mesh(head, "CheekR", new SphereGeometry(0.13, 22, 16), fur, [0.13, -0.09, 0.325], [1.1, 0.88, 0.8]);
mesh(head, "Chin", new SphereGeometry(0.13, 22, 16), fur, [0, -0.205, 0.31], [1.05, 0.7, 0.9]);
const nose = mesh(head, "Nose", new SphereGeometry(0.061, 24, 18), dark, [0, -0.05, 0.505], [1.18, 0.78, 0.74]);
nose.rotation.x = -0.08;
mesh(head, "Smile", new SphereGeometry(0.07, 18, 12), mouth, [0, -0.145, 0.448], [1.02, 0.42, 0.52]);
mesh(head, "Tongue", new SphereGeometry(0.038, 16, 10), tongue, [0, -0.181, 0.48], [0.82, 0.52, 0.48]);
addFurCurls(head, "HeadCurl", 26, [0.43, 0.423, 0.397], [0, 0.015, -0.01], (direction) => direction.z > 0.28 && direction.y < 0.56 && Math.abs(direction.x) < 0.76);

for (const x of [-0.135, 0.135]) {
  const side = x < 0 ? "L" : "R";
  mesh(head, `Eye${side}`, new SphereGeometry(0.055, 22, 16), dark, [x * 1.08, 0.075, 0.385], [0.94, 1, 0.6]);
  mesh(head, `EyeGlint${side}`, new SphereGeometry(0.012, 10, 8), eyeGlint, [x * 1.08 - 0.012, 0.09, 0.418]);
  const brow = mesh(head, `Brow${side}`, new CapsuleGeometry(0.02, 0.085, 6, 12), deepFur, [x * 1.08, 0.17, 0.354], [1, 1, 0.72]);
  brow.rotation.z = x < 0 ? -1.18 : 1.18;
}

for (const x of [-0.345, 0.345]) {
  const side = x < 0 ? "L" : "R";
  const ear = new Group();
  ear.name = `Ear${side}`;
  ear.position.set(x, 0.02, -0.02);
  ear.rotation.z = x < 0 ? 0.14 : -0.14;
  head.add(ear);
  const earCoat = mesh(ear, `EarCoat${side}`, new CapsuleGeometry(0.12, 0.29, 9, 20), warmFur, [x < 0 ? -0.02 : 0.02, -0.13, -0.01], [0.98, 1.08, 0.8]);
  earCoat.rotation.z = x < 0 ? -0.12 : 0.12;
  mesh(ear, `EarTip${side}`, new SphereGeometry(0.13, 20, 14), warmFur, [x < 0 ? -0.045 : 0.045, -0.315, 0], [1, 1.15, 0.8]);
}

// Jointed legs keep the body lifted off the ground and give the gait real weight.
const legDefinitions = [
  ["LegFL", -0.245, 0.3], ["LegFR", 0.245, 0.3],
  ["LegBL", -0.255, -0.43], ["LegBR", 0.255, -0.43],
];
for (const [name, x, z] of legDefinitions) {
  const leg = new Group();
  leg.name = name;
  leg.position.set(x * 0.94, -0.1, z * 0.9);
  rig.add(leg);
  const upper = mesh(leg, `${name}Upper`, new CapsuleGeometry(0.1, 0.1, 8, 18), deepFur, [0, -0.065, 0], [1.03, 1, 0.98]);
  upper.rotation.x = name.includes("B") ? -0.1 : 0.06;
  mesh(leg, `${name}Lower`, new CapsuleGeometry(0.09, 0.12, 8, 18), fur, [0, -0.23, name.includes("B") ? 0.02 : 0], [1, 1, 0.96]);
  mesh(leg, `${name}Paw`, new SphereGeometry(0.122, 22, 15), warmFur, [0, -0.37, 0.052], [1.08, 0.64, 1.38]);
  addFurCurls(leg, `${name}Curl`, 4, [0.096, 0.15, 0.098], [0, -0.22, 0.02], (direction) => Math.abs(direction.y) > 0.72);
}

// A continuous curved tail replaces the old stack of toy-like fur balls.
const tail = new Group();
tail.name = "Tail";
tail.position.set(0, 0.14, -0.52);
const tailCurve = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0.08, 0.14, 0),
  new Vector3(0.11, 0.3, 0.07),
  new Vector3(0.04, 0.42, 0.18),
  new Vector3(-0.07, 0.37, 0.3),
]);
mesh(tail, "TailCoat", new TubeGeometry(tailCurve, 36, 0.085, 12, false), deepFur);
for (let index = 0; index < 8; index += 1) {
  const point = tailCurve.getPoint((index + 0.45) / 8);
  const tuft = mesh(tail, `TailCurl${index}`, curlGeometry, index % 4 === 0 ? warmFur : curlFur, point.toArray());
  const size = 1.55 + Math.sin(index * 1.7) * 0.12;
  tuft.scale.set(size * 1.02, size, size * 1.04);
  tuft.castShadow = false;
}
mesh(tail, "TailTip", new SphereGeometry(0.11, 22, 16), curlFur, [-0.07, 0.37, 0.3], [1.02, 1.08, 1.04]);
rig.add(tail);

// A restrained leather collar reads as a real pet accessory, not a costume.
const collar = mesh(rig, "Collar", new TorusGeometry(0.255, 0.022, 10, 40), leather, [0, 0.34, 0.31], [1.02, 1, 0.9]);
collar.rotation.x = Math.PI / 2 - 0.18;
const tag = mesh(rig, "Tag", new CylinderGeometry(0.043, 0.043, 0.012, 20), brass, [0, 0.265, 0.505]);
tag.rotation.x = Math.PI / 2;

// Kept as an animation anchor for backwards compatibility; no cartoon bow is rendered.
const bow = new Group();
bow.name = "Bow";
bow.position.set(0, 0.32, 0.3);
rig.add(bow);

for (const side of [-1, 1]) {
  for (let row = 0; row < 2; row += 1) {
    const whisker = mesh(head, `Whisker${side < 0 ? "L" : "R"}${row + 1}`, new CylinderGeometry(0.002, 0.003, 0.22, 5), deepFur, [side * 0.14, -0.1 - row * 0.038, 0.405]);
    whisker.rotation.z = side * (1.28 - row * 0.08);
    whisker.rotation.x = 0.24 + row * 0.1;
  }
}

function quaternionValues(eulers) {
  const quaternion = new Quaternion();
  return eulers.flatMap(([x, y, z]) => {
    quaternion.setFromEuler(new Euler(x, y, z, "XYZ"));
    return quaternion.toArray();
  });
}

function rotationTrack(node, times, eulers) {
  return new QuaternionKeyframeTrack(`${node}.quaternion`, times, quaternionValues(eulers));
}

const idleTimes = [0, 0.75, 1.5, 2.25, 3];
const clips = [
  new AnimationClip("idle", 3, [
    new VectorKeyframeTrack("BichonRig.position", idleTimes, [0, 0, 0, 0, 0.006, 0, 0, 0, 0, 0, 0.006, 0, 0, 0, 0]),
    rotationTrack("Head", idleTimes, [[0, 0, 0], [0.015, 0.04, 0], [0, 0, 0], [0.015, -0.04, 0], [0, 0, 0]]),
    rotationTrack("Tail", idleTimes, [[0, 0, 0.08], [0, 0, 0.2], [0, 0, 0.08], [0, 0, -0.06], [0, 0, 0.08]]),
  ]),
  new AnimationClip("run", 0.6, [
    new VectorKeyframeTrack("BichonRig.position", [0, 0.15, 0.3, 0.45, 0.6], [0, 0, 0, 0, 0.035, 0, 0, 0, 0, 0, 0.035, 0, 0, 0, 0]),
    rotationTrack("LegFL", [0, 0.15, 0.3, 0.45, 0.6], [[0.42, 0, 0], [0, 0, 0], [-0.38, 0, 0], [0, 0, 0], [0.42, 0, 0]]),
    rotationTrack("LegFR", [0, 0.15, 0.3, 0.45, 0.6], [[-0.38, 0, 0], [0, 0, 0], [0.42, 0, 0], [0, 0, 0], [-0.38, 0, 0]]),
    rotationTrack("LegBL", [0, 0.15, 0.3, 0.45, 0.6], [[-0.34, 0, 0], [0, 0, 0], [0.38, 0, 0], [0, 0, 0], [-0.34, 0, 0]]),
    rotationTrack("LegBR", [0, 0.15, 0.3, 0.45, 0.6], [[0.38, 0, 0], [0, 0, 0], [-0.34, 0, 0], [0, 0, 0], [0.38, 0, 0]]),
    rotationTrack("Head", [0, 0.3, 0.6], [[0.025, 0, 0], [-0.025, 0, 0], [0.025, 0, 0]]),
    rotationTrack("Tail", [0, 0.15, 0.3, 0.45, 0.6], [[0, 0, 0.24], [0, 0, -0.16], [0, 0, 0.24], [0, 0, -0.16], [0, 0, 0.24]]),
  ]),
  new AnimationClip("jump", 0.72, [
    new VectorKeyframeTrack("BichonRig.position", [0, 0.18, 0.43, 0.72], [0, 0, 0, 0, -0.035, 0, 0, 0.095, 0, 0, 0, 0]),
    rotationTrack("Head", [0, 0.36, 0.72], [[0.08, 0, 0], [-0.1, 0, 0], [0, 0, 0]]),
    rotationTrack("LegFL", [0, 0.36, 0.72], [[0, 0, 0], [-0.35, 0, 0], [0, 0, 0]]),
    rotationTrack("LegFR", [0, 0.36, 0.72], [[0, 0, 0], [-0.35, 0, 0], [0, 0, 0]]),
    rotationTrack("LegBL", [0, 0.36, 0.72], [[0, 0, 0], [0.24, 0, 0], [0, 0, 0]]),
    rotationTrack("LegBR", [0, 0.36, 0.72], [[0, 0, 0], [0.24, 0, 0], [0, 0, 0]]),
  ]),
  new AnimationClip("sniff", 2.2, [
    rotationTrack("Head", [0, 0.55, 1.1, 1.65, 2.2], [[0, 0, 0], [0.32, 0.1, 0], [0.38, -0.14, 0], [0.3, 0.07, 0], [0, 0, 0]]),
    new VectorKeyframeTrack("BichonRig.position", [0, 0.55, 1.65, 2.2], [0, 0, 0, 0, -0.018, 0.045, 0, -0.018, 0.045, 0, 0, 0]),
    rotationTrack("Tail", [0, 0.55, 1.1, 1.65, 2.2], [[0, 0, 0.06], [0, 0, 0.18], [0, 0, 0.03], [0, 0, 0.18], [0, 0, 0.06]]),
  ]),
  new AnimationClip("celebrate", 1.2, [
    new VectorKeyframeTrack("BichonRig.position", [0, 0.22, 0.5, 0.82, 1.2], [0, 0, 0, 0, 0.17, 0, 0, 0.015, 0, 0, 0.12, 0, 0, 0, 0]),
    rotationTrack("Head", [0, 0.3, 0.7, 1.2], [[0, 0, 0], [-0.12, 0, -0.09], [-0.08, 0, 0.09], [0, 0, 0]]),
    rotationTrack("Tail", [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], [[0, 0, 0.3], [0, 0, -0.28], [0, 0, 0.3], [0, 0, -0.28], [0, 0, 0.3], [0, 0, -0.28], [0, 0, 0.08]]),
  ]),
];

root.traverse((object) => {
  if (object instanceof Mesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});

const exporter = new GLTFExporter();
const arrayBuffer = await exporter.parseAsync(root, {
  binary: true,
  animations: clips,
  onlyVisible: true,
  trs: true,
});
await writeFile(new URL("../public/models/anqi-bichon.glb", import.meta.url), Buffer.from(arrayBuffer));
console.log(`Created public/models/anqi-bichon.glb (${Math.round(arrayBuffer.byteLength / 1024)} KB)`);

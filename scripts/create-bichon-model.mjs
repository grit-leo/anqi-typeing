import { writeFile } from "node:fs/promises";
import {
  AnimationClip,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
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
});
const deepFur = new MeshPhysicalMaterial({
  name: "NaturalBichonShadowCoat",
  color: 0xd8d0c2,
  roughness: 1,
  metalness: 0,
  sheen: 0.12,
  sheenColor: new Color(0xf4eadc),
  sheenRoughness: 1,
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
const dark = new MeshStandardMaterial({ name: "EyesAndNose", color: 0x171719, roughness: 0.32 });
const eyeGlint = new MeshStandardMaterial({ name: "EyeReflection", color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.1 });
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

// Long torso, visible brisket and tucked waist establish a believable small-dog silhouette.
const body = new Group();
body.name = "Body";
body.position.set(0, 0.02, -0.12);
rig.add(body);
const torso = mesh(body, "Torso", new CapsuleGeometry(0.33, 0.55, 12, 28), fur, [0, 0, 0], [1.04, 1, 0.98]);
torso.rotation.x = Math.PI / 2;
const torsoTips = mesh(body, "FurShellBody", new CapsuleGeometry(0.34, 0.56, 10, 24), coatTip, [0, 0.004, 0], [1.04, 1, 0.98]);
torsoTips.rotation.x = Math.PI / 2;
mesh(body, "Brisket", new SphereGeometry(0.35, 28, 20), deepFur, [0, 0.01, 0.39], [1.03, 1.1, 0.73]);
mesh(body, "Waist", new SphereGeometry(0.3, 26, 18), fur, [0, 0.025, -0.46], [0.98, 0.86, 0.72]);

const neck = mesh(rig, "Neck", new CapsuleGeometry(0.24, 0.2, 10, 22), deepFur, [0, 0.28, 0.3], [1.06, 1, 0.9]);
neck.rotation.x = -0.38;

// Everything facial is parented to the head, so sniffing and looking feel anatomical.
const head = new Group();
head.name = "Head";
head.position.set(0, 0.59, 0.42);
rig.add(head);
mesh(head, "Skull", new SphereGeometry(0.36, 34, 26), fur, [0, 0, 0], [1.06, 1.02, 0.92]);
mesh(head, "FurShellHead", new SphereGeometry(0.371, 30, 23), coatTip, [0, 0.004, -0.002], [1.06, 1.02, 0.92]);
mesh(head, "Crown", new SphereGeometry(0.25, 28, 20), fur, [0, 0.25, -0.025], [1.18, 0.62, 0.93]);
mesh(head, "Muzzle", new SphereGeometry(0.18, 26, 18), deepFur, [0, -0.08, 0.3], [1.18, 0.67, 0.92]);
mesh(head, "Chin", new SphereGeometry(0.12, 20, 14), fur, [0, -0.18, 0.27], [1.05, 0.68, 0.88]);
const nose = mesh(head, "Nose", new SphereGeometry(0.057, 22, 16), dark, [0, -0.045, 0.455], [1.16, 0.76, 0.74]);
nose.rotation.x = -0.08;

for (const x of [-0.135, 0.135]) {
  const side = x < 0 ? "L" : "R";
  mesh(head, `Eye${side}`, new SphereGeometry(0.052, 22, 16), dark, [x, 0.07, 0.315], [0.91, 1.05, 0.64]);
  mesh(head, `EyeGlint${side}`, new SphereGeometry(0.012, 10, 8), eyeGlint, [x - 0.012, 0.086, 0.347]);
  const brow = mesh(head, `Brow${side}`, new CapsuleGeometry(0.022, 0.09, 6, 12), deepFur, [x, 0.155, 0.293], [1, 1, 0.72]);
  brow.rotation.z = x < 0 ? -1.18 : 1.18;
}

for (const x of [-0.31, 0.31]) {
  const side = x < 0 ? "L" : "R";
  const ear = new Group();
  ear.name = `Ear${side}`;
  ear.position.set(x, 0.02, -0.02);
  ear.rotation.z = x < 0 ? 0.14 : -0.14;
  head.add(ear);
  const earCoat = mesh(ear, `EarCoat${side}`, new CapsuleGeometry(0.105, 0.27, 9, 20), deepFur, [x < 0 ? -0.02 : 0.02, -0.12, -0.01], [0.92, 1.08, 0.72]);
  earCoat.rotation.z = x < 0 ? -0.12 : 0.12;
  mesh(ear, `EarTip${side}`, new SphereGeometry(0.115, 20, 14), fur, [x < 0 ? -0.045 : 0.045, -0.29, 0], [0.92, 1.12, 0.72]);
}

// Jointed legs keep the body lifted off the ground and give the gait real weight.
const legDefinitions = [
  ["LegFL", -0.245, 0.3], ["LegFR", 0.245, 0.3],
  ["LegBL", -0.255, -0.43], ["LegBR", 0.255, -0.43],
];
for (const [name, x, z] of legDefinitions) {
  const leg = new Group();
  leg.name = name;
  leg.position.set(x, -0.12, z);
  rig.add(leg);
  const upper = mesh(leg, `${name}Upper`, new CapsuleGeometry(0.095, 0.16, 8, 18), deepFur, [0, -0.09, 0], [1.02, 1, 0.96]);
  upper.rotation.x = name.includes("B") ? -0.1 : 0.06;
  mesh(leg, `${name}Lower`, new CapsuleGeometry(0.083, 0.19, 8, 18), fur, [0, -0.31, name.includes("B") ? 0.025 : 0], [1, 1, 0.94]);
  mesh(leg, `${name}Paw`, new SphereGeometry(0.115, 22, 15), deepFur, [0, -0.48, 0.055], [1.04, 0.58, 1.38]);
}

// A continuous curved tail replaces the old stack of toy-like fur balls.
const tail = new Group();
tail.name = "Tail";
tail.position.set(0.17, 0.14, -0.64);
const tailCurve = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0.11, 0.16, -0.04),
  new Vector3(0.13, 0.36, 0.03),
  new Vector3(0.04, 0.5, 0.17),
  new Vector3(-0.09, 0.45, 0.29),
]);
mesh(tail, "TailCoat", new TubeGeometry(tailCurve, 32, 0.083, 10, false), fur);
mesh(tail, "TailTip", new SphereGeometry(0.12, 22, 16), fur, [-0.09, 0.45, 0.29], [0.92, 1.08, 0.92]);
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

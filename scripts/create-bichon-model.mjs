import { writeFile } from "node:fs/promises";
import {
  AnimationClip,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  QuaternionKeyframeTrack,
  SphereGeometry,
  TorusGeometry,
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

const fur = new MeshPhysicalMaterial({
  name: "PearlCurlFur",
  color: 0xfffcf5,
  roughness: 0.84,
  metalness: 0,
  sheen: 0.7,
  sheenColor: new Color(0xffeadf),
  sheenRoughness: 0.58,
  clearcoat: 0.08,
  clearcoatRoughness: 0.8,
});
const shadowFur = new MeshPhysicalMaterial({
  name: "WarmCurlFur",
  color: 0xe8ddd0,
  roughness: 0.92,
  sheen: 0.48,
  sheenColor: new Color(0xffeee2),
  sheenRoughness: 0.72,
});
const dark = new MeshStandardMaterial({ name: "EyesAndNose", color: 0x17151c, roughness: 0.46 });
const pink = new MeshPhysicalMaterial({ name: "AnqiRose", color: 0xe789ad, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.35 });
const gold = new MeshStandardMaterial({ name: "WishGold", color: 0xf5c866, roughness: 0.42, metalness: 0.25 });

function namedMesh(name, geometry, material, position, scale = [1, 1, 1]) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  rig.add(mesh);
  return mesh;
}

namedMesh("Body", new SphereGeometry(0.46, 30, 22), fur, [0, 0.02, -0.02], [1.12, 0.92, 1.05]);
namedMesh("Chest", new SphereGeometry(0.31, 24, 18), shadowFur, [0, 0.06, 0.31], [1.08, 1.18, 0.52]);
namedMesh("Head", new SphereGeometry(0.44, 32, 24), fur, [0, 0.59, 0.08], [1.1, 1.05, 0.99]);
namedMesh("Muzzle", new SphereGeometry(0.2, 24, 18), shadowFur, [0, 0.5, 0.41], [1.16, 0.72, 0.8]);
namedMesh("Nose", new SphereGeometry(0.068, 18, 14), dark, [0, 0.55, 0.57], [1.08, 0.78, 0.72]);

for (const x of [-0.15, 0.15]) {
  namedMesh(x < 0 ? "EyeL" : "EyeR", new SphereGeometry(0.058, 18, 14), dark, [x, 0.69, 0.43], [0.9, 1.1, 0.64]);
  namedMesh(x < 0 ? "EyeGlintL" : "EyeGlintR", new SphereGeometry(0.014, 10, 8), new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15 }), [x - 0.014, 0.711, 0.466]);
}

for (const x of [-0.4, 0.4]) {
  const ear = namedMesh(x < 0 ? "EarL" : "EarR", new CapsuleGeometry(0.13, 0.27, 8, 16), shadowFur, [x, 0.52, 0.03], [0.88, 1.12, 0.78]);
  ear.rotation.z = x < 0 ? 0.2 : -0.2;
}

const legs = [
  ["LegFL", -0.25, 0.21], ["LegFR", 0.25, 0.21], ["LegBL", -0.25, -0.2], ["LegBR", 0.25, -0.2],
];
for (const [name, x, z] of legs) {
  namedMesh(name, new CapsuleGeometry(0.108, 0.2, 7, 14), fur, [x, -0.35, z]);
  namedMesh(`${name}Paw`, new SphereGeometry(0.135, 18, 13), shadowFur, [x, -0.53, z + 0.04], [1, 0.64, 1.27]);
}

const tail = new Group();
tail.name = "Tail";
tail.position.set(0.28, 0.12, -0.39);
[[0, 0, 0], [0.08, 0.14, -0.03], [0.03, 0.28, 0.02], [-0.08, 0.38, 0.05]].forEach(([x, y, z], index) => {
  const puff = new Mesh(new IcosahedronGeometry(0.16 - index * 0.012, 2), index % 2 ? shadowFur : fur);
  puff.name = `TailCurl${index + 1}`;
  puff.position.set(x, y, z);
  tail.add(puff);
});
rig.add(tail);

const collar = namedMesh("Collar", new TorusGeometry(0.315, 0.037, 10, 32), pink, [0, 0.31, 0.06], [1, 1, 0.92]);
collar.rotation.x = Math.PI / 2;
const tag = namedMesh("Tag", new OctahedronGeometry(0.078, 0), gold, [0, 0.25, 0.38]);
tag.rotation.z = Math.PI / 4;

const bow = new Group();
bow.name = "Bow";
bow.position.set(0, 0.43, -0.4);
for (const x of [-0.11, 0.11]) {
  const wing = new Mesh(new SphereGeometry(0.108, 16, 12), pink);
  wing.position.x = x;
  wing.scale.set(1.32, 0.74, 0.48);
  bow.add(wing);
}
bow.add(new Mesh(new SphereGeometry(0.06, 12, 10), gold));
rig.add(bow);

// Real raised curls create the coat silhouette and catch light like soft fur.
const curlGeometry = new DodecahedronGeometry(0.082, 1);
const bodyCurls = [];
const headCurls = [];
for (let index = 0; index < 86; index += 1) {
  const y = 1 - (index / 85) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (z > -0.78) bodyCurls.push([x * 0.49, y * 0.4 + 0.03, z * 0.46 - 0.02]);
}
for (let index = 0; index < 92; index += 1) {
  const y = 1 - (index / 91) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (z > -0.72 && !(z > 0.55 && y < 0.15)) headCurls.push([x * 0.47, y * 0.45 + 0.59, z * 0.43 + 0.08]);
}

function addCurlCoat(name, positions) {
  const coat = new InstancedMesh(curlGeometry, fur, positions.length);
  coat.name = name;
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  positions.forEach(([x, y, z], index) => {
    const scale = 0.82 + (index % 7) * 0.035;
    matrix.compose(new Vector3(x, y, z), quaternion, new Vector3(scale, scale * 0.82, scale));
    coat.setMatrixAt(index, matrix);
  });
  coat.castShadow = true;
  rig.add(coat);
}
addCurlCoat("FurTuftsBody", bodyCurls);
addCurlCoat("FurTuftsHead", headCurls);

// Subtle whiskers and brows keep the face readable at game-camera distance.
for (const side of [-1, 1]) {
  const whisker = namedMesh(side < 0 ? "WhiskerL" : "WhiskerR", new CylinderGeometry(0.004, 0.008, 0.27, 6), shadowFur, [side * 0.17, 0.48, 0.56]);
  whisker.rotation.z = side * 1.18;
  whisker.rotation.x = 0.3;
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

const idleTimes = [0, 1, 2, 3];
const clips = [
  new AnimationClip("idle", 3, [
    new VectorKeyframeTrack("BichonRig.position", idleTimes, [0, 0, 0, 0, 0.012, 0, 0, 0, 0, 0, 0.012, 0]),
    rotationTrack("Head", idleTimes, [[0, 0, 0], [0, 0.055, 0], [0, 0, 0], [0, -0.055, 0]]),
    rotationTrack("Tail", idleTimes, [[0, 0, 0.18], [0, 0, 0.34], [0, 0, 0.18], [0, 0, 0.02]]),
  ]),
  new AnimationClip("run", 0.56, [
    new VectorKeyframeTrack("BichonRig.position", [0, 0.14, 0.28, 0.42, 0.56], [0, 0, 0, 0, 0.055, 0, 0, 0, 0, 0, 0.055, 0, 0, 0, 0]),
    rotationTrack("LegFL", [0, 0.14, 0.28, 0.42, 0.56], [[0.55, 0, 0], [0, 0, 0], [-0.55, 0, 0], [0, 0, 0], [0.55, 0, 0]]),
    rotationTrack("LegFR", [0, 0.14, 0.28, 0.42, 0.56], [[-0.55, 0, 0], [0, 0, 0], [0.55, 0, 0], [0, 0, 0], [-0.55, 0, 0]]),
    rotationTrack("LegBL", [0, 0.14, 0.28, 0.42, 0.56], [[-0.55, 0, 0], [0, 0, 0], [0.55, 0, 0], [0, 0, 0], [-0.55, 0, 0]]),
    rotationTrack("LegBR", [0, 0.14, 0.28, 0.42, 0.56], [[0.55, 0, 0], [0, 0, 0], [-0.55, 0, 0], [0, 0, 0], [0.55, 0, 0]]),
    rotationTrack("Tail", [0, 0.14, 0.28, 0.42, 0.56], [[0, 0, 0.46], [0, 0, -0.12], [0, 0, 0.46], [0, 0, -0.12], [0, 0, 0.46]]),
  ]),
  new AnimationClip("jump", 0.72, [
    new VectorKeyframeTrack("BichonRig.position", [0, 0.16, 0.42, 0.72], [0, 0, 0, 0, -0.05, 0, 0, 0.11, 0, 0, 0, 0]),
    new VectorKeyframeTrack("BichonRig.scale", [0, 0.16, 0.42, 0.72], [1, 1, 1, 1.08, 0.88, 1.08, 0.94, 1.08, 0.94, 1, 1, 1]),
    rotationTrack("Head", [0, 0.36, 0.72], [[0.12, 0, 0], [-0.14, 0, 0], [0, 0, 0]]),
    rotationTrack("LegFL", [0, 0.36, 0.72], [[0, 0, 0], [-0.45, 0, 0], [0, 0, 0]]),
    rotationTrack("LegFR", [0, 0.36, 0.72], [[0, 0, 0], [-0.45, 0, 0], [0, 0, 0]]),
  ]),
  new AnimationClip("sniff", 2.2, [
    rotationTrack("Head", [0, 0.55, 1.1, 1.65, 2.2], [[0, 0, 0], [0.42, 0.12, 0], [0.48, -0.16, 0], [0.36, 0.08, 0], [0, 0, 0]]),
    new VectorKeyframeTrack("BichonRig.position", [0, 0.55, 1.65, 2.2], [0, 0, 0, 0, -0.035, 0.08, 0, -0.035, 0.08, 0, 0, 0]),
    rotationTrack("Tail", [0, 0.55, 1.1, 1.65, 2.2], [[0, 0, 0.12], [0, 0, 0.28], [0, 0, 0.08], [0, 0, 0.28], [0, 0, 0.12]]),
  ]),
  new AnimationClip("celebrate", 1.2, [
    new VectorKeyframeTrack("BichonRig.position", [0, 0.22, 0.5, 0.82, 1.2], [0, 0, 0, 0, 0.24, 0, 0, 0.02, 0, 0, 0.17, 0, 0, 0, 0]),
    rotationTrack("Head", [0, 0.3, 0.7, 1.2], [[0, 0, 0], [-0.18, 0, -0.16], [-0.1, 0, 0.16], [0, 0, 0]]),
    rotationTrack("Tail", [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], [[0, 0, 0.45], [0, 0, -0.42], [0, 0, 0.45], [0, 0, -0.42], [0, 0, 0.45], [0, 0, -0.42], [0, 0, 0.18]]),
    rotationTrack("Bow", [0, 0.3, 0.6, 0.9, 1.2], [[0, 0, 0], [0, 0, 0.14], [0, 0, -0.14], [0, 0, 0.14], [0, 0, 0]]),
  ]),
];

root.traverse((object) => {
  if (object instanceof Mesh || object instanceof InstancedMesh) {
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

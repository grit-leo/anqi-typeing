import * as T from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

type Ellipsoid = [number, number, number, number, number, number];
export type CompanionFrame = {
  time: number; delta: number; walking: boolean; paused: boolean;
  reducedMotion: boolean; celebrate: boolean; cameraDistance: number;
};

/** A continuous groomed coat, not a collection of visible cotton-ball primitives. */
function sculpt(parts: Ellipsoid[], smooth = .07, resolution = 42) {
  const temporaryMaterial = new T.MeshBasicMaterial();
  const marching = new MarchingCubes(resolution, temporaryMaterial, false, false, 20000);
  marching.isolation = 0;
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = x / resolution * 2 - 1, py = y / resolution * 2 - 1, pz = z / resolution * 2 - 1;
    let distance = 10;
    for (const [cx, cy, cz, rx, ry, rz] of parts) {
      const d = (Math.hypot((px - cx) / rx, (py - cy) / ry, (pz - cz) / rz) - 1) * Math.min(rx, ry, rz);
      const h = Math.max(smooth - Math.abs(distance - d), 0) / smooth;
      distance = Math.min(distance, d) - h * h * smooth * .25;
    }
    marching.field[z * resolution * resolution + y * resolution + x] = -distance;
  }
  marching.update();
  const geometry = new T.BufferGeometry();
  for (const name of ["position", "normal"]) {
    geometry.setAttribute(name, new T.BufferAttribute((marching.geometry.getAttribute(name).array as Float32Array).slice(0, marching.count * 3), 3));
  }
  const position = geometry.getAttribute("position"), uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = .5 + Math.atan2(position.getZ(i), position.getX(i)) / (2 * Math.PI);
    uv[i * 2 + 1] = .5 + position.getY(i) * .5;
  }
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
  geometry.normalizeNormals(); geometry.computeBoundingSphere();
  marching.geometry.dispose(); temporaryMaterial.dispose();
  return geometry;
}

function seededRandom() {
  let seed = 82641;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

/** Fine, irregular ringlets give the coat a soft silhouette in a small number of draw calls. */
export function createBichonCompanion() {
  const root = new T.Group(); root.name = "MianmianBichon";
  const rig = new T.Group(); rig.name = "BodyRig"; root.add(rig);
  const random = seededRandom();
  const ownedGeometries = new Set<T.BufferGeometry>(), ownedMaterials = new Set<T.Material>();
  const furMeshes: T.InstancedMesh[] = [];
  const geometry = <G extends T.BufferGeometry>(g: G) => { ownedGeometries.add(g); return g; };
  const material = <M extends T.Material>(m: M) => { ownedMaterials.add(m); return m; };

  // A tiny repeatable fibre relief complements real geometry; no network asset is needed.
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const curl = Math.sin(x * .63 + Math.sin(y * .39) * 2.4) * Math.sin(y * .58 + Math.sin(x * .28));
    const value = 153 + curl * 47 + (random() - .5) * 26;
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value; pixels[offset + 3] = 255;
  }
  const relief = new T.DataTexture(pixels, size, size); relief.wrapS = relief.wrapT = T.RepeatWrapping;
  relief.repeat.set(5, 5); relief.magFilter = T.LinearFilter; relief.minFilter = T.LinearMipmapLinearFilter;
  relief.generateMipmaps = true; relief.needsUpdate = true;
  const coat = material(new T.MeshPhysicalMaterial({ color: 0xfffcf5, roughness: 1, bumpMap: relief, bumpScale: .006, sheen: .65, sheenColor: new T.Color(0xffffff), sheenRoughness: 1 }));
  const fibre = material(new T.MeshPhysicalMaterial({ color: 0xfffdf6, roughness: 1, sheen: 1, sheenColor: new T.Color(0xffffff), sheenRoughness: 1, emissive: 0xaca79f, emissiveIntensity: .08 }));
  const skin = material(new T.MeshStandardMaterial({ color: 0x302924, roughness: .88 }));
  const eyeMaterial = material(new T.MeshPhysicalMaterial({ color: 0x130f0d, roughness: .14, clearcoat: 1, clearcoatRoughness: .1 }));
  const noseMaterial = material(new T.MeshPhysicalMaterial({ color: 0x252321, roughness: .56, clearcoat: .18, bumpMap: relief, bumpScale: .004 }));
  const mouthMaterial = material(new T.MeshStandardMaterial({ color: 0x554039, roughness: .9 }));
  const pink = material(new T.MeshStandardMaterial({ color: 0xb87f7e, roughness: .85 }));
  const sphere = geometry(new T.SphereGeometry(1, 28, 20));
  function mesh(parent: T.Object3D, g: T.BufferGeometry, m: T.Material, name: string) {
    const o = new T.Mesh(g, m); o.name = name; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function oval(parent: T.Object3D, m: T.Material, name: string, p: number[], s: number[]) {
    const o = mesh(parent, sphere, m, name); o.position.set(p[0], p[1], p[2]); o.scale.set(s[0], s[1], s[2]); return o;
  }
  const curlPath = new T.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const t = i / 8, angle = t * Math.PI * 1.8;
    return new T.Vector3(Math.sin(angle) * .4 * Math.sin(t * Math.PI), t * .65 + Math.sin(t * Math.PI) * .2, (Math.cos(angle) - 1) * .28 * Math.sin(t * Math.PI));
  }));
  const curlGeometry = geometry(new T.TubeGeometry(curlPath, 8, .055, 4, false));
  const up = new T.Vector3(0, 1, 0), transform = new T.Object3D(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const position = new T.Vector3(), normal = new T.Vector3(), color = new T.Color();
  function fur(parent: T.Object3D, g: T.BufferGeometry, count: number, length: number, trimFace = false) {
    const surface = mesh(parent, g, coat, "ContinuousCoat");
    const p = g.getAttribute("position"), n = g.getAttribute("normal"), index = g.getIndex();
    const triangles = (index ? index.count : p.count) / 3, weights = new Float32Array(triangles);
    const vertex = (i: number) => index ? index.getX(i) : i;
    let area = 0;
    for (let i = 0; i < triangles; i++) {
      a.fromBufferAttribute(p, vertex(i * 3)); b.fromBufferAttribute(p, vertex(i * 3 + 1)); c.fromBufferAttribute(p, vertex(i * 3 + 2));
      area += b.sub(a).cross(c.sub(a)).length(); weights[i] = area;
    }
    const curls = new T.InstancedMesh(curlGeometry, fibre, count); curls.name = "FineCurledFur";
    // The continuous undercoat casts the shadow. Fine strands do not double shadow-map cost.
    curls.castShadow = false; curls.receiveShadow = false; curls.userData.fullCount = count;
    for (let i = 0; i < count; i++) {
      const sample = random() * area;
      let low = 0, high = triangles - 1;
      while (low < high) { const mid = (low + high) >>> 1; if (weights[mid] < sample) low = mid + 1; else high = mid; }
      const ids = [vertex(low * 3), vertex(low * 3 + 1), vertex(low * 3 + 2)];
      const u = Math.sqrt(random()), v = random(), factors = [1 - u, u * (1 - v), u * v];
      position.set(0, 0, 0); normal.set(0, 0, 0);
      ids.forEach((id, k) => { a.fromBufferAttribute(p, id); position.addScaledVector(a, factors[k]); a.fromBufferAttribute(n, id); normal.addScaledVector(a, factors[k]); });
      normal.normalize();
      let strandLength = length * (.65 + random() * .7);
      if (trimFace && position.z > .19) {
        const eyes = Math.hypot(Math.abs(position.x) - .137, position.y - .054);
        if (eyes < .06) strandLength *= .2;
        else if (position.z > .38) strandLength *= .6;
      }
      transform.position.copy(position).addScaledVector(normal, -.003);
      transform.quaternion.setFromUnitVectors(up, normal); transform.rotateY(random() * Math.PI * 2);
      transform.scale.set(strandLength * (1 + random() * .6), strandLength, strandLength);
      transform.updateMatrix(); curls.setMatrixAt(i, transform.matrix);
      const shade = .96 + random() * .04; color.setRGB(shade, shade * .997, shade * .989); curls.setColorAt(i, color);
    }
    curls.instanceMatrix.needsUpdate = true; if (curls.instanceColor) curls.instanceColor.needsUpdate = true;
    curls.computeBoundingSphere(); parent.add(curls); furMeshes.push(curls);
    return surface;
  }

  const body = new T.Group(); body.name = "ChestAndBack"; body.position.set(0, .61, -.1); rig.add(body);
  fur(body, geometry(sculpt([[0, 0, -.03, .25, .28, .46], [0, .055, .29, .235, .28, .25], [0, -.03, -.34, .245, .24, .23]], .1)), 7200, .03);
  const neck = new T.Group(); neck.position.set(0, .79, .28); rig.add(neck);
  fur(neck, geometry(sculpt([[0, 0, 0, .21, .28, .23]], .06, 34)), 1100, .04);

  const head = new T.Group(); head.name = "Head"; head.position.set(0, 1.04, .39); rig.add(head);
  const face = geometry(sculpt([
    [0, .025, -.015, .335, .305, .275],
    [-.14, -.105, .14, .165, .155, .17], [.14, -.105, .14, .165, .155, .17],
    [0, -.095, .29, .16, .115, .158], [0, -.19, .25, .14, .075, .135],
  ], .075, 56));
  fur(head, face, 11500, .029, true);
  const ears: T.Group[] = [], eyes: T.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new T.Group(); ear.name = side < 0 ? "EarLeft" : "EarRight";
    ear.position.set(side * .26, .04, -.025); ear.rotation.z = side * .09; head.add(ear); ears.push(ear);
    fur(ear, geometry(sculpt([[side * .025, -.12, 0, .12, .17, .145], [0, -.03, -.018, .1, .12, .13]], .05, 44)), 1600, .035);
    const eye = new T.Group(); eye.name = side < 0 ? "EyeLeft" : "EyeRight"; eye.position.set(side * .137, .054, .242); head.add(eye); eyes.push(eye);
    oval(eye, skin, "Eyelid", [0, 0, 0], [.048, .05, .024]);
    oval(eye, eyeMaterial, "DarkBrownEye", [0, .002, .008], [.038, .04, .023]);
    oval(eye, material(new T.MeshBasicMaterial({ color: 0xfff8e9 })), "EyeCatchlight", [-.011, .016, .028], [.005, .005, .0025]);
  }
  const nose = oval(head, noseMaterial, "Nose", [0, -.068, .439], [.071, .048, .037]);
  // Taper the underside of the nose rather than using a round toy button.
  const noseGeometry = geometry(sphere.clone()), np = noseGeometry.getAttribute("position");
  for (let i = 0; i < np.count; i++) np.setX(i, np.getX(i) * (.72 + (np.getY(i) + 1) * .14));
  noseGeometry.computeVertexNormals(); nose.geometry = noseGeometry;
  [-1, 1].forEach(side => oval(head, skin, "Nostril", [side * .038, -.073, .47], [.011, .008, .004]));
  const mouthCurve = new T.CatmullRomCurve3([new T.Vector3(-.1, -.16, .387), new T.Vector3(-.052, -.181, .407), new T.Vector3(0, -.172, .418), new T.Vector3(.052, -.181, .407), new T.Vector3(.1, -.16, .387)]);
  mesh(head, geometry(new T.TubeGeometry(mouthCurve, 18, .004, 5, false)), mouthMaterial, "SoftMouthLine");
  const tongue = oval(head, pink, "Tongue", [0, -.195, .405], [.027, .027, .012]); tongue.visible = false;

  // Slim leather collar tucked into the coat, with a small brass identity tag.
  const collarMat = material(new T.MeshStandardMaterial({ color: 0x8e6769, roughness: .8 }));
  const collar = mesh(neck, geometry(new T.TorusGeometry(.217, .019, 7, 40)), collarMat, "LeatherCollar"); collar.rotation.x = Math.PI / 2; collar.position.y = -.035;
  const tag = mesh(neck, geometry(new T.SphereGeometry(1, 16, 10)), material(new T.MeshStandardMaterial({ color: 0xc8aa6e, metalness: .55, roughness: .4 })), "BrassTag");
  tag.position.set(0, -.117, .228); tag.scale.set(.028, .035, .009);

  const legs: { hip: T.Group; ankle: T.Group; front: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const front = i < 2, hip = new T.Group(); hip.name = ["LegFL", "LegFR", "LegBL", "LegBR"][i];
    hip.position.set(i % 2 ? .171 : -.171, .49, front ? .25 : -.405); rig.add(hip);
    fur(hip, geometry(sculpt([[0, -.1, 0, .096, .22, .108]], .05, 44)), 520, .026);
    const ankle = new T.Group(); ankle.name = "Ankle"; ankle.position.set(0, -.255, front ? 0 : -.018); hip.add(ankle);
    fur(ankle, geometry(sculpt([[0, -.095, 0, .077, .15, .085], [0, -.177, .041, .092, .058, .132]], .035, 48)), 640, .025);
    legs.push({ hip, ankle, front });
  }
  const tail = new T.Group(); tail.name = "PlumeTail"; tail.position.set(0, .78, -.51); rig.add(tail);
  fur(tail, geometry(sculpt([[0, .055, -.045, .062, .125, .074], [0, .205, -.115, .07, .14, .09], [.018, .315, .008, .094, .084, .17], [.015, .255, .15, .107, .107, .12]], .075, 52)), 2800, .036);

  let stride = 0, locomotion = 0, disposed = false;
  function update(frame: CompanionFrame) {
    const { time, delta, walking, paused, reducedMotion, celebrate, cameraDistance } = frame;
    const detail = cameraDistance < 3.8 ? 1 : cameraDistance < 7 ? .45 : .22;
    furMeshes.forEach(f => { f.count = Math.floor(f.userData.fullCount * detail); });
    if (paused) return;
    const motion = !reducedMotion;
    locomotion = T.MathUtils.damp(locomotion, walking ? 1 : 0, 9, delta);
    if (walking) stride += delta * 9;
    const gait = motion ? locomotion : 0;
    // A four-beat walk with flexing ankles, not four rigid swinging sticks.
    legs.forEach(({ hip, ankle, front }, i) => {
      const phase = stride + [0, Math.PI, Math.PI * .55, Math.PI * 1.55][i];
      hip.rotation.x = Math.sin(phase) * .36 * gait;
      ankle.rotation.x = Math.max(0, Math.cos(phase)) * (front ? -.33 : .38) * gait;
      hip.position.y = .49 + Math.max(0, Math.cos(phase)) * .025 * gait;
    });
    const sniff = motion && !walking ? Math.pow(Math.max(0, Math.sin(time * .36 - 1)), 14) : 0;
    rig.position.y = motion ? Math.sin(stride * 2) * .008 * gait + (celebrate ? Math.max(0, Math.sin(time * 4.5)) * .12 : 0) : 0;
    rig.rotation.z = Math.sin(stride) * .015 * gait;
    body.scale.y = motion ? 1 + Math.sin(time * 2.3) * .009 : 1;
    head.rotation.set(motion ? -.035 * gait + sniff * .31 : 0, motion ? Math.sin(time * .63) * .1 * (1 - gait) : 0, motion ? Math.sin(time * .9) * .025 : 0);
    ears.forEach((ear, i) => { ear.rotation.x = motion ? Math.sin(stride + i * .4) * .1 * gait + Math.sin(time * 1.2) * .017 : 0; });
    tail.rotation.z = motion ? Math.sin(time * (celebrate ? 10 : 5.5)) * (celebrate ? .28 : .16) : 0;
    const blinkPhase = time % 4.7, blink = motion && blinkPhase > 4.5 ? Math.sin((blinkPhase - 4.5) / .2 * Math.PI) : 0;
    eyes.forEach(eye => { eye.scale.y = 1 - blink * .94; });
    tongue.visible = motion && (celebrate || (walking && Math.sin(time * .5) > .75));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; furMeshes.forEach(f => f.dispose());
    ownedGeometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose()); relief.dispose();
  }
  return { root, update, dispose };
}

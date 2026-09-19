import assert from "node:assert/strict";
import test from "node:test";
import * as T from "three";
import { createBichonCompanion } from "../app/BichonCompanion.ts";

const still = { time: 0, delta: 1 / 60, walking: false, paused: false, reducedMotion: false, celebrate: false, cameraDistance: 3 };
function pose(root) {
  const result = [];
  root.traverse(o => result.push([...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray(), o.visible]));
  return result;
}
test("bichon has a complete articulated anatomy and finite renderable geometry", () => {
  const c = createBichonCompanion();
  try {
    for (const name of ["Head", "EarLeft", "EarRight", "EyeLeft", "EyeRight", "Nose", "PlumeTail", "LegFL", "LegFR", "LegBL", "LegBR"]) assert.ok(c.root.getObjectByName(name), name);
    const meshes = [];
    c.root.traverse(o => {
      if (!o.isMesh) return;
      meshes.push(o);
      for (const name of ["position", "normal"]) {
        const attr = o.geometry.getAttribute(name);
        assert.ok(attr.count > 0);
        assert.ok(attr.array.every(Number.isFinite), `${o.name} ${name}`);
      }
    });
    assert.ok(meshes.length < 55, "fur should be instanced, not thousands of separate draw calls");
    const box = new T.Box3().setFromObject(c.root), size = box.getSize(new T.Vector3());
    assert.ok(box.min.y > -.05 && box.min.y < .02, "paws should meet the ground");
    assert.ok(size.z > size.x && size.y > 1 && size.y < 1.6);
  } finally { c.dispose(); }
});
test("walking articulates ankles and head without moving the navigation root", () => {
  const c = createBichonCompanion();
  try {
    c.root.position.set(3, .18, 2); c.root.rotation.y = .7;
    for (let i = 0; i < 30; i++) c.update({ ...still, time: i / 60, walking: true });
    const rotations = ["LegFL", "LegFR", "LegBL", "LegBR"].map(name => c.root.getObjectByName(name).rotation.x);
    assert.ok(rotations.some(x => x > .05) && rotations.some(x => x < -.05));
    assert.ok(c.root.getObjectByName("LegFL").getObjectByName("Ankle").rotation.x !== 0 || c.root.getObjectByName("LegFR").getObjectByName("Ankle").rotation.x !== 0);
    assert.deepEqual(c.root.position.toArray(), [3, .18, 2]); assert.equal(c.root.rotation.y, .7);
  } finally { c.dispose(); }
});
test("pause freezes the exact pose; reduced motion disables secondary animation", () => {
  const c = createBichonCompanion();
  try {
    c.update({ ...still, time: 3.8, walking: true, celebrate: true });
    const before = pose(c.root);
    c.update({ ...still, time: 30, delta: 1, paused: true });
    assert.deepEqual(pose(c.root), before);
    c.update({ ...still, time: 4.6, walking: true, celebrate: true, reducedMotion: true });
    for (const name of ["Head", "PlumeTail", "LegFL", "LegFR", "LegBL", "LegBR"]) assert.equal(Math.abs(c.root.getObjectByName(name).rotation.x), 0);
    assert.equal(c.root.getObjectByName("PlumeTail").rotation.z, 0);
    assert.equal(c.root.getObjectByName("Tongue").visible, false);
    assert.equal(c.root.getObjectByName("BodyRig").position.y, 0);
  } finally { c.dispose(); }
});
test("eyes blink and re-open without hiding the eyes permanently", () => {
  const c = createBichonCompanion();
  try {
    c.update({ ...still, time: 4.6 });
    assert.ok(c.root.getObjectByName("EyeLeft").scale.y < .1);
    c.update({ ...still, time: 4.8 });
    assert.equal(c.root.getObjectByName("EyeLeft").scale.y, 1);
  } finally { c.dispose(); }
});
test("far-view fur is reduced and every GPU resource is disposed exactly once", () => {
  const c = createBichonCompanion(), resources = new Set(), fur = [];
  c.root.traverse(o => {
    if (!o.isMesh) return;
    resources.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      resources.add(m); if (m.bumpMap) resources.add(m.bumpMap);
    }
    if (o.isInstancedMesh) { fur.push(o); resources.add(o); }
  });
  const near = fur.reduce((sum, o) => sum + o.count, 0);
  c.update({ ...still, cameraDistance: 15 });
  assert.ok(fur.reduce((sum, o) => sum + o.count, 0) < near * .45);
  c.update(still);
  assert.equal(fur.reduce((sum, o) => sum + o.count, 0), near);
  const disposed = new Map();
  for (const r of resources) r.addEventListener("dispose", () => disposed.set(r, (disposed.get(r) ?? 0) + 1));
  c.dispose(); c.dispose();
  for (const r of resources) assert.equal(disposed.get(r), 1, r.type);
});

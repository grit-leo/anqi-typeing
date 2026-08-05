import { readFile, writeFile } from "node:fs/promises";
import { loadImage } from "@napi-rs/canvas";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

globalThis.self = globalThis;
globalThis.createImageBitmap = async (blob) => loadImage(Buffer.from(await blob.arrayBuffer()));

class SvgNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = new Map();
    this.childNodes = [];
    this.style = {};
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    return child;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  toString() {
    const attributes = [...this.attributes].map(([name, value]) => `${name}="${value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`);
    const style = Object.entries(this.style).map(([name, value]) => `${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}`).join(";");
    if (style) attributes.push(`style="${style}"`);
    return `<${this.tagName}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${this.childNodes.map(String).join("")}</${this.tagName}>`;
  }
}

globalThis.document = {
  createElementNS: (_namespace, tagName) => new SvgNode(tagName),
};

const { SVGRenderer } = await import("three/examples/jsm/renderers/SVGRenderer.js");

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: node scripts/render-bichon-preview.mjs <model.glb> <preview.svg>");

const binary = await readFile(input);
const arrayBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, "", resolve, reject));

const scene = new Scene();
scene.background = new Color("#203029");
scene.add(new AmbientLight("#fff8ed", 1.05));
const key = new DirectionalLight("#fff0d5", 4.8);
key.intensity = 1.7;
key.position.set(-3, 5, 4);
scene.add(key);
const rim = new DirectionalLight("#a9c8ba", 0.75);
rim.position.set(4, 3, -3);
scene.add(rim);

const model = gltf.scene;
model.position.y = 0.62;
model.rotation.y = -0.35;
model.scale.setScalar(1.25);
scene.add(model);

const camera = new PerspectiveCamera(34, 1, 0.1, 30);
camera.position.set(2.3, 1.45, 3.45);
camera.lookAt(new Vector3(0, 0.38, 0));

const renderer = new SVGRenderer();
renderer.setQuality("high");
renderer.setClearColor("#203029");
renderer.setSize(960, 960);
renderer.render(scene, camera);
await writeFile(output, `<?xml version="1.0" encoding="UTF-8"?>${renderer.domElement}`);
console.log(output);

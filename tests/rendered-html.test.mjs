import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the full-screen Magic Garden commercial game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>安琪打字机｜星愿花园全屏打字冒险<\/title>/i);
  assert.match(html, /安琪打字机/);
  assert.match(html, /星愿花园/);
  assert.match(html, /开始冒险/);
  assert.match(html, /花瓣启程/);
  assert.match(html, /月光舞会/);
  assert.match(html, /星愿王冠/);
  assert.match(html, /本机保存进度/);
  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(html, /3D 星球守卫战|30 秒星星雨|泡泡派对|课程地图/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("includes real WebGL, complete game states, touch input, safety and persistence", async () => {
  const [page, stage, engine, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MagicGarden3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.addEventListener\("keydown"/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /mobileInputRef/);
  assert.match(page, /inputMode="text"/);
  assert.match(page, /anqi-magic-garden-progress/);
  assert.match(page, /applyGardenResult/);
  assert.match(page, /calculateGardenResult/);
  assert.match(page, /AudioContext/);
  assert.match(page, /aria-live="assertive"/);
  assert.match(page, /phase === "paused"/);
  assert.match(page, /phase === "complete"/);
  assert.match(page, /不用点输入框/);
  assert.match(page, /不扣生命/);

  assert.match(stage, /new THREE\.WebGLRenderer/);
  assert.match(stage, /new THREE\.PerspectiveCamera/);
  assert.match(stage, /new THREE\.CanvasTexture/);
  assert.match(stage, /new THREE\.Line/);
  assert.match(stage, /new THREE\.Points/);
  assert.match(stage, /webglcontextlost/);
  assert.match(stage, /pointermove/);
  assert.match(stage, /prefers-reduced-motion/);
  assert.match(stage, /garden-stage-fallback/);
  assert.match(engine, /targetWords/);
  assert.match(engine, /bestScores/);

  assert.match(css, /height:100dvh/);
  assert.match(css, /\.spell-console/);
  assert.match(css, /\.modal-backdrop/);
  assert.match(css, /@media \(max-width:800px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(layout, /og-v4\.png/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

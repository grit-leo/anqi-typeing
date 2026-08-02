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

test("server-renders the complete typing product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>安琪打字机｜儿童趣味打字课<\/title>/i);
  assert.match(html, /安琪打字机/);
  assert.match(html, /起航信号/);
  assert.match(html, /开始任务/);
  assert.match(html, /星球课程/);
  assert.match(html, /aria-label="课程地图"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("includes the essential learning, feedback, and persistence logic", async () => {
  const [page, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.addEventListener\("keydown"/);
  assert.match(page, /handleKey\(" "\)/);
  assert.match(page, /sessionAccuracy/);
  assert.match(page, /finalWpm/);
  assert.match(page, /anqi-typer-progress/);
  assert.match(page, /key-quest-progress/);
  assert.match(page, /prefers-reduced-motion|sr-only/);
  assert.match(page, /aria-live="assertive"/);
  assert.match(page, /LESSONS\.map/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

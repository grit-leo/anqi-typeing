import assert from "node:assert/strict";
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

test("island entry renders a usable curriculum and adventure action before WebGL loads", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>安琪打字机｜花语岛 3D 打字探险<\/title>/);
  for (const label of ["今天，让这里多一点你的痕迹。", "开始小冒险", "练习小屋", "成长手账", "第一颗花种", "找到 F 和 J", "岛屿与旅程", "棉棉的溪边花园", "点击草地"]) assert.ok(html.includes(label), label);
  assert.match(html, /class="world-stage/);
  assert.match(html, /aria-label="小岛建设进度"/);
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /Internal Server Error|Your site is taking shape/);
});

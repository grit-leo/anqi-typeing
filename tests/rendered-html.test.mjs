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
  assert.match(html, /<title>安琪打字机｜四界大型打字冒险<\/title>/i);
  assert.match(html, /安琪打字机/);
  assert.match(html, /星愿花园/);
  assert.match(html, /开始冒险/);
  assert.match(html, /花瓣启程/);
  assert.match(html, /萤火邮差/);
  assert.match(html, /蔷薇守门人/);
  assert.match(html, /四大世界 · 十二关大型冒险/);
  assert.match(html, /樱花谷/);
  assert.match(html, /月光湖/);
  assert.match(html, /云上王城/);
  assert.match(html, /极光圣殿/);
  assert.match(html, /世界地图/);
  assert.match(html, /每日委托/);
  assert.match(html, /魔法衣橱/);
  assert.match(html, /成就图鉴/);
  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(html, /3D 星球守卫战|30 秒星星雨|泡泡派对|课程地图/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("includes real WebGL, large-game systems, touch input, safety and persistence", async () => {
  const [page, hub, keyboard, parentReport, stage, engine, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdventureHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/KeyboardCoach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ParentReport.tsx", import.meta.url), "utf8"),
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
  assert.match(page, /找到 F 和 J/);
  assert.match(page, /不扣生命/);
  assert.match(page, /轻松启蒙/);
  assert.match(page, /settingsResumeRef/);
  assert.match(page, /正在热身/);
  assert.match(page, /claimDailyReward/);
  assert.match(page, /buyOrEquipCosmetic/);
  assert.match(page, /mission-mechanic/);
  assert.match(page, /fireflyResting/);
  assert.match(page, /rhythmHits/);
  assert.match(page, /migrateGardenProgress/);
  assert.match(page, /parentHoldTimer/);
  assert.match(page, /按住 2 秒进入/);
  assert.match(page, /anqi-magic-garden-settings/);
  assert.match(page, /highContrast/);
  assert.match(page, /lazy\(\(\) => import\("\.\/MagicGarden3D"\)/);

  assert.match(hub, /GARDEN_WORLDS/);
  assert.match(hub, /GARDEN_LEVELS/);
  assert.match(hub, /COSMETICS/);
  assert.match(hub, /ACHIEVEMENTS/);
  assert.match(hub, /world-map-view/);
  assert.match(hub, /daily-view/);
  assert.match(hub, /collection-view/);
  assert.match(hub, /achievements-view/);
  assert.match(hub, /review-view/);
  assert.match(hub, /getWeakKeys/);
  assert.match(hub, /getLevelMastery/);

  assert.match(parentReport, /家长学习报告/);
  assert.match(parentReport, /只保存在这台设备/);
  assert.match(parentReport, /最近练习/);

  assert.match(keyboard, /keyboard-coach/);
  assert.match(keyboard, /fingerFor/);
  assert.match(keyboard, /SHIFT/);

  assert.match(stage, /new THREE\.WebGLRenderer/);
  assert.match(stage, /new THREE\.PerspectiveCamera/);
  assert.match(stage, /new THREE\.CanvasTexture/);
  assert.match(stage, /new THREE\.Line/);
  assert.match(stage, /new THREE\.Points/);
  assert.match(stage, /webglcontextlost/);
  assert.match(stage, /pointermove/);
  assert.match(stage, /prefers-reduced-motion/);
  assert.match(stage, /garden-stage-fallback/);
  assert.match(stage, /rhythmRings/);
  assert.match(stage, /guardianCrown/);
  assert.match(stage, /lightweight/);
  assert.doesNotMatch(stage, /THREE\.Clock|PCFSoftShadowMap/);
  assert.match(engine, /targetWords/);
  assert.match(engine, /bestScores/);
  assert.match(engine, /GardenWorldId/);
  assert.match(engine, /MissionType/);
  assert.match(engine, /claimDailyReward/);
  assert.match(engine, /unlockAchievements/);
  assert.match(engine, /newKeys/);
  assert.match(engine, /mergeKeyMastery/);
  assert.match(engine, /MISSION_RULES/);
  assert.match(engine, /getGuardianState/);
  assert.match(engine, /getAdaptiveLevelWord/);
  assert.match(engine, /sessionHistory/);
  assert.match(engine, /bestStars/);

  assert.match(css, /height:100dvh/);
  assert.match(css, /\.spell-console/);
  assert.match(css, /\.modal-backdrop/);
  assert.match(css, /\.adventure-hub/);
  assert.match(css, /\.stage-route/);
  assert.match(css, /\.parent-report-card/);
  assert.match(css, /\.high-contrast \.coach-key\.target/);
  assert.match(css, /@media \(max-width:800px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /og-v5\.jpg/);
  assert.match(layout, /og-v5\.jpg/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

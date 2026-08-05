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
  assert.match(html, /<title>安琪打字机｜比熊自然探索打字游戏<\/title>/i);
  assert.match(html, /安琪打字机/);
  assert.match(html, /星愿花园/);
  assert.match(html, /开始探索/);
  assert.match(html, /花瓣启程/);
  assert.match(html, /萤火邮差/);
  assert.match(html, /蔷薇守门人/);
  assert.match(html, /为 9 岁孩子设计/);
  assert.match(html, /无限旅程/);
  assert.match(html, /樱花谷/);
  assert.match(html, /月光湖/);
  assert.match(html, /云上王城/);
  assert.match(html, /极光圣殿/);
  assert.match(html, /学习地图/);
  assert.match(html, /我的空间/);
  assert.match(html, /今日任务/);
  assert.match(html, /外观/);
  assert.match(html, /成长记录/);
  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(html, /3D 星球守卫战|30 秒星星雨|泡泡派对|课程地图/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("includes real WebGL, large-game systems, touch input, safety and persistence", async () => {
  const [page, hub, keyboard, parentReport, stage, exploration, playCanvas, levelSchema, explorationEngine, engine, css, layout, packageJson, bichonModel, bichonCinematic] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdventureHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/KeyboardCoach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ParentReport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MagicGarden3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ExplorationWorld3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PlayCanvasWorld3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/level-schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/exploration-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/models/anqi-bichon.glb", import.meta.url)),
    readFile(new URL("../public/worlds/bichon-cinematic-v1.webp", import.meta.url)),
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
  assert.match(page, /锁定基准位/);
  assert.match(page, /错误不会扣生命/);
  assert.match(page, /指法优先模式/);
  assert.match(page, /反应时间/);
  assert.match(page, /按完立即归位/);
  assert.match(page, /settingsResumeRef/);
  assert.match(page, /正在热身/);
  assert.match(page, /claimDailyReward/);
  assert.match(page, /buyOrEquipCosmetic/);
  assert.match(page, /typing-focus-strip/);
  assert.match(page, /现在只输入这个词/);
  assert.doesNotMatch(page, /className="quest-hud"|mission-mechanic/);
  assert.match(page, /fireflyResting/);
  assert.match(page, /rhythmHits/);
  assert.match(page, /migrateGardenProgress/);
  assert.match(page, /parentHoldTimer/);
  assert.match(page, /按住 2 秒进入/);
  assert.match(page, /anqi-magic-garden-settings/);
  assert.match(page, /highContrast/);
  assert.match(page, /lazy\(\(\) => import\("\.\/MagicGarden3D"\)/);
  assert.match(page, /lazy\(\(\) => import\("\.\/PlayCanvasWorld3D"\)/);
  assert.match(page, /feedback=\{flash\}/);
  assert.match(page, /phase === "exploring"/);
  assert.match(page, /beginExplorationEncounter/);
  assert.match(page, /isExplorationBoundary/);
  assert.match(page, /startEndlessWorld/);
  assert.match(page, /getEndlessReward/);
  assert.match(page, /bichon-character-cast/);
  assert.match(page, /bichon-action-image/);
  assert.match(page, /garden-growth/);
  assert.match(page, /world-challenge/);
  assert.match(page, /anqi-magic-garden-profiles/);
  assert.match(page, /anqi-typer-backup/);
  assert.match(page, /exportBackup/);
  assert.match(page, /importBackup/);
  assert.match(page, /resetCurrentProfile/);
  assert.match(page, /SpeechSynthesisUtterance/);
  assert.match(page, /totalReactionMs/);
  assert.match(page, /沉浸声音与鼓励/);
  assert.match(page, /discoverWorldSecret/);
  assert.match(page, /CINEMATIC_COPY/);
  assert.match(page, /bichon-cinematic/);
  assert.match(page, /epic-word-reaction/);
  assert.match(page, /skipCinematic/);
  assert.match(page, /startedAt\.current = Date\.now\(\) \+ introDuration/);
  assert.match(page, /cinematicMoment \? "paused"/);
  assert.match(css, /flash-correct \.spell-ray/);
  assert.match(css, /flash-word \.flower-character/);
  assert.match(css, /flash-wrong \.lumi-character/);

  assert.match(hub, /GARDEN_WORLDS/);
  assert.match(hub, /GARDEN_LEVELS/);
  assert.match(hub, /COSMETICS/);
  assert.match(hub, /ACHIEVEMENTS/);
  assert.match(hub, /world-map-view/);
  assert.match(hub, /daily-view/);
  assert.match(hub, /collection-view/);
  assert.match(hub, /achievements-view/);
  assert.match(hub, /review-view/);
  assert.match(hub, /sanctuary-view/);
  assert.match(hub, /getLumiBond/);
  assert.match(hub, /getUnlockedDecorations/);
  assert.match(hub, /getWeakKeys/);
  assert.match(hub, /getLevelMastery/);
  assert.match(hub, /主关 6 分钟 \+ 弱键 5 分钟/);

  assert.match(parentReport, /家长学习报告/);
  assert.match(parentReport, /只保存在这台设备/);
  assert.match(parentReport, /最近练习/);
  assert.match(parentReport, /面向9岁学习阶段/);

  assert.match(keyboard, /keyboard-coach/);
  assert.match(keyboard, /fingerFor/);
  assert.match(keyboard, /getKeyMovement/);
  assert.match(keyboard, /F 凸点直接按/);
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
  assert.match(stage, /skyDome/);
  assert.match(stage, /WORLD_BACKGROUNDS/);
  assert.match(stage, /realisticWorldBackdrop/);
  assert.match(stage, /new THREE\.TextureLoader/);
  assert.match(stage, /blossom-real-v1\.webp/);
  assert.match(stage, /moonlake-real-v1\.webp/);
  assert.match(stage, /cloud-real-v1\.webp/);
  assert.match(stage, /aurora-real-v1\.webp/);
  assert.match(stage, /farBackdrop/);
  assert.match(stage, /blossomWorld/);
  assert.match(stage, /moonLakeWorld/);
  assert.match(stage, /skyPalace/);
  assert.match(stage, /auroraTemple/);
  assert.match(stage, /atmosphereMotes/);
  assert.match(stage, /guardianStorm/);
  assert.match(stage, /wordSprite\.visible = false/);
  assert.match(stage, /lightweight/);
  assert.doesNotMatch(stage, /THREE\.Clock|PCFSoftShadowMap/);
  assert.match(exploration, /new THREE\.WebGLRenderer/);
  assert.match(exploration, /new THREE\.PerspectiveCamera/);
  assert.match(exploration, /ArrowUp/);
  assert.match(exploration, /jump-action/);
  assert.match(exploration, /mobile-explore-controls/);
  assert.match(exploration, /getExplorationCheckpoint/);
  assert.match(exploration, /onEncounter/);
  assert.match(exploration, /fallback-adventure-card/);
  assert.match(exploration, /new THREE\.Raycaster/);
  assert.match(exploration, /intersectObjects\(walkableMeshes/);
  assert.match(exploration, /endlessChunks/);
  assert.match(exploration, /bouncePads/);
  assert.match(exploration, /0xfffbf2/);
  assert.match(exploration, /bichonTail/);
  assert.match(exploration, /reactionBurst/);
  assert.match(exploration, /bichonEyes/);
  assert.match(exploration, /createGroundTexture/);
  assert.match(exploration, /createEncounterSign/);
  assert.match(exploration, /encounterProgressOrbs/);
  assert.match(exploration, /getStoryTerrainHeight/);
  assert.match(exploration, /isStoryPositionBlocked/);
  assert.match(exploration, /atmosphereMotes/);
  assert.match(exploration, /qualityScale/);
  assert.match(exploration, /GLTFLoader/);
  assert.match(exploration, /anqi-bichon\.glb/);
  assert.match(exploration, /playBichonAnimation/);
  assert.match(exploration, /WORLD_DISCOVERIES/);
  assert.match(exploration, /onMovementAudio/);
  assert.match(exploration, /renderer\.shadowMap\.enabled = qualityMode/);
  assert.match(exploration, /Math\.exp\(-delta/);
  assert.match(playCanvas, /new pc\.Application/);
  assert.match(playCanvas, /instantiateModelEntity/);
  assert.match(playCanvas, /anqi-bichon\.glb/);
  assert.match(playCanvas, /screenToWorld/);
  assert.match(playCanvas, /EndlessLevel-streamed-chunks/);
  assert.match(playCanvas, /mobile-explore-controls/);
  assert.match(playCanvas, /ResizeObserver/);
  assert.match(playCanvas, /webglcontextlost/);
  assert.match(playCanvas, /WorldShockwave/);
  assert.match(playCanvas, /cameraImpact/);
  assert.match(levelSchema, /schemaVersion: 1/);
  assert.match(levelSchema, /BLOSSOM_TRAIL_LEVEL/);
  assert.match(levelSchema, /encounters:/);
  assert.match(levelSchema, /discoveries:/);
  assert.match(levelSchema, /visibleChunks/);
  assert.match(explorationEngine, /rune-gate/);
  assert.match(explorationEngine, /moon-bridge/);
  assert.match(explorationEngine, /wish-beacon/);
  assert.match(explorationEngine, /ENDLESS_BIOMES/);
  assert.match(explorationEngine, /getEndlessEncounter/);
  assert.match(explorationEngine, /WORLD_DISCOVERIES/);
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
  assert.match(engine, /getAdaptiveTargetKeys/);
  assert.match(engine, /sessionHistory/);
  assert.match(engine, /bestStars/);
  assert.match(engine, /LEVEL_MECHANICS/);
  assert.match(engine, /SANCTUARY_DECORATIONS/);
  assert.match(engine, /getSessionSupport/);

  assert.match(css, /height:100dvh/);
  assert.match(css, /\.spell-console/);
  assert.match(css, /\.modal-backdrop/);
  assert.match(css, /\.adventure-hub/);
  assert.match(css, /\.stage-route/);
  assert.match(css, /\.parent-report-card/);
  assert.match(css, /\.high-contrast \.coach-key\.target/);
  assert.match(css, /@media \(max-width:800px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /characters\/anqi-v2\.webp/);
  assert.match(css, /\.garden-stage\.world-scene-0/);
  assert.match(css, /\.guardian-shields/);
  assert.match(css, /\.sanctuary-scene/);
  assert.match(css, /\.exploration-stage/);
  assert.match(css, /\.mobile-explore-controls/);
  assert.match(css, /\.encounter-console/);
  assert.match(css, /\.endless-world-status/);
  assert.match(css, /\.endless-minimap/);
  assert.match(css, /Readability baseline for a nine-year-old learner/);
  assert.match(css, /\.magic-game small\{font-size:12px!important/);
  assert.match(css, /\.hub-nav\{grid-template-columns:repeat\(3,1fr\)/);
  assert.match(css, /Focused child HUD/);
  assert.match(css, /\.explore-focus-card/);
  assert.match(css, /\.typing-focus-strip/);
  assert.match(css, /\.playcanvas-world/);
  assert.equal(bichonModel.subarray(0, 4).toString("utf8"), "glTF");
  assert.ok(bichonModel.byteLength > 300_000);
  const gltfJsonLength = bichonModel.readUInt32LE(12);
  const gltfJson = JSON.parse(bichonModel.subarray(20, 20 + gltfJsonLength).toString("utf8").trim());
  assert.deepEqual(gltfJson.animations.map((animation) => animation.name), ["idle", "run", "jump", "sniff", "celebrate"]);
  assert.ok(gltfJson.nodes.some((node) => node.name === "FurShellBody"));
  assert.ok(gltfJson.nodes.some((node) => node.name === "FurShellHead"));
  assert.ok(gltfJson.nodes.some((node) => node.name?.startsWith("BodyCurl")));
  assert.ok(gltfJson.nodes.some((node) => node.name?.startsWith("HeadCurl")));
  assert.ok(gltfJson.nodes.some((node) => node.name?.startsWith("TailCurl")));
  assert.ok(gltfJson.materials.some((material) => material.name === "NaturalBichonCoat"));
  assert.ok(gltfJson.materials.some((material) => material.name === "IndividualCurlLayer"));
  assert.ok(bichonCinematic.byteLength > 150_000);
  assert.match(css, /bichon-cinematic-v1\.webp/);
  assert.match(css, /cinematicCurtain/);
  assert.match(layout, /bichon-garden-real-v1\.webp/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(packageJson, /"playcanvas"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

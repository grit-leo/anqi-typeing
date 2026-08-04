import assert from "node:assert/strict";
import test from "node:test";
import {
  ACHIEVEMENTS,
  applyGardenResult,
  buyOrEquipCosmetic,
  calculateGardenResult,
  claimDailyReward,
  COSMETICS,
  DEFAULT_GARDEN_PROGRESS,
  evaluateTypingKey,
  GARDEN_LEVELS,
  GARDEN_WORLDS,
  getDailyTarget,
  getAdaptiveLevelWord,
  getAdaptiveTargetKeys,
  getEarnedPetals,
  getLevelWord,
  getLessonAct,
  getLevelMastery,
  getGuardianState,
  getLearningRecommendation,
  getLumiBond,
  getMissionDuration,
  getLiveScore,
  getPlayerLevel,
  getPlayerLevelProgress,
  getSanctuaryLevel,
  getSessionSupport,
  getSuggestedReviewLevel,
  getUnlockedDecorations,
  getWeakKeys,
  mergeKeyMastery,
  migrateGardenProgress,
  LEVEL_MECHANICS,
  MISSION_RULES,
  SANCTUARY_DECORATIONS,
} from "../app/game-engine.ts";

test("large adventure ships four worlds, twelve progressive levels, and four mission types", () => {
  assert.equal(GARDEN_WORLDS.length, 4);
  assert.equal(GARDEN_LEVELS.length, 12);
  assert.deepEqual(GARDEN_WORLDS.map((world) => world.name), ["樱花谷", "月光湖", "云上王城", "极光圣殿"]);
  assert.deepEqual(new Set(GARDEN_LEVELS.map((level) => level.mission)), new Set(["bloom", "firefly", "rhythm", "guardian"]));
  assert.ok(GARDEN_LEVELS.every((level) => level.targetWords >= 8 && level.duration >= 85));
  assert.ok(GARDEN_LEVELS.every((level) => level.words.length >= level.targetWords));
  assert.ok(GARDEN_LEVELS.every((level) => level.newKeys.length > 0 && level.learnedKeys.length >= level.newKeys.length));
  assert.equal(GARDEN_LEVELS.filter((level) => level.mission === "guardian").length, 4);
  assert.ok(GARDEN_LEVELS.at(-1).words.some((word) => word.includes(" ")));
});

test("word selection loops and typing input supports letters, phrases, and controls", () => {
  const first = GARDEN_LEVELS[0];
  assert.equal(getLevelWord(first, 0), "fff");
  assert.equal(getLevelWord(first, first.words.length), "fff");
  assert.equal(evaluateTypingKey("star", 0, "S"), "correct");
  assert.equal(evaluateTypingKey("star", 3, "r"), "complete");
  assert.equal(evaluateTypingKey("magic book", 5, " "), "correct");
  assert.equal(evaluateTypingKey("Magic", 0, "M"), "correct");
  assert.equal(evaluateTypingKey("Magic", 0, "m"), "wrong");
  assert.equal(evaluateTypingKey("Hello, garden.", 5, ","), "correct");
  assert.equal(evaluateTypingKey("star", 1, "x"), "wrong");
  assert.equal(evaluateTypingKey("star", 1, "Backspace"), "ignored");
});

test("lesson acts and key mastery turn practice into measurable learning", () => {
  const first = GARDEN_LEVELS[0];
  assert.equal(getLessonAct(first, 0), "learn");
  assert.equal(getLessonAct(first, 5), "practice");
  assert.equal(getLessonAct(first, 11), "adventure");
  const mastery = mergeKeyMastery({}, {
    f: { attempts: 8, correct: 8, bestStreak: 8 },
    j: { attempts: 8, correct: 7, bestStreak: 5 },
  });
  assert.equal(mastery.f.score, 100);
  assert.equal(mastery.j.score, 88);
  assert.equal(getLevelMastery(first, mastery), 94);
});

test("missions score differently and results reward accuracy, completion, combo, and XP", () => {
  const bloom = GARDEN_LEVELS.find((level) => level.mission === "bloom");
  const guardian = GARDEN_LEVELS.find((level) => level.mission === "guardian");
  assert.ok(bloom && guardian);
  assert.ok(getLiveScore(guardian, 40, 1, 10, 20) > getLiveScore(bloom, 40, 1, 10, 20));

  const perfect = calculateGardenResult(bloom, 50, 0, 60, bloom.targetWords, 25, 120);
  assert.equal(perfect.won, true);
  assert.equal(perfect.accuracy, 100);
  assert.equal(perfect.stars, 3);
  assert.ok(perfect.petals >= 50);
  assert.ok(perfect.xp > 0);
  assert.equal(perfect.missionBonus, 120);

  const growing = calculateGardenResult(bloom, 18, 8, 90, 7, 4);
  assert.equal(growing.won, false);
  assert.ok(growing.score >= 0);
});

test("every mission has a distinct rule and guardian phase", () => {
  assert.equal(MISSION_RULES.bloom.untimed, true);
  assert.equal(MISSION_RULES.firefly.durationOverride, 240);
  assert.equal(MISSION_RULES.rhythm.untimed, false);
  assert.match(`${MISSION_RULES.guardian.verb}${MISSION_RULES.guardian.hint}`, /三重护盾/);
  const bloom = GARDEN_LEVELS.find((level) => level.mission === "bloom");
  const firefly = GARDEN_LEVELS.find((level) => level.mission === "firefly");
  const guardian = GARDEN_LEVELS.find((level) => level.mission === "guardian");
  assert.ok(bloom && firefly && guardian);
  assert.equal(getMissionDuration(bloom), null);
  assert.equal(getMissionDuration(firefly), 240);
  assert.deepEqual(getGuardianState(guardian, 0), { hpPercent: 100, phase: 1, shieldName: "外环护盾" });
  assert.equal(getGuardianState(guardian, Math.ceil(guardian.targetWords / 2)).shieldName, "荆棘核心");
  assert.equal(getGuardianState(guardian, guardian.targetWords).hpPercent, 0);
});

test("all twelve chapters expose a distinct child-visible mechanic", () => {
  assert.equal(Object.keys(LEVEL_MECHANICS).length, 12);
  assert.equal(new Set(Object.values(LEVEL_MECHANICS).map((mechanic) => mechanic.name)).size, 12);
  GARDEN_LEVELS.forEach((level) => {
    assert.ok(LEVEL_MECHANICS[level.id].action.length > 5);
    assert.ok(LEVEL_MECHANICS[level.id].success.length > 5);
  });
});

test("winning unlocks the twelve-level path, achievements, daily progress, and best scores", () => {
  const first = GARDEN_LEVELS[0];
  const win = calculateGardenResult(first, 50, 1, 70, first.targetWords, 22);
  const progressed = applyGardenResult(DEFAULT_GARDEN_PROGRESS, 0, win, first.targetWords, 22, "2026-08-02");
  assert.equal(progressed.unlocked, 2);
  assert.equal(progressed.totalWords, first.targetWords);
  assert.equal(progressed.daily.words, first.targetWords);
  assert.equal(progressed.daily.sessions, 1);
  assert.ok(progressed.achievements.includes("first-spell"));
  assert.ok(progressed.achievements.includes("steady-hands"));
  assert.ok(progressed.achievements.includes("combo-star"));
  assert.equal(progressed.bestScores["petal-gate"], win.score);
});

test("daily rewards and cosmetic collection are guarded by their requirements", () => {
  const date = "2026-08-02";
  const target = getDailyTarget(date);
  const ready = { ...DEFAULT_GARDEN_PROGRESS, petals: 200, daily: { date, words: target, sessions: 2, claimed: false } };
  const claimed = claimDailyReward(ready, date);
  assert.equal(claimed.petals, 260);
  assert.equal(claimed.xp, 80);
  assert.equal(claimed.daily.claimed, true);
  assert.deepEqual(claimDailyReward(claimed, date), claimed);

  const rose = COSMETICS.find((item) => item.id === "rose-wand");
  assert.ok(rose);
  const purchased = buyOrEquipCosmetic(ready, rose.id);
  assert.ok(purchased.ownedCosmetics.includes(rose.id));
  assert.equal(purchased.equippedCosmetic, rose.id);
  assert.equal(purchased.petals, ready.petals - rose.price);
  assert.equal(ACHIEVEMENTS.length, 8);
});

test("player level curve is monotonic and exposes bounded progress", () => {
  assert.equal(getPlayerLevel(0), 1);
  assert.ok(getPlayerLevel(1000) > getPlayerLevel(100));
  assert.ok(getPlayerLevelProgress(240) >= 0 && getPlayerLevelProgress(240) <= 100);
});

test("old saves migrate safely and retain one best-star total per level", () => {
  const migrated = migrateGardenProgress({
    unlocked: 3,
    totalStars: 5,
    bestScores: { ...DEFAULT_GARDEN_PROGRESS.bestScores, "petal-gate": 1200, "firefly-post": 900 },
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.totalStars, 5);
  assert.equal(migrated.bestStars["petal-gate"], 3);
  assert.equal(migrated.bestStars["firefly-post"], 2);
  assert.equal(migrated.bestScores["petal-gate"], 1200);
  assert.deepEqual(migrated.sessionHistory, []);
  assert.deepEqual(migrated.endless, { bestDistance: 0, bestEvents: 0 });
});

test("infinite world records migrate and remain part of each child profile", () => {
  const migrated = migrateGardenProgress({ ...DEFAULT_GARDEN_PROGRESS, endless: { bestDistance: 480, bestEvents: 24 } });
  assert.deepEqual(migrated.endless, { bestDistance: 480, bestEvents: 24 });
});

test("hidden-world discoveries persist safely across save migration", () => {
  const migrated = migrateGardenProgress({ ...DEFAULT_GARDEN_PROGRESS, discoveries: ["dew-crystal", "momo-guide", "dew-crystal"] });
  assert.deepEqual(migrated.discoveries, ["dew-crystal", "momo-guide"]);
});

test("practice adapts to weak keys and recommends an unlocked review lesson", () => {
  const mastery = {
    f: { attempts: 12, correct: 5, streak: 0, score: 42 },
    j: { attempts: 12, correct: 11, streak: 6, score: 92 },
  };
  assert.deepEqual(getWeakKeys(mastery), ["f"]);
  const word = getAdaptiveLevelWord(GARDEN_LEVELS[0], 3, mastery);
  assert.match(word, /f/i);
  const reviewIndex = getSuggestedReviewLevel({ ...DEFAULT_GARDEN_PROGRESS, unlocked: 4, keyMastery: mastery });
  assert.equal(reviewIndex, 0);
  assert.equal(getLearningRecommendation({ ...DEFAULT_GARDEN_PROGRESS, keyMastery: mastery }).targetKey, "f");
  assert.equal(getSessionSupport(8, 0, 0).mode, "steady");
  assert.equal(getSessionSupport(4, 3, 2).mode, "guided");
});

test("live adaptation combines mistakes with slow reaction time before choosing the next word", () => {
  const level = GARDEN_LEVELS[0];
  const session = {
    f: { attempts: 4, correct: 4, bestStreak: 4, totalReactionMs: 5600, slowAttempts: 4 },
    j: { attempts: 4, correct: 4, bestStreak: 4, totalReactionMs: 1800, slowAttempts: 0 },
  };
  assert.equal(getAdaptiveTargetKeys(level, {}, session)[0], "f");
  assert.match(getAdaptiveLevelWord(level, 2, {}, session), /f/i);
  const mastery = mergeKeyMastery({}, session);
  assert.ok(mastery.f.averageReactionMs > mastery.j.averageReactionMs);
  assert.ok(mastery.f.speedScore < mastery.j.speedScore);
});

test("personal garden and Lumi bond grow from practice without a new save schema", () => {
  const growing = { ...DEFAULT_GARDEN_PROGRESS, totalWords: 140, totalStars: 14, sessionHistory: Array.from({ length: 6 }, (_, index) => ({ date: `2026-08-0${index + 1}`, levelId: "petal-gate", accuracy: 95, wpm: 12, duration: 70, completedWords: 8, stars: 2, weakKeys: [] })) };
  assert.ok(getSanctuaryLevel(growing) > getSanctuaryLevel(DEFAULT_GARDEN_PROGRESS));
  assert.ok(getLumiBond(growing) > 0 && getLumiBond(growing) <= 100);
  assert.ok(getUnlockedDecorations(growing).length >= 4);
  assert.equal(SANCTUARY_DECORATIONS[0].id, "seed-bed");
});

test("replaying cannot farm permanent stars or full first-clear petals", () => {
  const first = GARDEN_LEVELS[0];
  const win = calculateGardenResult(first, 50, 0, 60, first.targetWords, 25);
  const once = applyGardenResult(DEFAULT_GARDEN_PROGRESS, 0, win, first.targetWords, 25, "2026-08-03");
  const replayReward = getEarnedPetals(once, first, win, first.targetWords);
  const twice = applyGardenResult(once, 0, win, first.targetWords, 25, "2026-08-03");
  assert.equal(once.totalStars, 3);
  assert.equal(twice.totalStars, 3);
  assert.equal(replayReward, 6);
  assert.equal(twice.petals - once.petals, 6);
  assert.equal(twice.sessionHistory.length, 2);
  assert.equal(twice.sessionHistory.at(-1).duration, 60);
});

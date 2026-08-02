import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGardenResult,
  calculateGardenResult,
  DEFAULT_GARDEN_PROGRESS,
  evaluateTypingKey,
  GARDEN_LEVELS,
  getLevelWord,
  getLiveScore,
} from "../app/game-engine.ts";

test("commercial story chapters have complete goals and progressive vocabulary", () => {
  assert.equal(GARDEN_LEVELS.length, 3);
  assert.deepEqual(GARDEN_LEVELS.map((level) => level.title), ["花瓣启程", "月光舞会", "星愿王冠"]);
  assert.ok(GARDEN_LEVELS.every((level) => level.targetWords > 0 && level.duration >= 90));
  assert.ok(GARDEN_LEVELS.every((level) => level.words.length >= level.targetWords));
  assert.ok(GARDEN_LEVELS[2].words.some((word) => word.length >= 8));
});

test("word selection is deterministic and loops without ending a timed session", () => {
  const level = GARDEN_LEVELS[0];
  assert.equal(getLevelWord(level, 0), "star");
  assert.equal(getLevelWord(level, level.words.length), "star");
  assert.equal(getLevelWord(level, 5), "magic");
});

test("typing input accepts the next letter, completes words, and ignores controls", () => {
  assert.equal(evaluateTypingKey("star", 0, "S"), "correct");
  assert.equal(evaluateTypingKey("star", 3, "r"), "complete");
  assert.equal(evaluateTypingKey("star", 1, "x"), "wrong");
  assert.equal(evaluateTypingKey("star", 1, "Backspace"), "ignored");
  assert.equal(evaluateTypingKey("star", 1, "1"), "ignored");
});

test("results reward accuracy, completion and combo without negative scoring", () => {
  const level = GARDEN_LEVELS[0];
  const perfect = calculateGardenResult(level, 50, 0, 60, 10, 25);
  assert.equal(perfect.won, true);
  assert.equal(perfect.accuracy, 100);
  assert.equal(perfect.wpm, 10);
  assert.equal(perfect.stars, 3);
  assert.ok(perfect.petals >= 50);

  const growing = calculateGardenResult(level, 18, 8, 90, 7, 4);
  assert.equal(growing.won, false);
  assert.equal(growing.stars, 2);
  assert.ok(growing.score >= 0);
  assert.equal(getLiveScore(1, 99, 0, 0), 0);
});

test("winning unlocks the next chapter and preserves best scores", () => {
  const win = calculateGardenResult(GARDEN_LEVELS[0], 50, 1, 70, 10, 18);
  const progressed = applyGardenResult(DEFAULT_GARDEN_PROGRESS, 0, win, 10);
  assert.equal(progressed.unlocked, 2);
  assert.equal(progressed.totalWords, 10);
  assert.equal(progressed.totalStars, win.stars);
  assert.equal(progressed.bestScores["petal-gate"], win.score);

  const lowerReplay = { ...win, score: win.score - 100 };
  const replayed = applyGardenResult(progressed, 0, lowerReplay, 10);
  assert.equal(replayed.bestScores["petal-gate"], win.score);
});

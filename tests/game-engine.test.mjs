import assert from "node:assert/strict";
import test from "node:test";
import { calculateGameResult, getModeDuration, getModePrompts, getSessionReward } from "../app/game-engine.ts";

const lesson = { keys: ["a", "s", "d", "f"], prompts: ["asdf", "sad dad"], xp: 50 };

test("each game mode has a distinct, playable prompt flow", () => {
  assert.deepEqual(getModePrompts("orbit-defense", lesson), lesson.prompts);
  assert.deepEqual(getModePrompts("journey", lesson), lesson.prompts);
  assert.deepEqual(getModePrompts("star-rush", lesson), lesson.prompts);
  const bubbles = getModePrompts("bubble-party", lesson);
  assert.equal(bubbles.length, 3);
  assert.ok(bubbles.every((prompt) => prompt.length === lesson.keys.length * 2));
  assert.ok(bubbles.every((prompt) => [...prompt].every((key) => lesson.keys.includes(key))));
});

test("arcade modes award replay XP without replacing course rewards", () => {
  assert.equal(getSessionReward("journey", 50), 50);
  assert.equal(getSessionReward("orbit-defense", 50), 50);
  assert.equal(getSessionReward("star-rush", 50), 35);
  assert.equal(getSessionReward("bubble-party", 50), 30);
});

test("timed modes expose their intended round durations", () => {
  assert.equal(getModeDuration("orbit-defense"), 45);
  assert.equal(getModeDuration("star-rush"), 30);
  assert.equal(getModeDuration("journey"), null);
  assert.equal(getModeDuration("bubble-party"), null);
});

test("results reward accuracy, speed, and streak without producing negative scores", () => {
  const perfect = calculateGameResult("journey", 40, 0, 30, 40);
  assert.equal(perfect.accuracy, 100);
  assert.equal(perfect.wpm, 16);
  assert.equal(perfect.stars, 3);
  assert.ok(perfect.score > 0);

  const rush = calculateGameResult("star-rush", 60, 3, 30, 25);
  assert.equal(rush.stars, 3);
  assert.ok(rush.score >= 650);

  const defense = calculateGameResult("orbit-defense", 80, 2, 45, 30);
  assert.equal(defense.stars, 3);
  assert.ok(defense.score >= 850);

  const struggling = calculateGameResult("bubble-party", 1, 20, 20, 1);
  assert.equal(struggling.stars, 1);
  assert.ok(struggling.score >= 0);
});

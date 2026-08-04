import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPLORATION_ENCOUNTERS,
  EXPLORATION_TOTAL_WORDS,
  ENDLESS_BIOMES,
  ENDLESS_CHUNK_LENGTH,
  getEndlessBiome,
  getEndlessEncounter,
  getEndlessEncounterProgress,
  getEndlessReward,
  getCompletedEncounterCount,
  getEncounterProgress,
  getExplorationCheckpoint,
  getExplorationEncounter,
  isExplorationBoundary,
  isEndlessBoundary,
} from "../app/exploration-engine.ts";

test("the Sakura Valley adventure has three contiguous five-word encounters", () => {
  assert.equal(EXPLORATION_ENCOUNTERS.length, 3);
  assert.equal(EXPLORATION_ENCOUNTERS[0].start, 0);
  assert.equal(EXPLORATION_ENCOUNTERS.at(-1).end, EXPLORATION_TOTAL_WORDS);
  EXPLORATION_ENCOUNTERS.forEach((encounter, index) => {
    assert.equal(encounter.end - encounter.start, 5);
    if (index > 0) assert.equal(encounter.start, EXPLORATION_ENCOUNTERS[index - 1].end);
    assert.ok(encounter.story.length >= 20);
    assert.ok(encounter.success.length >= 12);
  });
});

test("the endless world cycles biomes while events continue without a fixed end", () => {
  assert.equal(ENDLESS_BIOMES.length, 4);
  assert.equal(getEndlessBiome(0).name, "樱风原野");
  assert.equal(getEndlessBiome(4).name, "樱风原野");
  const first = getEndlessEncounter(0);
  const hundredth = getEndlessEncounter(500);
  assert.equal(first.id, "endless-0");
  assert.equal(hundredth.id, "endless-100");
  assert.equal(hundredth.start, 500);
  assert.equal(hundredth.end, 505);
  assert.equal(first.position.z - getEndlessEncounter(5).position.z, ENDLESS_CHUNK_LENGTH);
});

test("endless encounters have five-word milestones and bounded growing rewards", () => {
  assert.deepEqual(getEndlessEncounterProgress(0), { current: 0, total: 5, percent: 0 });
  assert.deepEqual(getEndlessEncounterProgress(4), { current: 4, total: 5, percent: 80 });
  assert.deepEqual(getEndlessEncounterProgress(5), { current: 0, total: 5, percent: 0 });
  assert.equal(isEndlessBoundary(0), false);
  assert.equal(isEndlessBoundary(5), true);
  assert.equal(isEndlessBoundary(500), true);
  assert.ok(getEndlessReward(8).petals > getEndlessReward(0).petals);
  assert.ok(getEndlessReward(1000).petals <= 24);
  assert.ok(getEndlessReward(1000).xp <= 60);
});

test("encounters advance only at complete learning boundaries", () => {
  assert.equal(getExplorationEncounter(0)?.id, "rune-gate");
  assert.equal(getExplorationEncounter(4)?.id, "rune-gate");
  assert.equal(getExplorationEncounter(5)?.id, "moon-bridge");
  assert.equal(getExplorationEncounter(10)?.id, "wish-beacon");
  assert.equal(getExplorationEncounter(15), null);
  assert.equal(isExplorationBoundary(5), true);
  assert.equal(isExplorationBoundary(10), true);
  assert.equal(isExplorationBoundary(15), false);
});

test("encounter progress and checkpoints are deterministic and bounded", () => {
  assert.deepEqual(getEncounterProgress(0), { current: 0, total: 5, percent: 0 });
  assert.deepEqual(getEncounterProgress(7), { current: 2, total: 5, percent: 40 });
  assert.deepEqual(getEncounterProgress(15), { current: 5, total: 5, percent: 100 });
  assert.equal(getCompletedEncounterCount(0), 0);
  assert.equal(getCompletedEncounterCount(10), 2);
  assert.equal(getCompletedEncounterCount(15), 3);
  assert.ok(getExplorationCheckpoint(5).z < getExplorationCheckpoint(0).z);
  assert.ok(getExplorationCheckpoint(10).z < getExplorationCheckpoint(5).z);
});

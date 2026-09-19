import assert from "node:assert/strict";
import test from "node:test";
import { LESSONS, emptyProgress, saveSession, scoreSession, planIslandWalk, isIslandWalkable } from "../app/island-engine.ts";
import { emptyJourney, freshJourneyRun, loadJourney, checkpointJourney, finishJourney, chapterProjects } from "../app/island-journey.ts";

function draft(lesson = 0, line = 2, position = 1, review = false) {
  const prompts = LESSONS[lesson].prompts;
  const typed = prompts.slice(0, line).join("") + prompts[line].slice(0, position);
  const stats = {};
  for (const char of typed) { stats[char] ??= { hits: 0, misses: 0 }; stats[char].hits++; }
  return { lesson, review, prompts, run: { ...freshJourneyRun(), line, position, hits: typed.length, combo: typed.length, started: true, stats, seconds: 23 } };
}
test("old lesson records migrate to completed construction without resetting scores", () => {
  const progress = saveSession(emptyProgress(), scoreSession(0, 16, 0, 30), {});
  const before = JSON.stringify(progress);
  const journey = loadJourney(null, progress);
  assert.deepEqual(chapterProjects(journey, 0), [6, 0, 0, 0]);
  assert.equal(JSON.stringify(progress), before);
});
test("each finished group persists a world change and an exact resumable cursor", () => {
  const current = draft();
  const saved = checkpointJourney(emptyJourney(), current);
  current.run.line = 4;
  assert.equal(saved.draft.run.line, 2, "checkpoint must not share mutable run state");
  const restored = loadJourney(JSON.stringify(saved), emptyProgress());
  assert.equal(restored.projects[LESSONS[0].id], 2);
  assert.equal(restored.draft.run.position, 1);
  assert.equal(restored.draft.run.hits, 5);
});
test("world work is never removed on retry and review cannot construct or unlock", () => {
  let journey = checkpointJourney(emptyJourney(), draft());
  journey = checkpointJourney(journey, draft(0, 0, 1));
  assert.equal(journey.projects[LESSONS[0].id], 2);
  journey = checkpointJourney(journey, draft(1, 4, 1, true));
  assert.equal(journey.projects[LESSONS[1].id], undefined);
});
test("completed construction clears the draft and accumulates only bounded timing samples", () => {
  const current = draft(0, 5, 0);
  current.run.line = 6;
  current.run.timing = { f: { samples: 3, totalMs: 2600, hesitations: 1 } };
  const next = finishJourney(emptyJourney(), current);
  assert.equal(next.draft, null);
  assert.equal(next.projects[LESSONS[0].id], 6);
  assert.deepEqual(next.timing.f, current.run.timing.f);
  const progress = emptyProgress();
  const restored = loadJourney(JSON.stringify(next), progress);
  assert.equal(restored.projects[LESSONS[0].id], 6, "construction persists independently of the accuracy gate");
  assert.equal(progress.unlocked, 0);
});
test("corrupt checkpoints do not break startup or inject untaught prompts", () => {
  for (const raw of [null, "{", "null", "[]", '{"version":99}']) assert.equal(loadJourney(raw, emptyProgress()).draft, null);
  const original = checkpointJourney(emptyJourney(), draft());
  for (const mutate of [
    j => j.draft.run.line = 99,
    j => j.draft.run.position = -1,
    j => j.draft.run.seconds = -1,
    j => j.draft.run.hits = 2000,
    j => j.draft.lesson = 15,
    j => j.draft.prompts[0] = "unlearned keys",
    j => j.draft.run.stats = { f: { hits: -1, misses: 0 } },
  ]) {
    const bad = structuredClone(original); mutate(bad);
    assert.equal(loadJourney(JSON.stringify(bad), emptyProgress()).draft, null);
  }
});
test("a bridge under construction is not walkable; complete bridge unlocks passage", () => {
  const middle = { x: .98, z: 1.6 };
  assert.equal(isIslandWalkable(middle, false), false);
  assert.equal(isIslandWalkable(middle, true), true);
  assert.deepEqual(planIslandWalk({ x: .98, z: 2.5 }, middle, false), []);
  assert.ok(planIslandWalk({ x: .98, z: 2.5 }, middle, true).length > 0);
});

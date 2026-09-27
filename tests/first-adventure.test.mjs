import assert from "node:assert/strict";
import test from "node:test";
import { FIRST_PROMPTS, GARDEN_SPOTS, advanceAdventure, emptyFirstAdventure, loadFirstAdventure, awardFirstAdventure, adventureAccuracy, adventureStep } from "../app/first-adventure.ts";
import { emptyProgress, loadIslandProgress, scoreSession, saveSession, planIslandWalk } from "../app/island-engine.ts";

function prepared() {
  let state = emptyFirstAdventure();
  for (const action of [{ type: "greet" }, { type: "seeds" }, { type: "ready", key: "f" }, { type: "ready", key: "j" }, { type: "begin" }]) state = advanceAdventure(state, action);
  return state;
}
function play(state = prepared(), mistakes = 0) {
  for (let i = 0; i < mistakes; i++) state = advanceAdventure(state, { type: "type", key: "x", assisted: true });
  while (state.line < FIRST_PROMPTS.length) {
    if (state.phase === "sprouts") state = advanceAdventure(state, { type: "continue" });
    const key = FIRST_PROMPTS[state.line][state.position];
    state = advanceAdventure(state, { type: "type", key, assisted: state.phase === "plant" });
  }
  return state;
}
function completed(mistakes = 0) {
  return advanceAdventure(advanceAdventure(play(undefined, mistakes), { type: "place", spot: "path" }), { type: "finish" });
}

test("first adventure requires greeting, seeds and both home keys before typing", () => {
  let state = emptyFirstAdventure();
  for (const action of [{ type: "seeds" }, { type: "begin" }, { type: "finish" }, { type: "type", key: "f", assisted: true }]) assert.equal(advanceAdventure(state, action), state);
  state = advanceAdventure(advanceAdventure(state, { type: "greet" }), { type: "seeds" });
  assert.equal(advanceAdventure(state, { type: "begin" }), state);
  state = advanceAdventure(state, { type: "ready", key: "f" });
  state = advanceAdventure(state, { type: "ready", key: "f" });
  assert.deepEqual(state.ready, ["f"]);
  assert.equal(advanceAdventure(state, { type: "begin" }), state);
  assert.equal(prepared().phase, "plant");
});

test("twelve short F/J groups form two distinct six-group practice stages", () => {
  assert.equal(FIRST_PROMPTS.length, 12);
  assert.ok(FIRST_PROMPTS.every(prompt => /^[fj]{2,4}$/.test(prompt)));
  let state = prepared();
  for (const prompt of FIRST_PROMPTS.slice(0, 6)) for (const key of prompt) state = advanceAdventure(state, { type: "type", key, assisted: true });
  assert.equal(state.phase, "sprouts");
  assert.equal(state.hits, 16);
  assert.equal(advanceAdventure(state, { type: "type", key: "f", assisted: false }), state);
  state = advanceAdventure(state, { type: "continue" });
  state = advanceAdventure(state, { type: "type", key: "f", assisted: false });
  assert.equal(state.phase, "bloom", "the first correct key in round two must not return to the interlude");
  assert.equal(state.position, 1);
  state = play(state);
  assert.equal(state.phase, "decorate");
  assert.equal(state.hits, 40);
  assert.equal(state.assistedHits, 16);
  assert.equal(adventureStep(state.phase), 4);
});

test("mistakes keep the cursor and count the expected key rather than taking rewards away", () => {
  const original = prepared();
  const wrong = advanceAdventure(original, { type: "type", key: "j", assisted: false });
  assert.equal(wrong.position, 0);
  assert.equal(wrong.hits, 0);
  assert.deepEqual(wrong.stats, { f: { hits: 0, misses: 1 } });
  assert.equal(original.mistakes, 0, "reducer must not mutate previous state");
  const right = advanceAdventure(wrong, { type: "type", key: "f", assisted: false });
  assert.equal(right.position, 1);
  assert.equal(adventureAccuracy(right), 50);
  assert.equal(advanceAdventure(right, { type: "type", key: "Backspace", assisted: false }), right);
});

test("every typing cursor, the interlude, and final customization survive reload", () => {
  let state = prepared();
  for (const prompt of FIRST_PROMPTS) {
    if (state.phase === "sprouts") state = advanceAdventure(state, { type: "continue" });
    for (const key of prompt) {
      state = advanceAdventure(state, { type: "type", key, assisted: state.phase === "plant" });
      state = advanceAdventure(state, { type: "tick", seconds: 1.25 });
      assert.deepEqual(loadFirstAdventure(JSON.stringify(state)), state);
    }
  }
  for (const action of [{ type: "color", color: "lavender" }, { type: "place", spot: "tree" }, { type: "name", name: "棉棉与我的花园" }, { type: "finish" }]) {
    state = advanceAdventure(state, action);
    assert.deepEqual(loadFirstAdventure(JSON.stringify(state)), state);
  }
  assert.equal(state.phase, "complete");
  assert.equal(state.gardenName, "棉棉与我的花园");
});

test("only active typing after a keystroke contributes time", () => {
  let state = prepared();
  assert.equal(advanceAdventure(state, { type: "tick", seconds: 5 }), state);
  state = advanceAdventure(state, { type: "type", key: "f", assisted: true });
  for (const seconds of [NaN, Infinity, -1]) assert.equal(advanceAdventure(state, { type: "tick", seconds }), state);
  assert.equal(advanceAdventure(state, { type: "tick", seconds: 600 }).seconds, 5);
  const done = completed();
  assert.equal(advanceAdventure(done, { type: "tick", seconds: 5 }), done);
});

test("the child must choose a real location; names are bounded and blank names have a fallback", () => {
  let state = play();
  assert.equal(advanceAdventure(state, { type: "finish" }), state);
  assert.equal(advanceAdventure(state, { type: "place", spot: "invalid" }), state);
  assert.equal(advanceAdventure(state, { type: "color", color: "invalid" }), state);
  state = advanceAdventure(state, { type: "name", name: "🌷".repeat(30) + "\n" });
  assert.equal([...state.gardenName].length, 16);
  state = advanceAdventure(state, { type: "name", name: " \n " });
  state = advanceAdventure(state, { type: "place", spot: "window" });
  state = advanceAdventure(state, { type: "finish" });
  assert.equal(state.gardenName, "棉棉的小院");
  assert.ok(Number.isFinite(Date.parse(state.finishedAt)));
  assert.equal(advanceAdventure(state, { type: "finish" }), state);
});

test("corrupted story saves cannot bypass typing or strand the adventure", () => {
  for (const raw of [null, "{", "null", "[]", '{"version":9}']) assert.deepEqual(loadFirstAdventure(raw), emptyFirstAdventure());
  const state = completed();
  for (const patch of [{ hits: 0 }, { position: 1 }, { line: 13 }, { ready: [] }, { spot: null }, { finishedAt: "bad" }, { assistedHits: 41 }, { stats: {} }, { mistakes: 1 }, { seconds: -1 }, { phase: "meet" }]) {
    assert.deepEqual(loadFirstAdventure(JSON.stringify({ ...state, ...patch })), emptyFirstAdventure(), JSON.stringify(patch));
  }
});

test("completion joins the real curriculum once and reload cannot farm flower rewards", () => {
  const story = completed();
  const progress = awardFirstAdventure(emptyProgress(), story);
  assert.equal(progress.unlocked, 1);
  assert.equal(progress.flowers, 6);
  assert.equal(progress.history.length, 1);
  assert.equal(progress.history[0].hits, 40);
  assert.equal(progress.history[0].date, story.finishedAt);
  assert.deepEqual(progress.keyStats, story.stats);
  const restored = loadIslandProgress(JSON.stringify(progress));
  assert.equal(awardFirstAdventure(restored, story), restored);
});

test("lower accuracy still completes the home but does not skip the learning gate", () => {
  const story = completed(10);
  assert.equal(story.phase, "complete");
  assert.equal(adventureAccuracy(story), 80);
  const progress = awardFirstAdventure(emptyProgress(), story);
  assert.equal(progress.unlocked, 0);
  assert.equal(progress.flowers, 3);
  assert.equal(progress.firstAdventureClaimed, true);
});

test("old learners keep their grades, unlocks and stats when playing the new story", () => {
  let original = emptyProgress();
  for (let lesson = 0; lesson < 5; lesson++) original = saveSession(original, scoreSession(lesson, 20, 0, 60), { d: { hits: 20, misses: 0 } });
  const legacy = structuredClone(original);
  delete legacy.firstAdventureClaimed;
  const old = loadIslandProgress(JSON.stringify(legacy));
  assert.equal(old.firstAdventureClaimed, false);
  const next = awardFirstAdventure(old, completed());
  assert.equal(next.unlocked, 5);
  assert.equal(next.flowers, old.flowers + 6);
  assert.deepEqual(next.keyStats.d, old.keyStats.d);
  assert.equal(next.history.length, old.history.length + 1);
  assert.equal(old.firstAdventureClaimed, false);
});

test("seed bag and each personal garden location are reachable on the island", () => {
  for (const end of [{ x: -.63, z: 3.05 }, ...GARDEN_SPOTS.map(spot => ({ x: spot.position[0] + .4, z: spot.position[1] }))]) assert.ok(planIslandWalk({ x: .2, z: 2.4 }, end, false).length, JSON.stringify(end));
});

import assert from "node:assert/strict";
import test from "node:test";
import { CHAPTERS, LESSONS, chapterStart, chapterForLesson, chapterLocalIndex, chapterLessons, emptyProgress, loadIslandProgress, scoreSession, saveSession, weakKeys, reviewPrompts, fingerFor, localDay, planIslandWalk, isIslandWalkable } from "../app/island-engine.ts";

test("each lesson only uses keys that have been introduced, including spaces and punctuation", () => {
  const known = new Set();
  for (const [index, lesson] of LESSONS.entries()) {
    for (const key of lesson.keys) known.add(key);
    assert.equal(lesson.prompts.length, 6);
    for (const prompt of lesson.prompts) {
      if (lesson.mode === "pinyin") { assert.match(prompt, /^[\u3400-\u9fff，。！？：；、\s]+$/); continue; }
      for (const key of prompt) assert.ok(known.has(key.toLowerCase()), `Lesson ${index + 1} uses untaught ${JSON.stringify(key)}`);
    }
  }
  for (const key of "abcdefghijklmnopqrstuvwxyz0123456789 ,.';!?") assert.ok(known.has(key), `Missing key ${key}`);
});

test("accurate completed lessons unlock the next stage and persist across reloads", () => {
  let progress = emptyProgress();
  for (let index = 0; index < LESSONS.length; index++) {
    assert.equal(progress.unlocked, index);
    progress = saveSession(progress, scoreSession(index, 90, 10, 60), { f: { hits: 90, misses: 10 } });
    progress = loadIslandProgress(JSON.stringify(progress));
    assert.equal(progress.unlocked, Math.min(index + 1, LESSONS.length - 1));
  }
  assert.equal(Object.keys(progress.best).length, LESSONS.length);
  assert.equal(progress.flowers, LESSONS.length * 6);
  assert.equal(progress.keyStats.f.hits, LESSONS.length * 90);
  assert.equal(progress.history.length, LESSONS.length);
});

test("six regions contain 32 stable lessons and old 16-lesson saves continue at the new region", () => {
  assert.deepEqual(CHAPTERS.map(chapter => chapter.count), [4, 4, 4, 4, 8, 8]);
  assert.equal(LESSONS.length, 32);
  for (let chapter = 0; chapter < CHAPTERS.length; chapter++) {
    assert.equal(chapterLessons(chapter).length, CHAPTERS[chapter].count);
    for (const index of Array.from({ length: CHAPTERS[chapter].count }, (_, offset) => chapterStart(chapter) + offset)) {
      assert.equal(chapterForLesson(index), chapter);
      assert.equal(chapterLocalIndex(index), index - chapterStart(chapter));
    }
  }
  const oldBest = Object.fromEntries(LESSONS.slice(0, 16).map(lesson => [lesson.id, 93]));
  const saved = loadIslandProgress(JSON.stringify({ version: 1, best: oldBest, flowers: 40 }));
  assert.equal(saved.unlocked, 16);
  assert.equal(saved.flowers, 40);
  assert.equal(chapterForLesson(saved.unlocked), 4);
});

test("Chinese IME lessons measure committed characters, without adding Chinese characters to finger review", () => {
  assert.equal(scoreSession(24, 30, 0, 60).wpm, 30);
  assert.equal(scoreSession(0, 30, 0, 60).wpm, 6);
  assert.deepEqual(reviewPrompts({ f: { hits: 2, misses: 3 } }, 24), LESSONS[24].prompts);
  assert.deepEqual(weakKeys({ 你: { hits: 1, misses: 4 }, f: { hits: 1, misses: 2 } }), ["f"]);
});

test("finger mastery distinguishes aided completion, independent recall, and a later-day retest", () => {
  const assisted = saveSession(emptyProgress(), scoreSession(0, 30, 0, 60), {});
  assert.equal(assisted.unlocked, 1);
  assert.equal(assisted.mastery[LESSONS[0].id], undefined);
  const independent = saveSession(assisted, scoreSession(0, 30, 0, 60, true, true), {});
  assert.equal(independent.mastery[LESSONS[0].id].independentBest, 100);
  assert.equal(independent.mastery[LESSONS[0].id].delayedBest, 0);
  assert.equal(independent.unlocked, 1, "review must not unlock a lesson");
  const againToday = saveSession(independent, scoreSession(0, 30, 0, 60, true, true), {});
  assert.equal(againToday.mastery[LESSONS[0].id].delayedBest, 0);
  const older = { ...againToday, mastery: { ...againToday.mastery, [LESSONS[0].id]: { ...againToday.mastery[LESSONS[0].id], independentDate: "2020-01-01" } } };
  const delayed = loadIslandProgress(JSON.stringify(saveSession(older, scoreSession(0, 30, 0, 60, true, true), {})));
  assert.equal(delayed.mastery[LESSONS[0].id].delayedBest, 100);
  assert.equal(delayed.mastery[LESSONS[0].id].delayedDate, localDay());
});

test("slow keys join personalized finger practice only after enough timing evidence", () => {
  const stats = { f: { hits: 12, misses: 0 }, j: { hits: 12, misses: 0 } };
  assert.deepEqual(weakKeys(stats, { j: { samples: 2, totalMs: 10000, hesitations: 2 } }), []);
  assert.deepEqual(weakKeys(stats, { j: { samples: 5, totalMs: 11000, hesitations: 3 } }), ["j"]);
  assert.ok(reviewPrompts(stats, 0, { j: { samples: 5, totalMs: 11000, hesitations: 3 } })[0].includes("j"));
});

test("accuracy rather than speed gates progress; review cannot bypass the course", () => {
  let progress = saveSession(emptyProgress(), scoreSession(0, 16, 4, 1), { f: { hits: 16, misses: 4 } });
  assert.equal(progress.unlocked, 0);
  assert.equal(progress.best[LESSONS[0].id], 80);
  progress = saveSession(progress, scoreSession(0, 20, 0, 30, true), {});
  assert.equal(progress.unlocked, 0);
  assert.equal(progress.best[LESSONS[0].id], 80);
  progress = saveSession(progress, scoreSession(0, 20, 0, 180), {});
  assert.equal(progress.unlocked, 1);
});

test("bad saves do not block the game or accidentally unlock the whole curriculum", () => {
  for (const raw of [null, "{", "null", "[]", '{"version":9}']) assert.deepEqual(loadIslandProgress(raw), emptyProgress());
  const restored = loadIslandProgress(JSON.stringify({ version: 1, unlocked: 999, flowers: -2, best: { [LESSONS[5].id]: 100 }, keyStats: { f: { hits: -10, misses: 5 } } }));
  assert.equal(restored.unlocked, 0);
  assert.equal(restored.flowers, 0);
  assert.deepEqual(restored.keyStats.f, { hits: 0, misses: 5 });
});

test("review prioritizes actual mistakes and does not introduce space before it is taught", () => {
  const stats = { f: { hits: 20, misses: 1 }, j: { hits: 2, misses: 3 }, d: { hits: 10, misses: 0 } };
  assert.deepEqual(weakKeys(stats), ["j", "f"]);
  const prompts = reviewPrompts(stats, 0);
  assert.ok(prompts.length > 0 && prompts.length <= 6);
  assert.ok(prompts.every(prompt => /^[fj]+$/.test(prompt)));
  assert.ok(prompts[0].includes("j"));
  const nextLessonReview = reviewPrompts({ f: { hits: 8, misses: 1 }, j: { hits: 8, misses: 0 } }, 1);
  assert.equal(nextLessonReview.length, 6);
  assert.ok(nextLessonReview.every(prompt => /^[fj]+$/.test(prompt)), "Review must not add new D/K keys from the next unlocked lesson");
});

test("finger guidance covers home row, upper row, punctuation, numbers and space", () => {
  assert.equal(fingerFor("F").name, "左手食指");
  assert.equal(fingerFor("J").name, "右手食指");
  assert.equal(fingerFor("p").name, "右手小指");
  assert.equal(fingerFor(";").home, ";");
  assert.equal(fingerFor("!").name, "左手小指");
  assert.equal(fingerFor("?").name, "右手小指");
  assert.equal(fingerFor(" ").name, "拇指");
});

test("session speed uses five-character words and bounded recent history", () => {
  assert.equal(scoreSession(0, 100, 0, 60).wpm, 20);
  assert.equal(scoreSession(0, 0, 0, 0).accuracy, 0);
  assert.equal(scoreSession(0, 5, 0, 0).wpm, 0);
  let progress = emptyProgress();
  for (let i = 0; i < 70; i++) progress = saveSession(progress, scoreSession(0, 20, 0, 60), {});
  assert.equal(progress.history.length, 60);
  assert.deepEqual(progress.days, [localDay()]);
});

test("click-to-walk reaches every station without crossing the cottage, pond or island edge", () => {
  const start = { x: .2, z: 2.4 };
  for (const end of [{ x: -.55, z: 2.55 }, { x: 2.65, z: .12 }, { x: -2.2, z: -.2 }, { x: .3, z: -2.7 }, { x: -3.15, z: 1.3 }, { x: 3.2, z: -1.5 }, { x: 1.1, z: -2.7 }, { x: .3, z: 3.45 }]) {
    const path = planIslandWalk(start, end);
    assert.ok(path.length > 0);
    assert.deepEqual(path.at(-1), end);
    let previous = start;
    for (const point of path) {
      for (let fraction = 0; fraction <= 1; fraction += .01) assert.ok(isIslandWalkable({ x: previous.x + (point.x - previous.x) * fraction, z: previous.z + (point.z - previous.z) * fraction }));
      previous = point;
    }
  }
  for (const point of [{ x: -.9, z: -1.45 }, { x: 2.2, z: 1.6 }, { x: 8, z: 8 }]) assert.deepEqual(planIslandWalk(start, point), []);
});

test("larger town and harbor terrain keeps all eight task landmarks reachable", () => {
  const start = { x: .2, z: 2.4 };
  const outer = [{ x: -4.8, z: 1.6 }, { x: 4.7, z: -2 }, { x: 1.3, z: -3.9 }, { x: .3, z: 4.45 }];
  for (const chapter of [4, 5]) for (const end of outer) {
    const path = planIslandWalk(start, end, true, chapter);
    assert.ok(path.length, `${CHAPTERS[chapter].name} cannot reach ${JSON.stringify(end)}`);
    assert.deepEqual(path.at(-1), end);
    let before = start;
    for (const point of path) {
      for (let t = 0; t <= 1; t += .02) assert.ok(isIslandWalkable({ x: before.x + (point.x - before.x) * t, z: before.z + (point.z - before.z) * t }, true, chapter));
      before = point;
    }
  }
  assert.equal(isIslandWalkable({ x: -4.8, z: 1.6 }, true), false, "old islands stay smaller");
});

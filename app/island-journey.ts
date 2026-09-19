import { LESSONS, type IslandProgress, type KeyRecord } from "./island-engine.ts";

export const JOURNEY_KEY = "anqi-island-journey-v1";
export const PROJECTS = [
  { name: "种下花园", icon: "flower", unit: "片花圃", action: "每完成一组字母，一片花圃就会长出来。", complete: "花园开花了！这是你亲手种下的。", position: [-2, 1.75] },
  { name: "修好小桥", icon: "map", unit: "块桥板", action: "每完成一组字母，就为小桥铺上一块木板。", complete: "小桥修好了！棉棉可以走过去啦。", position: [.98, 1.6] },
  { name: "唤醒风铃", icon: "sound", unit: "串风铃", action: "每完成一组字母，一串风铃就会轻轻响起。", complete: "听，花园有了自己的声音。", position: [-2.7, .2] },
  { name: "点亮小屋", icon: "sun", unit: "盏暖灯", action: "每完成一组字母，一盏花园灯就会亮起来。", complete: "小屋亮起来了。欢迎回到我们的花园！", position: [-.9, -.7] },
] as const;

export type Timing = { samples: number; totalMs: number; hesitations: number };
export type JourneyRun = {
  line: number; position: number; hits: number; mistakes: number; combo: number;
  seconds: number; started: boolean; stats: Record<string, KeyRecord>;
  timing: Record<string, Timing>; assistedHits: number;
};
export type Draft = { lesson: number; review: boolean; prompts: string[]; run: JourneyRun };
export type Journey = { version: 1; projects: Record<string, number>; draft: Draft | null; timing: Record<string, Timing> };
export function freshJourneyRun(): JourneyRun { return { line: 0, position: 0, hits: 0, mistakes: 0, combo: 0, seconds: 0, started: false, stats: {}, timing: {}, assistedHits: 0 }; }
export function emptyJourney(): Journey { return { version: 1, projects: {}, draft: null, timing: {} }; }
const validCount = (n: unknown, max = 1e7): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
function readTiming(raw: unknown): Record<string, Timing> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([key, v]) => key.length === 1 && v && validCount(v.samples) && validCount(v.totalMs, 1e12) && validCount(v.hesitations)));
}

// Separate, additive storage leaves the original curriculum and scores untouched.
export function loadJourney(raw: string | null, progress: IslandProgress): Journey {
  const result = emptyJourney();
  let data;
  try { data = JSON.parse(raw ?? "null"); } catch { /* Recover from the existing learning record. */ }
  if (data?.version !== 1) data = null;
  for (const [i, lesson] of LESSONS.entries()) {
    const groups = data?.projects?.[lesson.id];
    result.projects[lesson.id] = progress.best[lesson.id] >= 90 ? 6 : i <= progress.unlocked && validCount(groups, 6) ? Math.floor(groups) : 0;
  }
  result.timing = readTiming(data?.timing);
  const draft = data?.draft;
  if (!draft || !Number.isInteger(draft.lesson) || draft.lesson < 0 || draft.lesson > progress.unlocked || typeof draft.review !== "boolean") return result;
  const prompts = draft.prompts;
  if (!Array.isArray(prompts) || prompts.length !== 6 || !prompts.every(p => typeof p === "string" && p.length > 0 && p.length <= 120 && /^[\x20-\x7e]+$/.test(p))) return result;
  if (!draft.review && JSON.stringify(prompts) !== JSON.stringify(LESSONS[draft.lesson].prompts)) return result;
  if (draft.review && !prompts.every(p => [...p].every(k => progress.keyStats[k]))) return result;
  const r = draft.run;
  if (!r || !Number.isInteger(r.line) || r.line < 0 || r.line >= prompts.length || !Number.isInteger(r.position) || r.position < 0 || r.position >= prompts[r.line].length) return result;
  const hits = prompts.slice(0, r.line).reduce((n: number, p: string) => n + p.length, 0) + r.position;
  if (r.hits !== hits || !validCount(r.mistakes) || !validCount(r.seconds, 86400) || !validCount(r.combo, hits) || !r.stats || typeof r.stats !== "object") return result;
  if (!Object.entries(r.stats).every(([k, s]) => k.length === 1 && s && typeof s === "object" && validCount((s as KeyRecord).hits) && validCount((s as KeyRecord).misses))) return result;
  const stats = Object.values(r.stats) as KeyRecord[];
  if (stats.reduce((n, s) => n + s.hits, 0) !== hits || stats.reduce((n, s) => n + s.misses, 0) !== r.mistakes) return result;
  result.draft = { lesson: draft.lesson, review: draft.review, prompts, run: { ...freshJourneyRun(), ...r, started: hits + r.mistakes > 0, timing: readTiming(r.timing), assistedHits: validCount(r.assistedHits, hits) ? r.assistedHits : 0 } };
  return result;
}

export function checkpointJourney(journey: Journey, draft: Draft): Journey {
  const projects = { ...journey.projects };
  if (!draft.review) projects[LESSONS[draft.lesson].id] = Math.max(projects[LESSONS[draft.lesson].id] ?? 0, Math.min(6, draft.run.line));
  // Clone the run: the input loop mutates its own counters between React renders.
  return { ...journey, projects, draft: draft.run.line < draft.prompts.length ? structuredClone(draft) : null };
}
export function finishJourney(journey: Journey, draft: Draft): Journey {
  const next = checkpointJourney(journey, draft);
  const timing = { ...next.timing };
  for (const [key, value] of Object.entries(draft.run.timing)) {
    const old = timing[key] ?? { samples: 0, totalMs: 0, hesitations: 0 };
    timing[key] = { samples: old.samples + value.samples, totalMs: old.totalMs + value.totalMs, hesitations: old.hesitations + value.hesitations };
  }
  return { ...next, timing, draft: null };
}
export function chapterProjects(journey: Journey, chapter: number): number[] {
  return LESSONS.slice(chapter * 4, chapter * 4 + 4).map(l => journey.projects[l.id] ?? 0);
}

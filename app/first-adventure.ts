import { saveSession, scoreSession, type IslandProgress, type KeyRecord } from "./island-engine.ts";

export const FIRST_ADVENTURE_KEY = "anqi-first-adventure-v1";
export const FIRST_PROMPTS = ["ff", "jj", "fj", "jf", "ffjj", "jjff", "fjfj", "jfjf", "ffjf", "jjfj", "fjjf", "jffj"];
export const GARDEN_SPOTS = [
  { id: "window", label: "小屋窗边", description: "一开窗，就能看见花。", position: [-1.3, -.28] },
  { id: "path", label: "石头路旁", description: "每次回家，都经过它。", position: [.15, 2.85] },
  { id: "tree", label: "树荫下面", description: "和棉棉一起乘凉。", position: [-3.4, 1.75] },
] as const;
export const GARDEN_COLORS = [
  { id: "peach", label: "桃子粉", hex: "#e6b1a6", value: 0xe6b1a6 },
  { id: "cream", label: "奶油黄", hex: "#ead49a", value: 0xead49a },
  { id: "lavender", label: "丁香紫", hex: "#b7acd1", value: 0xb7acd1 },
] as const;
export type AdventurePhase = "meet" | "trail" | "prepare" | "plant" | "sprouts" | "bloom" | "decorate" | "complete";
export type GardenSpot = typeof GARDEN_SPOTS[number]["id"];
export type GardenColor = typeof GARDEN_COLORS[number]["id"];
export type FirstAdventureState = {
  version: 1; phase: AdventurePhase; line: number; position: number; ready: string[];
  hits: number; mistakes: number; seconds: number; assistedHits: number;
  stats: Record<string, KeyRecord>; color: GardenColor; spot: GardenSpot | null;
  gardenName: string; finishedAt: string | null;
};
export type AdventureAction =
  | { type: "greet" | "seeds" | "begin" | "continue" | "finish" }
  | { type: "ready"; key: string }
  | { type: "type"; key: string; assisted: boolean }
  | { type: "tick"; seconds: number }
  | { type: "color"; color: GardenColor }
  | { type: "place"; spot: GardenSpot }
  | { type: "name"; name: string };
export type AdventureSceneState = Pick<FirstAdventureState, "phase" | "line" | "hits" | "color" | "spot"> & { command: number };
export type AdventureSceneAction = "greet" | "seeds" | GardenSpot;
export const isAdventureTyping = (phase: AdventurePhase) => phase === "plant" || phase === "bloom";
export function emptyFirstAdventure(): FirstAdventureState {
  return { version: 1, phase: "meet", line: 0, position: 0, ready: [], hits: 0, mistakes: 0, seconds: 0, assistedHits: 0, stats: {}, color: "peach", spot: null, gardenName: "棉棉的小院", finishedAt: null };
}
export function adventureStep(phase: AdventurePhase) {
  return ({ meet: 0, trail: 1, prepare: 2, plant: 2, sprouts: 3, bloom: 3, decorate: 4, complete: 5 })[phase];
}
export function adventureAccuracy(state: FirstAdventureState) {
  return state.hits + state.mistakes ? Math.round(state.hits / (state.hits + state.mistakes) * 100) : 100;
}
export function advanceAdventure(state: FirstAdventureState, action: AdventureAction): FirstAdventureState {
  switch (action.type) {
    case "greet": return state.phase === "meet" ? { ...state, phase: "trail" } : state;
    case "seeds": return state.phase === "trail" ? { ...state, phase: "prepare" } : state;
    case "ready": return state.phase === "prepare" && /^[fj]$/.test(action.key) ? { ...state, ready: [...new Set([...state.ready, action.key])] } : state;
    case "begin": return state.phase === "prepare" && state.ready.includes("f") && state.ready.includes("j") ? { ...state, phase: "plant" } : state;
    case "continue": return state.phase === "sprouts" ? { ...state, phase: "bloom" } : state;
    case "tick": return isAdventureTyping(state.phase) && state.hits + state.mistakes > 0 && Number.isFinite(action.seconds) && action.seconds > 0 ? { ...state, seconds: Math.min(86400, state.seconds + Math.min(action.seconds, 5)) } : state;
    case "type": {
      if (!isAdventureTyping(state.phase) || action.key.length !== 1) return state;
      const expected = FIRST_PROMPTS[state.line]?.[state.position];
      if (!expected) return state;
      const correct = action.key === expected;
      const previous = state.stats[expected] ?? { hits: 0, misses: 0 };
      const stats = { ...state.stats, [expected]: { hits: previous.hits + Number(correct), misses: previous.misses + Number(!correct) } };
      if (!correct) return { ...state, mistakes: state.mistakes + 1, stats };
      const finishedLine = state.position + 1 === FIRST_PROMPTS[state.line].length;
      const line = state.line + Number(finishedLine), position = finishedLine ? 0 : state.position + 1;
      const phase = finishedLine && line === 6 ? "sprouts" : finishedLine && line === 12 ? "decorate" : state.phase;
      return { ...state, line, position, phase, stats, hits: state.hits + 1, assistedHits: state.assistedHits + Number(action.assisted) };
    }
    case "color": return state.phase === "decorate" && GARDEN_COLORS.some(c => c.id === action.color) ? { ...state, color: action.color } : state;
    case "place": return state.phase === "decorate" && GARDEN_SPOTS.some(s => s.id === action.spot) ? { ...state, spot: action.spot } : state;
    case "name": return state.phase === "decorate" ? { ...state, gardenName: [...action.name.replace(/[\u0000-\u001f\u007f]/g, "")].slice(0, 16).join("") } : state;
    case "finish": return state.phase === "decorate" && state.spot ? { ...state, phase: "complete", gardenName: state.gardenName.trim() || "棉棉的小院", finishedAt: new Date().toISOString() } : state;
  }
}

/** Validate both the learning cursor and the story prerequisites before resuming. */
export function loadFirstAdventure(raw: string | null): FirstAdventureState {
  const fresh = emptyFirstAdventure();
  try {
    const s = JSON.parse(raw ?? "null");
    const phases: AdventurePhase[] = ["meet", "trail", "prepare", "plant", "sprouts", "bloom", "decorate", "complete"];
    if (!s || s.version !== 1 || !phases.includes(s.phase) || !Number.isInteger(s.line) || s.line < 0 || s.line > 12 || !Number.isInteger(s.position) || s.position < 0) return fresh;
    const ranges: Record<AdventurePhase, boolean> = {
      meet: s.line === 0 && s.position === 0, trail: s.line === 0 && s.position === 0, prepare: s.line === 0 && s.position === 0,
      plant: s.line < 6, sprouts: s.line === 6 && s.position === 0, bloom: s.line >= 6 && s.line < 12,
      decorate: s.line === 12 && s.position === 0, complete: s.line === 12 && s.position === 0,
    };
    if (!ranges[s.phase as AdventurePhase] || (s.line < 12 && s.position >= FIRST_PROMPTS[s.line].length)) return fresh;
    const count = (n: unknown, max = 1e7): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
    const ready: string[] = Array.isArray(s.ready) ? [...new Set<string>(s.ready.filter((key: unknown) => key === "f" || key === "j"))] : [];
    if (phases.indexOf(s.phase) >= 3 && ready.length !== 2) return fresh;
    const expectedHits = FIRST_PROMPTS.slice(0, s.line).join("") + (FIRST_PROMPTS[s.line]?.slice(0, s.position) ?? "");
    if (s.hits !== expectedHits.length || !Number.isInteger(s.mistakes) || !count(s.mistakes) || !count(s.seconds, 86400) || !Number.isInteger(s.assistedHits) || !count(s.assistedHits, s.hits)) return fresh;
    if (!s.stats || typeof s.stats !== "object" || Array.isArray(s.stats)) return fresh;
    const stats: Record<string, KeyRecord> = {};
    for (const [key, entry] of Object.entries(s.stats)) {
      const value = entry as KeyRecord;
      if (!/^[fj]$/.test(key) || !value || !Number.isInteger(value.hits) || !Number.isInteger(value.misses) || !count(value.hits) || !count(value.misses)) return fresh;
      stats[key] = { hits: value.hits, misses: value.misses };
    }
    for (const key of ["f", "j"]) if ((stats[key]?.hits ?? 0) !== [...expectedHits].filter(k => k === key).length) return fresh;
    if (Object.values(stats).reduce((n, value) => n + value.misses, 0) !== s.mistakes || (phases.indexOf(s.phase) < 3 && s.mistakes !== 0)) return fresh;
    const color = GARDEN_COLORS.some(c => c.id === s.color) ? s.color : fresh.color;
    const spot = GARDEN_SPOTS.some(p => p.id === s.spot) ? s.spot : null;
    const finishedAt = typeof s.finishedAt === "string" && Number.isFinite(Date.parse(s.finishedAt)) ? s.finishedAt : null;
    if (s.phase === "complete" && (!spot || !finishedAt)) return fresh;
    const gardenName = typeof s.gardenName === "string" ? [...s.gardenName.replace(/[\u0000-\u001f\u007f]/g, "")].slice(0, 16).join("") : fresh.gardenName;
    return { ...fresh, phase: s.phase, line: s.line, position: s.position, ready, hits: s.hits, mistakes: s.mistakes, seconds: s.seconds, assistedHits: s.assistedHits, stats, color, spot, gardenName, finishedAt: s.phase === "complete" ? finishedAt : null };
  } catch { return fresh; }
}

/** First completion joins the existing F/J course, without replay reward farming. */
export function awardFirstAdventure(progress: IslandProgress, story: FirstAdventureState): IslandProgress {
  if (progress.firstAdventureClaimed || story.phase !== "complete") return progress;
  const result = scoreSession(0, story.hits, story.mistakes, story.seconds);
  result.date = story.finishedAt ?? result.date;
  return { ...saveSession(progress, result, story.stats), firstAdventureClaimed: true };
}

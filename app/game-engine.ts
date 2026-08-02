export type GardenLevelId = "petal-gate" | "moon-ball" | "wish-crown";

export type GardenLevel = {
  id: GardenLevelId;
  chapter: string;
  title: string;
  story: string;
  goal: string;
  targetWords: number;
  duration: number;
  accent: string;
  words: readonly string[];
};

export type GardenResult = {
  accuracy: number;
  wpm: number;
  score: number;
  stars: number;
  petals: number;
  won: boolean;
};

export type GardenProgress = {
  unlocked: number;
  totalStars: number;
  petals: number;
  totalWords: number;
  bestScores: Record<GardenLevelId, number>;
};

export const GARDEN_LEVELS: readonly GardenLevel[] = [
  {
    id: "petal-gate",
    chapter: "CHAPTER 01",
    title: "花瓣启程",
    story: "让沉睡的花朵重新记起自己的名字",
    goal: "唤醒 10 朵星愿花",
    targetWords: 10,
    duration: 90,
    accent: "#ff8eb5",
    words: ["star", "moon", "rose", "glow", "wish", "magic", "bloom", "fairy", "happy", "dream"],
  },
  {
    id: "moon-ball",
    chapter: "CHAPTER 02",
    title: "月光舞会",
    story: "为月光精灵点亮通往舞会的萤火小径",
    goal: "点亮 12 盏月光灯",
    targetWords: 12,
    duration: 95,
    accent: "#9b8cff",
    words: ["silver", "ribbon", "violet", "sparkle", "dancing", "lantern", "melody", "crystal", "twinkle", "gentle", "wonder", "friend"],
  },
  {
    id: "wish-crown",
    chapter: "CHAPTER 03",
    title: "星愿王冠",
    story: "用勇气咒语击退暗影荆棘，守护整座花园",
    goal: "净化 14 枚暗影花苞",
    targetWords: 14,
    duration: 105,
    accent: "#5fd9cc",
    words: ["brave", "kindness", "believe", "rainbow", "adventure", "together", "starlight", "guardian", "beautiful", "courage", "princess", "powerful", "victory", "forever"],
  },
] as const;

export const DEFAULT_GARDEN_PROGRESS: GardenProgress = {
  unlocked: 1,
  totalStars: 0,
  petals: 0,
  totalWords: 0,
  bestScores: { "petal-gate": 0, "moon-ball": 0, "wish-crown": 0 },
};

export function getLevelWord(level: GardenLevel, completedWords: number): string {
  return level.words[completedWords % level.words.length];
}

export function getLiveScore(correctKeys: number, mistakes: number, completedWords: number, bestCombo: number): number {
  return Math.max(0, correctKeys * 9 + completedWords * 70 + bestCombo * 4 - mistakes * 4);
}

export function evaluateTypingKey(word: string, typedLength: number, key: string): "correct" | "complete" | "wrong" | "ignored" {
  const normalized = key.toLowerCase();
  if (normalized.length !== 1 || !/^[a-z]$/.test(normalized)) return "ignored";
  if (normalized !== word[typedLength]) return "wrong";
  return typedLength + 1 >= word.length ? "complete" : "correct";
}

export function calculateGardenResult(
  level: GardenLevel,
  correctKeys: number,
  mistakes: number,
  elapsedSeconds: number,
  completedWords: number,
  bestCombo: number,
): GardenResult {
  const accuracy = Math.round((correctKeys / Math.max(1, correctKeys + mistakes)) * 100);
  const wpm = Math.round(correctKeys / 5 / (Math.max(1, elapsedSeconds) / 60));
  const score = getLiveScore(correctKeys, mistakes, completedWords, bestCombo);
  const won = completedWords >= level.targetWords;
  const completion = completedWords / level.targetWords;
  const stars = won && accuracy >= 95 ? 3 : won || completion >= 0.65 ? 2 : 1;
  const petals = stars * 12 + completedWords * 2;
  return { accuracy, wpm, score, stars, petals, won };
}

export function applyGardenResult(progress: GardenProgress, levelIndex: number, result: GardenResult, completedWords: number): GardenProgress {
  const level = GARDEN_LEVELS[levelIndex];
  const unlocked = result.won ? Math.min(GARDEN_LEVELS.length, Math.max(progress.unlocked, levelIndex + 2)) : progress.unlocked;
  return {
    unlocked,
    totalStars: progress.totalStars + result.stars,
    petals: progress.petals + result.petals,
    totalWords: progress.totalWords + completedWords,
    bestScores: {
      ...progress.bestScores,
      [level.id]: Math.max(progress.bestScores[level.id], result.score),
    },
  };
}

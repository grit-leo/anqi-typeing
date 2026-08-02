export type GameMode = "journey" | "star-rush" | "bubble-party";

export type GameModeDefinition = {
  id: GameMode;
  icon: string;
  label: string;
  shortLabel: string;
  description: string;
  startCopy: string;
  goal: string;
};

export type GameResult = {
  accuracy: number;
  wpm: number;
  stars: number;
  score: number;
};

export const RUSH_SECONDS = 30;

export const GAME_MODES: readonly GameModeDefinition[] = [
  {
    id: "journey",
    icon: "🚀",
    label: "星路冒险",
    shortLabel: "冒险",
    description: "跟着课程地图逐站解锁新按键",
    startCopy: "点亮航线，抵达下一颗星球",
    goal: "完成全部词组",
  },
  {
    id: "star-rush",
    icon: "🌠",
    label: "30 秒星星雨",
    shortLabel: "竞速",
    description: "在倒计时结束前收集尽可能多的星星",
    startCopy: "30 秒内，每按对一次就接住一颗星",
    goal: "挑战最高分",
  },
  {
    id: "bubble-party",
    icon: "🫧",
    label: "泡泡派对",
    shortLabel: "泡泡",
    description: "按对字母，噗噗噗地消除所有泡泡",
    startCopy: "看准字母，把发光泡泡一个个戳破",
    goal: "消除全部泡泡",
  },
] as const;

type LessonInput = { keys: string[]; prompts: string[]; xp: number };

export function getModePrompts(mode: GameMode, lesson: LessonInput): string[] {
  if (mode !== "bubble-party") return lesson.prompts;
  const keys = lesson.keys.length ? lesson.keys : ["f", "j"];
  const reversed = [...keys].reverse();
  return [
    [...keys, ...reversed].join(""),
    [...reversed, ...keys].join(""),
    keys.flatMap((key, index) => [key, index % 2 === 0 ? keys.at(-1)! : keys[0]]).join(""),
  ];
}

export function getSessionReward(mode: GameMode, lessonXp: number): number {
  if (mode === "journey") return lessonXp;
  return mode === "star-rush" ? 35 : 30;
}

export function calculateGameResult(
  mode: GameMode,
  correct: number,
  mistakes: number,
  elapsedSeconds: number,
  bestStreak: number,
): GameResult {
  const accuracy = Math.round((correct / Math.max(1, correct + mistakes)) * 100);
  const wpm = Math.round(correct / 5 / (Math.max(1, elapsedSeconds) / 60));
  const score = Math.max(0, correct * 10 + bestStreak * 3 - mistakes * 4);

  let stars = accuracy >= 97 ? 3 : accuracy >= 88 ? 2 : 1;
  if (mode === "star-rush") {
    stars = score >= 650 && accuracy >= 92 ? 3 : score >= 350 && accuracy >= 82 ? 2 : 1;
  }
  if (mode === "bubble-party") {
    stars = bestStreak >= 18 && accuracy >= 95 ? 3 : bestStreak >= 9 && accuracy >= 85 ? 2 : 1;
  }

  return { accuracy, wpm, stars, score };
}

export type GardenWorldId = "blossom-vale" | "moon-lake" | "cloud-kingdom" | "aurora-temple";
export type MissionType = "bloom" | "firefly" | "rhythm" | "guardian";
export type GardenLevelId =
  | "petal-gate" | "firefly-post" | "rose-guardian"
  | "crystal-ripple" | "moon-ball" | "sleeping-swan"
  | "cloud-station" | "rainbow-library" | "storm-queen"
  | "aurora-whisper" | "wish-corridor" | "eternal-crown";

export type GardenWorld = {
  id: GardenWorldId;
  number: string;
  name: string;
  subtitle: string;
  icon: string;
  accent: string;
  story: string;
};

export type GardenLevel = {
  id: GardenLevelId;
  worldId: GardenWorldId;
  worldIndex: number;
  mission: MissionType;
  chapter: string;
  title: string;
  story: string;
  goal: string;
  targetWords: number;
  duration: number;
  accent: string;
  difficulty: number;
  newKeys: readonly string[];
  learnedKeys: readonly string[];
  lesson: string;
  words: readonly string[];
};

export type KeyMastery = {
  attempts: number;
  correct: number;
  streak: number;
  score: number;
};

export type SessionKeyStat = { attempts: number; correct: number; bestStreak: number };
export type SessionKeyStats = Record<string, SessionKeyStat>;
export type LessonAct = "learn" | "practice" | "adventure";

export type MissionRules = {
  name: string;
  verb: string;
  hint: string;
  untimed: boolean;
  durationOverride?: number;
};

export type GardenResult = {
  accuracy: number;
  wpm: number;
  score: number;
  stars: number;
  petals: number;
  xp: number;
  missionBonus: number;
  won: boolean;
};

export type DailyProgress = {
  date: string;
  words: number;
  sessions: number;
  claimed: boolean;
};

export type GardenProgress = {
  schemaVersion: 2;
  unlocked: number;
  totalStars: number;
  petals: number;
  totalWords: number;
  xp: number;
  bestScores: Record<GardenLevelId, number>;
  achievements: string[];
  ownedCosmetics: string[];
  equippedCosmetic: string;
  daily: DailyProgress;
  keyMastery: Record<string, KeyMastery>;
};

export type Cosmetic = {
  id: string;
  icon: string;
  name: string;
  story: string;
  price: number;
  color: string;
};

export type Achievement = {
  id: string;
  icon: string;
  name: string;
  story: string;
};

export const GARDEN_WORLDS: readonly GardenWorld[] = [
  { id: "blossom-vale", number: "WORLD 01", name: "樱花谷", subtitle: "花语初醒", icon: "❀", accent: "#ff8eb5", story: "跟随月兔露米，唤醒被晨雾封印的第一座花谷。" },
  { id: "moon-lake", number: "WORLD 02", name: "月光湖", subtitle: "银色舞会", icon: "☾", accent: "#9b8cff", story: "乘上水晶小船，为沉睡的月光精灵找回旋律。" },
  { id: "cloud-kingdom", number: "WORLD 03", name: "云上王城", subtitle: "彩虹书页", icon: "☁", accent: "#70cfee", story: "穿越云朵车站，在风暴到来前修复王城图书馆。" },
  { id: "aurora-temple", number: "WORLD 04", name: "极光圣殿", subtitle: "永恒星愿", icon: "✦", accent: "#66e0c9", story: "集齐四界光芒，完成守护花园的最终加冕。" },
] as const;

export const MISSION_RULES: Record<MissionType, MissionRules> = {
  bloom: { name: "花灵唤醒", verb: "让花朵生长", hint: "没有倒计时，稳定输入最重要", untimed: true },
  firefly: { name: "萤火竞速", verb: "追上萤火光带", hint: "三轮 20 秒冲刺，每轮之间休息 2 秒", untimed: false, durationOverride: 66 },
  rhythm: { name: "节奏短句", verb: "跟随月光节拍", hint: "在光圈最亮时输入可获得拍点奖励", untimed: false },
  guardian: { name: "守护者 Boss", verb: "击破三重护盾", hint: "完整词语造成伤害，连击积蓄终结魔法", untimed: false },
};

export const GARDEN_LEVELS: readonly GardenLevel[] = [
  {
    id: "petal-gate", worldId: "blossom-vale", worldIndex: 0, mission: "bloom", chapter: "1-1", title: "花瓣启程", story: "让左右食指找到键盘上的两个小凸点", goal: "完成 8 组 F/J 定位魔法", targetWords: 8, duration: 90, accent: "#ff8eb5", difficulty: 1,
    newKeys: ["f", "j"], learnedKeys: ["f", "j"], lesson: "左右食指定位",
    words: ["fff", "jjj", "fjf", "jfj", "ffj", "jjf", "fjj", "jff"],
  },
  {
    id: "firefly-post", worldId: "blossom-vale", worldIndex: 0, mission: "firefly", chapter: "1-2", title: "萤火邮差", story: "学习主键行两侧的花语按键", goal: "送出 10 封主键行萤火信", targetWords: 10, duration: 95, accent: "#ffb868", difficulty: 1,
    newKeys: ["a", "s", "d", "k", "l"], learnedKeys: ["a", "s", "d", "f", "j", "k", "l"], lesson: "主键行两侧",
    words: ["sad", "dad", "ask", "fall", "flask", "salad", "lad", "all", "lass", "adds"],
  },
  {
    id: "rose-guardian", worldId: "blossom-vale", worldIndex: 0, mission: "guardian", chapter: "1-3", title: "蔷薇守门人", story: "用 G/H 连接左右手，守护完整主键行", goal: "击破 10 层主键行结界", targetWords: 10, duration: 110, accent: "#f56e9e", difficulty: 2,
    newKeys: ["g", "h"], learnedKeys: ["a", "s", "d", "f", "g", "h", "j", "k", "l"], lesson: "完整主键行",
    words: ["dash", "flash", "glass", "flag", "half", "shall", "glad", "salad", "hash", "gash"],
  },
  {
    id: "crystal-ripple", worldId: "moon-lake", worldIndex: 1, mission: "rhythm", chapter: "2-1", title: "水晶涟漪", story: "从主键行伸向最容易找到的 E/I", goal: "奏响 10 段 E/I 水晶旋律", targetWords: 10, duration: 105, accent: "#89b8ff", difficulty: 2,
    newKeys: ["e", "i"], learnedKeys: ["a", "s", "d", "f", "g", "h", "j", "k", "l", "e", "i"], lesson: "上排第一步",
    words: ["see", "feel", "life", "idea", "side", "file", "hide", "like", "kiss", "sea"],
  },
  {
    id: "moon-ball", worldId: "moon-lake", worldIndex: 1, mission: "firefly", chapter: "2-2", title: "月光舞会", story: "让手指向上轻移，点亮 R/U/W/O", goal: "点亮 10 盏上排月光灯", targetWords: 10, duration: 105, accent: "#9b8cff", difficulty: 2,
    newKeys: ["r", "u", "w", "o"], learnedKeys: ["a", "s", "d", "f", "g", "h", "j", "k", "l", "e", "i", "r", "u", "w", "o"], lesson: "上排伸展",
    words: ["rose", "word", "flower", "world", "house", "wish", "soul", "doll", "owl", "row"],
  },
  {
    id: "sleeping-swan", worldId: "moon-lake", worldIndex: 1, mission: "guardian", chapter: "2-3", title: "沉睡天鹅", story: "学会 Q/T/Y/P，完成整个上排键位", goal: "净化 10 枚上排迷雾音符", targetWords: 10, duration: 115, accent: "#b49cff", difficulty: 3,
    newKeys: ["q", "t", "y", "p"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l"], lesson: "完整上排",
    words: ["quiet", "type", "pretty", "power", "party", "story", "yellow", "purple", "queen", "tower"],
  },
  {
    id: "cloud-station", worldId: "cloud-kingdom", worldIndex: 2, mission: "bloom", chapter: "3-1", title: "云朵车站", story: "从主键行向下找到 V/M", goal: "打印 10 张 V/M 云端车票", targetWords: 10, duration: 110, accent: "#70cfee", difficulty: 3,
    newKeys: ["v", "m"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "v", "m"], lesson: "下排第一步",
    words: ["move", "moon", "dream", "smile", "magic", "river", "warm", "movie", "summer", "velvet"],
  },
  {
    id: "rainbow-library", worldId: "cloud-kingdom", worldIndex: 2, mission: "rhythm", chapter: "3-2", title: "彩虹图书馆", story: "继续向下找到 C/N/X/B", goal: "修复 10 页下排键故事", targetWords: 10, duration: 120, accent: "#7fdcc8", difficulty: 4,
    newKeys: ["c", "n", "x", "b"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "c", "v", "b", "n", "m", "x"], lesson: "下排伸展",
    words: ["bunny", "cloud", "dance", "crown", "box", "next", "candy", "ocean", "brave", "crystal"],
  },
  {
    id: "storm-queen", worldId: "cloud-kingdom", worldIndex: 2, mission: "guardian", chapter: "3-3", title: "风暴女王", story: "找到最后的 Z，掌握完整字母区", goal: "击破 10 枚全字母风暴核心", targetWords: 10, duration: 125, accent: "#62bfe9", difficulty: 4,
    newKeys: ["z"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "z", "x", "c", "v", "b", "n", "m"], lesson: "完整字母区",
    words: ["amazing", "puzzle", "breeze", "wizard", "jazz", "frozen", "zigzag", "prize", "sparkle", "adventure"],
  },
  {
    id: "aurora-whisper", worldId: "aurora-temple", worldIndex: 3, mission: "firefly", chapter: "4-1", title: "极光秘语", story: "学会用拇指敲空格，把单词连接成短语", goal: "捕捉 10 组空格极光符文", targetWords: 10, duration: 120, accent: "#66e0c9", difficulty: 4,
    newKeys: ["space"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "z", "x", "c", "v", "b", "n", "m", "space"], lesson: "拇指与空格",
    words: ["magic book", "bright sky", "kind heart", "tiny dragon", "silver key", "rainbow road", "brave friend", "dream big", "we shine", "keep going"],
  },
  {
    id: "wish-corridor", worldId: "aurora-temple", worldIndex: 3, mission: "rhythm", chapter: "4-2", title: "星愿回廊", story: "左右小指配合 Shift，点亮句子开头", goal: "完成 10 条大写星愿誓言", targetWords: 10, duration: 135, accent: "#67d8d0", difficulty: 5,
    newKeys: ["shift"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "z", "x", "c", "v", "b", "n", "m", "space", "shift"], lesson: "Shift 与大写",
    words: ["Magic Garden", "Brave Friend", "Dream Big", "Keep Going", "We Can Shine", "Kind Heart", "Bright Sky", "Follow Stars", "Create Magic", "I Will Learn"],
  },
  {
    id: "eternal-crown", worldId: "aurora-temple", worldIndex: 3, mission: "guardian", chapter: "4-3", title: "永恒花冠", story: "加入逗号、句号和撇号，写下完整的花园故事", goal: "净化 10 层标点永恒结界", targetWords: 10, duration: 145, accent: "#ffd16d", difficulty: 5,
    newKeys: ["comma", "period", "apostrophe"], learnedKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "z", "x", "c", "v", "b", "n", "m", "space", "shift", "comma", "period", "apostrophe"], lesson: "完整句子",
    words: ["Hello, garden.", "I'm brave.", "Let's grow.", "Magic is here.", "We can shine.", "Dreams have power.", "Kindness wins.", "I'll keep going.", "Write your story.", "Forever blooming."],
  },
] as const;

export const COSMETICS: readonly Cosmetic[] = [
  { id: "violet-wand", icon: "✦", name: "紫罗兰星杖", story: "安琪的第一支魔法杖", price: 0, color: "#9e7af0" },
  { id: "rose-wand", icon: "❀", name: "蔷薇花杖", story: "连击时会泛起玫瑰光", price: 80, color: "#ff86b4" },
  { id: "moon-crown", icon: "☾", name: "月桂银冠", story: "来自月光舞会的纪念", price: 120, color: "#b7a4ff" },
  { id: "cloud-cape", icon: "☁", name: "云雀披风", story: "像晨风一样轻盈的蓝色", price: 180, color: "#70cfee" },
  { id: "aurora-tiara", icon: "✧", name: "极光冠冕", story: "四界守护者的璀璨证明", price: 260, color: "#66e0c9" },
] as const;

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-spell", icon: "✿", name: "第一朵花", story: "完成第一个目标单词" },
  { id: "steady-hands", icon: "◎", name: "稳稳的魔法", story: "单局准确率达到 95%" },
  { id: "combo-star", icon: "✦", name: "星愿连击", story: "单局最高连击达到 20" },
  { id: "vale-guardian", icon: "❀", name: "樱花谷守护者", story: "通过世界 1 的全部关卡" },
  { id: "word-hundred", icon: "100", name: "百词魔法师", story: "累计完成 100 个单词" },
  { id: "world-walker", icon: "♢", name: "四界旅行家", story: "解锁全部四大世界" },
  { id: "perfect-crown", icon: "♛", name: "完美花冠", story: "任意关卡获得三星" },
  { id: "eternal-guardian", icon: "∞", name: "永恒守护者", story: "通关最终试炼" },
] as const;

function emptyBestScores(): Record<GardenLevelId, number> {
  return Object.fromEntries(GARDEN_LEVELS.map((level) => [level.id, 0])) as Record<GardenLevelId, number>;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyTarget(dateKey: string): number {
  const digitSum = [...dateKey].reduce((sum, character) => sum + (Number(character) || 0), 0);
  return 18 + (digitSum % 5);
}

export const DEFAULT_GARDEN_PROGRESS: GardenProgress = {
  schemaVersion: 2,
  unlocked: 1,
  totalStars: 0,
  petals: 0,
  totalWords: 0,
  xp: 0,
  bestScores: emptyBestScores(),
  achievements: [],
  ownedCosmetics: ["violet-wand"],
  equippedCosmetic: "violet-wand",
  daily: { date: "", words: 0, sessions: 0, claimed: false },
  keyMastery: {},
};

export function getLessonAct(level: GardenLevel, completedWords: number): LessonAct {
  const ratio = completedWords / Math.max(1, level.targetWords);
  return ratio < 0.3 ? "learn" : ratio < 0.7 ? "practice" : "adventure";
}

export function getLevelMastery(level: GardenLevel, mastery: Record<string, KeyMastery>): number {
  if (!level.newKeys.length) return 0;
  return Math.round(level.newKeys.reduce((sum, key) => sum + (mastery[key]?.score ?? 0), 0) / level.newKeys.length);
}

export function mergeKeyMastery(current: Record<string, KeyMastery>, session: SessionKeyStats): Record<string, KeyMastery> {
  const next = { ...current };
  Object.entries(session).forEach(([key, stat]) => {
    const previous = current[key] ?? { attempts: 0, correct: 0, streak: 0, score: 0 };
    const attempts = previous.attempts + stat.attempts;
    const correct = previous.correct + stat.correct;
    const streak = Math.max(previous.streak, stat.bestStreak);
    const accuracy = correct / Math.max(1, attempts);
    const practice = Math.min(1, attempts / 8);
    next[key] = { attempts, correct, streak, score: Math.round(accuracy * practice * 100) };
  });
  return next;
}

export function getLevelWord(level: GardenLevel, completedWords: number): string {
  return level.words[completedWords % level.words.length];
}

export function getPlayerLevel(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 90)) + 1;
}

export function getPlayerLevelProgress(xp: number): number {
  const level = getPlayerLevel(xp);
  const floor = (level - 1) ** 2 * 90;
  const ceiling = level ** 2 * 90;
  return Math.round(((xp - floor) / Math.max(1, ceiling - floor)) * 100);
}

export function getLiveScore(level: GardenLevel, correctKeys: number, mistakes: number, completedWords: number, bestCombo: number, missionBonus = 0): number {
  const multiplier = level.mission === "guardian" ? 1.2 : level.mission === "rhythm" ? 1.12 : level.mission === "firefly" ? 1.06 : 1;
  return Math.max(0, Math.round((correctKeys * 9 + completedWords * 70 + bestCombo * 4 - mistakes * 4) * multiplier + missionBonus));
}

export function getMissionDuration(level: GardenLevel): number | null {
  const rules = MISSION_RULES[level.mission];
  return rules.untimed ? null : rules.durationOverride ?? level.duration;
}

export function getGuardianState(level: GardenLevel, completedWords: number): { hpPercent: number; phase: number } {
  const hpPercent = Math.max(0, Math.round((1 - completedWords / Math.max(1, level.targetWords)) * 100));
  return { hpPercent, phase: hpPercent > 66 ? 1 : hpPercent > 33 ? 2 : 3 };
}

export function evaluateTypingKey(word: string, typedLength: number, key: string): "correct" | "complete" | "wrong" | "ignored" {
  if (key.length !== 1 || !/^[a-zA-Z ,\.']$/.test(key)) return "ignored";
  const expected = word[typedLength];
  const exactCaseRequired = expected >= "A" && expected <= "Z";
  const matches = exactCaseRequired ? key === expected : key.toLowerCase() === expected;
  if (!matches) return "wrong";
  return typedLength + 1 >= word.length ? "complete" : "correct";
}

export function calculateGardenResult(level: GardenLevel, correctKeys: number, mistakes: number, elapsedSeconds: number, completedWords: number, bestCombo: number, missionBonus = 0): GardenResult {
  const accuracy = Math.round((correctKeys / Math.max(1, correctKeys + mistakes)) * 100);
  const wpm = Math.round(correctKeys / 5 / (Math.max(1, elapsedSeconds) / 60));
  const score = getLiveScore(level, correctKeys, mistakes, completedWords, bestCombo, missionBonus);
  const won = completedWords >= level.targetWords && accuracy >= 85;
  const stars = won && accuracy >= 97 ? 3 : won && accuracy >= 90 ? 2 : won ? 1 : 0;
  const petals = stars * 12 + completedWords * 2 + (level.mission === "guardian" && won ? 12 : 0);
  const xp = completedWords * 8 + stars * 18 + Math.floor(bestCombo / 5) * 3;
  return { accuracy, wpm, score, stars, petals, xp, missionBonus, won };
}

export function unlockAchievements(progress: GardenProgress, levelIndex: number, result: GardenResult, bestCombo: number): string[] {
  const unlocked = new Set(progress.achievements);
  if (progress.totalWords >= 1) unlocked.add("first-spell");
  if (result.accuracy >= 95) unlocked.add("steady-hands");
  if (bestCombo >= 20) unlocked.add("combo-star");
  if (progress.unlocked >= 4) unlocked.add("vale-guardian");
  if (progress.totalWords >= 100) unlocked.add("word-hundred");
  if (progress.unlocked >= 10) unlocked.add("world-walker");
  if (result.stars === 3) unlocked.add("perfect-crown");
  if (levelIndex === GARDEN_LEVELS.length - 1 && result.won) unlocked.add("eternal-guardian");
  return [...unlocked];
}

export function applyGardenResult(progress: GardenProgress, levelIndex: number, result: GardenResult, completedWords: number, bestCombo: number, dateKey: string, keyStats: SessionKeyStats = {}): GardenProgress {
  const level = GARDEN_LEVELS[levelIndex];
  const unlocked = result.won ? Math.min(GARDEN_LEVELS.length, Math.max(progress.unlocked, levelIndex + 2)) : progress.unlocked;
  const dailyBase = progress.daily.date === dateKey ? progress.daily : { date: dateKey, words: 0, sessions: 0, claimed: false };
  const next: GardenProgress = {
    ...progress,
    unlocked,
    totalStars: progress.totalStars + result.stars,
    petals: progress.petals + result.petals,
    totalWords: progress.totalWords + completedWords,
    xp: progress.xp + result.xp,
    bestScores: { ...progress.bestScores, [level.id]: Math.max(progress.bestScores[level.id], result.score) },
    daily: { ...dailyBase, words: dailyBase.words + completedWords, sessions: dailyBase.sessions + 1 },
    keyMastery: mergeKeyMastery(progress.keyMastery, keyStats),
  };
  next.achievements = unlockAchievements(next, levelIndex, result, bestCombo);
  return next;
}

export function claimDailyReward(progress: GardenProgress, dateKey: string): GardenProgress {
  const target = getDailyTarget(dateKey);
  if (progress.daily.date !== dateKey || progress.daily.words < target || progress.daily.claimed) return progress;
  return { ...progress, petals: progress.petals + 60, xp: progress.xp + 80, daily: { ...progress.daily, claimed: true } };
}

export function buyOrEquipCosmetic(progress: GardenProgress, cosmeticId: string): GardenProgress {
  const cosmetic = COSMETICS.find((item) => item.id === cosmeticId);
  if (!cosmetic) return progress;
  if (progress.ownedCosmetics.includes(cosmeticId)) return { ...progress, equippedCosmetic: cosmeticId };
  if (progress.petals < cosmetic.price) return progress;
  return { ...progress, petals: progress.petals - cosmetic.price, ownedCosmetics: [...progress.ownedCosmetics, cosmeticId], equippedCosmetic: cosmeticId };
}

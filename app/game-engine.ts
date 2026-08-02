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
  words: readonly string[];
};

export type GardenResult = {
  accuracy: number;
  wpm: number;
  score: number;
  stars: number;
  petals: number;
  xp: number;
  won: boolean;
};

export type DailyProgress = {
  date: string;
  words: number;
  sessions: number;
  claimed: boolean;
};

export type GardenProgress = {
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

export const GARDEN_LEVELS: readonly GardenLevel[] = [
  {
    id: "petal-gate", worldId: "blossom-vale", worldIndex: 0, mission: "bloom", chapter: "1-1", title: "花瓣启程", story: "让沉睡的花朵重新记起自己的名字", goal: "唤醒 10 朵星愿花", targetWords: 10, duration: 90, accent: "#ff8eb5", difficulty: 1,
    words: ["star", "moon", "rose", "glow", "wish", "magic", "bloom", "fairy", "happy", "dream"],
  },
  {
    id: "firefly-post", worldId: "blossom-vale", worldIndex: 0, mission: "firefly", chapter: "1-2", title: "萤火邮差", story: "赶在日落前，把花语信送到每一座蘑菇屋", goal: "送出 11 封萤火信", targetWords: 11, duration: 85, accent: "#ffb868", difficulty: 1,
    words: ["letter", "honey", "garden", "little", "yellow", "butter", "sunny", "smile", "basket", "picnic", "friend"],
  },
  {
    id: "rose-guardian", worldId: "blossom-vale", worldIndex: 0, mission: "guardian", chapter: "1-3", title: "蔷薇守门人", story: "用准确的咒语解除蔷薇迷宫的三重结界", goal: "击破 12 层蔷薇结界", targetWords: 12, duration: 100, accent: "#f56e9e", difficulty: 2,
    words: ["petals", "secret", "lovely", "summer", "gentle", "promise", "sparkle", "cottage", "morning", "forever", "welcome", "courage"],
  },
  {
    id: "crystal-ripple", worldId: "moon-lake", worldIndex: 1, mission: "rhythm", chapter: "2-1", title: "水晶涟漪", story: "跟着湖面节拍，让每个字母落在月光上", goal: "奏响 12 段水晶旋律", targetWords: 12, duration: 95, accent: "#89b8ff", difficulty: 2,
    words: ["silver", "ripple", "violet", "mirror", "melody", "crystal", "twinkle", "gentle", "wonder", "feather", "whisper", "evening"],
  },
  {
    id: "moon-ball", worldId: "moon-lake", worldIndex: 1, mission: "firefly", chapter: "2-2", title: "月光舞会", story: "为月光精灵点亮通往舞会的萤火小径", goal: "点亮 13 盏月光灯", targetWords: 13, duration: 95, accent: "#9b8cff", difficulty: 2,
    words: ["ribbon", "dancing", "lantern", "velvet", "starlit", "graceful", "diamond", "festival", "midnight", "glimmer", "harmony", "partner", "delight"],
  },
  {
    id: "sleeping-swan", worldId: "moon-lake", worldIndex: 1, mission: "guardian", chapter: "2-3", title: "沉睡天鹅", story: "穿过迷雾，唤醒守护月湖的银翼天鹅", goal: "净化 14 枚迷雾音符", targetWords: 14, duration: 105, accent: "#b49cff", difficulty: 3,
    words: ["moonbeam", "serenade", "luminous", "sapphire", "enchanted", "elegance", "reflection", "beautiful", "symphony", "peaceful", "guardian", "awakening", "radiant", "moonlight"],
  },
  {
    id: "cloud-station", worldId: "cloud-kingdom", worldIndex: 2, mission: "bloom", chapter: "3-1", title: "云朵车站", story: "修好会飞的打字车票，搭上前往王城的列车", goal: "打印 14 张云端车票", targetWords: 14, duration: 100, accent: "#70cfee", difficulty: 3,
    words: ["cloud", "ticket", "travel", "breeze", "window", "station", "journey", "luggage", "captain", "floating", "sunrise", "airship", "compass", "arrive"],
  },
  {
    id: "rainbow-library", worldId: "cloud-kingdom", worldIndex: 2, mission: "rhythm", chapter: "3-2", title: "彩虹图书馆", story: "输入完整短句，让散落的故事重新飞回书页", goal: "修复 12 页彩虹故事", targetWords: 12, duration: 115, accent: "#7fdcc8", difficulty: 4,
    words: ["magic book", "bright sky", "kind heart", "tiny dragon", "silver key", "rainbow road", "brave friend", "flying castle", "secret story", "wonder grows", "dreams begin", "we shine"],
  },
  {
    id: "storm-queen", worldId: "cloud-kingdom", worldIndex: 2, mission: "guardian", chapter: "3-3", title: "风暴女王", story: "保持节奏与准确，平息笼罩王城的雷云", goal: "击破 15 枚风暴核心", targetWords: 15, duration: 120, accent: "#62bfe9", difficulty: 4,
    words: ["thunder", "powerful", "kingdom", "adventure", "lightning", "together", "fearless", "victory", "skyward", "champion", "protect", "believe", "bravery", "freedom", "sunlight"],
  },
  {
    id: "aurora-whisper", worldId: "aurora-temple", worldIndex: 3, mission: "firefly", chapter: "4-1", title: "极光秘语", story: "追上极光精灵，收集散落在夜空的古老文字", goal: "捕捉 15 枚极光符文", targetWords: 15, duration: 110, accent: "#66e0c9", difficulty: 4,
    words: ["aurora", "emerald", "starlight", "northern", "mystery", "celestial", "glacier", "shimmer", "destiny", "infinite", "horizon", "whisper", "comet", "cosmic", "radiance"],
  },
  {
    id: "wish-corridor", worldId: "aurora-temple", worldIndex: 3, mission: "rhythm", chapter: "4-2", title: "星愿回廊", story: "写下属于自己的勇气短句，开启圣殿大门", goal: "完成 14 条星愿誓言", targetWords: 14, duration: 125, accent: "#67d8d0", difficulty: 5,
    words: ["i am brave", "i choose kind", "dream big", "keep going", "we can shine", "trust yourself", "create magic", "follow the stars", "my heart glows", "friends are power", "wonder is near", "i will learn", "make a wish", "light the way"],
  },
  {
    id: "eternal-crown", worldId: "aurora-temple", worldIndex: 3, mission: "guardian", chapter: "4-3", title: "永恒花冠", story: "集结四界花灵，完成最后的守护者试炼", goal: "净化 16 层永恒结界", targetWords: 16, duration: 135, accent: "#ffd16d", difficulty: 5,
    words: ["constellation", "extraordinary", "imagination", "determination", "celebration", "magnificent", "friendship", "confidence", "kindness wins", "believe in magic", "we grow together", "courage shines", "protect our garden", "dreams have power", "write your story", "forever blooming"],
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
};

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

export function getLiveScore(level: GardenLevel, correctKeys: number, mistakes: number, completedWords: number, bestCombo: number): number {
  const multiplier = level.mission === "guardian" ? 1.2 : level.mission === "rhythm" ? 1.12 : level.mission === "firefly" ? 1.06 : 1;
  return Math.max(0, Math.round((correctKeys * 9 + completedWords * 70 + bestCombo * 4 - mistakes * 4) * multiplier));
}

export function evaluateTypingKey(word: string, typedLength: number, key: string): "correct" | "complete" | "wrong" | "ignored" {
  const normalized = key === " " ? " " : key.toLowerCase();
  if (normalized.length !== 1 || !/^[a-z ]$/.test(normalized)) return "ignored";
  if (normalized !== word[typedLength]) return "wrong";
  return typedLength + 1 >= word.length ? "complete" : "correct";
}

export function calculateGardenResult(level: GardenLevel, correctKeys: number, mistakes: number, elapsedSeconds: number, completedWords: number, bestCombo: number): GardenResult {
  const accuracy = Math.round((correctKeys / Math.max(1, correctKeys + mistakes)) * 100);
  const wpm = Math.round(correctKeys / 5 / (Math.max(1, elapsedSeconds) / 60));
  const score = getLiveScore(level, correctKeys, mistakes, completedWords, bestCombo);
  const won = completedWords >= level.targetWords;
  const completion = completedWords / level.targetWords;
  const stars = won && accuracy >= 96 ? 3 : won || completion >= 0.65 ? 2 : 1;
  const petals = stars * 12 + completedWords * 2 + (level.mission === "guardian" && won ? 12 : 0);
  const xp = completedWords * 8 + stars * 18 + Math.floor(bestCombo / 5) * 3;
  return { accuracy, wpm, score, stars, petals, xp, won };
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

export function applyGardenResult(progress: GardenProgress, levelIndex: number, result: GardenResult, completedWords: number, bestCombo: number, dateKey: string): GardenProgress {
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

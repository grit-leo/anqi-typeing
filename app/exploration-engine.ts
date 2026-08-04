export type ExplorationEncounterId = "rune-gate" | "moon-bridge" | "wish-beacon" | `endless-${number}`;
export type WorldDiscoveryId = "dew-crystal" | "cloud-seed" | "momo-guide" | "tea-gardener";
export type WorldDiscovery = {
  id: WorldDiscoveryId;
  kind: "collectible" | "npc";
  name: string;
  label: string;
  message: string;
  reward: number;
  position: { x: number; z: number };
};

export type EndlessBiomeId = "sakura-meadow" | "moon-creek" | "cloud-orchard" | "aurora-grove";

export type EndlessBiome = {
  id: EndlessBiomeId;
  name: string;
  subtitle: string;
  icon: string;
  sky: number;
  fog: number;
  grass: number;
  accent: number;
};

export type ExplorationEncounter = {
  id: ExplorationEncounterId;
  number: number;
  title: string;
  subtitle: string;
  story: string;
  success: string;
  icon: string;
  start: number;
  end: number;
  position: { x: number; z: number };
};

export const EXPLORATION_TOTAL_WORDS = 15;
export const ENDLESS_EVENT_WORDS = 5;
export const ENDLESS_CHUNK_LENGTH = 18;

export function getPerformanceQuality(averageFrameSeconds: number, currentScale: number, lightweight: boolean): { scale: number; mode: "精细" | "流畅" } {
  const scale = averageFrameSeconds > 0.024
    ? Math.max(0.68, currentScale - 0.12)
    : averageFrameSeconds < 0.0175
      ? Math.min(1, currentScale + 0.06)
      : currentScale;
  return { scale, mode: lightweight || scale <= 0.88 ? "流畅" : "精细" };
}

export const WORLD_DISCOVERIES: readonly WorldDiscovery[] = [
  { id: "momo-guide", kind: "npc", name: "向导茉茉", label: "隐秘花径的守护兔", message: "左边的小路通向晨露花圃。慢慢走，发光的叶子会为你指路。", reward: 3, position: { x: -4.9, z: -3.9 } },
  { id: "dew-crystal", kind: "collectible", name: "晨露水晶", label: "藏在西侧花圃", message: "你找到了晨露水晶！它会记录认真探索的脚步。", reward: 6, position: { x: -6.1, z: -7.1 } },
  { id: "tea-gardener", kind: "npc", name: "园丁茶茶", label: "月桥旁的花园朋友", message: "桥的右侧有一条弯弯小径。云朵种子正在池边等一个细心的人。", reward: 3, position: { x: 5.35, z: -14.9 } },
  { id: "cloud-seed", kind: "collectible", name: "云朵种子", label: "藏在东侧月影池", message: "云朵种子加入了收藏！完成关卡后，它会在花园里发芽。", reward: 6, position: { x: 6.05, z: -18.15 } },
] as const;

export function getWorldDiscovery(id: string): WorldDiscovery | null {
  return WORLD_DISCOVERIES.find((discovery) => discovery.id === id) ?? null;
}

export const ENDLESS_BIOMES: readonly EndlessBiome[] = [
  { id: "sakura-meadow", name: "樱风原野", subtitle: "花瓣会指向下一个谜题", icon: "✿", sky: 0x8fc9e7, fog: 0xd1b9ce, grass: 0x62a277, accent: 0xff9fc8 },
  { id: "moon-creek", name: "月亮溪谷", subtitle: "沿着发光溪流继续前进", icon: "☾", sky: 0x718bd0, fog: 0x9fa7d1, grass: 0x4f887a, accent: 0xb8a7ff },
  { id: "cloud-orchard", name: "云朵果园", subtitle: "漂浮果实藏着新的词语", icon: "☁", sky: 0x8fd5df, fog: 0xc8d9d5, grass: 0x6ca978, accent: 0xffd27f },
  { id: "aurora-grove", name: "极光森林", subtitle: "跟随极光找到星愿石碑", icon: "✦", sky: 0x477e94, fog: 0x78979f, grass: 0x397b70, accent: 0x79efd2 },
] as const;

const ENDLESS_EVENT_TEMPLATES = [
  { title: "风车花语台", story: "风车停在了半空。准确输入五个咒语，让花瓣再次乘风飞行。", success: "花瓣风车重新转动，前方世界继续展开！" },
  { title: "月兔邮筒", story: "一封星光信件正在等待投递。完成五个词语，为它写上魔法地址。", success: "星光信件飞向远方，你获得了新的探索奖励！" },
  { title: "云果泡泡机", story: "漂浮果实被泡泡困住了。用稳定指法逐个释放它们。", success: "云果落进了露米的背包，新的道路出现了！" },
  { title: "极光许愿碑", story: "石碑上缺少五颗文字星星。输入正确字母，补全这幅极光图。", success: "许愿碑被点亮，远处又升起了一座新的岛屿！" },
] as const;

export const EXPLORATION_ENCOUNTERS: readonly ExplorationEncounter[] = [
  {
    id: "rune-gate",
    number: 1,
    title: "花瓣符文门",
    subtitle: "唤醒第一道花印",
    story: "门上的花纹失去了光。用基准键咒语让它重新绽放。",
    success: "花瓣门开启，前方出现了新的小路！",
    icon: "✿",
    start: 0,
    end: 5,
    position: { x: 0, z: -2.4 },
  },
  {
    id: "moon-bridge",
    number: 2,
    title: "溪谷浮桥",
    subtitle: "召回五块月光踏板",
    story: "溪水冲散了桥面。每个正确单词都会召回一块踏板。",
    success: "月光踏板全部归位，可以继续前进了！",
    icon: "⌁",
    start: 5,
    end: 10,
    position: { x: 0, z: -11.5 },
  },
  {
    id: "wish-beacon",
    number: 3,
    title: "星愿花塔",
    subtitle: "点亮沉睡的花园核心",
    story: "终点的花塔正在呼唤你。完成最后五个咒语，唤醒整片樱花谷。",
    success: "星愿花塔被点亮，樱花谷恢复了生机！",
    icon: "✦",
    start: 10,
    end: 15,
    position: { x: 0, z: -22.2 },
  },
] as const;

export function getExplorationEncounter(completedWords: number): ExplorationEncounter | null {
  const safeWords = Math.max(0, Math.floor(completedWords));
  return EXPLORATION_ENCOUNTERS.find((encounter) => safeWords >= encounter.start && safeWords < encounter.end) ?? null;
}

export function getEndlessBiome(eventIndex: number): EndlessBiome {
  return ENDLESS_BIOMES[Math.max(0, Math.floor(eventIndex)) % ENDLESS_BIOMES.length];
}

export function getEndlessEncounter(endlessWords: number): ExplorationEncounter {
  const safeWords = Math.max(0, Math.floor(endlessWords));
  const eventIndex = Math.floor(safeWords / ENDLESS_EVENT_WORDS);
  const template = ENDLESS_EVENT_TEMPLATES[eventIndex % ENDLESS_EVENT_TEMPLATES.length];
  const biome = getEndlessBiome(eventIndex);
  const start = eventIndex * ENDLESS_EVENT_WORDS;
  return {
    id: `endless-${eventIndex}`,
    number: eventIndex + 1,
    title: template.title,
    subtitle: `${biome.name} · 第 ${eventIndex + 1} 次奇遇`,
    story: template.story,
    success: template.success,
    icon: biome.icon,
    start,
    end: start + ENDLESS_EVENT_WORDS,
    position: { x: eventIndex % 2 === 0 ? -2.6 : 2.6, z: -33 - eventIndex * ENDLESS_CHUNK_LENGTH },
  };
}

export function getEncounterProgress(completedWords: number): { current: number; total: number; percent: number } {
  const encounter = getExplorationEncounter(completedWords);
  if (!encounter) return { current: 5, total: 5, percent: 100 };
  const current = Math.max(0, Math.min(5, completedWords - encounter.start));
  return { current, total: encounter.end - encounter.start, percent: Math.round((current / (encounter.end - encounter.start)) * 100) };
}

export function getEndlessEncounterProgress(endlessWords: number): { current: number; total: number; percent: number } {
  const current = Math.max(0, Math.floor(endlessWords)) % ENDLESS_EVENT_WORDS;
  return { current, total: ENDLESS_EVENT_WORDS, percent: Math.round((current / ENDLESS_EVENT_WORDS) * 100) };
}

export function isEndlessBoundary(endlessWords: number): boolean {
  return endlessWords > 0 && endlessWords % ENDLESS_EVENT_WORDS === 0;
}

export function getEndlessReward(eventIndex: number): { petals: number; xp: number } {
  const safeIndex = Math.max(0, Math.floor(eventIndex));
  return { petals: Math.min(24, 8 + Math.floor(safeIndex / 2) * 2), xp: Math.min(60, 20 + safeIndex * 3) };
}

export function getCompletedEncounterCount(completedWords: number): number {
  return EXPLORATION_ENCOUNTERS.filter((encounter) => completedWords >= encounter.end).length;
}

export function isExplorationBoundary(completedWords: number): boolean {
  return EXPLORATION_ENCOUNTERS.slice(0, -1).some((encounter) => encounter.end === completedWords);
}

export function getExplorationCheckpoint(completedWords: number): { x: number; y: number; z: number } {
  if (completedWords >= 10) return { x: 0, y: 0.58, z: -16.4 };
  if (completedWords >= 5) return { x: 0, y: 0.58, z: -6.2 };
  return { x: 0, y: 0.58, z: 5.4 };
}

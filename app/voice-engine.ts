export type ChildVoiceStyle = "playmate" | "gentle" | "clear";
export type ChildVoiceRole = "anqi" | "coach" | "npc";

export type ChildVoiceProfile = {
  rate: number;
  pitch: number;
  volume: number;
};

export type VoiceCandidate = Pick<SpeechSynthesisVoice, "name" | "lang" | "default" | "localService">;

export const CHILD_VOICE_STYLES: readonly { id: ChildVoiceStyle; name: string; description: string }[] = [
  { id: "playmate", name: "安琪伙伴声", description: "活泼自然，适合闯关鼓励" },
  { id: "gentle", name: "温柔姐姐声", description: "柔和慢一点，适合安静练习" },
  { id: "clear", name: "清晰教练声", description: "节奏清楚，重点提示更容易听懂" },
] as const;

const STYLE_PROFILES: Record<ChildVoiceStyle, Record<ChildVoiceRole, ChildVoiceProfile>> = {
  playmate: {
    anqi: { rate: 0.94, pitch: 1.05, volume: 0.76 },
    coach: { rate: 0.86, pitch: 0.99, volume: 0.78 },
    npc: { rate: 0.9, pitch: 1.02, volume: 0.74 },
  },
  gentle: {
    anqi: { rate: 0.86, pitch: 1.01, volume: 0.73 },
    coach: { rate: 0.8, pitch: 0.97, volume: 0.76 },
    npc: { rate: 0.83, pitch: 0.99, volume: 0.72 },
  },
  clear: {
    anqi: { rate: 0.9, pitch: 1, volume: 0.78 },
    coach: { rate: 0.78, pitch: 0.96, volume: 0.8 },
    npc: { rate: 0.84, pitch: 0.98, volume: 0.76 },
  },
};

const FRIENDLY_VOICE_NAMES = [
  "xiaoxiao", "xiaoyi", "xiaomeng", "xiaohan", "xiaorui", "tingting", "ting-ting", "meijia", "mei-jia",
  "google 普通话", "google mandarin", "mandarin china", "普通话（中国大陆）", "普通話（中國大陸）",
];

const GENTLE_VOICE_NAMES = ["xiaoxiao", "xiaohan", "xiaorui", "tingting", "ting-ting", "meijia", "mei-jia"];
const CLEAR_VOICE_NAMES = ["xiaoxiao", "xiaoyi", "google 普通话", "google mandarin", "mandarin china"];
const ADULT_MALE_VOICE_NAMES = ["yunyang", "yunjian", "yunxi", "kangkang", "yaoyao", "yunze"];

export function isChildVoiceStyle(value: unknown): value is ChildVoiceStyle {
  return value === "playmate" || value === "gentle" || value === "clear";
}

export function getChildVoiceProfile(style: ChildVoiceStyle, role: ChildVoiceRole): ChildVoiceProfile {
  return STYLE_PROFILES[style][role];
}

function scoreVoice(voice: VoiceCandidate, style: ChildVoiceStyle, role: ChildVoiceRole): number {
  const name = voice.name.toLowerCase();
  const language = voice.lang.toLowerCase().replaceAll("_", "-");
  let score = language === "zh-cn" || language.startsWith("zh-cn-") ? 150
    : language.startsWith("zh-hans") ? 142
      : language.startsWith("zh") ? 110
        : -300;

  FRIENDLY_VOICE_NAMES.forEach((candidate, index) => {
    if (name.includes(candidate)) score += 72 - index * 2;
  });
  const styleNames = style === "gentle" ? GENTLE_VOICE_NAMES : style === "clear" ? CLEAR_VOICE_NAMES : FRIENDLY_VOICE_NAMES;
  styleNames.forEach((candidate, index) => {
    if (name.includes(candidate)) score += 36 - index;
  });
  if (name.includes("natural") || name.includes("neural") || name.includes("premium")) score += 28;
  if (role === "npc" && (name.includes("meijia") || name.includes("mei-jia"))) score += 15;
  if (voice.localService) score += 6;
  if (voice.default) score += 3;
  if (ADULT_MALE_VOICE_NAMES.some((candidate) => name.includes(candidate))) score -= 90;
  return score;
}

export function chooseChildFriendlyVoice<T extends VoiceCandidate>(voices: readonly T[], style: ChildVoiceStyle, role: ChildVoiceRole): T | null {
  const ranked = voices
    .map((voice) => ({ voice, score: scoreVoice(voice, style, role) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.voice.name.localeCompare(right.voice.name));
  return ranked[0]?.voice ?? null;
}

export function prepareChildSpeech(message: string, role: ChildVoiceRole): string {
  let text = message
    .replaceAll(" · ", "，")
    .replace(/([^，。！？])说：/u, "$1说，")
    .replace(/\s+/g, " ")
    .trim();
  if (role === "coach" && text.startsWith("没关系，")) text = text.replace("没关系，", "没关系。我们慢慢来，");
  return text.slice(0, 96);
}


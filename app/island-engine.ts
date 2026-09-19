export type Lesson = { id: string; title: string; subtitle: string; keys: string; prompts: string[]; story: string; reward: string };
export const CHAPTERS = [
  { name: "花语岛", subtitle: "把手指安放在正确的位置", color: "#789380", label: "THE BLOSSOM ISLAND" },
  { name: "风铃森林", subtitle: "向上探索，认识更多字母", color: "#76978d", label: "THE WHISPERING WOODS" },
  { name: "星光湖畔", subtitle: "把字母连成小小的故事", color: "#9495b5", label: "THE STARLIGHT LAKE" },
  { name: "云朵邮局", subtitle: "寄出一封自己打的信", color: "#c49477", label: "THE CLOUD POST OFFICE" },
];
export const LESSONS: Lesson[] = [
  { id: "home-fj", title: "第一颗花种", subtitle: "找到 F 和 J", keys: "fj", prompts: ["ff", "jj", "fj", "jf", "ffjj", "fjfj"], story: "棉棉找到了一袋花种。每打对一组字母，就种下一片小花圃。", reward: "雏菊花圃" },
  { id: "home-dk", title: "溪边的小木桥", subtitle: "认识 D 和 K", keys: "dk", prompts: ["dd", "kk", "dk", "kd", "fdkj", "dkdk"], story: "棉棉想走过溪边的小桥。和它一起，用准确的敲击把木板一块块铺好。", reward: "溪边木桥" },
  { id: "home-sl", title: "唤醒风铃", subtitle: "认识 S 和 L", keys: "sl", prompts: ["ss", "ll", "sl", "ls", "sdf", "jkl"], story: "树上的风铃还在睡觉。用无名指轻轻敲出它们的旋律。", reward: "花园风铃" },
  { id: "home-a", title: "小屋亮灯啦", subtitle: "基准排与空格", keys: "a; ", prompts: ["aa;;", "asdf", "jkl;", "a sad lad", "ask dad", "a flask"], story: "八根手指都有自己的家了。帮小屋点亮第一盏温暖的灯。", reward: "暖光小屋" },
  { id: "reach-gh", title: "森林的新朋友", subtitle: "食指向内伸一伸", keys: "gh", prompts: ["fg jh", "gh hg", "flag", "glass", "a glad dad", "a half glass"], story: "森林的小精灵送来两片新叶子。食指伸出去，再回到 F 和 J。", reward: "蘑菇朋友" },
  { id: "upper-ru", title: "风车转起来", subtitle: "上排 R U T Y", keys: "ruty", prompts: ["fr ju", "ft jy", "rust", "trust", "a fluffy fur", "try a hug"], story: "给森林里的风车送去微风。慢慢找到上排键，风车就会转起来。", reward: "森林风车" },
  { id: "upper-ei", title: "萤火虫来信", subtitle: "上排 E 和 I", keys: "ei", prompts: ["de ki", "see", "little", "a little seed", "she likes tea", "a red kite"], story: "萤火虫带来一封短信。跟着发光的字母，把它读给棉棉听。", reward: "萤火灯笼" },
  { id: "upper-rest", title: "树梢的秘密", subtitle: "上排 W O Q P", keys: "woqp", prompts: ["sw lo", "aq ;p", "quiet", "flower", "a yellow flower", "we grow together"], story: "树梢藏着一张地图。认识这一排最后的字母，就能去星光湖。", reward: "树梢鸟屋" },
  { id: "lower-inner", title: "湖上的纸船", subtitle: "下排 V B N M", keys: "vbnm", prompts: ["fv jm", "fb jn", "bloom", "brave", "my name is anqi", "a tiny boat"], story: "折一只纸船，送它去湖心。食指向下移动，敲完记得回家。", reward: "小小纸船" },
  { id: "lower-rest", title: "月亮的花束", subtitle: "下排 C X Z", keys: "cxz", prompts: ["dc sx az", "cozy", "amazing", "six cozy cats", "a magic box", "we can explore"], story: "你已经认识全部字母啦！摘下月光花，为棉棉做一束花。", reward: "月光花束" },
  { id: "punctuation", title: "写给棉棉的话", subtitle: "大写与标点", keys: ",.'", prompts: ["Hi, Mimi.", "I like flowers.", "Let's play.", "You are my friend.", "The sky is blue.", "We can do it."], story: "用另一只手的小指按住 Shift。给自己的句子一个漂亮的开头。", reward: "星星信纸" },
  { id: "numbers", title: "云端小账本", subtitle: "数字与符号", keys: "1234567890!?", prompts: ["12 34 56", "78 90", "3 cats", "5 little stars", "I am 10!", "Ready? Go!"], story: "邮局在清点花种。数字键也有自己的手指，一起数一数吧。", reward: "云朵邮票" },
  { id: "story-one", title: "花园明信片", subtitle: "完整短句", keys: "", prompts: ["Hello, my friend.", "Today is a good day.", "I planted a flower.", "It is pink and white.", "Mimi likes it too.", "See you in the garden!"], story: "把今天的小冒险写成明信片。保持自己的节奏，让故事慢慢展开。", reward: "花园明信片" },
  { id: "story-two", title: "勇敢的小探险家", subtitle: "连贯输入", keys: "", prompts: ["My name is Anqi.", "I am a brave explorer.", "I can try new things.", "Mistakes help me learn.", "One step at a time.", "I am proud of myself!"], story: "把想对自己说的话寄出去。你每一次认真练习，都在变得更熟练。", reward: "探险家徽章" },
  { id: "story-three", title: "比熊的生日", subtitle: "数字与句子", keys: "", prompts: ["Mimi is 2 today!", "We have 6 balloons.", "There are 3 cupcakes.", "Can you find the gift?", "It is a little ball.", "Happy birthday, Mimi!"], story: "棉棉的生日到了。帮它准备礼物，写下一张生日贺卡。", reward: "生日气球" },
  { id: "graduation", title: "小岛的新主人", subtitle: "综合练习", keys: "", prompts: ["Welcome to my island!", "We can grow a garden.", "We can write a story.", "I use all my fingers.", "I take my time to type.", "A new adventure begins."], story: "把小岛介绍给新朋友。练习没有终点，你的故事还会继续。", reward: "花语岛纪念章" },
];

export type KeyRecord = { hits: number; misses: number };
export type Session = { lesson: number; accuracy: number; wpm: number; seconds: number; hits: number; mistakes: number; date: string; review: boolean };
export type IslandProgress = { version: 1; unlocked: number; best: Record<string, number>; flowers: number; keyStats: Record<string, KeyRecord>; history: Session[]; days: string[] };
export const STORAGE_KEY = "anqi-island-learning-v1";
export function emptyProgress(): IslandProgress { return { version: 1, unlocked: 0, best: {}, flowers: 0, keyStats: {}, history: [], days: [] }; }
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
const finite = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
export function loadIslandProgress(raw: string | null): IslandProgress {
  const fresh = emptyProgress();
  try {
    const data = JSON.parse(raw ?? "null");
    if (!data || data.version !== 1) return fresh;
    const best: Record<string, number> = {};
    for (const lesson of LESSONS) if (typeof data.best?.[lesson.id] === "number") best[lesson.id] = finite(data.best[lesson.id], 100);
    const keyStats: Record<string, KeyRecord> = {};
    for (const [key, value] of Object.entries(data.keyStats ?? {})) {
      if (key.length === 1 && value && typeof value === "object") { const k = value as KeyRecord; keyStats[key] = { hits: finite(k.hits, 1e7), misses: finite(k.misses, 1e7) }; }
    }
    // Unlock only a contiguous sequence of lessons completed accurately.
    let unlocked = 0;
    while (unlocked < LESSONS.length - 1 && (best[LESSONS[unlocked].id] ?? 0) >= 90) unlocked++;
    return { ...fresh, unlocked, best, keyStats, flowers: Math.floor(finite(data.flowers, 1e7)), days: Array.isArray(data.days) ? data.days.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-365) : [], history: Array.isArray(data.history) ? data.history.filter((s: Session) => s && Number.isInteger(s.lesson) && s.lesson >= 0 && s.lesson < LESSONS.length && Number.isFinite(s.accuracy) && Number.isFinite(s.seconds) && Number.isFinite(s.wpm) && typeof s.date === "string").slice(-60) : [] };
  } catch { return fresh; }
}
export function scoreSession(lesson: number, hits: number, mistakes: number, seconds: number, review = false): Session {
  return { lesson, hits, mistakes, seconds: Math.round(seconds), review, accuracy: hits + mistakes ? Math.round(hits / (hits + mistakes) * 100) : 0, wpm: seconds >= 5 ? Math.round((hits / 5) / (seconds / 60)) : 0, date: new Date().toISOString() };
}
export function saveSession(progress: IslandProgress, session: Session, stats: Record<string, KeyRecord>): IslandProgress {
  const keyStats = { ...progress.keyStats };
  for (const [key, stat] of Object.entries(stats)) { const old = keyStats[key] ?? { hits: 0, misses: 0 }; keyStats[key] = { hits: old.hits + stat.hits, misses: old.misses + stat.misses }; }
  const best = { ...progress.best };
  if (!session.review) best[LESSONS[session.lesson].id] = Math.max(best[LESSONS[session.lesson].id] ?? 0, session.accuracy);
  const unlocked = !session.review && session.accuracy >= 90 ? Math.max(progress.unlocked, Math.min(LESSONS.length - 1, session.lesson + 1)) : progress.unlocked;
  const day = localDay();
  return { ...progress, best, unlocked, keyStats, flowers: progress.flowers + (session.accuracy >= 90 ? 6 : 3), history: [...progress.history, session].slice(-60), days: [...new Set([...progress.days, day])].slice(-365) };
}
export function weakKeys(stats: Record<string, KeyRecord>): string[] {
  return Object.entries(stats).filter(([, s]) => s.misses > 0).sort((a, b) => b[1].misses / (b[1].hits + b[1].misses) - a[1].misses / (a[1].hits + a[1].misses)).slice(0, 4).map(([key]) => key);
}
export function reviewPrompts(stats: Record<string, KeyRecord>, lesson: number) {
  const keys = weakKeys(stats);
  if (!keys.length) return LESSONS[lesson].prompts;
  const separator = stats[" "] ? " " : "";
  const candidates = LESSONS.slice(0, lesson + 1).flatMap(l => l.prompts).filter(p => keys.some(k => p.includes(k)) && [...p].every(k => stats[k]));
  const drills = [...keys.map(k => `${k}${k}${separator}${k}${k}`), ...candidates];
  return Array.from({ length: 6 }, (_, i) => drills[i % drills.length]);
}
export function fingerFor(key: string): { name: string; color: string; home: string; hand: "left" | "right" | "thumb"; index: number } {
  const lower = key.toLowerCase();
  if (lower === " ") return { name: "拇指", color: "#b8aa8a", home: "空格", hand: "thumb", index: 4 };
  const zones = [
    ["1qaz!", "左手小指", "#b899ad", "A", "left", 0], ["2wsx@", "左手无名指", "#c9aa81", "S", "left", 1],
    ["3edc#", "左手中指", "#92afa0", "D", "left", 2], ["45rtfgvb$%", "左手食指", "#89a7bd", "F", "left", 3],
    ["67yuhjnm^&", "右手食指", "#89a7bd", "J", "right", 3], ["8ik,*", "右手中指", "#92afa0", "K", "right", 2],
    ["9ol.(", "右手无名指", "#c9aa81", "L", "right", 1], ["0p;/'?\"):-_=+[{]}\\|", "右手小指", "#b899ad", ";", "right", 0],
  ] as const;
  const zone = zones.find(z => z[0].includes(lower)) ?? zones[7];
  return { name: zone[1], color: zone[2], home: zone[3], hand: zone[4], index: zone[5] };
}
export function keyLabel(key: string) { return key === " " ? "空格" : key.toUpperCase(); }

export type IslandPoint = { x: number; z: number };
export function isIslandWalkable({ x, z }: IslandPoint, bridgeOpen = true): boolean {
  if ((x / 4.8) ** 2 + (z / 3.85) ** 2 > 1) return false;
  if (x > -2.15 && x < .36 && z > -2.65 && z < -.5) return false;
  if (!bridgeOpen && x > .68 && x < 1.25 && z > .9 && z < 2.3) return false;
  if (((x - 2.2) / 1.53) ** 2 + ((z - 1.6) / 1.05) ** 2 < 1 && !(x > .68 && x < 1.25 && z > .9 && z < 2.3)) return false;
  return ![[-3, -1.4], [-3.9, .4], [2.7, -2], [-.1, -3.05], [3.7, -.65], [1.55, -2.1]].some(([tx, tz]) => Math.hypot(x - tx, z - tz) < .4);
}

// Small fixed navigation grid: click-to-walk stays on land and walks around buildings.
export function planIslandWalk(start: IslandPoint, end: IslandPoint, bridgeOpen = true): IslandPoint[] {
  if (!isIslandWalkable(end, bridgeOpen)) return [];
  const step = .25;
  const lineClear = (a: IslandPoint, b: IslandPoint) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .1));
    for (let i = 1; i <= steps; i++) if (!isIslandWalkable({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps }, bridgeOpen)) return false;
    return true;
  };
  if (lineClear(start, end)) return [end];
  const snap = (p: IslandPoint) => ({ x: Math.round(p.x / step), z: Math.round(p.z / step) });
  const origin = snap(start), finish = snap(end);
  const id = (p: IslandPoint) => `${p.x},${p.z}`;
  const queue = [origin], parents = new Map<string, IslandPoint | null>([[id(origin), null]]);
  let found: IslandPoint | undefined;
  for (let i = 0; i < queue.length && i < 1600; i++) {
    const current = queue[i];
    if (current.x === finish.x && current.z === finish.z) { found = current; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (!parents.has(id(next)) && isIslandWalkable({ x: next.x * step, z: next.z * step }, bridgeOpen)) { parents.set(id(next), current); queue.push(next); }
    }
  }
  if (!found) return [];
  const path: IslandPoint[] = [end];
  for (let point: IslandPoint | null = found; point; point = parents.get(id(point)) ?? null) path.unshift({ x: point.x * step, z: point.z * step });
  const smooth: IslandPoint[] = [];
  let current = start, i = 0;
  while (i < path.length) {
    let furthest = i;
    while (furthest + 1 < path.length && lineClear(current, path[furthest + 1])) furthest++;
    smooth.push(path[furthest]); current = path[furthest]; i = furthest + 1;
  }
  return smooth;
}

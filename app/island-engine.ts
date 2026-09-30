export type Lesson = { id: string; title: string; subtitle: string; keys: string; prompts: string[]; story: string; reward: string; mode?: "pinyin"; fingerGoal?: string };
export const CHAPTERS = [
  { name: "花语岛", subtitle: "基准排与双手定位", color: "#789380", label: "THE BLOSSOM ISLAND", count: 4 },
  { name: "风铃森林", subtitle: "食指伸展与上排", color: "#76978d", label: "THE WHISPERING WOODS", count: 4 },
  { name: "星光湖畔", subtitle: "下排、大写和数字", color: "#9495b5", label: "THE STARLIGHT LAKE", count: 4 },
  { name: "云朵邮局", subtitle: "英文短句与连贯输入", color: "#c49477", label: "THE CLOUD POST OFFICE", count: 4 },
  { name: "故事小镇", subtitle: "从单词写到自己的故事", color: "#aa947e", label: "THE STORY VILLAGE", count: 8 },
  { name: "拼音港", subtitle: "用中文输入法写给朋友", color: "#779ba7", label: "THE PINYIN HARBOR", count: 8 },
];
export function chapterStart(chapter: number) { return CHAPTERS.slice(0, chapter).reduce((sum, item) => sum + item.count, 0); }
export function chapterForLesson(index: number) { return CHAPTERS.findIndex((_, chapter) => index < chapterStart(chapter + 1)); }
export function chapterLessons(chapter: number) { return LESSONS.slice(chapterStart(chapter), chapterStart(chapter + 1)); }
export function chapterLocalIndex(index: number) { return index - chapterStart(chapterForLesson(index)); }
export const LESSONS: Lesson[] = [
  { id: "home-fj", title: "第一颗花种", subtitle: "找到 F 和 J", keys: "fj", prompts: ["ff", "jj", "fj", "jf", "ffjj", "fjfj"], story: "棉棉找到了一袋花种。每打对一组字母，就种下一片小花圃。", reward: "雏菊花圃", fingerGoal: "左右食指轻触 F / J 的凸点，打完回到这里" },
  { id: "home-dk", title: "溪边的小木桥", subtitle: "认识 D 和 K", keys: "dk", prompts: ["ddkk", "kkdd", "dkdk", "kddk", "fddfjkkj", "dfjkfkjd"], story: "棉棉想走过溪边的小桥。左手中指负责 D，右手中指负责 K。每打一组，小桥就多一块木板。", reward: "溪边木桥", fingerGoal: "左手中指按 D，右手中指按 K；食指留在 F / J" },
  { id: "home-sl", title: "唤醒风铃", subtitle: "认识 S 和 L", keys: "sl", prompts: ["ss", "ll", "sl", "ls", "sdf", "jkl"], story: "树上的风铃还在睡觉。用无名指轻轻敲出它们的旋律。", reward: "花园风铃", fingerGoal: "左手无名指按 S，右手无名指按 L" },
  { id: "home-a", title: "小屋亮灯啦", subtitle: "基准排与空格", keys: "a; ", prompts: ["aa;;", "asdf", "jkl;", "a sad lad", "ask dad", "a flask"], story: "八根手指都有自己的家了。帮小屋点亮第一盏温暖的灯。", reward: "暖光小屋", fingerGoal: "小指分别守住 A 和 ;，拇指轻按空格" },
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
  { id: "village-home", title: "小镇的早晨", subtitle: "回到基准排", keys: "asdfjkl; ", prompts: ["asdf jkl;", "a sad lad", "ask dad", "a flask", "all fall", "a glad lass"], story: "棉棉带你走进小镇。先找回八根手指的家，镇上的早餐店才会开门。", reward: "早餐店招牌", fingerGoal: "每敲完一键，手指回到 A S D F / J K L ;" },
  { id: "village-alternate", title: "穿过石板路", subtitle: "双手交替", keys: "", prompts: ["fa ja fa ja", "dad had a hat", "a little lake", "take a look", "we walk home", "the light is on"], story: "左右脚轮流踏上石板，左右手也轮流敲键。看，小路在脚下延伸。", reward: "石板小路", fingerGoal: "留意左右手交替，眼睛尽量看屏幕" },
  { id: "village-reach", title: "面包店的香气", subtitle: "跨排后回家", keys: "", prompts: ["rise and rest", "warm bread", "a little smile", "we make a cake", "mimi smells it", "share it with friends"], story: "给面包店写菜单。手指伸向上排或下排后，都回到自己的位置。", reward: "面包店", fingerGoal: "跨排伸手后回到基准排" },
  { id: "village-shift", title: "镇上的路牌", subtitle: "另一只手按 Shift", keys: "", prompts: ["Mimi", "Anqi", "Big Tree", "Moon Lake", "Sunny Road", "Welcome Home!"], story: "路牌需要大写字母。用另一只手按住 Shift，不用 Caps Lock。", reward: "彩色路牌", fingerGoal: "左边的大写用右手 Shift，右边的大写用左手 Shift" },
  { id: "village-punctuation", title: "给朋友的邀请", subtitle: "逗号、句号与问号", keys: "", prompts: ["Hi, Mimi.", "Are you ready?", "Yes, I am!", "Let's go outside.", "Where is the shop?", "See you soon!"], story: "一封邀请信需要停顿和提问。让句子说得清楚，也保持舒服的节奏。", reward: "邀请信", fingerGoal: "标点也有负责的手指，敲完回家" },
  { id: "village-rhythm", title: "音乐广场", subtitle: "准确的节奏", keys: "", prompts: ["tap tap tap", "step by step", "sing a little song", "the bells ring", "we dance together", "take a quiet breath"], story: "跟着广场的音乐打字；先保持准确，再让节奏自然变稳。", reward: "音乐喷泉", fingerGoal: "保持双手放松，不为速度牺牲准确" },
  { id: "village-postcard", title: "写下今天", subtitle: "短句连成故事", keys: "", prompts: ["Today I saw a dog.", "It ran across the square.", "I gave it some water.", "It wagged its little tail.", "We became good friends.", "I will see it tomorrow."], story: "把今天遇见的事写成小故事。打一行，镇上的窗户就亮起一扇。", reward: "小镇故事书", fingerGoal: "连贯输入时也别忘记基准排" },
  { id: "village-festival", title: "灯火节", subtitle: "综合复习", keys: "", prompts: ["The town is full of lights.", "Mimi has a red ribbon.", "We bring 3 little cakes.", "Can you hear the music?", "I type with all my fingers.", "This is our happy festival!"], story: "小镇的灯火节到了。把这段旅程学会的键都用上，一起点亮夜晚。", reward: "灯火节徽章", fingerGoal: "综合运用所有手指，准确率达到 90%" },
  { id: "pinyin-home", title: "港口见面", subtitle: "拼音输入法 · 单字", keys: "ni hao", prompts: ["你", "好", "我", "们", "花", "海"], story: "切换中文拼音输入法，输入拼音并选出屏幕上的汉字。棉棉在码头等你。", reward: "码头小旗", mode: "pinyin", fingerGoal: "拼音字母仍用标准指法；候选字选对再继续" },
  { id: "pinyin-words", title: "潮汐小店", subtitle: "常见双字词", keys: "hua hai", prompts: ["你好", "花园", "小狗", "朋友", "月亮", "海边"], story: "帮潮汐小店写物品卡片。先想好词语，再用拼音把它选出来。", reward: "潮汐小店", mode: "pinyin", fingerGoal: "把词语作为整体输入，减少来回选字" },
  { id: "pinyin-short", title: "第一张船票", subtitle: "短语输入", keys: "chu fa", prompts: ["我们出发", "看看小岛", "一起散步", "快乐的小狗", "温暖的阳光", "今天真开心"], story: "一张船票可以带你去新地方。用短语记录想去的方向。", reward: "小船票", mode: "pinyin", fingerGoal: "候选词不对时调整拼音，确认后再输入" },
  { id: "pinyin-note", title: "给棉棉留言", subtitle: "中文短句", keys: "liu yan", prompts: ["棉棉你好。", "今天一起玩吧。", "我喜欢这片海。", "我们去找朋友。", "花园里有小鸟。", "明天再见！"], story: "棉棉想收到你的留言。打出完整句子，别忘了中文标点。", reward: "留言瓶", mode: "pinyin", fingerGoal: "输入拼音时保持指法；标点用中文输入法" },
  { id: "pinyin-choice", title: "灯塔的谜语", subtitle: "同音字与选词", keys: "deng ta", prompts: ["星星", "心情", "小桥", "学校", "灯光", "海风"], story: "灯塔给你出了一些同音字谜。仔细看候选词，选出正确答案。", reward: "灯塔之光", mode: "pinyin", fingerGoal: "先看目标字，再看候选字，不急着按数字" },
  { id: "pinyin-letter", title: "远方的来信", subtitle: "两行小故事", keys: "xin jian", prompts: ["亲爱的朋友：", "今天海风很轻。", "棉棉发现了一只小船。", "我们一起把它修好了。", "谢谢你陪我练习打字。", "期待下次再见！"], story: "把在港口发生的事写进信里。每完成一行，信封就多一枚邮戳。", reward: "远方的信", mode: "pinyin", fingerGoal: "长句分成词语输入，保持准确和节奏" },
  { id: "pinyin-story", title: "海边日记", subtitle: "自然书写", keys: "ri ji", prompts: ["今天我来到海边。", "浪花轻轻拍着沙滩。", "棉棉追着自己的影子跑。", "我用十根手指写下这一刻。", "虽然会打错，我也会慢慢改好。", "这是属于我的小小冒险。"], story: "这次由你写下海边日记。看看自己如何用拼音表达完整的想法。", reward: "海边日记本", mode: "pinyin", fingerGoal: "试着少看键盘，把注意力放在文字上" },
  { id: "pinyin-finale", title: "扬帆出发", subtitle: "中文综合练习", keys: "chu hang", prompts: ["你好，新朋友！", "我叫安琪。", "我和棉棉学会了打字。", "我们走过花园和小镇。", "我会继续认真练习指法。", "下一段故事由我来写！"], story: "把你的成长介绍给新朋友。港口的船会随着每句话慢慢扬帆。", reward: "扬帆纪念章", mode: "pinyin", fingerGoal: "准确输入，完成自己的中文故事" },
];

export type KeyRecord = { hits: number; misses: number };
export type Session = { lesson: number; accuracy: number; wpm: number; seconds: number; hits: number; mistakes: number; date: string; review: boolean; independent?: boolean };
export type LessonMastery = { independentBest: number; independentDate: string; delayedBest: number; delayedDate: string };
export type IslandProgress = { version: 1; unlocked: number; best: Record<string, number>; mastery: Record<string, LessonMastery>; flowers: number; keyStats: Record<string, KeyRecord>; history: Session[]; days: string[]; firstAdventureClaimed: boolean };
export const STORAGE_KEY = "anqi-island-learning-v1";
export function emptyProgress(): IslandProgress { return { version: 1, unlocked: 0, best: {}, mastery: {}, flowers: 0, keyStats: {}, history: [], days: [], firstAdventureClaimed: false }; }
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
const finite = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
export function loadIslandProgress(raw: string | null): IslandProgress {
  const fresh = emptyProgress();
  try {
    const data = JSON.parse(raw ?? "null");
    if (!data || data.version !== 1) return fresh;
    const best: Record<string, number> = {};
    for (const lesson of LESSONS) if (typeof data.best?.[lesson.id] === "number") best[lesson.id] = finite(data.best[lesson.id], 100);
    const mastery: Record<string, LessonMastery> = {};
    for (const lesson of LESSONS) {
      const item = data.mastery?.[lesson.id];
      if (!item || typeof item !== "object") continue;
      const validDate = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
      mastery[lesson.id] = { independentBest: finite(item.independentBest, 100), independentDate: validDate(item.independentDate), delayedBest: finite(item.delayedBest, 100), delayedDate: validDate(item.delayedDate) };
    }
    const keyStats: Record<string, KeyRecord> = {};
    for (const [key, value] of Object.entries(data.keyStats ?? {})) {
      if (key.length === 1 && value && typeof value === "object") { const k = value as KeyRecord; keyStats[key] = { hits: finite(k.hits, 1e7), misses: finite(k.misses, 1e7) }; }
    }
    // Unlock only a contiguous sequence of lessons completed accurately.
    let unlocked = 0;
    while (unlocked < LESSONS.length - 1 && (best[LESSONS[unlocked].id] ?? 0) >= 90) unlocked++;
    return { ...fresh, unlocked, best, mastery, keyStats, firstAdventureClaimed: data.firstAdventureClaimed === true, flowers: Math.floor(finite(data.flowers, 1e7)), days: Array.isArray(data.days) ? data.days.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-365) : [], history: Array.isArray(data.history) ? data.history.filter((s: Session) => s && Number.isInteger(s.lesson) && s.lesson >= 0 && s.lesson < LESSONS.length && Number.isFinite(s.accuracy) && Number.isFinite(s.seconds) && Number.isFinite(s.wpm) && typeof s.date === "string").slice(-60) : [] };
  } catch { return fresh; }
}
export function scoreSession(lesson: number, hits: number, mistakes: number, seconds: number, review = false, independent = false): Session {
  const units = LESSONS[lesson]?.mode === "pinyin" ? hits : hits / 5;
  return { lesson, hits, mistakes, seconds: Math.round(seconds), review, independent, accuracy: hits + mistakes ? Math.round(hits / (hits + mistakes) * 100) : 0, wpm: seconds >= 5 ? Math.round(units / (seconds / 60)) : 0, date: new Date().toISOString() };
}
export function saveSession(progress: IslandProgress, session: Session, stats: Record<string, KeyRecord>): IslandProgress {
  const keyStats = { ...progress.keyStats };
  for (const [key, stat] of Object.entries(stats)) { const old = keyStats[key] ?? { hits: 0, misses: 0 }; keyStats[key] = { hits: old.hits + stat.hits, misses: old.misses + stat.misses }; }
  const best = { ...progress.best };
  if (!session.review) best[LESSONS[session.lesson].id] = Math.max(best[LESSONS[session.lesson].id] ?? 0, session.accuracy);
  const unlocked = !session.review && session.accuracy >= 90 ? Math.max(progress.unlocked, Math.min(LESSONS.length - 1, session.lesson + 1)) : progress.unlocked;
  const day = localDay();
  const mastery = { ...progress.mastery };
  if (session.independent && session.accuracy >= 90) {
    const id = LESSONS[session.lesson].id;
    const current = mastery[id] ?? { independentBest: 0, independentDate: "", delayedBest: 0, delayedDate: "" };
    mastery[id] = current.independentBest >= 90 && current.independentDate && day > current.independentDate
      ? { ...current, delayedBest: Math.max(current.delayedBest, session.accuracy), delayedDate: day }
      : { ...current, independentBest: Math.max(current.independentBest, session.accuracy), independentDate: current.independentDate || day };
  }
  return { ...progress, best, mastery, unlocked, keyStats, flowers: progress.flowers + (session.accuracy >= 90 ? 6 : 3), history: [...progress.history, session].slice(-60), days: [...new Set([...progress.days, day])].slice(-365) };
}
export type KeyTiming = { samples: number; totalMs: number; hesitations: number };
export function weakKeys(stats: Record<string, KeyRecord>, timing: Record<string, KeyTiming> = {}): string[] {
  const score = (key: string, record: KeyRecord) => {
    const t = timing[key];
    const errors = record.misses / Math.max(1, record.hits + record.misses);
    const slow = t && t.samples >= 3 ? Math.min(1, t.totalMs / t.samples / 1800) * .2 + t.hesitations / t.samples * .3 : 0;
    return errors + slow;
  };
  return Object.entries(stats).filter(([key, s]) => /^[\x20-\x7e]$/.test(key) && (s.misses > 0 || (timing[key]?.samples ?? 0) >= 3 && (timing[key]?.totalMs ?? 0) / timing[key].samples > 1500)).sort((a, b) => score(b[0], b[1]) - score(a[0], a[1])).slice(0, 4).map(([key]) => key);
}
export function reviewPrompts(stats: Record<string, KeyRecord>, lesson: number, timing: Record<string, KeyTiming> = {}) {
  if (LESSONS[lesson].mode === "pinyin") return LESSONS[lesson].prompts;
  const keys = weakKeys(stats, timing);
  if (!keys.length) return LESSONS[lesson].prompts;
  const separator = stats[" "] ? " " : "";
  const candidates = LESSONS.slice(0, lesson + 1).filter(l => l.mode !== "pinyin").flatMap(l => l.prompts).filter(p => keys.some(k => p.includes(k)) && [...p].every(k => stats[k]));
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
export function isIslandWalkable({ x, z }: IslandPoint, bridgeOpen = true, chapter = 0): boolean {
  const expanded = chapter >= 4;
  if ((x / (expanded ? 6.05 : 4.8)) ** 2 + (z / (expanded ? 4.9 : 3.85)) ** 2 > 1) return false;
  if (x > -2.15 && x < .36 && z > -2.65 && z < -.5) return false;
  if (!bridgeOpen && x > .68 && x < 1.25 && z > .9 && z < 2.3) return false;
  if (((x - 2.2) / 1.53) ** 2 + ((z - 1.6) / 1.05) ** 2 < 1 && !(x > .68 && x < 1.25 && z > .9 && z < 2.3)) return false;
  if (expanded && Math.hypot(x + 3.75, z + .7) < .55) return false;
  if (chapter === 4 && Math.hypot(x - 3.42, z + .92) < .82) return false;
  return ![[-3, -1.4], [-3.9, .4], [2.7, -2], [-.1, -3.05], [3.7, -.65], [1.55, -2.1]].some(([tx, tz]) => Math.hypot(x - tx, z - tz) < .4);
}

// Small fixed navigation grid: click-to-walk stays on land and walks around buildings.
export function planIslandWalk(start: IslandPoint, end: IslandPoint, bridgeOpen = true, chapter = 0): IslandPoint[] {
  if (!isIslandWalkable(end, bridgeOpen, chapter)) return [];
  const step = .25;
  const lineClear = (a: IslandPoint, b: IslandPoint) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .1));
    for (let i = 1; i <= steps; i++) if (!isIslandWalkable({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps }, bridgeOpen, chapter)) return false;
    return true;
  };
  if (lineClear(start, end)) return [end];
  const snap = (p: IslandPoint) => ({ x: Math.round(p.x / step), z: Math.round(p.z / step) });
  const origin = snap(start), finish = snap(end);
  const id = (p: IslandPoint) => `${p.x},${p.z}`;
  const queue = [origin], parents = new Map<string, IslandPoint | null>([[id(origin), null]]);
  let found: IslandPoint | undefined;
  for (let i = 0; i < queue.length && i < (chapter >= 4 ? 2500 : 1600); i++) {
    const current = queue[i];
    if (current.x === finish.x && current.z === finish.z) { found = current; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (!parents.has(id(next)) && isIslandWalkable({ x: next.x * step, z: next.z * step }, bridgeOpen, chapter)) { parents.set(id(next), current); queue.push(next); }
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

"use client";

type KeyboardCoachProps = {
  target: string;
  learnedKeys: readonly string[];
  newKeys: readonly string[];
  wrongStreak: number;
};

const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", "."],
] as const;

const KEY_CODE: Record<string, string> = { " ": "space", ",": "comma", ".": "period", "'": "apostrophe" };
const DISPLAY: Record<string, string> = { " ": "空格", ",": ",", ".": ".", "'": "'" };
const HOME_ROUTE: Record<string, string> = {
  q: "从 A 向左上方伸", a: "A 基准位直接按", z: "从 A 向左下方伸",
  w: "从 S 向左上方伸", s: "S 基准位直接按", x: "从 S 向左下方伸",
  e: "从 D 向上伸", d: "D 基准位直接按", c: "从 D 向下伸",
  r: "从 F 向左上方伸", f: "F 凸点直接按", v: "从 F 向左下方伸",
  t: "从 F 向右上方伸", g: "从 F 向右移动", b: "从 F 向右下方伸",
  y: "从 J 向左上方伸", h: "从 J 向左移动", n: "从 J 向左下方伸",
  u: "从 J 向右上方伸", j: "J 凸点直接按", m: "从 J 向右下方伸",
  i: "从 K 向上伸", k: "K 基准位直接按", ",": "从 K 向下伸",
  o: "从 L 向上伸", l: "L 基准位直接按", ".": "从 L 向下伸",
  p: "从分号键向上伸", "'": "右手小指向右移动",
};

export function getKeyMovement(key: string): string {
  if (key === " ") return "拇指轻按空格，其他手指不离开基准位";
  return HOME_ROUTE[key.toLowerCase()] ?? "按完后回到 F、J 基准位";
}

function fingerFor(key: string): { hand: string; finger: string; side: "left" | "right" | "thumb" } {
  const lower = key.toLowerCase();
  if (lower === " ") return { hand: "双手", finger: "拇指", side: "thumb" };
  if ("qaz".includes(lower)) return { hand: "左手", finger: "小指", side: "left" };
  if ("wsx".includes(lower)) return { hand: "左手", finger: "无名指", side: "left" };
  if ("edc".includes(lower)) return { hand: "左手", finger: "中指", side: "left" };
  if ("rfvtgb".includes(lower)) return { hand: "左手", finger: "食指", side: "left" };
  if ("yhnujm".includes(lower)) return { hand: "右手", finger: "食指", side: "right" };
  if ("ik,".includes(lower)) return { hand: "右手", finger: "中指", side: "right" };
  if ("ol.".includes(lower)) return { hand: "右手", finger: "无名指", side: "right" };
  return { hand: "右手", finger: "小指", side: "right" };
}

export function KeyboardCoach({ target, learnedKeys, newKeys, wrongStreak }: KeyboardCoachProps) {
  const targetCode = KEY_CODE[target] ?? target.toLowerCase();
  const uppercase = /^[A-Z]$/.test(target);
  const learned = new Set(learnedKeys);
  const fresh = new Set(newKeys);
  const guide = uppercase ? { hand: "另一只手", finger: "小指按 Shift", side: "thumb" as const } : fingerFor(target);
  const targetName = DISPLAY[target] ?? target.toUpperCase();
  const movement = uppercase ? `按住 Shift；${getKeyMovement(target)}` : getKeyMovement(target);

  const renderKey = (key: string) => {
    const code = KEY_CODE[key] ?? key;
    const active = code === targetCode;
    const isLearned = learned.has(code);
    const isFresh = fresh.has(code);
    return <span key={key} className={`coach-key ${active ? "target" : ""} ${isLearned ? "learned" : ""} ${isFresh ? "fresh" : ""}`} data-key={code}>{key.toUpperCase()}</span>;
  };

  return (
    <section className={`keyboard-coach ${wrongStreak >= 2 ? "helping" : ""}`} aria-label={`请用${guide.hand}${guide.finger}输入${targetName}，${movement}`}>
      <div className="finger-guide">
        <span className={`hand-dot ${guide.side}`} aria-hidden="true">{guide.side === "left" ? "左" : guide.side === "right" ? "右" : "拇"}</span>
        <p><small>{wrongStreak >= 2 ? "纠错路线" : "这次用"}</small><strong>{guide.hand} · {guide.finger}</strong><em>{movement}</em></p>
        <b>{uppercase ? `SHIFT + ${targetName}` : targetName}</b>
      </div>
      <div className="coach-board" aria-hidden="true">
        {ROWS.map((row, index) => <div className={`coach-row row-${index + 1}`} key={index}>{row.map(renderKey)}</div>)}
        <div className="coach-row utility-row"><span className={`coach-key shift-key ${uppercase ? "target" : ""} ${learned.has("shift") ? "learned" : ""}`}>SHIFT</span>{renderKey(" ")}</div>
      </div>
    </section>
  );
}

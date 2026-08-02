"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Lesson = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  keys: string[];
  prompts: string[];
  xp: number;
};

type Progress = {
  completed: string[];
  xp: number;
  bestWpm: number;
  totalStars: number;
};

type Result = {
  accuracy: number;
  wpm: number;
  stars: number;
};

const LESSONS: Lesson[] = [
  {
    id: "home-beacons",
    title: "起航信号",
    subtitle: "认识 F 和 J 的小凸点",
    badge: "01",
    keys: ["f", "j"],
    prompts: ["fff jjj", "fjf jfj", "ffj jff", "fjfj jfjf"],
    xp: 40,
  },
  {
    id: "left-garden",
    title: "左手花园",
    subtitle: "ASDF 四根手指来集合",
    badge: "02",
    keys: ["a", "s", "d", "f"],
    prompts: ["asdf fdsa", "sad dad", "fad ads", "a sad dad"],
    xp: 50,
  },
  {
    id: "right-island",
    title: "右手小岛",
    subtitle: "JKL; 找到右手大本营",
    badge: "03",
    keys: ["j", "k", "l", ";"],
    prompts: ["jkl; ;lkj", "jill", "jelly", "jill; jelly"],
    xp: 55,
  },
  {
    id: "word-forest",
    title: "单词森林",
    subtitle: "双手合作采集单词",
    badge: "04",
    keys: ["a", "s", "d", "f", "j", "k", "l"],
    prompts: ["fall", "ask", "dad", "salad", "a sad fall"],
    xp: 65,
  },
  {
    id: "moon-station",
    title: "月亮基地",
    subtitle: "挑战更多字母和太空词汇",
    badge: "05",
    keys: ["m", "o", "n", "r", "t", "c"],
    prompts: ["moon", "star", "rocket", "robot", "moon robot"],
    xp: 75,
  },
  {
    id: "space-message",
    title: "星际电报",
    subtitle: "完成你的第一条英文句子",
    badge: "06",
    keys: ["h", "e", "l", "o", "w", "r", "d"],
    prompts: ["hello", "hello world", "we love typing", "hello little star"],
    xp: 90,
  },
];

const KEYBOARD = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

const DEFAULT_PROGRESS: Progress = {
  completed: [],
  xp: 0,
  bestWpm: 0,
  totalStars: 0,
};

const FINGER_GROUPS: Record<string, { finger: string; hand: "左手" | "右手" }> = {
  q: { finger: "小拇指", hand: "左手" },
  a: { finger: "小拇指", hand: "左手" },
  z: { finger: "小拇指", hand: "左手" },
  w: { finger: "无名指", hand: "左手" },
  s: { finger: "无名指", hand: "左手" },
  x: { finger: "无名指", hand: "左手" },
  e: { finger: "中指", hand: "左手" },
  d: { finger: "中指", hand: "左手" },
  c: { finger: "中指", hand: "左手" },
  r: { finger: "食指", hand: "左手" },
  t: { finger: "食指", hand: "左手" },
  f: { finger: "食指", hand: "左手" },
  g: { finger: "食指", hand: "左手" },
  v: { finger: "食指", hand: "左手" },
  b: { finger: "食指", hand: "左手" },
  y: { finger: "食指", hand: "右手" },
  u: { finger: "食指", hand: "右手" },
  h: { finger: "食指", hand: "右手" },
  j: { finger: "食指", hand: "右手" },
  n: { finger: "食指", hand: "右手" },
  m: { finger: "食指", hand: "右手" },
  i: { finger: "中指", hand: "右手" },
  k: { finger: "中指", hand: "右手" },
  ",": { finger: "中指", hand: "右手" },
  o: { finger: "无名指", hand: "右手" },
  l: { finger: "无名指", hand: "右手" },
  ".": { finger: "无名指", hand: "右手" },
  p: { finger: "小拇指", hand: "右手" },
  ";": { finger: "小拇指", hand: "右手" },
  "/": { finger: "小拇指", hand: "右手" },
};

function safeLoadProgress(): Progress {
  try {
    const saved = window.localStorage.getItem("key-quest-progress");
    return saved ? { ...DEFAULT_PROGRESS, ...JSON.parse(saved) } : DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<"ready" | "playing" | "complete">("ready");
  const [correctHits, setCorrectHits] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [result, setResult] = useState<Result | null>(null);
  const startTime = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lesson = LESSONS[selectedIndex];
  const prompt = lesson.prompts[promptIndex];
  const target = prompt?.[typed.length] ?? "";
  const finger = target === " " ? { finger: "大拇指", hand: "任意手" as const } : FINGER_GROUPS[target];
  const unlockedCount = Math.min(LESSONS.length, progress.completed.length + 1);
  const sessionAccuracy = correctHits + mistakes === 0 ? 100 : Math.round((correctHits / (correctHits + mistakes)) * 100);
  const wpm = elapsed < 1 ? 0 : Math.round(correctHits / 5 / (elapsed / 60));

  const lessonProgress = useMemo(() => {
    const completedLength = lesson.prompts.slice(0, promptIndex).reduce((sum, item) => sum + item.length, 0);
    const totalLength = lesson.prompts.reduce((sum, item) => sum + item.length, 0);
    return Math.min(100, Math.round(((completedLength + typed.length) / totalLength) * 100));
  }, [lesson, promptIndex, typed.length]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setProgress(safeLoadProgress());
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => {
      setElapsed((Date.now() - startTime.current) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const playTone = useCallback((isCorrect: boolean) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = new AudioCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = isCorrect ? "sine" : "square";
      oscillator.frequency.value = isCorrect ? 620 : 150;
      gain.gain.setValueAtTime(0.05, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
      oscillator.onended = () => void context.close();
    } catch {
      // Sound is an enhancement; typing remains fully usable when audio is blocked.
    }
  }, [soundOn]);

  const showFlash = useCallback((kind: "correct" | "wrong") => {
    setFlash(kind);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 150);
  }, []);

  const saveCompletion = useCallback((finalResult: Result) => {
    setProgress((current) => {
      const alreadyComplete = current.completed.includes(lesson.id);
      const next = {
        completed: alreadyComplete ? current.completed : [...current.completed, lesson.id],
        xp: current.xp + lesson.xp,
        bestWpm: Math.max(current.bestWpm, finalResult.wpm),
        totalStars: current.totalStars + finalResult.stars,
      };
      try {
        window.localStorage.setItem("key-quest-progress", JSON.stringify(next));
      } catch {
        // Progress still works for this session when storage is unavailable.
      }
      return next;
    });
  }, [lesson]);

  const finishLesson = useCallback((finalCorrect: number, finalMistakes: number) => {
    const finalElapsed = Math.max(1, (Date.now() - startTime.current) / 1000);
    const finalAccuracy = Math.round((finalCorrect / Math.max(1, finalCorrect + finalMistakes)) * 100);
    const finalWpm = Math.round(finalCorrect / 5 / (finalElapsed / 60));
    const finalStars = finalAccuracy >= 97 ? 3 : finalAccuracy >= 88 ? 2 : 1;
    const finalResult = { accuracy: finalAccuracy, wpm: finalWpm, stars: finalStars };
    setElapsed(finalElapsed);
    setResult(finalResult);
    setStatus("complete");
    saveCompletion(finalResult);
  }, [saveCompletion]);

  const startLesson = useCallback(() => {
    setPromptIndex(0);
    setTyped("");
    setCorrectHits(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setElapsed(0);
    setResult(null);
    startTime.current = Date.now();
    setStatus("playing");
  }, []);

  const handleKey = useCallback((key: string) => {
    if (status !== "playing" || !target) return;
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    if (normalized === target) {
      const nextCorrect = correctHits + 1;
      const nextStreak = streak + 1;
      const nextTyped = typed + normalized;
      setCorrectHits(nextCorrect);
      setStreak(nextStreak);
      setBestStreak((current) => Math.max(current, nextStreak));
      showFlash("correct");
      playTone(true);

      if (nextTyped.length === prompt.length) {
        if (promptIndex === lesson.prompts.length - 1) {
          setTyped(nextTyped);
          finishLesson(nextCorrect, mistakes);
        } else {
          setPromptIndex((current) => current + 1);
          setTyped("");
        }
      } else {
        setTyped(nextTyped);
      }
    } else if (normalized.length === 1) {
      setMistakes((current) => current + 1);
      setStreak(0);
      showFlash("wrong");
      playTone(false);
    }
  }, [correctHits, finishLesson, lesson.prompts.length, mistakes, playTone, prompt, promptIndex, showFlash, status, streak, target, typed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (status === "ready" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        startLesson();
        return;
      }
      if (status === "complete" && event.key === "Enter") {
        event.preventDefault();
        startLesson();
        return;
      }
      if (status === "playing" && event.key.length === 1) {
        event.preventDefault();
        handleKey(event.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey, startLesson, status]);

  const chooseLesson = (index: number) => {
    if (index >= unlockedCount) return;
    setSelectedIndex(index);
    setPromptIndex(0);
    setTyped("");
    setStatus("ready");
    setResult(null);
  };

  const goToNextLesson = () => {
    if (selectedIndex < LESSONS.length - 1) {
      chooseLesson(selectedIndex + 1);
    } else {
      startLesson();
    }
  };

  return (
    <main className="app-shell">
      <div className="sky-dot dot-one" />
      <div className="sky-dot dot-two" />
      <header className="topbar">
        <div className="brand" aria-label="键盘探险队首页">
          <span className="brand-planet"><span /></span>
          <div><strong>键盘探险队</strong><small>KEY QUEST</small></div>
        </div>
        <div className="top-progress">
          <span className="level-pill">等级 {Math.floor(progress.xp / 200) + 1}</span>
          <div className="xp-track" aria-label={`经验值 ${progress.xp}`}><span style={{ width: `${progress.xp % 200 / 2}%` }} /></div>
          <strong>{progress.xp} XP</strong>
        </div>
        <button className="sound-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "关闭音效" : "打开音效"}>
          {soundOn ? "♪" : "×"}<span>{soundOn ? "音效开" : "音效关"}</span>
        </button>
      </header>

      <div className="game-layout">
        <aside className="lesson-panel" aria-label="课程地图">
          <div className="panel-heading">
            <div><span className="eyebrow">探索路线</span><h2>星球课程</h2></div>
            <span className="course-count">{progress.completed.length}/{LESSONS.length}</span>
          </div>
          <div className="lesson-list">
            {LESSONS.map((item, index) => {
              const locked = index >= unlockedCount;
              const complete = progress.completed.includes(item.id);
              return (
                <button
                  key={item.id}
                  className={`lesson-item ${selectedIndex === index ? "active" : ""} ${locked ? "locked" : ""}`}
                  onClick={() => chooseLesson(index)}
                  disabled={locked}
                  aria-current={selectedIndex === index ? "step" : undefined}
                >
                  <span className="lesson-badge">{complete ? "✓" : locked ? "•" : item.badge}</span>
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <span className="lesson-state">{complete ? "★" : locked ? "锁" : "›"}</span>
                </button>
              );
            })}
          </div>
          <div className="parent-note"><span>☀</span><p><strong>每天 10 分钟</strong><br />短时练习，更容易保持好习惯</p></div>
        </aside>

        <section className={`practice-card ${flash ? `flash-${flash}` : ""}`}>
          <div className="practice-topline">
            <div>
              <span className="eyebrow">任务 {lesson.badge}</span>
              <h1>{lesson.title}</h1>
            </div>
            <div className="session-stats">
              <span><small>速度</small><strong>{wpm}</strong><em>WPM</em></span>
              <span><small>准确</small><strong>{sessionAccuracy}</strong><em>%</em></span>
              <span><small>连击</small><strong>{streak}</strong><em>次</em></span>
            </div>
          </div>

          <div className="flight-path" aria-label={`本关进度 ${lessonProgress}%`}>
            <span className="flight-line"><i style={{ width: `${lessonProgress}%` }} /></span>
            <span className="rocket" style={{ left: `calc(${lessonProgress}% - 14px)` }}>➤</span>
            <span className="finish-planet">★</span>
          </div>

          {status === "complete" && result ? (
            <div className="result-panel" role="dialog" aria-label="任务完成">
              <span className="result-orbit">✓</span>
              <span className="eyebrow">任务完成</span>
              <h2>漂亮的飞行，探险家！</h2>
              <div className="result-stars" aria-label={`获得 ${result.stars} 颗星`}>
                {[0, 1, 2].map((star) => <span className={star < result.stars ? "earned" : ""} key={star}>★</span>)}
              </div>
              <div className="result-score">
                <span><strong>{result.accuracy}%</strong><small>准确率</small></span>
                <span><strong>{result.wpm}</strong><small>每分钟单词</small></span>
                <span><strong>+{lesson.xp}</strong><small>经验值</small></span>
              </div>
              <div className="result-actions">
                <button className="secondary-button" onClick={startLesson}>再练一次</button>
                <button className="primary-button" onClick={goToNextLesson}>{selectedIndex === LESSONS.length - 1 ? "再次出发" : "下一站"}<span>→</span></button>
              </div>
            </div>
          ) : (
            <>
              <div className="typing-stage">
                <p className="mission-copy">{status === "ready" ? "把手指放在键盘基准位，准备发射" : "看准高亮字母，一个一个来"}</p>
                <div className="prompt" aria-live="polite" aria-label={`请输入 ${prompt}`}>
                  {prompt.split("").map((character, index) => (
                    <span
                      key={`${promptIndex}-${index}`}
                      className={index < typed.length ? "done" : index === typed.length ? "current" : ""}
                    >{character === " " ? "·" : character}</span>
                  ))}
                </div>
                <div className="finger-tip">
                  {status === "playing" && finger ? <><span className={`hand-dot ${finger.hand === "右手" ? "right" : ""}`} />用<strong>{finger.hand}{finger.finger}</strong>按下 <kbd>{target === " " ? "空格" : target.toUpperCase()}</kbd></> : <><span className="hand-dot" />F、J 键上的小凸点就是手指的“停机坪”</>}
                </div>
                {status === "ready" && <button className="primary-button start-button" onClick={startLesson}>开始任务 <span>→</span><small>也可按 Enter</small></button>}
              </div>

              <div className="keyboard-wrap" aria-label="屏幕键盘，可点击输入">
                {KEYBOARD.map((row, rowIndex) => (
                  <div className={`keyboard-row row-${rowIndex + 1}`} key={row.join("")}>
                    {row.map((key) => (
                      <button
                        key={key}
                        className={`key ${target === key && status === "playing" ? "target" : ""} ${lesson.keys.includes(key) ? "lesson-key" : ""}`}
                        onClick={() => handleKey(key)}
                        aria-label={`按键 ${key}`}
                        tabIndex={status === "playing" ? 0 : -1}
                      >
                        {key.toUpperCase()}
                        {(key === "f" || key === "j") && <i />}
                      </button>
                    ))}
                  </div>
                ))}
                <button className={`space-key ${target === " " && status === "playing" ? "target" : ""}`} onClick={() => handleKey(" ")} tabIndex={status === "playing" ? 0 : -1}>空格 SPACE</button>
              </div>
            </>
          )}
          <span className="sr-only" aria-live="assertive">{flash === "wrong" ? "再试一次" : flash === "correct" ? "正确" : ""}</span>
        </section>

        <aside className="mission-panel">
          <div className="buddy-card">
            <div className="buddy-antenna" />
            <div className="buddy-face"><span className="eye left" /><span className="eye right" /><span className="smile" /></div>
            <div className="speech-bubble">{streak >= 10 ? "太棒了！你的连击像火箭一样快！" : status === "playing" ? "慢一点也没关系，准确最重要。" : "嗨！我是波波，今天一起练习吧！"}</div>
          </div>
          <div className="goal-card">
            <span className="eyebrow">本关目标</span>
            <h3>收集 3 颗星</h3>
            <div className="goal-row"><span className="goal-icon violet">◎</span><p><strong>保持准确</strong><small>准确率达到 97%</small></p><b>{sessionAccuracy}%</b></div>
            <div className="goal-row"><span className="goal-icon coral">⚡</span><p><strong>连续命中</strong><small>最高连续按对次数</small></p><b>{bestStreak}</b></div>
            <div className="goal-row"><span className="goal-icon yellow">★</span><p><strong>完成任务</strong><small>还剩 {lesson.prompts.length - promptIndex} 组</small></p><b>{promptIndex}/{lesson.prompts.length}</b></div>
          </div>
          <div className="tiny-stats"><span><b>★ {progress.totalStars}</b>累计星星</span><span><b>{progress.bestWpm}</b>最快 WPM</span></div>
        </aside>
      </div>
    </main>
  );
}

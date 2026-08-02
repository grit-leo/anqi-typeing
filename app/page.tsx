"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateGameResult,
  GAME_MODES,
  getModePrompts,
  getSessionReward,
  RUSH_SECONDS,
  type GameMode,
  type GameResult,
} from "./game-engine";

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
  arcadeBest: { "star-rush": number; "bubble-party": number };
};

type Result = GameResult & { reward: number };

const LESSONS: Lesson[] = [
  { id: "home-beacons", title: "起航信号", subtitle: "认识 F 和 J 的小凸点", badge: "01", keys: ["f", "j"], prompts: ["fff jjj", "fjf jfj", "ffj jff", "fjfj jfjf"], xp: 40 },
  { id: "left-garden", title: "左手花园", subtitle: "ASDF 四根手指来集合", badge: "02", keys: ["a", "s", "d", "f"], prompts: ["asdf fdsa", "sad dad", "fad ads", "a sad dad"], xp: 50 },
  { id: "right-island", title: "右手小岛", subtitle: "JKL; 找到右手大本营", badge: "03", keys: ["j", "k", "l", ";"], prompts: ["jkl; ;lkj", "jill", "jelly", "jill; jelly"], xp: 55 },
  { id: "word-forest", title: "单词森林", subtitle: "双手合作采集单词", badge: "04", keys: ["a", "s", "d", "f", "j", "k", "l"], prompts: ["fall", "ask", "dad", "salad", "a sad fall"], xp: 65 },
  { id: "moon-station", title: "月亮基地", subtitle: "挑战更多字母和太空词汇", badge: "05", keys: ["m", "o", "n", "r", "t", "c"], prompts: ["moon", "star", "rocket", "robot", "moon robot"], xp: 75 },
  { id: "space-message", title: "星际电报", subtitle: "完成你的第一条英文句子", badge: "06", keys: ["h", "e", "l", "o", "w", "r", "d"], prompts: ["hello", "hello world", "we love typing", "hello little star"], xp: 90 },
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
  arcadeBest: { "star-rush": 0, "bubble-party": 0 },
};

const FINGER_GROUPS: Record<string, { finger: string; hand: "左手" | "右手" }> = {
  q: { finger: "小拇指", hand: "左手" }, a: { finger: "小拇指", hand: "左手" }, z: { finger: "小拇指", hand: "左手" },
  w: { finger: "无名指", hand: "左手" }, s: { finger: "无名指", hand: "左手" }, x: { finger: "无名指", hand: "左手" },
  e: { finger: "中指", hand: "左手" }, d: { finger: "中指", hand: "左手" }, c: { finger: "中指", hand: "左手" },
  r: { finger: "食指", hand: "左手" }, t: { finger: "食指", hand: "左手" }, f: { finger: "食指", hand: "左手" }, g: { finger: "食指", hand: "左手" }, v: { finger: "食指", hand: "左手" }, b: { finger: "食指", hand: "左手" },
  y: { finger: "食指", hand: "右手" }, u: { finger: "食指", hand: "右手" }, h: { finger: "食指", hand: "右手" }, j: { finger: "食指", hand: "右手" }, n: { finger: "食指", hand: "右手" }, m: { finger: "食指", hand: "右手" },
  i: { finger: "中指", hand: "右手" }, k: { finger: "中指", hand: "右手" }, ",": { finger: "中指", hand: "右手" },
  o: { finger: "无名指", hand: "右手" }, l: { finger: "无名指", hand: "右手" }, ".": { finger: "无名指", hand: "右手" },
  p: { finger: "小拇指", hand: "右手" }, ";": { finger: "小拇指", hand: "右手" }, "/": { finger: "小拇指", hand: "右手" },
};

function safeLoadProgress(): Progress {
  try {
    const saved = window.localStorage.getItem("anqi-typer-progress") ?? window.localStorage.getItem("key-quest-progress");
    if (!saved) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(saved) as Partial<Progress>;
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      arcadeBest: { ...DEFAULT_PROGRESS.arcadeBest, ...parsed.arcadeBest },
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("journey");
  const [promptIndex, setPromptIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<"ready" | "playing" | "complete">("ready");
  const [correctHits, setCorrectHits] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [result, setResult] = useState<Result | null>(null);
  const startTime = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lesson = LESSONS[selectedIndex];
  const activeMode = GAME_MODES.find((mode) => mode.id === gameMode)!;
  const activePrompts = useMemo(() => getModePrompts(gameMode, lesson), [gameMode, lesson]);
  const prompt = activePrompts[promptIndex] ?? activePrompts[0];
  const target = prompt?.[typed.length] ?? "";
  const finger = target === " " ? { finger: "大拇指", hand: "任意手" as const } : FINGER_GROUPS[target];
  const unlockedCount = Math.min(LESSONS.length, progress.completed.length + 1);
  const sessionAccuracy = correctHits + mistakes === 0 ? 100 : Math.round((correctHits / (correctHits + mistakes)) * 100);
  const wpm = elapsed < 1 ? 0 : Math.round(correctHits / 5 / (elapsed / 60));
  const liveScore = Math.max(0, correctHits * 10 + bestStreak * 3 - mistakes * 4);
  const multiplier = Math.min(5, 1 + Math.floor(streak / 5));
  const timeLeft = Math.max(0, Math.ceil(RUSH_SECONDS - elapsed));

  const gameProgress = useMemo(() => {
    if (gameMode === "star-rush") return Math.min(100, Math.round((elapsed / RUSH_SECONDS) * 100));
    const completedLength = activePrompts.slice(0, promptIndex).reduce((sum, item) => sum + item.length, 0);
    const totalLength = activePrompts.reduce((sum, item) => sum + item.length, 0);
    return Math.min(100, Math.round(((completedLength + typed.length) / totalLength) * 100));
  }, [activePrompts, elapsed, gameMode, promptIndex, typed.length]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setProgress(safeLoadProgress()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setElapsed((Date.now() - startTime.current) / 1000), 200);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const playTone = useCallback((isCorrect: boolean) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = new AudioCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = isCorrect ? "sine" : "square";
      oscillator.frequency.value = isCorrect ? 580 + Math.min(streak, 12) * 20 : 145;
      gain.gain.setValueAtTime(0.055, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.09);
      oscillator.onended = () => void context.close();
    } catch {
      // Audio feedback is optional; the game stays fully playable without it.
    }
  }, [soundOn, streak]);

  const showFlash = useCallback((kind: "correct" | "wrong") => {
    setFlash(kind);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 170);
  }, []);

  const saveCompletion = useCallback((finalResult: Result) => {
    setProgress((current) => {
      const isCourse = gameMode === "journey";
      const alreadyComplete = current.completed.includes(lesson.id);
      const completed = isCourse && !alreadyComplete ? [...current.completed, lesson.id] : current.completed;
      const arcadeBest = isCourse ? current.arcadeBest : {
        ...current.arcadeBest,
        [gameMode]: Math.max(current.arcadeBest[gameMode], finalResult.score),
      };
      const next = {
        completed,
        xp: current.xp + finalResult.reward,
        bestWpm: Math.max(current.bestWpm, finalResult.wpm),
        totalStars: current.totalStars + finalResult.stars,
        arcadeBest,
      };
      try {
        window.localStorage.setItem("anqi-typer-progress", JSON.stringify(next));
      } catch {
        // In-memory progress still works when browser storage is unavailable.
      }
      return next;
    });
  }, [gameMode, lesson.id]);

  const finishGame = useCallback((finalCorrect: number, finalMistakes: number, finalStreak: number) => {
    const finalElapsed = Math.max(1, (Date.now() - startTime.current) / 1000);
    const stats = calculateGameResult(gameMode, finalCorrect, finalMistakes, finalElapsed, finalStreak);
    const finalResult = { ...stats, reward: getSessionReward(gameMode, lesson.xp) };
    setElapsed(finalElapsed);
    setResult(finalResult);
    setStatus("complete");
    saveCompletion(finalResult);
  }, [gameMode, lesson.xp, saveCompletion]);

  useEffect(() => {
    if (status !== "playing" || gameMode !== "star-rush") return;
    const remaining = Math.max(0, RUSH_SECONDS * 1000 - (Date.now() - startTime.current));
    const timer = window.setTimeout(() => finishGame(correctHits, mistakes, bestStreak), remaining);
    return () => window.clearTimeout(timer);
  }, [bestStreak, correctHits, finishGame, gameMode, mistakes, status]);

  const startGame = useCallback(() => {
    setPromptIndex(0);
    setTyped("");
    setCorrectHits(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setElapsed(0);
    setLaps(0);
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
        if (promptIndex === activePrompts.length - 1) {
          if (gameMode === "star-rush") {
            setPromptIndex(0);
            setTyped("");
            setLaps((current) => current + 1);
          } else {
            setTyped(nextTyped);
            finishGame(nextCorrect, mistakes, nextStreak);
          }
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
  }, [activePrompts.length, correctHits, finishGame, gameMode, mistakes, playTone, prompt, promptIndex, showFlash, status, streak, target, typed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (status === "ready" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        startGame();
      } else if (status === "complete" && event.key === "Enter") {
        event.preventDefault();
        startGame();
      } else if (status === "playing" && event.key.length === 1) {
        event.preventDefault();
        handleKey(event.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey, startGame, status]);

  const resetBoard = () => {
    setPromptIndex(0);
    setTyped("");
    setStatus("ready");
    setResult(null);
    setElapsed(0);
  };

  const chooseLesson = (index: number) => {
    if (index >= unlockedCount || status === "playing") return;
    setSelectedIndex(index);
    resetBoard();
  };

  const chooseMode = (mode: GameMode) => {
    if (status === "playing") return;
    setGameMode(mode);
    resetBoard();
  };

  const goForward = () => {
    if (gameMode === "journey" && selectedIndex < LESSONS.length - 1) {
      chooseLesson(selectedIndex + 1);
    } else {
      startGame();
    }
  };

  const buddyCopy = streak >= 15
    ? `哇！${multiplier} 倍能量，继续保持！`
    : gameMode === "star-rush"
      ? "别着急，稳稳接住每一颗星。"
      : gameMode === "bubble-party"
        ? "泡泡会等你，看准再按就好。"
        : "手指放松，准确比速度更重要。";

  return (
    <main className="app-shell">
      <div className="sky-dot dot-one" /><div className="sky-dot dot-two" />
      <header className="topbar">
        <div className="brand" aria-label="安琪打字机首页">
          <span className="brand-planet"><span /></span>
          <div><strong>安琪打字机</strong><small>ANQI TYPER</small></div>
        </div>
        <div className="top-progress">
          <span className="streak-pill">🔥 已收集 {progress.totalStars} 颗星</span>
          <span className="level-pill">等级 {Math.floor(progress.xp / 200) + 1}</span>
          <div className="xp-track" aria-label={`经验值 ${progress.xp}`}><span style={{ width: `${(progress.xp % 200) / 2}%` }} /></div>
          <strong>{progress.xp} XP</strong>
        </div>
        <button className="sound-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "关闭音效" : "打开音效"}>
          {soundOn ? "♫" : "×"}<span>{soundOn ? "音效开" : "音效关"}</span>
        </button>
      </header>

      <div className="game-layout">
        <aside className="lesson-panel" aria-label="课程地图">
          <div className="panel-heading">
            <div><span className="eyebrow">冒险地图</span><h2>今天去哪里？</h2></div>
            <span className="course-count">{progress.completed.length}/{LESSONS.length}</span>
          </div>
          <div className="lesson-list">
            {LESSONS.map((item, index) => {
              const locked = index >= unlockedCount;
              const complete = progress.completed.includes(item.id);
              return (
                <button key={item.id} className={`lesson-item ${selectedIndex === index ? "active" : ""} ${locked ? "locked" : ""}`} onClick={() => chooseLesson(index)} disabled={locked || status === "playing"} aria-current={selectedIndex === index ? "step" : undefined}>
                  <span className="lesson-badge">{complete ? "✓" : locked ? "•" : item.badge}</span>
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <span className="lesson-state">{complete ? "★" : locked ? "🔒" : "›"}</span>
                </button>
              );
            })}
          </div>
          <div className="daily-card"><span className="daily-icon">🎁</span><p><strong>今日宝箱</strong><small>再获得 {Math.max(0, 3 - (progress.totalStars % 3)) || 3} 颗星即可开启</small></p><span className="mini-stars">★ ★ ★</span></div>
        </aside>

        <section className={`practice-card mode-${gameMode} ${flash ? `flash-${flash}` : ""}`}>
          <div className="practice-topline">
            <div><span className="eyebrow">任务 {lesson.badge} · {activeMode.shortLabel}模式</span><h1>{lesson.title}</h1></div>
            <div className="session-stats">
              <span><small>速度</small><strong>{wpm}</strong><em>WPM</em></span>
              <span><small>准确</small><strong>{sessionAccuracy}</strong><em>%</em></span>
              <span className={gameMode === "star-rush" && timeLeft <= 5 ? "danger" : ""}><small>{gameMode === "star-rush" ? "剩余" : "连击"}</small><strong>{gameMode === "star-rush" ? timeLeft : streak}</strong><em>{gameMode === "star-rush" ? "秒" : "次"}</em></span>
            </div>
          </div>

          <div className="mode-switcher" role="tablist" aria-label="选择游戏玩法">
            {GAME_MODES.map((mode) => (
              <button key={mode.id} role="tab" aria-selected={gameMode === mode.id} className={gameMode === mode.id ? "active" : ""} onClick={() => chooseMode(mode.id)} disabled={status === "playing"}>
                <span>{mode.icon}</span><strong>{mode.label}</strong><small>{mode.description}</small>
              </button>
            ))}
          </div>

          <div className="flight-path" aria-label={`本局进度 ${gameProgress}%`}>
            <span className="flight-label">{gameMode === "star-rush" ? `第 ${laps + 1} 圈` : activeMode.goal}</span>
            <span className="flight-line"><i style={{ width: `${gameProgress}%` }} /></span>
            <span className="rocket" style={{ left: `calc(${gameProgress}% - 14px)` }}>{gameMode === "bubble-party" ? "●" : "➤"}</span>
            <span className="finish-planet">★</span>
          </div>

          {status === "complete" && result ? (
            <div className={`result-panel result-${gameMode}`} role="dialog" aria-label="任务完成">
              <div className="confetti"><i /><i /><i /><i /><i /><i /></div>
              <span className="result-orbit">{gameMode === "star-rush" ? "⚡" : gameMode === "bubble-party" ? "●" : "✓"}</span>
              <span className="eyebrow">{gameMode === "journey" ? "新航线已点亮" : "游戏结算"}</span>
              <h2>{gameMode === "star-rush" ? "星星雨大丰收！" : gameMode === "bubble-party" ? "泡泡全部消除！" : "成功抵达下一站！"}</h2>
              <div className="result-stars" aria-label={`获得 ${result.stars} 颗星`}>{[0, 1, 2].map((star) => <span className={star < result.stars ? "earned" : ""} key={star}>★</span>)}</div>
              <div className="result-score">
                <span><strong>{result.score}</strong><small>本局得分</small></span>
                <span><strong>{result.accuracy}%</strong><small>准确率</small></span>
                <span><strong>{result.wpm}</strong><small>最快速度</small></span>
                <span><strong>+{result.reward}</strong><small>经验值</small></span>
              </div>
              <p className="result-tip">{result.accuracy >= 95 ? "手指像小超人一样又稳又准！" : "每一次练习都在让手指变得更聪明。"}</p>
              <div className="result-actions">
                <button className="secondary-button" onClick={resetBoard}>换个玩法</button>
                <button className="primary-button" onClick={goForward}>{gameMode === "journey" && selectedIndex < LESSONS.length - 1 ? "前往下一站" : "再玩一局"}<span>→</span></button>
              </div>
            </div>
          ) : (
            <>
              <div className={`typing-stage scene-${gameMode}`}>
                <div className="scene-decor" aria-hidden="true">
                  {gameMode === "journey" && <><i className="planet-a" /><i className="planet-b" /><i className="tiny-rocket">➤</i></>}
                  {gameMode === "star-rush" && <><i className="falling-star star-a">★</i><i className="falling-star star-b">★</i><i className="falling-star star-c">★</i><i className="shield" /></>}
                  {gameMode === "bubble-party" && <><i className="float-bubble bubble-a" /><i className="float-bubble bubble-b" /><i className="float-bubble bubble-c" /></>}
                </div>
                <div className="scene-headline">
                  <span>{activeMode.icon}</span>
                  <p>{status === "ready" ? activeMode.startCopy : gameMode === "star-rush" ? `能量 ${liveScore} · ${multiplier}× 连击` : gameMode === "bubble-party" ? `还剩 ${Math.max(0, prompt.length - typed.length)} 个泡泡` : "看准高亮字母，一个一个来"}</p>
                  {gameMode === "star-rush" && <b className={timeLeft <= 5 ? "danger" : ""}>{timeLeft}s</b>}
                </div>
                <div className={`prompt ${gameMode === "bubble-party" ? "bubble-prompt" : ""}`} aria-live="polite" aria-label={`请输入 ${prompt}`}>
                  {prompt.split("").map((character, index) => (
                    <span key={`${promptIndex}-${index}`} className={index < typed.length ? "done" : index === typed.length ? "current" : ""}>{character === " " ? "·" : character}</span>
                  ))}
                </div>
                <div className="finger-tip">
                  {status === "playing" && finger ? <><span className={`hand-dot ${finger.hand === "右手" ? "right" : ""}`} />用<strong>{finger.hand}{finger.finger}</strong>按下 <kbd>{target === " " ? "空格" : target.toUpperCase()}</kbd></> : <><span className="hand-dot" />F、J 键的小凸点就是手指“停机坪”</>}
                </div>
                {status === "ready" ? <button className="primary-button start-button" onClick={startGame}>开始游戏 <span>→</span><small>也可按 Enter</small></button> : <button className="quit-button" onClick={resetBoard}>暂停并退出本局</button>}
              </div>

              <div className="keyboard-wrap" aria-label="屏幕键盘，可点击输入">
                <div className="combo-meter"><span><i style={{ width: `${Math.min(100, (streak % 5) * 20)}%` }} /></span><b>{multiplier}× 能量</b></div>
                {KEYBOARD.map((row, rowIndex) => (
                  <div className={`keyboard-row row-${rowIndex + 1}`} key={row.join("")}>
                    {row.map((key) => <button key={key} className={`key ${target === key && status === "playing" ? "target" : ""} ${lesson.keys.includes(key) ? "lesson-key" : ""}`} onClick={() => handleKey(key)} aria-label={`按键 ${key}`} tabIndex={status === "playing" ? 0 : -1}>{key.toUpperCase()}{(key === "f" || key === "j") && <i />}</button>)}
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
            <div className="speech-bubble">{buddyCopy}</div>
            <div className="buddy-antenna" /><div className="buddy-face"><span className="eye left" /><span className="eye right" /><span className="smile" /></div>
            {streak >= 5 && <span className="combo-pop">{multiplier}×</span>}
          </div>
          <div className="goal-card">
            <span className="eyebrow">本局挑战</span><h3>{activeMode.goal}</h3>
            <div className="goal-row"><span className="goal-icon violet">◎</span><p><strong>保持准确</strong><small>目标达到 95%</small></p><b>{sessionAccuracy}%</b></div>
            <div className="goal-row"><span className="goal-icon coral">⚡</span><p><strong>{gameMode === "star-rush" ? "收集能量" : "连续命中"}</strong><small>{gameMode === "star-rush" ? "按对越多分数越高" : "连续按对获得加成"}</small></p><b>{gameMode === "star-rush" ? liveScore : bestStreak}</b></div>
            <div className="goal-row"><span className="goal-icon yellow">★</span><p><strong>{gameMode === "star-rush" ? "坚持到底" : "完成目标"}</strong><small>{gameMode === "star-rush" ? "倒计时结束自动结算" : `还剩 ${activePrompts.length - promptIndex} 组`}</small></p><b>{gameMode === "star-rush" ? `${timeLeft}s` : `${promptIndex}/${activePrompts.length}`}</b></div>
          </div>
          <div className="best-card"><span>🏆</span><p><small>{gameMode === "journey" ? "最快速度" : "小游戏最高分"}</small><strong>{gameMode === "journey" ? `${progress.bestWpm} WPM` : progress.arcadeBest[gameMode]}</strong></p></div>
          <div className="tiny-stats"><span><b>★ {progress.totalStars}</b>累计星星</span><span><b>{progress.completed.length}</b>已通关星球</span></div>
        </aside>
      </div>
    </main>
  );
}

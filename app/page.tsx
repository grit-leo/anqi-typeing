"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyGardenResult,
  buyOrEquipCosmetic,
  calculateGardenResult,
  claimDailyReward,
  COSMETICS,
  DEFAULT_GARDEN_PROGRESS,
  evaluateTypingKey,
  GARDEN_LEVELS,
  getLevelWord,
  getLocalDateKey,
  getLiveScore,
  getPlayerLevel,
  type GardenProgress,
  type GardenResult,
} from "./game-engine";
import { AdventureHub } from "./AdventureHub";
import { MagicGarden3D } from "./MagicGarden3D";

type Phase = "lobby" | "playing" | "paused" | "complete";
type Flash = "correct" | "wrong" | "word" | null;
type SessionSnapshot = { correctHits: number; mistakes: number; completedWords: number; bestCombo: number; elapsed: number };

const PROGRESS_KEY = "anqi-magic-garden-progress";
const TUTORIAL_KEY = "anqi-magic-garden-tutorial";

function loadProgress(): GardenProgress {
  try {
    const saved = window.localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<GardenProgress>;
      return {
        ...DEFAULT_GARDEN_PROGRESS,
        ...parsed,
        bestScores: { ...DEFAULT_GARDEN_PROGRESS.bestScores, ...parsed.bestScores },
        achievements: parsed.achievements ?? DEFAULT_GARDEN_PROGRESS.achievements,
        ownedCosmetics: parsed.ownedCosmetics ?? DEFAULT_GARDEN_PROGRESS.ownedCosmetics,
        equippedCosmetic: parsed.equippedCosmetic ?? DEFAULT_GARDEN_PROGRESS.equippedCosmetic,
        daily: { ...DEFAULT_GARDEN_PROGRESS.daily, ...parsed.daily },
      };
    }
    const legacy = window.localStorage.getItem("anqi-typer-progress");
    if (legacy) {
      const parsed = JSON.parse(legacy) as { completed?: string[]; totalStars?: number };
      return {
        ...DEFAULT_GARDEN_PROGRESS,
        unlocked: Math.min(3, Math.max(1, 1 + Math.floor((parsed.completed?.length ?? 0) / 2))),
        totalStars: parsed.totalStars ?? 0,
      };
    }
  } catch {
    // The full game remains playable when browser storage is unavailable.
  }
  return DEFAULT_GARDEN_PROGRESS;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [levelIndex, setLevelIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [correctHits, setCorrectHits] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [completedWords, setCompletedWords] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GardenResult | null>(null);
  const [progress, setProgress] = useState<GardenProgress>(DEFAULT_GARDEN_PROGRESS);
  const [soundOn, setSoundOn] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [toast, setToast] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const startedAt = useRef(0);
  const finishingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<SessionSnapshot>({ correctHits: 0, mistakes: 0, completedWords: 0, bestCombo: 0, elapsed: 0 });

  const level = GARDEN_LEVELS[levelIndex];
  const word = getLevelWord(level, completedWords);
  const target = word[typed.length] ?? "";
  const targetLabel = target === " " ? "空格" : target.toUpperCase();
  const timeLeft = Math.max(0, Math.ceil(level.duration - elapsed));
  const score = getLiveScore(level, correctHits, mistakes, completedWords, bestCombo);
  const accuracy = correctHits + mistakes === 0 ? 100 : Math.round((correctHits / (correctHits + mistakes)) * 100);
  const questProgress = Math.min(100, Math.round((completedWords / level.targetWords) * 100));
  const isFever = combo >= 12;
  const playerLevel = getPlayerLevel(progress.xp);
  const equippedCosmetic = COSMETICS.find((item) => item.id === progress.equippedCosmetic) ?? COSMETICS[0];
  const missionName = level.mission === "guardian" ? "守护者 Boss" : level.mission === "rhythm" ? "节奏短句" : level.mission === "firefly" ? "萤火竞速" : "花灵唤醒";
  const missionProgressCopy = level.mission === "guardian" ? "结界剩余" : level.mission === "rhythm" ? "旋律修复" : level.mission === "firefly" ? "萤火收集" : "花园净化";
  const missionProgressValue = level.mission === "guardian" ? Math.max(0, level.targetWords - completedWords) : completedWords;

  const levelLabel = useMemo(() => `${level.title}，${level.goal}`, [level]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setProgress(loadProgress());
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    });
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  useEffect(() => {
    sessionRef.current = { correctHits, mistakes, completedWords, bestCombo, elapsed };
  }, [bestCombo, completedWords, correctHits, elapsed, mistakes]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    void audioContextRef.current?.close();
  }, []);

  const playTone = useCallback((kind: "key" | "wrong" | "word" | "win") => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = audioContextRef.current && audioContextRef.current.state !== "closed" ? audioContextRef.current : new AudioCtor();
      audioContextRef.current = context;
      const notes = kind === "win" ? [523, 659, 784] : [kind === "wrong" ? 164 : kind === "word" ? 740 : 540 + Math.min(combo, 15) * 18];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = kind === "wrong" ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        const start = context.currentTime + index * 0.085;
        gain.gain.setValueAtTime(kind === "key" ? 0.035 : 0.055, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.14);
      });
    } catch {
      // Sound is an enhancement, never a condition for play.
    }
  }, [combo, soundOn]);

  const showFlash = useCallback((kind: Exclude<Flash, null>) => {
    setFlash(kind);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), kind === "word" ? 520 : 180);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1400);
  }, []);

  const finishGame = useCallback((snapshot?: SessionSnapshot) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const final = snapshot ?? sessionRef.current;
    const elapsedSeconds = Math.max(1, final.elapsed || (Date.now() - startedAt.current) / 1000);
    const finalResult = calculateGardenResult(level, final.correctHits, final.mistakes, elapsedSeconds, final.completedWords, final.bestCombo);
    setElapsed(elapsedSeconds);
    setResult(finalResult);
    setPhase("complete");
    playTone("win");
    setProgress((current) => {
      const next = applyGardenResult(current, levelIndex, finalResult, final.completedWords, final.bestCombo, getLocalDateKey());
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Session result still renders when local persistence is unavailable.
      }
      return next;
    });
  }, [level, levelIndex, playTone]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      const nextElapsed = (Date.now() - startedAt.current) / 1000;
      setElapsed(nextElapsed);
      if (nextElapsed >= level.duration) {
        finishGame({ ...sessionRef.current, elapsed: level.duration });
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [finishGame, level.duration, phase]);

  const beginSession = useCallback(() => {
    setTyped("");
    setCorrectHits(0);
    setMistakes(0);
    setCombo(0);
    setBestCombo(0);
    setCompletedWords(0);
    setElapsed(0);
    setResult(null);
    setFlash(null);
    setToast("");
    finishingRef.current = false;
    sessionRef.current = { correctHits: 0, mistakes: 0, completedWords: 0, bestCombo: 0, elapsed: 0 };
    startedAt.current = Date.now();
    setPhase("playing");
    window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), 120);
  }, []);

  const requestStart = useCallback(() => {
    try {
      if (!window.localStorage.getItem(TUTORIAL_KEY)) {
        setTutorialOpen(true);
        return;
      }
    } catch {
      // Continue directly when tutorial preference cannot be stored.
    }
    beginSession();
  }, [beginSession]);

  const completeTutorial = () => {
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "seen");
    } catch {
      // Tutorial can still be dismissed without storage.
    }
    setTutorialOpen(false);
    beginSession();
  };

  const pauseGame = useCallback(() => {
    if (phase !== "playing") return;
    const nowElapsed = (Date.now() - startedAt.current) / 1000;
    setElapsed(nowElapsed);
    setPhase("paused");
  }, [phase]);

  const resumeGame = useCallback(() => {
    startedAt.current = Date.now() - elapsed * 1000;
    setPhase("playing");
    window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), 100);
  }, [elapsed]);

  const returnToLobby = useCallback(() => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishingRef.current = false;
    setPhase("lobby");
    setTyped("");
    setResult(null);
    setSettingsOpen(false);
  }, []);

  const updateProgress = useCallback((updater: (current: GardenProgress) => GardenProgress) => {
    setProgress((current) => {
      const next = updater(current);
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // In-memory progress still works when browser storage is unavailable.
      }
      return next;
    });
  }, []);

  const claimDaily = useCallback(() => {
    updateProgress((current) => claimDailyReward(current, getLocalDateKey()));
    showToast("每日委托奖励已收入花园背包");
  }, [showToast, updateProgress]);

  const chooseCosmetic = useCallback((cosmeticId: string) => {
    updateProgress((current) => buyOrEquipCosmetic(current, cosmeticId));
  }, [updateProgress]);

  const handleKey = useCallback((key: string) => {
    if (phase !== "playing" || finishingRef.current || !target) return;
    const normalized = key.toLowerCase();
    const outcome = evaluateTypingKey(word, typed.length, normalized);
    if (outcome === "correct" || outcome === "complete") {
      const nextCorrect = correctHits + 1;
      const nextCombo = combo + 1;
      const nextBest = Math.max(bestCombo, nextCombo);
      const nextTyped = typed + normalized;
      setCorrectHits(nextCorrect);
      setCombo(nextCombo);
      setBestCombo(nextBest);
      playTone("key");
      showFlash("correct");
      if (nextCombo === 12) showToast("星愿时刻 · 魔力全开");

      if (outcome === "complete") {
        const nextCompleted = completedWords + 1;
        setCompletedWords(nextCompleted);
        setTyped("");
        showFlash("word");
        playTone("word");
        if (nextCompleted === 5) showToast("花灵苏醒 · 第一重结界解除");
        if (nextCompleted === Math.ceil(level.targetWords / 2)) showToast("旅程过半 · 月兔为你加油");
        if (nextCompleted >= level.targetWords) {
          const snapshot = { correctHits: nextCorrect, mistakes, completedWords: nextCompleted, bestCombo: nextBest, elapsed: (Date.now() - startedAt.current) / 1000 };
          sessionRef.current = snapshot;
          finishingRef.current = true;
          finishTimer.current = setTimeout(() => {
            finishingRef.current = false;
            finishGame(snapshot);
          }, reducedMotion ? 80 : 650);
        }
      } else {
        setTyped(nextTyped);
      }
    } else if (outcome === "wrong") {
      setMistakes((current) => current + 1);
      setCombo(0);
      playTone("wrong");
      showFlash("wrong");
    }
  }, [bestCombo, combo, completedWords, correctHits, finishGame, level.targetWords, mistakes, phase, playTone, reducedMotion, showFlash, showToast, target, typed, word]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const interactiveTarget = event.target instanceof HTMLElement && ["BUTTON", "INPUT", "A"].includes(event.target.tagName);
      if (phase === "lobby" && event.key === "Enter" && !tutorialOpen && !helpOpen && !settingsOpen && !interactiveTarget) {
        event.preventDefault();
        requestStart();
      } else if (phase === "playing" && event.key === "Escape") {
        event.preventDefault();
        pauseGame();
      } else if (phase === "paused" && event.key === "Escape") {
        event.preventDefault();
        resumeGame();
      } else if (phase === "playing" && event.key.length === 1) {
        event.preventDefault();
        handleKey(event.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey, helpOpen, pauseGame, phase, requestStart, resumeGame, settingsOpen, tutorialOpen]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === "playing") pauseGame();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pauseGame, phase]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showToast("当前设备将保持沉浸式满屏显示");
    }
  };

  const chooseLevel = (index: number) => {
    if (index >= progress.unlocked || phase !== "lobby") return;
    setLevelIndex(index);
  };

  const playNext = () => {
    const next = Math.min(GARDEN_LEVELS.length - 1, levelIndex + 1);
    if (result?.won && next !== levelIndex) setLevelIndex(next);
    setPhase("lobby");
    setResult(null);
    setTyped("");
  };

  return (
    <main className={`magic-game phase-${phase} level-${level.id} mission-${level.mission} ${flash ? `flash-${flash}` : ""} ${isFever ? "fever-mode" : ""}`}>
      <MagicGarden3D
        phase={phase}
        worldIndex={level.worldIndex}
        mission={level.mission}
        cosmeticColor={equippedCosmetic.color}
        word={word}
        typedLength={typed.length}
        correctHits={correctHits}
        mistakes={mistakes}
        completedWords={completedWords}
        combo={combo}
        reducedMotion={reducedMotion}
      />
      <div className="cinematic-vignette" aria-hidden="true" />
      <div className="petal petal-a" aria-hidden="true" /><div className="petal petal-b" aria-hidden="true" /><div className="petal petal-c" aria-hidden="true" />

      <header className="game-topbar">
        <button className="brand-lockup" onClick={returnToLobby} aria-label="返回安琪打字机首页">
          <span className="brand-gem">✦</span>
          <span><strong>安琪打字机</strong><small>MAGIC GARDEN</small></span>
        </button>
        {phase === "lobby" ? (
          <div className="profile-strip" aria-label="成长记录">
            <span><i>✿</i><b>{progress.petals}</b><small>花瓣</small></span>
            <span><i>★</i><b>{progress.totalStars}</b><small>星星</small></span>
            <span className="player-badge"><i>{playerLevel}</i><b>花语魔法师</b></span>
          </div>
        ) : (
          <div className="mission-title"><small>{level.chapter}</small><strong>{level.title}</strong></div>
        )}
        <div className="top-actions">
          {phase === "lobby" && <button className="help-action" onClick={() => setHelpOpen(true)} aria-label="查看玩法说明">?</button>}
          <button className="sound-action" onClick={() => setSoundOn((current) => !current)} aria-label={soundOn ? "关闭音效" : "打开音效"}>{soundOn ? "♫" : "♩"}</button>
          <button className="fullscreen-action" onClick={toggleFullscreen} aria-label={isFullscreen ? "退出全屏" : "进入全屏"}>{isFullscreen ? "↙" : "↗"}</button>
          <button className="settings-action" onClick={() => setSettingsOpen((current) => !current)} aria-label="游戏设置">⚙</button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-popover" aria-label="游戏设置">
          <div><strong>游戏设置</strong><button onClick={() => setSettingsOpen(false)} aria-label="关闭设置">×</button></div>
          <label><span>魔法音效<small>按键、连击和过关提示</small></span><input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /></label>
          <label><span>柔和动画<small>减少镜头与粒子运动</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
        </section>
      )}

      {phase === "lobby" && (
        <section className="lobby-screen" aria-label="星愿花园主菜单">
          <div className="lobby-keyart" aria-hidden="true" />
          <div className="lobby-copy">
            <span className="season-chip"><i /> 四大世界 · 十二关大型冒险</span>
            <p className="lobby-eyebrow">ANQI TYPER · STORY SEASON 01</p>
            <h1>安琪打字机</h1>
            <h2>星愿花园 · 四界大冒险</h2>
            <p className="lobby-lead">穿越樱花谷、月光湖、云上王城与极光圣殿。每一个单词都会改变世界，和月兔露米一起完成十二场花语试炼。</p>
            <div className="lobby-actions">
              <button className="play-button" onClick={requestStart}><span>开始冒险</span><i>按 Enter</i><b>→</b></button>
              <button className="story-button" onClick={() => setHelpOpen(true)}>观看玩法 <span>▶</span></button>
            </div>
            <div className="promise-row"><span>✦ 12 个剧情关卡</span><span>✦ 4 种任务机制</span><span>✦ 本机保存进度</span></div>
          </div>

          <AdventureHub progress={progress} levelIndex={levelIndex} onChooseLevel={chooseLevel} onStart={requestStart} onClaimDaily={claimDaily} onCosmetic={chooseCosmetic} />
        </section>
      )}
      {phase === "lobby" && toast && <div className="hub-toast" aria-live="polite">{toast}</div>}

      {(phase === "playing" || phase === "paused") && (
        <section className="play-interface" aria-label="花园打字游戏">
          <div className="quest-hud">
            <div className="quest-copy"><span>{missionProgressCopy}</span><strong>{missionProgressValue}<i>/{level.targetWords}</i></strong></div>
            <div className="quest-track" aria-label={`${levelLabel}，完成 ${questProgress}%`}><i style={{ width: `${questProgress}%` }} /><span style={{ left: `calc(${questProgress}% - 9px)` }}>✿</span></div>
            <small>{missionName} · {completedWords < Math.ceil(level.targetWords / 2) ? "第一阶段" : completedWords < level.targetWords ? "最终阶段" : "任务完成"}</small>
          </div>
          <div className="session-hud">
            <span><small>剩余时间</small><b className={timeLeft <= 10 ? "danger" : ""}>{timeLeft}<i>s</i></b></span>
            <span><small>星愿积分</small><b>{score}</b></span>
            <button onClick={pauseGame} aria-label="暂停游戏">Ⅱ</button>
          </div>

          <div className={`combo-ribbon ${combo >= 5 ? "active" : ""}`}>
            <small>MAGIC COMBO</small><strong>{combo}<i>×</i></strong><span>{isFever ? "星愿时刻" : combo >= 5 ? "魔力上升" : "连续输入积蓄魔力"}</span>
          </div>

          <div className="spell-console">
            <span className="spell-label"><i /> {missionName}</span>
            <div className="spell-word" aria-live="polite" aria-label={`目标单词 ${word}`}>
                  {word.split("").map((letter, index) => <span key={`${completedWords}-${index}`} className={index < typed.length ? "done" : index === typed.length ? "current" : ""}>{letter === " " ? "·" : letter}</span>)}
            </div>
            <div className="spell-meta">
              <span>下一键 <kbd>{targetLabel}</kbd></span>
              <div><i style={{ width: `${Math.round((typed.length / word.length) * 100)}%` }} /></div>
              <span>准确率 <b>{accuracy}%</b></span>
            </div>
            <label className="mobile-type-box">
              <span>点这里打开手机键盘</span>
              <input ref={mobileInputRef} value="" onChange={(event) => handleKey(event.target.value.slice(-1))} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" aria-label="手机打字输入框" />
            </label>
            <p className="desktop-hint"><i>F</i><i>J</i> 手指放在凸点上，直接输入高亮按键 <b>{targetLabel}</b></p>
          </div>
          {flash === "word" && <div className="word-burst" aria-live="polite">PERFECT SPELL <span>✦</span></div>}
          {toast && <div className="game-toast" aria-live="polite">{toast}</div>}
          <span className="sr-only" aria-live="assertive">{flash === "wrong" ? "字母不对，再试一次" : flash === "correct" ? "正确" : ""}</span>
        </section>
      )}

      {phase === "paused" && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="游戏已暂停">
          <div className="pause-card modal-card">
            <span className="modal-orbit">☾</span><small>TAKE A LITTLE BREAK</small><h2>魔法暂停中</h2><p>花灵会在这里等你，休息好再继续。</p>
            <button className="modal-primary" onClick={resumeGame}>继续冒险 <span>→</span></button>
            <div><button onClick={beginSession}>重新开始</button><button onClick={returnToLobby}>返回花园</button></div>
            <small className="esc-hint">按 Esc 快速继续</small>
          </div>
        </section>
      )}

      {phase === "complete" && result && (
        <section className="modal-backdrop result-backdrop" role="dialog" aria-modal="true" aria-label="本章结算">
          <div className="result-card modal-card">
            <div className="result-aura" aria-hidden="true"><i /><i /><i /></div>
            <span className="result-kicker">{result.won ? "GARDEN RESTORED" : "MAGIC DISCOVERED"}</span>
            <h2>{result.won ? "花园重新绽放啦！" : "你的魔法正在变强"}</h2>
            <p>{result.won ? `你和露米完成了「${level.title}」的守护任务。` : `再唤醒 ${Math.max(0, level.targetWords - completedWords)} 朵花，就能点亮这一章。`}</p>
            <div className="result-stars" aria-label={`获得 ${result.stars} 颗星`}>{[0, 1, 2].map((star) => <span key={star} className={star < result.stars ? "earned" : ""}>★</span>)}</div>
            <div className="result-score"><small>本局星愿积分</small><strong>{result.score}</strong><span>历史最佳 {progress.bestScores[level.id]} · +{result.xp} XP</span></div>
            <div className="result-grid">
              <span><i>◎</i><small>准确率</small><strong>{result.accuracy}%</strong></span>
              <span><i>⌁</i><small>打字速度</small><strong>{result.wpm}<em> WPM</em></strong></span>
              <span><i>✦</i><small>最高连击</small><strong>{bestCombo}×</strong></span>
              <span><i>✿</i><small>获得花瓣</small><strong>+{result.petals}</strong></span>
            </div>
            <div className="result-actions"><button onClick={beginSession}>再玩一次</button><button className="modal-primary" onClick={playNext}>{result.won && levelIndex < GARDEN_LEVELS.length - 1 ? "前往下一章" : "回到花园"}<span>→</span></button></div>
          </div>
        </section>
      )}

      {tutorialOpen && (
        <section className="modal-backdrop tutorial-backdrop" role="dialog" aria-modal="true" aria-label="新手魔法课">
          <div className="tutorial-card modal-card">
            <button className="modal-close" onClick={() => setTutorialOpen(false)} aria-label="关闭新手魔法课">×</button>
            <span className="tutorial-badge">露米的 30 秒魔法课</span><h2>三个动作，花园就会发光</h2>
            <div className="tutorial-steps">
              <span><i>01</i><b>看咒语</b><small>找到花灵上方发光的英文单词</small></span>
              <span><i>02</i><b>直接输入</b><small>不用点输入框，照着字母连续打字</small></span>
              <span><i>03</i><b>保持连击</b><small>越准确，魔杖光束和奖励越闪耀</small></span>
            </div>
            <p>打错不会扣生命，也不用删除，重新按正确字母就好。</p>
            <button className="modal-primary" onClick={completeTutorial}>我准备好啦 <span>→</span></button>
          </div>
        </section>
      )}

      {helpOpen && (
        <section className="modal-backdrop tutorial-backdrop" role="dialog" aria-modal="true" aria-label="玩法说明">
          <div className="tutorial-card help-card modal-card">
            <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭玩法说明">×</button>
            <span className="tutorial-badge">HOW TO PLAY</span><h2>为孩子设计的温和挑战</h2>
            <div className="help-list"><span><i>⌨</i><p><b>实体键盘</b><small>进入游戏后直接输入，无需点击任何输入框。</small></p></span><span><i>✦</i><p><b>准确优先</b><small>错误只会中断连击，不扣生命、不制造挫败。</small></p></span><span><i>☾</i><p><b>手机和平板</b><small>点击底部输入条即可打开系统键盘。</small></p></span></div>
            <button className="modal-primary" onClick={() => setHelpOpen(false)}>明白了</button>
          </div>
        </section>
      )}
    </main>
  );
}

"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  applyGardenResult,
  buyOrEquipCosmetic,
  calculateGardenResult,
  claimDailyReward,
  COSMETICS,
  DEFAULT_GARDEN_PROGRESS,
  evaluateTypingKey,
  GARDEN_LEVELS,
  getAdaptiveLevelWord,
  getEarnedPetals,
  getLessonAct,
  getLocalDateKey,
  getLiveScore,
  getGuardianState,
  getMissionDuration,
  getPlayerLevel,
  MISSION_RULES,
  migrateGardenProgress,
  type GardenProgress,
  type GardenResult,
  type SessionKeyStats,
} from "./game-engine";
import { AdventureHub } from "./AdventureHub";
import { KeyboardCoach } from "./KeyboardCoach";
import { ParentReport } from "./ParentReport";

const MagicGarden3D = lazy(() => import("./MagicGarden3D").then((module) => ({ default: module.MagicGarden3D })));

type Phase = "lobby" | "playing" | "paused" | "complete";
type Flash = "correct" | "wrong" | "word" | null;
type SessionSnapshot = { correctHits: number; mistakes: number; completedWords: number; bestCombo: number; elapsed: number };

const PROGRESS_KEY = "anqi-magic-garden-progress";
const TUTORIAL_KEY = "anqi-magic-garden-tutorial";
const SETTINGS_KEY = "anqi-magic-garden-settings";

function loadProgress(): GardenProgress {
  try {
    const saved = window.localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<GardenProgress>;
      return migrateGardenProgress(parsed);
    }
    const legacy = window.localStorage.getItem("anqi-typer-progress");
    if (legacy) {
      const parsed = JSON.parse(legacy) as { completed?: string[]; totalStars?: number };
      return migrateGardenProgress({
        ...DEFAULT_GARDEN_PROGRESS,
        unlocked: Math.min(3, Math.max(1, 1 + Math.floor((parsed.completed?.length ?? 0) / 2))),
        totalStars: parsed.totalStars ?? 0,
      });
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
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [toast, setToast] = useState("");
  const [wrongStreak, setWrongStreak] = useState(0);
  const [missionBonus, setMissionBonus] = useState(0);
  const [rhythmHits, setRhythmHits] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [parentReportOpen, setParentReportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const startedAt = useRef(0);
  const finishingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsResumeRef = useRef(false);
  const missionBonusRef = useRef(0);
  const lastMissionRoundRef = useRef(1);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<SessionSnapshot>({ correctHits: 0, mistakes: 0, completedWords: 0, bestCombo: 0, elapsed: 0 });
  const sessionKeyStatsRef = useRef<SessionKeyStats>({});

  const level = GARDEN_LEVELS[levelIndex];
  const word = getAdaptiveLevelWord(level, completedWords, progress.keyMastery);
  const target = word[typed.length] ?? "";
  const targetLabel = target === " " ? "空格" : target === "," ? "逗号" : target === "." ? "句号" : target === "'" ? "撇号" : target.toUpperCase();
  const missionDuration = getMissionDuration(level);
  const timeLeft = missionDuration === null ? null : Math.max(0, Math.ceil(missionDuration - elapsed));
  const score = getLiveScore(level, correctHits, mistakes, completedWords, bestCombo, missionBonus);
  const accuracy = correctHits + mistakes === 0 ? 100 : Math.round((correctHits / (correctHits + mistakes)) * 100);
  const accuracyLabel = correctHits + mistakes < 5 ? "正在热身" : `${accuracy}%`;
  const calmSession = (beginnerMode && levelIndex === 0) || MISSION_RULES[level.mission].untimed;
  const questProgress = Math.min(100, Math.round((completedWords / level.targetWords) * 100));
  const isFever = combo >= 12;
  const playerLevel = getPlayerLevel(progress.xp);
  const equippedCosmetic = COSMETICS.find((item) => item.id === progress.equippedCosmetic) ?? COSMETICS[0];
  const missionName = level.mission === "guardian" ? "守护者 Boss" : level.mission === "rhythm" ? "节奏短句" : level.mission === "firefly" ? "萤火竞速" : "花灵唤醒";
  const missionProgressCopy = level.mission === "guardian" ? "结界剩余" : level.mission === "rhythm" ? "旋律修复" : level.mission === "firefly" ? "萤火收集" : "花园净化";
  const missionProgressValue = level.mission === "guardian" ? Math.max(0, level.targetWords - completedWords) : completedWords;
  const lessonAct = getLessonAct(level, completedWords);
  const lessonActCopy = lessonAct === "learn" ? "认识新键" : lessonAct === "practice" ? "组合练习" : "剧情挑战";
  const fireflyRound = level.mission === "firefly" ? Math.min(3, Math.floor(elapsed / 22) + 1) : 1;
  const fireflyResting = level.mission === "firefly" && elapsed > 0 && elapsed % 22 >= 20;
  const guardianState = getGuardianState(level, completedWords);

  const levelLabel = useMemo(() => `${level.title}，${level.goal}`, [level]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setProgress(loadProgress());
      const systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<{ soundOn: boolean; reducedMotion: boolean; beginnerMode: boolean; largeText: boolean; highContrast: boolean }>;
        setSoundOn(saved.soundOn ?? true);
        setReducedMotion(saved.reducedMotion ?? systemReducedMotion);
        setBeginnerMode(saved.beginnerMode ?? true);
        setLargeText(saved.largeText ?? false);
        setHighContrast(saved.highContrast ?? false);
      } catch {
        setReducedMotion(systemReducedMotion);
      }
      setSettingsHydrated(true);
    });
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundOn, reducedMotion, beginnerMode, largeText, highContrast }));
    } catch {
      // Accessibility preferences still apply to the current session.
    }
  }, [beginnerMode, highContrast, largeText, reducedMotion, settingsHydrated, soundOn]);

  useEffect(() => {
    sessionRef.current = { correctHits, mistakes, completedWords, bestCombo, elapsed };
  }, [bestCombo, completedWords, correctHits, elapsed, mistakes]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (parentHoldTimer.current) clearTimeout(parentHoldTimer.current);
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
    const calculated = calculateGardenResult(level, final.correctHits, final.mistakes, elapsedSeconds, final.completedWords, final.bestCombo, missionBonusRef.current);
    const finalResult = { ...calculated, petals: getEarnedPetals(progress, level, calculated, final.completedWords) };
    setElapsed(elapsedSeconds);
    setResult(finalResult);
    setPhase("complete");
    playTone("win");
    setProgress((current) => {
      const next = applyGardenResult(current, levelIndex, finalResult, final.completedWords, final.bestCombo, getLocalDateKey(), sessionKeyStatsRef.current);
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Session result still renders when local persistence is unavailable.
      }
      return next;
    });
  }, [level, levelIndex, playTone, progress]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      const nextElapsed = (Date.now() - startedAt.current) / 1000;
      setElapsed(nextElapsed);
      if (level.mission === "firefly") {
        const round = Math.min(3, Math.floor(nextElapsed / 22) + 1);
        if (round !== lastMissionRoundRef.current) {
          lastMissionRoundRef.current = round;
          showToast(`第 ${round} 轮萤火冲刺 · 深呼吸再出发`);
        }
      }
      if (!calmSession && missionDuration !== null && nextElapsed >= missionDuration) {
        finishGame({ ...sessionRef.current, elapsed: missionDuration });
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [calmSession, finishGame, level.mission, missionDuration, phase, showToast]);

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
    setWrongStreak(0);
    setMissionBonus(0);
    setRhythmHits(0);
    missionBonusRef.current = 0;
    lastMissionRoundRef.current = 1;
    finishingRef.current = false;
    sessionRef.current = { correctHits: 0, mistakes: 0, completedWords: 0, bestCombo: 0, elapsed: 0 };
    sessionKeyStatsRef.current = {};
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

  const openSettings = useCallback(() => {
    settingsResumeRef.current = phase === "playing";
    if (phase === "playing") pauseGame();
    setSettingsOpen(true);
  }, [pauseGame, phase]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (settingsResumeRef.current) {
      settingsResumeRef.current = false;
      window.setTimeout(resumeGame, 0);
    }
  }, [resumeGame]);

  const cancelParentHold = useCallback(() => {
    if (parentHoldTimer.current) clearTimeout(parentHoldTimer.current);
    parentHoldTimer.current = null;
  }, []);

  const startParentHold = useCallback(() => {
    if (phase !== "lobby") return;
    cancelParentHold();
    parentHoldTimer.current = setTimeout(() => {
      setSettingsOpen(false);
      setParentReportOpen(true);
      parentHoldTimer.current = null;
    }, 2000);
  }, [cancelParentHold, phase]);

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

  const recordKeyAttempt = useCallback((expected: string, correct: boolean) => {
    const keys = /^[A-Z]$/.test(expected) ? ["shift", expected.toLowerCase()] : [expected === " " ? "space" : expected === "," ? "comma" : expected === "." ? "period" : expected === "'" ? "apostrophe" : expected.toLowerCase()];
    keys.forEach((key) => {
      const previous = sessionKeyStatsRef.current[key] ?? { attempts: 0, correct: 0, bestStreak: 0 };
      const nextCorrect = previous.correct + (correct ? 1 : 0);
      sessionKeyStatsRef.current[key] = {
        attempts: previous.attempts + 1,
        correct: nextCorrect,
        bestStreak: correct ? Math.max(previous.bestStreak, combo + 1) : previous.bestStreak,
      };
    });
  }, [combo]);

  const addMissionBonus = useCallback((amount: number) => {
    missionBonusRef.current += amount;
    setMissionBonus(missionBonusRef.current);
  }, []);

  const handleKey = useCallback((key: string) => {
    if (phase !== "playing" || finishingRef.current || !target || fireflyResting) return;
    const outcome = evaluateTypingKey(word, typed.length, key);
    if (outcome === "correct" || outcome === "complete") {
      const nextCorrect = correctHits + 1;
      const nextCombo = combo + 1;
      const nextBest = Math.max(bestCombo, nextCombo);
      const nextTyped = typed + target;
      recordKeyAttempt(target, true);
      if (level.mission === "rhythm") {
        const beat = ((Date.now() - startedAt.current) / 1000) % 1;
        if (beat <= 0.2 || beat >= 0.8) {
          setRhythmHits((current) => current + 1);
          addMissionBonus(25);
          if ((rhythmHits + 1) % 5 === 0) showToast("完美拍点 · 月光和弦 +125");
        }
      } else if (level.mission === "firefly" && outcome === "complete") {
        addMissionBonus(15 * fireflyRound);
      } else if (level.mission === "guardian" && outcome === "complete") {
        addMissionBonus(30 + Math.min(70, nextCombo * 2));
      } else if (level.mission === "bloom" && outcome === "complete") {
        addMissionBonus(mistakes === 0 ? 20 : 8);
      }
      setCorrectHits(nextCorrect);
      setCombo(nextCombo);
      setBestCombo(nextBest);
      setWrongStreak(0);
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
        if (level.mission === "guardian" && (nextCompleted === Math.ceil(level.targetWords / 3) || nextCompleted === Math.ceil(level.targetWords * 2 / 3))) showToast("护盾破裂 · Boss 进入下一阶段");
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
      recordKeyAttempt(target, false);
      setMistakes((current) => current + 1);
      setCombo(0);
      setWrongStreak((current) => {
        const next = current + 1;
        if (next === 2) showToast(`慢一点，用正确手指找到 ${targetLabel}`);
        if (next >= 3) showToast(`露米提示：先看高亮键 ${targetLabel}，按对再继续`);
        return next;
      });
      playTone("wrong");
      showFlash("wrong");
    }
  }, [addMissionBonus, bestCombo, combo, completedWords, correctHits, finishGame, fireflyResting, fireflyRound, level.mission, level.targetWords, mistakes, phase, playTone, recordKeyAttempt, reducedMotion, rhythmHits, showFlash, showToast, target, targetLabel, typed, word]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (settingsOpen && event.key === "Escape") {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (parentReportOpen && event.key === "Escape") {
        event.preventDefault();
        setParentReportOpen(false);
        return;
      }
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
  }, [closeSettings, handleKey, helpOpen, parentReportOpen, pauseGame, phase, requestStart, resumeGame, settingsOpen, tutorialOpen]);

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
    setReviewMode(false);
    setLevelIndex(index);
  };

  const startReview = (index: number) => {
    if (index >= progress.unlocked || phase !== "lobby") return;
    setLevelIndex(index);
    setReviewMode(true);
    window.setTimeout(beginSession, 0);
  };

  const playNext = () => {
    if (reviewMode) {
      setReviewMode(false);
      returnToLobby();
      return;
    }
    const next = Math.min(GARDEN_LEVELS.length - 1, levelIndex + 1);
    if (result?.won && next !== levelIndex) setLevelIndex(next);
    setPhase("lobby");
    setResult(null);
    setTyped("");
  };

  return (
    <main className={`magic-game phase-${phase} level-${level.id} mission-${level.mission} ${flash ? `flash-${flash}` : ""} ${combo >= 10 ? "combo-bright" : combo >= 5 ? "combo-awake" : ""} ${isFever ? "fever-mode" : ""} ${largeText ? "child-text-large" : ""} ${highContrast ? "high-contrast" : ""}`}>
      {phase === "lobby" ? <div className="garden-stage lobby-scene-fallback" aria-hidden="true" /> : (
        <Suspense fallback={<div className="garden-stage garden-loading" aria-hidden="true"><span>✦</span></div>}>
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
        </Suspense>
      )}
      {phase !== "lobby" && (
        <div className="character-cast" aria-hidden="true">
          <span className="anqi-character"><Image src="/characters/anqi-v2.webp" alt="" width={575} height={1100} draggable={false} priority unoptimized /></span>
          <span className="lumi-character"><Image src="/characters/lumi-v2.webp" alt="" width={312} height={760} draggable={false} unoptimized /></span>
          <span className="flower-character"><Image src="/characters/flower-spirit-v2.webp" alt="" width={644} height={520} draggable={false} unoptimized /></span>
          <i className="spell-ray" />
          <i className="world-response" />
        </div>
      )}
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
          <button className="settings-action" onClick={settingsOpen ? closeSettings : openSettings} aria-label="游戏设置">⚙</button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-popover" aria-label="游戏设置">
          <div><strong>儿童辅助设置</strong><button onClick={closeSettings} aria-label="关闭设置">×</button></div>
          <label><span>魔法音效<small>按键、连击和过关提示</small></span><input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /></label>
          <label><span>柔和动画<small>减少镜头与粒子运动</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
          <label><span>轻松启蒙<small>第一关不倒计时，先学会再提速</small></span><input type="checkbox" checked={beginnerMode} onChange={(event) => setBeginnerMode(event.target.checked)} /></label>
          <label><span>大字模式<small>放大提示和学习信息</small></span><input type="checkbox" checked={largeText} onChange={(event) => setLargeText(event.target.checked)} /></label>
          <label><span>高对比按键<small>增强目标键、文字与焦点边界</small></span><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} /></label>
          <button
            type="button"
            className="parent-access"
            disabled={phase !== "lobby"}
            onPointerDown={startParentHold}
            onPointerUp={cancelParentHold}
            onPointerCancel={cancelParentHold}
            onPointerLeave={cancelParentHold}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSettingsOpen(false);
                setParentReportOpen(true);
              }
            }}
          ><span>家长学习报告<small>{phase === "lobby" ? "按住 2 秒进入，避免孩子误触" : "返回花园后可查看"}</small></span><b>按住查看</b></button>
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

          <AdventureHub progress={progress} levelIndex={levelIndex} onChooseLevel={chooseLevel} onStart={requestStart} onStartReview={startReview} onClaimDaily={claimDaily} onCosmetic={chooseCosmetic} />
        </section>
      )}
      {phase === "lobby" && toast && <div className="hub-toast" aria-live="polite">{toast}</div>}

      {(phase === "playing" || phase === "paused") && (
        <section className="play-interface" aria-label="花园打字游戏">
          <div className="quest-hud">
            <div className="quest-copy"><span>{missionProgressCopy}</span><strong>{missionProgressValue}<i>/{level.targetWords}</i></strong></div>
            <div className="quest-track" aria-label={`${levelLabel}，完成 ${questProgress}%`}><i style={{ width: `${questProgress}%` }} /><span style={{ left: `calc(${questProgress}% - 9px)` }}>✿</span></div>
            <small>{lessonActCopy} · 本课新键 {level.newKeys.map((key) => key === "space" ? "空格" : key === "shift" ? "Shift" : key === "comma" ? "," : key === "period" ? "." : key === "apostrophe" ? "'" : key.toUpperCase()).join(" · ")}</small>
          </div>
          <div className="session-hud">
            <span><small>{calmSession ? "学习模式" : "剩余时间"}</small><b className={!calmSession && timeLeft !== null && timeLeft <= 10 ? "danger" : ""}>{calmSession ? "∞" : timeLeft}{!calmSession && <i>s</i>}</b></span>
            <span><small>星愿积分</small><b>{score}</b></span>
            <button onClick={pauseGame} aria-label="暂停游戏">Ⅱ</button>
          </div>

          <div className={`combo-ribbon ${combo >= 5 ? "active" : ""}`}>
            <small>MAGIC COMBO</small><strong>{combo}<i>×</i></strong><span>{isFever ? "星愿时刻" : combo >= 5 ? "魔力上升" : "连续输入积蓄魔力"}</span>
          </div>

          <div className={`mission-mechanic mechanic-${level.mission}`} aria-live="polite">
            {level.mission === "bloom" && <><span className="mechanic-icon">❀</span><div><small>花朵成长</small><strong>{completedWords}/{level.targetWords}</strong><i style={{ width: `${questProgress}%` }} /></div><b>稳定输入，不限时间</b></>}
            {level.mission === "firefly" && <><span className="mechanic-icon">✦</span><div><small>萤火冲刺 · 第 {fireflyRound}/3 轮</small><strong>{fireflyResting ? "休息一下" : "追光中"}</strong><i style={{ width: `${Math.min(100, ((elapsed % 22) / 20) * 100)}%` }} /></div><b>光能 +{missionBonus}</b></>}
            {level.mission === "rhythm" && <><span className="mechanic-icon beat-orb">♫</span><div><small>月光节拍</small><strong>{rhythmHits} 次完美拍点</strong><i className="beat-track" /></div><b>奖励 +{missionBonus}</b></>}
            {level.mission === "guardian" && <><span className="mechanic-icon boss-core">♛</span><div><small>守护者 · 第 {guardianState.phase}/3 阶段</small><strong>护盾 {guardianState.hpPercent}%</strong><i style={{ width: `${guardianState.hpPercent}%` }} /></div><b>蓄力 +{missionBonus}</b></>}
          </div>

          {level.mission === "bloom" && (
            <div className="garden-growth" aria-hidden="true">
              {Array.from({ length: level.targetWords }, (_, index) => <i key={index} className={index < completedWords ? "awake" : ""} />)}
            </div>
          )}

          <div className="spell-console">
            <span className="spell-label"><i /> {reviewMode ? "露米弱键复习" : missionName}</span>
            <div className="spell-word" aria-live="polite" aria-label={`目标单词 ${word}`}>
                  {word.split("").map((letter, index) => <span key={`${completedWords}-${index}`} className={index < typed.length ? "done" : index === typed.length ? "current" : ""}>{letter === " " ? "·" : letter}</span>)}
            </div>
            <div className="spell-meta">
              <span>下一键 <kbd>{targetLabel}</kbd></span>
              <div><i style={{ width: `${Math.round((typed.length / word.length) * 100)}%` }} /></div>
              <span>稳定度 <b>{accuracyLabel}</b></span>
            </div>
            <label className="mobile-type-box">
              <span>点这里打开手机键盘</span>
              <input ref={mobileInputRef} value="" onChange={(event) => handleKey(event.target.value.slice(-1))} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" aria-label="手机打字输入框" />
            </label>
            <KeyboardCoach target={target} learnedKeys={level.learnedKeys} newKeys={level.newKeys} wrongStreak={wrongStreak} />
          </div>
          {flash === "word" && <div className="word-burst" aria-live="polite">PERFECT SPELL <span>✦</span></div>}
          {toast && <div className="game-toast" aria-live="polite">{toast}</div>}
          <span className="sr-only" aria-live="assertive">{flash === "wrong" ? "字母不对，再试一次" : flash === "correct" ? "正确" : ""}</span>
        </section>
      )}

      {phase === "paused" && !settingsOpen && (
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
            <div className="result-score"><small>本局星愿积分</small><strong>{result.score}</strong><span>任务奖励 +{result.missionBonus} · 历史最佳 {progress.bestScores[level.id]} · +{result.xp} XP</span></div>
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
              <span><i>01</i><b>坐稳放松</b><small>背部自然挺直，肩膀和手腕都放松</small></span>
              <span><i>02</i><b>找到 F 和 J</b><small>左右食指轻放在两个有凸点的按键上</small></span>
              <span><i>03</i><b>慢慢按对</b><small>看高亮键，用提示的手指轻轻按下</small></span>
            </div>
            <p>第一关没有倒计时。打错不会扣生命，露米会陪你重新找到正确按键。</p>
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

      {parentReportOpen && <ParentReport progress={progress} onClose={() => setParentReportOpen(false)} />}
    </main>
  );
}

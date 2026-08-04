"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import {
  applyGardenResult,
  buyOrEquipCosmetic,
  calculateGardenResult,
  claimDailyReward,
  COSMETICS,
  DEFAULT_GARDEN_PROGRESS,
  evaluateTypingKey,
  FIREFLY_ACTIVE_SECONDS,
  FIREFLY_ROUND_SECONDS,
  GARDEN_LEVELS,
  getAdaptiveLevelWord,
  getEarnedPetals,
  getLessonAct,
  getLocalDateKey,
  getLiveScore,
  getGuardianState,
  getMissionDuration,
  getPlayerLevel,
  getSessionSupport,
  LEVEL_MECHANICS,
  mergeKeyMastery,
  MISSION_RULES,
  migrateGardenProgress,
  type GardenProgress,
  type GardenResult,
  type SessionKeyStats,
} from "./game-engine";
import { AdventureHub } from "./AdventureHub";
import {
  getCompletedEncounterCount,
  getEndlessBiome,
  getEndlessEncounter,
  getEndlessEncounterProgress,
  getEndlessReward,
  getEncounterProgress,
  getExplorationEncounter,
  isEndlessBoundary,
  isExplorationBoundary,
  type ExplorationEncounterId,
} from "./exploration-engine";
import type { ExplorationWorldStatus } from "./ExplorationWorld3D";
import { getKeyMovement, KeyboardCoach } from "./KeyboardCoach";
import { ParentReport } from "./ParentReport";

const MagicGarden3D = lazy(() => import("./MagicGarden3D").then((module) => ({ default: module.MagicGarden3D })));
const ExplorationWorld3D = lazy(() => import("./ExplorationWorld3D").then((module) => ({ default: module.ExplorationWorld3D })));

type Phase = "lobby" | "exploring" | "playing" | "paused" | "complete";
type Flash = "correct" | "wrong" | "word" | null;
type SessionSnapshot = { correctHits: number; mistakes: number; completedWords: number; bestCombo: number; elapsed: number };
type LearnerProfile = { id: string; name: string; createdAt: number };
type ProgressBackup = { format: "anqi-typer-backup"; version: 1; profiles: LearnerProfile[]; activeProfileId: string; progressByProfile: Record<string, GardenProgress> };

const PROGRESS_KEY = "anqi-magic-garden-progress";
const TUTORIAL_KEY = "anqi-magic-garden-tutorial";
const SETTINGS_KEY = "anqi-magic-garden-settings";
const PROFILES_KEY = "anqi-magic-garden-profiles";
const ACTIVE_PROFILE_KEY = "anqi-magic-garden-active-profile";
const DEFAULT_PROFILE: LearnerProfile = { id: "default", name: "安琪", createdAt: 0 };

function profileProgressKey(profileId: string): string {
  return profileId === DEFAULT_PROFILE.id ? PROGRESS_KEY : `${PROGRESS_KEY}:${profileId}`;
}

function loadProfiles(): LearnerProfile[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "[]") as Partial<LearnerProfile>[];
    const valid = parsed.filter((profile) => typeof profile.id === "string" && typeof profile.name === "string").slice(0, 3).map((profile) => ({ id: profile.id as string, name: (profile.name as string).trim().slice(0, 8) || "小魔法师", createdAt: typeof profile.createdAt === "number" ? profile.createdAt : 0 }));
    if (valid.length) return valid;
  } catch {
    // Fall back to the original learner profile.
  }
  return [DEFAULT_PROFILE];
}

function loadProgress(profileId = DEFAULT_PROFILE.id): GardenProgress {
  try {
    const saved = window.localStorage.getItem(profileProgressKey(profileId));
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<GardenProgress>;
      return migrateGardenProgress(parsed);
    }
    const legacy = profileId === DEFAULT_PROFILE.id ? window.localStorage.getItem("anqi-typer-progress") : null;
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
  const [profiles, setProfiles] = useState<LearnerProfile[]>([DEFAULT_PROFILE]);
  const [activeProfileId, setActiveProfileId] = useState(DEFAULT_PROFILE.id);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
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
  const [endlessMode, setEndlessMode] = useState(false);
  const [endlessWords, setEndlessWords] = useState(0);
  const [worldStatus, setWorldStatus] = useState<ExplorationWorldStatus>({ distance: 0, zone: 1, biome: "樱风原野", movingByClick: false });
  const [parentReportOpen, setParentReportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pausedFrom, setPausedFrom] = useState<"exploring" | "playing">("playing");
  const startedAt = useRef(0);
  const finishingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsResumeRef = useRef(false);
  const reviewModeRef = useRef(false);
  const missionBonusRef = useRef(0);
  const lastMissionRoundRef = useRef(1);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<SessionSnapshot>({ correctHits: 0, mistakes: 0, completedWords: 0, bestCombo: 0, elapsed: 0 });
  const sessionKeyStatsRef = useRef<SessionKeyStats>({});

  const level = GARDEN_LEVELS[levelIndex];
  const isExplorationPrototype = level.id === "petal-gate" && !reviewMode;
  const explorationEncounter = endlessMode ? getEndlessEncounter(endlessWords) : getExplorationEncounter(completedWords);
  const explorationProgress = endlessMode ? getEndlessEncounterProgress(endlessWords) : getEncounterProgress(completedWords);
  const explorationStations = endlessMode ? Math.floor(endlessWords / 5) : getCompletedEncounterCount(completedWords);
  const pausedFromExploration = phase === "paused" && pausedFrom === "exploring";
  const showTypingInterface = phase === "playing" || (phase === "paused" && !pausedFromExploration);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? DEFAULT_PROFILE;
  const word = getAdaptiveLevelWord(level, endlessMode ? level.targetWords + endlessWords : completedWords, progress.keyMastery);
  const target = word[typed.length] ?? "";
  const targetLabel = target === " " ? "空格" : target === "," ? "逗号" : target === "." ? "句号" : target === "'" ? "撇号" : target.toUpperCase();
  const missionDuration = getMissionDuration(level);
  const timeLeft = missionDuration === null ? null : Math.max(0, Math.ceil(missionDuration - elapsed));
  const score = getLiveScore(level, correctHits, mistakes, completedWords, bestCombo, missionBonus);
  const calmSession = (beginnerMode && levelIndex === 0) || MISSION_RULES[level.mission].untimed;
  const questProgress = Math.min(100, Math.round((completedWords / level.targetWords) * 100));
  const isFever = combo >= 12;
  const playerLevel = getPlayerLevel(progress.xp);
  const equippedCosmetic = COSMETICS.find((item) => item.id === progress.equippedCosmetic) ?? COSMETICS[0];
  const missionName = level.mission === "guardian" ? "守护者 Boss" : level.mission === "rhythm" ? "节奏挑战" : level.mission === "firefly" ? "萤火竞速" : "精准修复";
  const missionProgressCopy = level.mission === "guardian" ? "结界剩余" : level.mission === "rhythm" ? "旋律修复" : level.mission === "firefly" ? "萤火收集" : "花园净化";
  const missionProgressValue = level.mission === "guardian" ? Math.max(0, level.targetWords - completedWords) : completedWords;
  const lessonAct = getLessonAct(level, completedWords);
  const lessonActCopy = lessonAct === "learn" ? "认识新键" : lessonAct === "practice" ? "组合练习" : "剧情挑战";
  const fireflyRound = level.mission === "firefly" ? Math.min(3, Math.floor(elapsed / FIREFLY_ROUND_SECONDS) + 1) : 1;
  const fireflyResting = level.mission === "firefly" && elapsed > 0 && elapsed % FIREFLY_ROUND_SECONDS >= FIREFLY_ACTIVE_SECONDS;
  const guardianState = getGuardianState(level, completedWords);
  const levelMechanic = LEVEL_MECHANICS[level.id];
  const sessionSupport = getSessionSupport(correctHits, mistakes, wrongStreak);
  const sessionSupportText = correctHits + mistakes < 5 ? "正在热身" : sessionSupport.label;
  const trainingRank = !result ? "" : result.accuracy >= 97 && bestCombo >= 20 ? "S · 精准控制" : result.accuracy >= 90 ? "A · 稳定推进" : result.won ? "B · 成功通关" : "继续校准";

  const levelLabel = useMemo(() => `${level.title}，${level.goal}`, [level]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedProfiles = loadProfiles();
      let storedActiveId: string | null = null;
      try {
        storedActiveId = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
      } catch {
        // The default profile remains available without storage access.
      }
      const storedActive = storedProfiles.some((profile) => profile.id === storedActiveId) ? storedActiveId as string : storedProfiles[0].id;
      setProfiles(storedProfiles);
      setActiveProfileId(storedActive);
      setProgress(loadProgress(storedActive));
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
        window.localStorage.setItem(profileProgressKey(activeProfileId), JSON.stringify(next));
      } catch {
        // Session result still renders when local persistence is unavailable.
      }
      return next;
    });
  }, [activeProfileId, level, levelIndex, playTone, progress]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "exploring") return;
    const timer = window.setInterval(() => {
      const nextElapsed = (Date.now() - startedAt.current) / 1000;
      setElapsed(nextElapsed);
      if (level.mission === "firefly") {
        const round = Math.min(3, Math.floor(nextElapsed / FIREFLY_ROUND_SECONDS) + 1);
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
    setEndlessMode(false);
    setEndlessWords(0);
    setWorldStatus({ distance: 0, zone: 1, biome: "樱风原野", movingByClick: false });
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
    const exploreFirst = level.id === "petal-gate" && !reviewModeRef.current;
    setPausedFrom(exploreFirst ? "exploring" : "playing");
    setPhase(exploreFirst ? "exploring" : "playing");
    if (!exploreFirst) window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), 120);
  }, [level.id]);

  const startEndlessWorld = useCallback(() => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    reviewModeRef.current = false;
    setReviewMode(false);
    setLevelIndex(0);
    setEndlessMode(true);
    setEndlessWords(0);
    setWorldStatus({ distance: 0, zone: 1, biome: getEndlessBiome(0).name, movingByClick: false });
    setTyped("");
    setCorrectHits(0);
    setMistakes(0);
    setCombo(0);
    setBestCombo(0);
    setCompletedWords(GARDEN_LEVELS[0].targetWords);
    setElapsed(0);
    setResult(null);
    setFlash(null);
    setWrongStreak(0);
    setMissionBonus(0);
    setRhythmHits(0);
    missionBonusRef.current = 0;
    finishingRef.current = false;
    sessionRef.current = { correctHits: 0, mistakes: 0, completedWords: 0, bestCombo: 0, elapsed: 0 };
    sessionKeyStatsRef.current = {};
    startedAt.current = Date.now();
    setPausedFrom("exploring");
    setPhase("exploring");
    showToast("无限世界已开启 · 点击路面即可自动前往");
  }, [showToast]);

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
    if (phase !== "playing" && phase !== "exploring") return;
    const nowElapsed = (Date.now() - startedAt.current) / 1000;
    setElapsed(nowElapsed);
    setPausedFrom(phase);
    setPhase("paused");
  }, [phase]);

  const resumeGame = useCallback(() => {
    startedAt.current = Date.now() - elapsed * 1000;
    setPhase(pausedFrom);
    if (pausedFrom === "playing") window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), 100);
  }, [elapsed, pausedFrom]);

  const openSettings = useCallback(() => {
    settingsResumeRef.current = phase === "playing" || phase === "exploring";
    if (phase === "playing" || phase === "exploring") pauseGame();
    setProfileOpen(false);
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
    reviewModeRef.current = false;
    setReviewMode(false);
    setEndlessMode(false);
    setEndlessWords(0);
    setPhase("lobby");
    setTyped("");
    setResult(null);
    setSettingsOpen(false);
    setProfileOpen(false);
  }, []);

  const updateProgress = useCallback((updater: (current: GardenProgress) => GardenProgress) => {
    setProgress((current) => {
      const next = updater(current);
      try {
        window.localStorage.setItem(profileProgressKey(activeProfileId), JSON.stringify(next));
      } catch {
        // In-memory progress still works when browser storage is unavailable.
      }
      return next;
    });
  }, [activeProfileId]);

  const saveProfiles = useCallback((nextProfiles: LearnerProfile[]) => {
    setProfiles(nextProfiles);
    try {
      window.localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles));
    } catch {
      // Profiles remain usable for the current session.
    }
  }, []);

  const switchProfile = useCallback((profileId: string) => {
    if (phase !== "lobby" || !profiles.some((profile) => profile.id === profileId)) return;
    setActiveProfileId(profileId);
    setProgress(loadProgress(profileId));
    setLevelIndex(0);
    setReviewMode(false);
    setProfileOpen(false);
    try {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    } catch {
      // The selected profile still applies to this session.
    }
    const nextName = profiles.find((profile) => profile.id === profileId)?.name ?? "小魔法师";
    showToast(`已切换到 ${nextName} 的花园`);
  }, [phase, profiles, showToast]);

  const createProfile = useCallback(() => {
    const name = newProfileName.trim().slice(0, 8);
    if (!name || profiles.length >= 3) return;
    const profile: LearnerProfile = { id: `child-${Date.now().toString(36)}`, name, createdAt: Date.now() };
    const nextProfiles = [...profiles, profile];
    saveProfiles(nextProfiles);
    try {
      window.localStorage.setItem(profileProgressKey(profile.id), JSON.stringify(DEFAULT_GARDEN_PROGRESS));
    } catch {
      // The new profile starts in memory when storage is unavailable.
    }
    setNewProfileName("");
    setActiveProfileId(profile.id);
    setProgress(DEFAULT_GARDEN_PROGRESS);
    setLevelIndex(0);
    try {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    } catch {
      // The new profile remains active for this session.
    }
    showToast(`${name} 的专属花园已经准备好`);
  }, [newProfileName, profiles, saveProfiles, showToast]);

  const exportBackup = useCallback(() => {
    const progressByProfile = Object.fromEntries(profiles.map((profile) => [profile.id, profile.id === activeProfileId ? progress : loadProgress(profile.id)]));
    const backup: ProgressBackup = { format: "anqi-typer-backup", version: 1, profiles, activeProfileId, progressByProfile };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `安琪打字机-学习备份-${getLocalDateKey()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("学习备份已导出到下载文件夹");
  }, [activeProfileId, profiles, progress, showToast]);

  const importBackup = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as Partial<ProgressBackup>;
      if (raw.format !== "anqi-typer-backup" || raw.version !== 1 || !Array.isArray(raw.profiles) || !raw.progressByProfile) throw new Error("invalid backup");
      const restoredProfiles = raw.profiles.filter((profile) => typeof profile.id === "string" && typeof profile.name === "string").slice(0, 3).map((profile) => ({ id: profile.id, name: profile.name.trim().slice(0, 8) || "小魔法师", createdAt: typeof profile.createdAt === "number" ? profile.createdAt : 0 }));
      if (!restoredProfiles.length) throw new Error("empty backup");
      restoredProfiles.forEach((profile) => window.localStorage.setItem(profileProgressKey(profile.id), JSON.stringify(migrateGardenProgress(raw.progressByProfile?.[profile.id]))));
      const restoredActive = restoredProfiles.some((profile) => profile.id === raw.activeProfileId) ? raw.activeProfileId as string : restoredProfiles[0].id;
      window.localStorage.setItem(PROFILES_KEY, JSON.stringify(restoredProfiles));
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, restoredActive);
      setProfiles(restoredProfiles);
      setActiveProfileId(restoredActive);
      setProgress(loadProgress(restoredActive));
      setLevelIndex(0);
      setProfileOpen(false);
      showToast("学习备份恢复成功");
    } catch {
      showToast("这个文件不是有效的安琪打字机备份");
    }
  }, [showToast]);

  const resetCurrentProfile = useCallback(() => {
    setProgress(DEFAULT_GARDEN_PROGRESS);
    setLevelIndex(0);
    setReviewMode(false);
    setResetConfirmOpen(false);
    try {
      window.localStorage.setItem(profileProgressKey(activeProfileId), JSON.stringify(DEFAULT_GARDEN_PROGRESS));
    } catch {
      // Reset still applies to the current session.
    }
    showToast(`${activeProfile.name} 的花园已重新开始`);
  }, [activeProfile.name, activeProfileId, showToast]);

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

  const beginExplorationEncounter = useCallback((encounterId: ExplorationEncounterId) => {
    const encounter = endlessMode ? getEndlessEncounter(endlessWords) : getExplorationEncounter(completedWords);
    if (phase !== "exploring" || !isExplorationPrototype || encounter?.id !== encounterId) return;
    startedAt.current = Date.now() - elapsed * 1000;
    setPausedFrom("playing");
    setTyped("");
    setPhase("playing");
    showToast(`${encounter.title} · 完成 5 个咒语`);
    window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), 100);
  }, [completedWords, elapsed, endlessMode, endlessWords, isExplorationPrototype, phase, showToast]);

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
        const nextEndlessWords = endlessWords + 1;
        if (endlessMode) setEndlessWords(nextEndlessWords);
        else setCompletedWords(nextCompleted);
        setTyped("");
        showFlash("word");
        playTone("word");
        if (!endlessMode && nextCompleted === 5 && !isExplorationPrototype) showToast("第一阶段完成 · 指法和节奏正在稳定");
        if (!endlessMode && nextCompleted === Math.ceil(level.targetWords / 2)) showToast("旅程过半 · 月兔为你加油");
        if (!endlessMode && level.mission === "guardian" && (nextCompleted === Math.ceil(level.targetWords / 3) || nextCompleted === Math.ceil(level.targetWords * 2 / 3))) showToast("护盾破裂 · Boss 进入下一阶段");
        if (!endlessMode && nextCompleted >= level.targetWords) {
          const snapshot = { correctHits: nextCorrect, mistakes, completedWords: nextCompleted, bestCombo: nextBest, elapsed: (Date.now() - startedAt.current) / 1000 };
          sessionRef.current = snapshot;
          finishingRef.current = true;
          finishTimer.current = setTimeout(() => {
            finishingRef.current = false;
            finishGame(snapshot);
          }, reducedMotion ? 80 : 650);
        } else if (!endlessMode && isExplorationPrototype && isExplorationBoundary(nextCompleted)) {
          const completedEncounter = getExplorationEncounter(nextCompleted - 1);
          const snapshot = { correctHits: nextCorrect, mistakes, completedWords: nextCompleted, bestCombo: nextBest, elapsed: (Date.now() - startedAt.current) / 1000 };
          sessionRef.current = snapshot;
          finishingRef.current = true;
          finishTimer.current = setTimeout(() => {
            finishingRef.current = false;
            setPausedFrom("exploring");
            setPhase("exploring");
            showToast(completedEncounter?.success ?? "机关已开启，继续向前探索");
          }, reducedMotion ? 100 : 560);
        } else if (endlessMode && isEndlessBoundary(nextEndlessWords)) {
          const completedEncounter = getEndlessEncounter(nextEndlessWords - 1);
          const eventIndex = Math.floor(nextEndlessWords / 5) - 1;
          const reward = getEndlessReward(eventIndex);
          const snapshot = { correctHits: nextCorrect, mistakes, completedWords: nextEndlessWords, bestCombo: nextBest, elapsed: (Date.now() - startedAt.current) / 1000 };
          sessionRef.current = snapshot;
          updateProgress((current) => {
            const date = getLocalDateKey();
            const daily = current.daily.date === date ? current.daily : { date, words: 0, sessions: 0, claimed: false };
            return {
              ...current,
              petals: current.petals + reward.petals,
              xp: current.xp + reward.xp,
              totalWords: current.totalWords + 5,
              keyMastery: mergeKeyMastery(current.keyMastery, sessionKeyStatsRef.current),
              daily: { ...daily, words: daily.words + 5 },
              endless: { bestDistance: Math.max(current.endless.bestDistance, worldStatus.distance), bestEvents: Math.max(current.endless.bestEvents, eventIndex + 1) },
            };
          });
          sessionKeyStatsRef.current = {};
          finishingRef.current = true;
          finishTimer.current = setTimeout(() => {
            finishingRef.current = false;
            setPausedFrom("exploring");
            setPhase("exploring");
            showToast(`${completedEncounter.success} · +${reward.petals} 花瓣`);
          }, reducedMotion ? 100 : 560);
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
        if (next === 2) showToast(`${getKeyMovement(target)}，按完立即归位`);
        if (next >= 3) showToast(`先看屏幕上的 ${targetLabel}，不要低头找键`);
        return next;
      });
      playTone("wrong");
      showFlash("wrong");
    }
  }, [addMissionBonus, bestCombo, combo, completedWords, correctHits, endlessMode, endlessWords, finishGame, fireflyResting, fireflyRound, isExplorationPrototype, level.mission, level.targetWords, mistakes, phase, playTone, recordKeyAttempt, reducedMotion, rhythmHits, showFlash, showToast, target, targetLabel, typed, updateProgress, word, worldStatus.distance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (settingsOpen && event.key === "Escape") {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (profileOpen && event.key === "Escape") {
        event.preventDefault();
        setProfileOpen(false);
        return;
      }
      if (parentReportOpen && event.key === "Escape") {
        event.preventDefault();
        setParentReportOpen(false);
        return;
      }
      const interactiveTarget = event.target instanceof HTMLElement && ["BUTTON", "INPUT", "A"].includes(event.target.tagName);
      if (phase === "lobby" && event.key === "Enter" && !tutorialOpen && !helpOpen && !settingsOpen && !profileOpen && !interactiveTarget) {
        event.preventDefault();
        requestStart();
      } else if ((phase === "playing" || phase === "exploring") && event.key === "Escape") {
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
  }, [closeSettings, handleKey, helpOpen, parentReportOpen, pauseGame, phase, profileOpen, requestStart, resumeGame, settingsOpen, tutorialOpen]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && (phase === "playing" || phase === "exploring")) pauseGame();
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
    reviewModeRef.current = false;
    setReviewMode(false);
    setLevelIndex(index);
  };

  const startReview = (index: number) => {
    if (index >= progress.unlocked || phase !== "lobby") return;
    setLevelIndex(index);
    reviewModeRef.current = true;
    setReviewMode(true);
    window.setTimeout(beginSession, 0);
  };

  const playNext = () => {
    if (reviewMode) {
      reviewModeRef.current = false;
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
    <main className={`magic-game phase-${phase} level-${level.id} mission-${level.mission} ${isExplorationPrototype ? "exploration-active" : ""} ${flash ? `flash-${flash}` : ""} ${combo >= 10 ? "combo-bright" : combo >= 5 ? "combo-awake" : ""} ${isFever ? "fever-mode" : ""} ${largeText ? "child-text-large" : ""} ${highContrast ? "high-contrast" : ""}`}>
      {phase === "lobby" ? <div className="garden-stage lobby-scene-fallback" aria-hidden="true" /> : (
        <Suspense fallback={<div className="garden-stage garden-loading" aria-hidden="true"><span>✦</span></div>}>
          {isExplorationPrototype ? (
            <ExplorationWorld3D
              mode={phase === "exploring" ? "explore" : phase === "playing" ? "encounter" : phase === "complete" ? "complete" : "paused"}
              completedWords={completedWords}
              endlessMode={endlessMode}
              endlessWords={endlessWords}
              reducedMotion={reducedMotion}
              cosmeticColor={equippedCosmetic.color}
              feedback={flash}
              onEncounter={beginExplorationEncounter}
              onCheckpoint={showToast}
              onWorldStatus={setWorldStatus}
            />
          ) : (
            <MagicGarden3D
              phase={phase === "exploring" ? "playing" : phase}
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
          )}
        </Suspense>
      )}
      {phase !== "lobby" && !isExplorationPrototype && (
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
          <div className="profile-cluster">
            <button className="learner-pill" onClick={() => { setSettingsOpen(false); setProfileOpen((current) => !current); }} aria-expanded={profileOpen} aria-label="切换儿童档案"><i>{activeProfile.name.slice(0, 1)}</i><span><small>正在学习</small><b>{activeProfile.name}</b></span><em>⌄</em></button>
            <div className="profile-strip" aria-label="成长记录">
              <span><i>✿</i><b>{progress.petals}</b><small>花瓣</small></span>
              <span><i>★</i><b>{progress.totalStars}</b><small>星星</small></span>
              <span className="player-badge"><i>{playerLevel}</i><b>花语魔法师</b></span>
            </div>
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

      {phase === "lobby" && profileOpen && (
        <section className="profile-popover" aria-label="儿童学习档案">
          <div><span><small>DEVICE PROFILES</small><strong>选择谁来学习</strong></span><button onClick={() => setProfileOpen(false)} aria-label="关闭儿童档案">×</button></div>
          <div className="profile-list">{profiles.map((profile) => <button key={profile.id} className={profile.id === activeProfileId ? "active" : ""} onClick={() => switchProfile(profile.id)}><i>{profile.name.slice(0, 1)}</i><span><strong>{profile.name}</strong><small>{profile.id === activeProfileId ? "当前花园" : "切换到独立进度"}</small></span><b>{profile.id === activeProfileId ? "✓" : "→"}</b></button>)}</div>
          {profiles.length < 3 ? <form onSubmit={(event) => { event.preventDefault(); createProfile(); }}><input value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} maxLength={8} placeholder="输入孩子昵称" aria-label="新儿童昵称" /><button type="submit" disabled={!newProfileName.trim()}>创建花园</button></form> : <p>本机最多保留 3 位孩子的独立进度。</p>}
          <small className="profile-privacy">🔒 档案和学习数据只保存在本机。</small>
        </section>
      )}

      {settingsOpen && (
        <section className="settings-popover" aria-label="游戏设置">
          <div><strong>儿童辅助设置</strong><button onClick={closeSettings} aria-label="关闭设置">×</button></div>
          <label><span>魔法音效<small>按键、连击和过关提示</small></span><input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /></label>
          <label><span>柔和动画<small>减少镜头与粒子运动</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
          <label><span>指法优先模式<small>第一关不限时，准确掌握后再提速</small></span><input type="checkbox" checked={beginnerMode} onChange={(event) => setBeginnerMode(event.target.checked)} /></label>
          <label><span>大字模式<small>放大提示和学习信息</small></span><input type="checkbox" checked={largeText} onChange={(event) => setLargeText(event.target.checked)} /></label>
          <label><span>高对比按键<small>增强目标键、文字与焦点边界</small></span><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} /></label>
          {phase === "lobby" && <div className="backup-tools"><span><strong>本地档案与备份</strong><small>保存 {profiles.length} 位孩子的独立学习记录</small></span><div><button type="button" onClick={exportBackup}>导出备份</button><button type="button" onClick={() => backupInputRef.current?.click()}>恢复备份</button><button type="button" className="reset-progress" onClick={() => setResetConfirmOpen(true)}>重置当前</button></div><input ref={backupInputRef} type="file" accept="application/json,.json" onChange={importBackup} hidden /></div>}
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
            <span className="season-chip"><i /> 9岁专注训练 · 四大世界十二关 + 无限探索</span>
            <p className="lobby-eyebrow">ANQI TYPER · STORY SEASON 01</p>
            <h1>安琪打字机</h1>
            <h2>星愿花园 · 四界大冒险</h2>
            <p className="lobby-lead">用准确指法穿越樱花谷、月光湖、云上王城与极光圣殿。完成樱花谷主线后，还能进入持续生成的无限世界，点击地面探索并不断遇见新的打字奇遇。</p>
            <div className="lobby-actions">
              <button className="play-button" onClick={requestStart}><span>开始冒险</span><i>按 Enter</i><b>→</b></button>
              <button className="story-button" onClick={() => setHelpOpen(true)}>观看玩法 <span>▶</span></button>
            </div>
            <div className="promise-row"><span>✦ 先准确再提速</span><span>✦ 每次约 4–6 分钟</span><span>✦ 本机独立学习档案</span></div>
          </div>

          <AdventureHub progress={progress} levelIndex={levelIndex} onChooseLevel={chooseLevel} onStart={requestStart} onStartReview={startReview} onStartEndless={startEndlessWorld} onClaimDaily={claimDaily} onCosmetic={chooseCosmetic} />
        </section>
      )}
      {phase === "lobby" && toast && <div className="hub-toast" aria-live="polite">{toast}</div>}

      {isExplorationPrototype && phase === "exploring" && explorationEncounter && (
        <section className="exploration-interface" aria-label="樱花谷探索任务">
          <div className="explore-objective-card">
            <span className="objective-icon">{explorationEncounter.icon}</span>
            <div><small>{endlessMode ? `无限世界 · 第 ${worldStatus.zone} 区` : `当前目标 · 第 ${explorationEncounter.number}/3 站`}</small><strong>{explorationEncounter.title}</strong><p>{endlessMode ? `${worldStatus.biome} · 点击路面自动前往` : explorationEncounter.subtitle}</p></div>
          </div>
          {endlessMode ? (
            <div className="endless-world-status" aria-label={`无限世界第 ${worldStatus.zone} 区，探索 ${worldStatus.distance} 米`}>
              <span><small>当前生态</small><strong>{worldStatus.biome}</strong></span>
              <span><small>探索距离</small><strong>{worldStatus.distance}<i>m</i></strong></span>
              <span><small>完成奇遇</small><strong>{explorationStations}<i>次</i></strong></span>
              <em className={worldStatus.movingByClick ? "walking" : ""}>{worldStatus.movingByClick ? "自动前往中…" : "点击地面前往"}</em>
            </div>
          ) : (
            <div className="explore-route-progress" aria-label={`已完成 ${explorationStations} 个探索机关`}>
              {[0, 1, 2].map((station) => <span key={station} className={station < explorationStations ? "complete" : station === explorationStations ? "current" : ""}><i>{station < explorationStations ? "✓" : station + 1}</i><small>{station === 0 ? "花瓣门" : station === 1 ? "浮桥" : "花塔"}</small></span>)}
            </div>
          )}
          <div className="explore-session-card"><span><small>探索用时</small><strong>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{Math.floor(elapsed % 60).toString().padStart(2, "0")}</strong></span><button onClick={pauseGame} aria-label="暂停探索">Ⅱ</button></div>
          {endlessMode && <div className="endless-minimap" aria-label={`前方奇遇还有 ${Math.max(0, Math.round(-explorationEncounter.position.z - 24 - worldStatus.distance))} 米`}><div><i /><i /><i /><span className="map-player">安</span><span className="map-event">{explorationEncounter.icon}</span></div><small>前方奇遇 <b>{Math.max(0, Math.round(-explorationEncounter.position.z - 24 - worldStatus.distance))}m</b></small></div>}
          {toast && <div className="game-toast exploration-toast" aria-live="polite">{toast}</div>}
        </section>
      )}

      {showTypingInterface && (
        <section className={`play-interface ${isExplorationPrototype ? "exploration-encounter-interface" : ""}`} aria-label={isExplorationPrototype ? "探索机关打字解谜" : "花园打字游戏"}>
          <div className="quest-hud">
            <div className="quest-copy"><span>{isExplorationPrototype ? explorationEncounter?.subtitle ?? "星愿花塔" : missionProgressCopy}</span><strong>{isExplorationPrototype ? explorationProgress.current : missionProgressValue}<i>/{isExplorationPrototype ? explorationProgress.total : level.targetWords}</i></strong></div>
            <div className="quest-track" aria-label={isExplorationPrototype ? `${explorationEncounter?.title ?? "最终机关"}，完成 ${explorationProgress.percent}%` : `${levelLabel}，完成 ${questProgress}%`}><i style={{ width: `${isExplorationPrototype ? explorationProgress.percent : questProgress}%` }} /><span style={{ left: `calc(${isExplorationPrototype ? explorationProgress.percent : questProgress}% - 9px)` }}>{explorationEncounter?.icon ?? "✿"}</span></div>
            <small>{isExplorationPrototype ? endlessMode ? `无限奇遇 ${explorationEncounter?.number ?? 1} · 每完成 5 个词获得花瓣与经验` : `机关 ${explorationEncounter?.number ?? 3}/3 · 看屏幕输入，完成后继续探索` : `${lessonActCopy} · 新键 ${level.newKeys.map((key) => key === "space" ? "空格" : key === "shift" ? "Shift" : key === "comma" ? "," : key === "period" ? "." : key === "apostrophe" ? "'" : key.toUpperCase()).join(" · ")} · 基础通关 85% · 推荐目标 90%`}</small>
          </div>
          <div className="session-hud">
            <span><small>{calmSession ? "学习模式" : "剩余时间"}</small><b className={!calmSession && timeLeft !== null && timeLeft <= 10 ? "danger" : ""}>{calmSession ? "∞" : timeLeft}{!calmSession && <i>s</i>}</b></span>
            <span><small>星愿积分</small><b>{score}</b></span>
            <button onClick={pauseGame} aria-label="暂停游戏">Ⅱ</button>
          </div>

          {!isExplorationPrototype && <div className={`combo-ribbon ${combo >= 5 ? "active" : ""}`}>
            <small>MAGIC COMBO</small><strong>{combo}<i>×</i></strong><span>{isFever ? "星愿时刻" : combo >= 5 ? "魔力上升" : "连续输入积蓄魔力"}</span>
          </div>}

          {!isExplorationPrototype && <div className={`mission-mechanic mechanic-${level.mission}`} aria-live="polite">
            {level.mission === "bloom" && <><span className="mechanic-icon">❀</span><div><small>{levelMechanic.name}</small><strong>{levelMechanic.action}</strong><i style={{ width: `${questProgress}%` }} /></div><b>{completedWords}/{level.targetWords} · 稳定输入</b></>}
            {level.mission === "firefly" && <><span className="mechanic-icon">✦</span><div><small>{levelMechanic.name} · 第 {fireflyRound}/3 轮</small><strong>{fireflyResting ? "活动手腕，准备下一轮" : levelMechanic.action}</strong><i style={{ width: `${Math.min(100, ((elapsed % FIREFLY_ROUND_SECONDS) / FIREFLY_ACTIVE_SECONDS) * 100)}%` }} /></div><b>光能 +{missionBonus}</b></>}
            {level.mission === "rhythm" && <><span className="mechanic-icon beat-orb">♫</span><div><small>{levelMechanic.name}</small><strong>{rhythmHits} 次完美拍点</strong><i className="beat-track" /></div><b>{levelMechanic.action}</b></>}
            {level.mission === "guardian" && <><span className="mechanic-icon boss-core">♛</span><div><small>{levelMechanic.name} · 第 {guardianState.phase}/3 阶段</small><strong>{guardianState.shieldName} {guardianState.hpPercent}%</strong><i style={{ width: `${guardianState.hpPercent}%` }} /></div><b>蓄力 +{missionBonus}</b></>}
          </div>}

          {!isExplorationPrototype && <div className={`world-challenge challenge-${level.mission} challenge-world-${level.worldIndex}`} aria-hidden="true">
            {level.mission === "bloom" && <div className="garden-growth">{Array.from({ length: level.targetWords }, (_, index) => <i key={index} className={index < completedWords ? "awake" : ""} />)}</div>}
            {level.mission === "firefly" && <div className={`firefly-trail ${fireflyResting ? "resting" : ""}`}>{Array.from({ length: 8 }, (_, index) => <i key={index} className={index < Math.ceil(questProgress / 12.5) ? "awake" : ""} />)}</div>}
            {level.mission === "rhythm" && <div className="rhythm-ripples">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < Math.min(5, rhythmHits) ? "awake" : ""} />)}<b>♫</b></div>}
            {level.mission === "guardian" && <div className={`guardian-shields phase-${guardianState.phase}`}>{Array.from({ length: 3 }, (_, index) => <i key={index} className={index < Math.floor((completedWords * 3) / level.targetWords) ? "broken" : ""} />)}<b>♛</b></div>}
          </div>}

          <div className={`spell-console ${isExplorationPrototype ? "encounter-console" : ""}`}>
            <span className="spell-label"><i /> {reviewMode ? "露米弱键复习" : isExplorationPrototype ? `${explorationEncounter?.icon ?? "✦"} ${explorationEncounter?.title ?? "最终机关"}` : missionName}</span>
            {isExplorationPrototype && <p className="encounter-story">{explorationEncounter?.story}</p>}
            <div className="spell-word" aria-live="polite" aria-label={`目标单词 ${word}`}>
                  {word.split("").map((letter, index) => <span key={`${completedWords}-${index}`} className={index < typed.length ? "done" : index === typed.length ? "current" : ""}>{letter === " " ? "·" : letter}</span>)}
            </div>
            <div className="spell-meta">
              <span>下一键 <kbd>{targetLabel}</kbd></span>
              <div><i style={{ width: `${Math.round((typed.length / word.length) * 100)}%` }} /></div>
              <span className={`support-${sessionSupport.mode}`} title={sessionSupport.detail}>稳定度 <b>{sessionSupportText}</b></span>
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
            <span className="modal-orbit">☾</span><small>TAKE A LITTLE BREAK</small><h2>{pausedFromExploration ? "探索已暂停" : "训练已暂停"}</h2><p>{pausedFromExploration ? "安琪和露米正在原地等你，回来后继续寻找下一个发光机关。" : "活动手腕、看看远处，准备好后再继续当前阶段。"}</p>
            <button className="modal-primary" onClick={resumeGame}>继续冒险 <span>→</span></button>
            <div><button onClick={endlessMode ? startEndlessWorld : beginSession}>{endlessMode ? "从无限世界起点出发" : "重新开始"}</button><button onClick={returnToLobby}>返回花园</button></div>
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
            <p>{result.won ? `${levelMechanic.success}，你和露米完成了「${level.title}」。` : completedWords >= level.targetWords && result.accuracy < 85 ? `目标已经完成；把准确率从 ${result.accuracy}% 稳定到 85%，就能正式点亮这一章。` : `再完成 ${Math.max(0, level.targetWords - completedWords)} 个目标，就能点亮这一章。`}</p>
            <div className="result-stars" aria-label={`获得 ${result.stars} 颗星`}>{[0, 1, 2].map((star) => <span key={star} className={star < result.stars ? "earned" : ""}>★</span>)}</div>
            <div className="result-score"><small>本局星愿积分 · {trainingRank}</small><strong>{result.score}</strong><span>任务奖励 +{result.missionBonus} · 历史最佳 {progress.bestScores[level.id]} · +{result.xp} XP</span></div>
            <div className="result-grid">
              <span><i>◎</i><small>准确率</small><strong>{result.accuracy}%</strong></span>
              <span><i>⌁</i><small>打字速度</small><strong>{result.wpm}<em> WPM</em></strong></span>
              <span><i>✦</i><small>最高连击</small><strong>{bestCombo}×</strong></span>
              <span><i>✿</i><small>获得花瓣</small><strong>+{result.petals}</strong></span>
            </div>
            <div className={`result-actions ${isExplorationPrototype && result.won ? "with-endless" : ""}`}><button onClick={beginSession}>再玩一次</button>{isExplorationPrototype && result.won && <button className="endless-result-button" onClick={startEndlessWorld}>进入无限世界 <span>∞</span></button>}<button className="modal-primary" onClick={playNext}>{result.won && levelIndex < GARDEN_LEVELS.length - 1 ? "前往下一章" : "回到花园"}<span>→</span></button></div>
          </div>
        </section>
      )}

      {tutorialOpen && (
        <section className="modal-backdrop tutorial-backdrop" role="dialog" aria-modal="true" aria-label="盲打起步课">
          <div className="tutorial-card modal-card">
            <button className="modal-close" onClick={() => setTutorialOpen(false)} aria-label="关闭盲打起步课">×</button>
            <span className="tutorial-badge">9岁盲打起步课</span><h2>先建立准确指法，再挑战速度</h2>
            <div className="tutorial-steps">
              <span><i>01</i><b>锁定基准位</b><small>食指摸到 F、J 凸点，其余手指自然放在同一排</small></span>
              <span><i>02</i><b>眼睛看屏幕</b><small>根据高亮键移动手指，不低头在键盘上寻找</small></span>
              <span><i>03</i><b>按完立即归位</b><small>每次伸手后回到 F、J，用准确动作形成肌肉记忆</small></span>
            </div>
            <p>第一关没有倒计时。点击远处地面可让安琪自动前往，也可用方向键自由探索；靠近发光机关按 Enter，解谜时再把双手放回基准位。错误不会扣生命。</p>
            <button className="modal-primary" onClick={completeTutorial}>进入樱花谷探索 <span>→</span></button>
          </div>
        </section>
      )}

      {helpOpen && (
        <section className="modal-backdrop tutorial-backdrop" role="dialog" aria-modal="true" aria-label="玩法说明">
          <div className="tutorial-card help-card modal-card">
            <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭玩法说明">×</button>
            <span className="tutorial-badge">HOW TO TRAIN</span><h2>适合9岁孩子的专注训练</h2>
            <div className="help-list"><span><i>⌨</i><p><b>实体键盘优先</b><small>进入关卡后直接输入，眼睛看屏幕，不低头找键。</small></p></span><span><i>✦</i><p><b>90% 是推荐目标</b><small>85% 可以通关；达到 90% 后再逐步挑战速度。</small></p></span><span><i>☾</i><p><b>每天约 15 分钟</b><small>完成一关并复习弱键，中途活动手腕、看看远处。</small></p></span></div>
            <button className="modal-primary" onClick={() => setHelpOpen(false)}>明白了</button>
          </div>
        </section>
      )}

      {resetConfirmOpen && (
        <section className="modal-backdrop reset-backdrop" role="dialog" aria-modal="true" aria-label="确认重置学习进度">
          <div className="reset-card modal-card"><span className="modal-orbit">↺</span><small>仅重置当前儿童档案</small><h2>重新开始 {activeProfile.name} 的花园？</h2><p>这会清空当前孩子的关卡、掌握度、花瓣和成长记录。其他孩子的档案不会受到影响。</p><div className="reset-actions"><button onClick={() => setResetConfirmOpen(false)}>保留进度</button><button className="danger-button" onClick={resetCurrentProfile}>确认重置</button></div></div>
        </section>
      )}

      {parentReportOpen && <ParentReport progress={progress} learnerName={activeProfile.name} onClose={() => setParentReportOpen(false)} />}
    </main>
  );
}

"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  getAdaptiveTargetKeys,
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
  type WorldDiscovery,
  type ExplorationEncounterId,
} from "./exploration-engine";
import type { ExplorationWorldStatus } from "./PlayCanvasWorld3D";
import { getKeyMovement, KeyboardCoach } from "./KeyboardCoach";
import { ParentReport } from "./ParentReport";
import {
  CHILD_VOICE_STYLES,
  chooseChildFriendlyVoice,
  getChildVoiceProfile,
  isChildVoiceStyle,
  prepareChildSpeech,
  type ChildVoiceRole,
  type ChildVoiceStyle,
} from "./voice-engine";

const MagicGarden3D = lazy(() => import("./MagicGarden3D").then((module) => ({ default: module.MagicGarden3D })));
const ExplorationWorld3D = lazy(() => import("./PlayCanvasWorld3D").then((module) => ({ default: module.PlayCanvasWorld3D })));

type Phase = "lobby" | "exploring" | "playing" | "paused" | "complete";
type Flash = "correct" | "wrong" | "word" | null;
type CinematicKind = "launch" | "endless" | "milestone" | "victory";
type SessionSnapshot = { correctHits: number; mistakes: number; completedWords: number; bestCombo: number; elapsed: number };
type LearnerProfile = { id: string; name: string; createdAt: number };
type ProgressBackup = { format: "anqi-typer-backup"; version: 1; profiles: LearnerProfile[]; activeProfileId: string; progressByProfile: Record<string, GardenProgress> };

const PROGRESS_KEY = "anqi-magic-garden-progress";
const TUTORIAL_KEY = "anqi-magic-garden-tutorial";
const SETTINGS_KEY = "anqi-magic-garden-settings";
const PROFILES_KEY = "anqi-magic-garden-profiles";
const ACTIVE_PROFILE_KEY = "anqi-magic-garden-active-profile";
const DEFAULT_PROFILE: LearnerProfile = { id: "default", name: "安琪", createdAt: 0 };
const CINEMATIC_COPY: Record<CinematicKind, { kicker: string; title: string; detail: string }> = {
  launch: { kicker: "ANQI · FIELD TEAM", title: "安琪，出发！", detail: "沿着真实山谷寻找打字任务" },
  endless: { kicker: "ENDLESS TRAIL", title: "新的小路正在生成", detail: "和比熊安琪一起跑向未知区域" },
  milestone: { kicker: "WORLD RESPONSE", title: "打字改变了世界", detail: "准确输入让自然重新苏醒" },
  victory: { kicker: "TRAIL COMPLETED", title: "安琪和你做到了！", detail: "这一段旅程已经被准确的手指点亮" },
};

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
  const [voiceStyle, setVoiceStyle] = useState<ChildVoiceStyle>("playmate");
  const [voiceLabel, setVoiceLabel] = useState("使用设备普通话声音");
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
  const [worldStatus, setWorldStatus] = useState<ExplorationWorldStatus>({ distance: 0, zone: 1, biome: "樱风原野", movingByClick: false, quality: "精细" });
  const [adaptiveStats, setAdaptiveStats] = useState<SessionKeyStats>({});
  const [parentReportOpen, setParentReportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pausedFrom, setPausedFrom] = useState<"exploring" | "playing">("playing");
  const [cinematicMoment, setCinematicMoment] = useState<{ kind: CinematicKind; nonce: number } | null>(null);
  const startedAt = useRef(0);
  const finishingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cinematicTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsResumeRef = useRef(false);
  const reviewModeRef = useRef(false);
  const missionBonusRef = useRef(0);
  const lastMissionRoundRef = useRef(1);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<{ noise: AudioBufferSourceNode; breeze: OscillatorNode; gain: GainNode } | null>(null);
  const lastSpeechAtRef = useRef(0);
  const voiceListRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechTokenRef = useRef(0);
  const speechStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechActiveRef = useRef(false);
  const keyShownAtRef = useRef(0);
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
  const wordOrdinal = endlessMode ? level.targetWords + endlessWords : completedWords;
  const word = useMemo(
    () => getAdaptiveLevelWord(level, wordOrdinal, progress.keyMastery, adaptiveStats),
    [adaptiveStats, level, progress.keyMastery, wordOrdinal],
  );
  const adaptiveKeys = getAdaptiveTargetKeys(level, progress.keyMastery, adaptiveStats);
  const adaptiveKeyLabel = adaptiveKeys[0] ? adaptiveKeys[0] === "space" ? "空格" : adaptiveKeys[0].toUpperCase() : null;
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
  const lessonAct = getLessonAct(level, completedWords);
  const lessonActCopy = lessonAct === "learn" ? "认识新键" : lessonAct === "practice" ? "组合练习" : "剧情挑战";
  const fireflyRound = level.mission === "firefly" ? Math.min(3, Math.floor(elapsed / FIREFLY_ROUND_SECONDS) + 1) : 1;
  const fireflyResting = level.mission === "firefly" && elapsed > 0 && elapsed % FIREFLY_ROUND_SECONDS >= FIREFLY_ACTIVE_SECONDS;
  const guardianState = getGuardianState(level, completedWords);
  const levelMechanic = LEVEL_MECHANICS[level.id];
  const sessionSupport = getSessionSupport(correctHits, mistakes, wrongStreak);
  const sessionSupportText = correctHits + mistakes < 5 ? "正在热身" : sessionSupport.label;
  const trainingRank = !result ? "" : result.accuracy >= 97 && bestCombo >= 20 ? "S · 精准控制" : result.accuracy >= 90 ? "A · 稳定推进" : result.won ? "B · 成功通关" : "继续校准";

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
        const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<{ soundOn: boolean; voiceStyle: ChildVoiceStyle; reducedMotion: boolean; beginnerMode: boolean; largeText: boolean; highContrast: boolean }>;
        setSoundOn(saved.soundOn ?? true);
        setVoiceStyle(isChildVoiceStyle(saved.voiceStyle) ? saved.voiceStyle : "playmate");
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
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundOn, voiceStyle, reducedMotion, beginnerMode, largeText, highContrast }));
    } catch {
      // Accessibility preferences still apply to the current session.
    }
  }, [beginnerMode, highContrast, largeText, reducedMotion, settingsHydrated, soundOn, voiceStyle]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      voiceListRef.current = synthesis.getVoices();
      const selected = chooseChildFriendlyVoice(voiceListRef.current, voiceStyle, "anqi");
      setVoiceLabel(selected ? `已匹配 · ${selected.name}` : "使用设备普通话声音");
    };
    const initialRefresh = window.setTimeout(refreshVoices, 0);
    synthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.clearTimeout(initialRefresh);
      synthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [voiceStyle]);

  useEffect(() => {
    sessionRef.current = { correctHits, mistakes, completedWords, bestCombo, elapsed };
  }, [bestCombo, completedWords, correctHits, elapsed, mistakes]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (parentHoldTimer.current) clearTimeout(parentHoldTimer.current);
    if (cinematicTimer.current) clearTimeout(cinematicTimer.current);
    if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
    speechTokenRef.current += 1;
    speechActiveRef.current = false;
    window.speechSynthesis?.cancel();
    ambientRef.current = null;
    void audioContextRef.current?.close();
  }, []);

  const playTone = useCallback((kind: "key" | "wrong" | "word" | "win" | "step" | "jump" | "land" | "collect") => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = audioContextRef.current && audioContextRef.current.state !== "closed" ? audioContextRef.current : new AudioCtor();
      audioContextRef.current = context;
      const notes = kind === "win" ? [523, 659, 784]
        : kind === "collect" ? [659, 880, 1047]
          : kind === "jump" ? [330, 520]
            : kind === "land" ? [118]
              : kind === "step" ? [92 + (Math.floor(performance.now() / 300) % 2) * 14]
                : [kind === "wrong" ? 164 : kind === "word" ? 740 : 540 + Math.min(combo, 15) * 18];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = kind === "wrong" ? "triangle" : kind === "step" || kind === "land" ? "sine" : "sine";
        oscillator.frequency.value = frequency;
        const start = context.currentTime + index * 0.085;
        const volume = kind === "step" ? 0.014 : kind === "land" ? 0.025 : kind === "key" ? 0.035 : 0.055;
        const duration = kind === "step" ? 0.07 : kind === "land" ? 0.1 : 0.13;
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      });
    } catch {
      // Sound is an enhancement, never a condition for play.
    }
  }, [combo, soundOn]);

  const stopAmbient = useCallback(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    ambientRef.current = null;
    const now = audioContextRef.current?.currentTime ?? 0;
    ambient.gain.gain.cancelScheduledValues(now);
    ambient.gain.gain.setTargetAtTime(0.0001, now, 0.08);
    window.setTimeout(() => {
      try { ambient.noise.stop(); } catch { /* already stopped */ }
      try { ambient.breeze.stop(); } catch { /* already stopped */ }
    }, 320);
  }, []);

  const startAmbient = useCallback(() => {
    if (!soundOn || ambientRef.current || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = audioContextRef.current && audioContextRef.current.state !== "closed" ? audioContextRef.current : new AudioCtor();
      audioContextRef.current = context;
      void context.resume();
      const seconds = 3;
      const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (0.35 + Math.sin(index / 19000) * 0.1);
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 620;
      filter.Q.value = 0.35;
      const breeze = context.createOscillator();
      breeze.type = "sine";
      breeze.frequency.value = 174;
      const breezeGain = context.createGain();
      breezeGain.gain.value = 0.004;
      const gain = context.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(speechActiveRef.current ? 0.0045 : 0.018, context.currentTime + 1.1);
      noise.connect(filter);
      filter.connect(gain);
      breeze.connect(breezeGain);
      breezeGain.connect(gain);
      gain.connect(context.destination);
      noise.start();
      breeze.start();
      ambientRef.current = { noise, breeze, gain };
    } catch {
      // Quiet play remains fully supported when audio is unavailable.
    }
  }, [soundOn]);

  const setAmbientSpeechDucking = useCallback((ducked: boolean) => {
    const context = audioContextRef.current;
    const ambient = ambientRef.current;
    if (!context || !ambient) return;
    const now = context.currentTime;
    ambient.gain.gain.cancelScheduledValues(now);
    ambient.gain.gain.setTargetAtTime(ducked ? 0.0045 : 0.018, now, ducked ? 0.055 : 0.2);
  }, []);

  const speakEncouragement = useCallback((message: string, options: { role?: ChildVoiceRole; urgent?: boolean; force?: boolean } = {}) => {
    if ((!soundOn && !options.force) || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synthesis = window.speechSynthesis;
    const role = options.role ?? "anqi";
    const urgent = options.urgent ?? false;
    const now = Date.now();
    if (!urgent && (now - lastSpeechAtRef.current < 7000 || synthesis.speaking || synthesis.pending)) return;
    lastSpeechAtRef.current = now;
    const wasBusy = synthesis.speaking || synthesis.pending;
    if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
    const token = speechTokenRef.current + 1;
    speechTokenRef.current = token;
    if (urgent && wasBusy) synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(prepareChildSpeech(message, role));
    const selectedVoice = chooseChildFriendlyVoice(voiceListRef.current.length ? voiceListRef.current : synthesis.getVoices(), voiceStyle, role);
    const profile = getChildVoiceProfile(voiceStyle, role);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang ?? "zh-CN";
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;
    const finishSpeech = () => {
      if (speechTokenRef.current !== token) return;
      speechActiveRef.current = false;
      setAmbientSpeechDucking(false);
    };
    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;
    speechActiveRef.current = true;
    setAmbientSpeechDucking(true);
    speechStartTimerRef.current = window.setTimeout(() => {
      if (speechTokenRef.current !== token) return;
      try {
        synthesis.speak(utterance);
      } catch {
        finishSpeech();
      }
    }, urgent && wasBusy ? 70 : 0);
  }, [setAmbientSpeechDucking, soundOn, voiceStyle]);

  const previewChildVoice = useCallback(() => {
    setSoundOn(true);
    speakEncouragement("嗨！我是安琪。准备好了吗？我们一起把字打准，再去发现新的小路！", { role: "anqi", urgent: true, force: true });
  }, [speakEncouragement]);

  useEffect(() => {
    if (soundOn && (phase === "exploring" || phase === "playing")) startAmbient();
    else stopAmbient();
  }, [phase, soundOn, startAmbient, stopAmbient]);

  useEffect(() => {
    keyShownAtRef.current = performance.now();
  }, [phase, typed.length, word]);

  const showFlash = useCallback((kind: Exclude<Flash, null>) => {
    setFlash(kind);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), kind === "word" ? 760 : 180);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1400);
  }, []);

  const playCinematic = useCallback((kind: CinematicKind, duration = 1900) => {
    if (cinematicTimer.current) clearTimeout(cinematicTimer.current);
    const actualDuration = reducedMotion ? 420 : duration;
    setCinematicMoment({ kind, nonce: Date.now() });
    cinematicTimer.current = setTimeout(() => setCinematicMoment(null), actualDuration);
    return actualDuration;
  }, [reducedMotion]);

  const skipCinematic = useCallback(() => {
    if (cinematicTimer.current) clearTimeout(cinematicTimer.current);
    cinematicTimer.current = null;
    setCinematicMoment(null);
    if (startedAt.current > Date.now()) startedAt.current = Date.now();
    if (phase === "playing") window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), 60);
  }, [phase]);

  const finishGame = useCallback((snapshot?: SessionSnapshot) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const final = snapshot ?? sessionRef.current;
    const elapsedSeconds = Math.max(1, final.elapsed);
    const calculated = calculateGardenResult(level, final.correctHits, final.mistakes, elapsedSeconds, final.completedWords, final.bestCombo, missionBonusRef.current);
    const finalResult = { ...calculated, petals: getEarnedPetals(progress, level, calculated, final.completedWords) };
    setElapsed(elapsedSeconds);
    setResult(finalResult);
    setPhase("complete");
    if (finalResult.won) playCinematic("victory", 2100);
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
  }, [activeProfileId, level, levelIndex, playCinematic, playTone, progress]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "exploring") return;
    const timer = window.setInterval(() => {
      const nextElapsed = Math.max(0, (Date.now() - startedAt.current) / 1000);
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
    const introDuration = playCinematic("launch", 2050);
    setEndlessMode(false);
    setEndlessWords(0);
    setWorldStatus({ distance: 0, zone: 1, biome: "樱风原野", movingByClick: false, quality: "精细" });
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
    setAdaptiveStats({});
    keyShownAtRef.current = performance.now();
    startedAt.current = Date.now() + introDuration;
    const exploreFirst = level.id === "petal-gate" && !reviewModeRef.current;
    setPausedFrom(exploreFirst ? "exploring" : "playing");
    setPhase(exploreFirst ? "exploring" : "playing");
    if (!exploreFirst) window.setTimeout(() => mobileInputRef.current?.focus({ preventScroll: true }), introDuration + 120);
  }, [level.id, playCinematic]);

  const startEndlessWorld = useCallback(() => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    reviewModeRef.current = false;
    setReviewMode(false);
    setLevelIndex(0);
    setEndlessMode(true);
    setEndlessWords(0);
    setWorldStatus({ distance: 0, zone: 1, biome: getEndlessBiome(0).name, movingByClick: false, quality: "精细" });
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
    setAdaptiveStats({});
    keyShownAtRef.current = performance.now();
    const introDuration = playCinematic("endless", 2050);
    startedAt.current = Date.now() + introDuration;
    setPausedFrom("exploring");
    setPhase("exploring");
    showToast("无限世界已开启 · 点击路面即可自动前往");
  }, [playCinematic, showToast]);

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

  const recordKeyAttempt = useCallback((expected: string, correct: boolean, reactionMs: number) => {
    const keys = /^[A-Z]$/.test(expected) ? ["shift", expected.toLowerCase()] : [expected === " " ? "space" : expected === "," ? "comma" : expected === "." ? "period" : expected === "'" ? "apostrophe" : expected.toLowerCase()];
    keys.forEach((key) => {
      const previous = sessionKeyStatsRef.current[key] ?? { attempts: 0, correct: 0, bestStreak: 0, totalReactionMs: 0, slowAttempts: 0 };
      const nextCorrect = previous.correct + (correct ? 1 : 0);
      const safeReaction = Math.max(80, Math.min(4000, reactionMs));
      sessionKeyStatsRef.current[key] = {
        attempts: previous.attempts + 1,
        correct: nextCorrect,
        bestStreak: correct ? Math.max(previous.bestStreak, combo + 1) : previous.bestStreak,
        totalReactionMs: (previous.totalReactionMs ?? 0) + safeReaction,
        slowAttempts: (previous.slowAttempts ?? 0) + (safeReaction > 1100 ? 1 : 0),
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

  const discoverWorldSecret = useCallback((discovery: WorldDiscovery) => {
    const firstVisit = !progress.discoveries.includes(discovery.id);
    if (firstVisit) {
      updateProgress((current) => ({
        ...current,
        discoveries: current.discoveries.includes(discovery.id) ? current.discoveries : [...current.discoveries, discovery.id],
        petals: current.petals + discovery.reward,
        xp: current.xp + discovery.reward * 2,
      }));
      playTone("collect");
    }
    showToast(`${discovery.message}${firstVisit ? ` · +${discovery.reward} 花瓣` : ""}`);
    speakEncouragement(discovery.kind === "npc" ? `${discovery.name}说：${discovery.message}` : discovery.message, { role: discovery.kind === "npc" ? "npc" : "anqi", urgent: true });
  }, [playTone, progress.discoveries, showToast, speakEncouragement, updateProgress]);

  const playMovementAudio = useCallback((kind: "step" | "jump" | "land") => {
    playTone(kind);
  }, [playTone]);

  const handleKey = useCallback((key: string) => {
    if (phase !== "playing" || cinematicMoment || finishingRef.current || !target || fireflyResting) return;
    const reactionMs = performance.now() - keyShownAtRef.current;
    const outcome = evaluateTypingKey(word, typed.length, key);
    if (outcome === "correct" || outcome === "complete") {
      const nextCorrect = correctHits + 1;
      const nextCombo = combo + 1;
      const nextBest = Math.max(bestCombo, nextCombo);
      const nextTyped = typed + target;
      recordKeyAttempt(target, true, reactionMs);
      keyShownAtRef.current = performance.now();
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
        setAdaptiveStats({ ...sessionKeyStatsRef.current });
        showFlash("word");
        playTone("word");
        if ((endlessMode ? nextEndlessWords : nextCompleted) % 5 === 0) speakEncouragement(nextBest >= 8 ? "耶！你的手指越来越稳啦！" : "做得好！慢慢来，我们继续探险！", { role: "anqi" });
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
            playCinematic("milestone", 1250);
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
          setAdaptiveStats({});
          finishingRef.current = true;
          finishTimer.current = setTimeout(() => {
            finishingRef.current = false;
            setPausedFrom("exploring");
            setPhase("exploring");
            playCinematic("milestone", 1250);
            showToast(`${completedEncounter.success} · +${reward.petals} 花瓣`);
          }, reducedMotion ? 100 : 560);
        }
      } else {
        setTyped(nextTyped);
      }
    } else if (outcome === "wrong") {
      recordKeyAttempt(target, false, reactionMs);
      keyShownAtRef.current = performance.now();
      setMistakes((current) => current + 1);
      setCombo(0);
      setWrongStreak((current) => {
        const next = current + 1;
        if (next === 2) showToast(`${getKeyMovement(target)}，按完立即归位`);
        if (next >= 3) {
          showToast(`先看屏幕上的 ${targetLabel}，不要低头找键`);
          speakEncouragement(`没关系，先找到 ${targetLabel}，慢慢按。`, { role: "coach", urgent: true });
        }
        return next;
      });
      playTone("wrong");
      showFlash("wrong");
    }
  }, [addMissionBonus, bestCombo, cinematicMoment, combo, completedWords, correctHits, endlessMode, endlessWords, finishGame, fireflyResting, fireflyRound, isExplorationPrototype, level.mission, level.targetWords, mistakes, phase, playCinematic, playTone, recordKeyAttempt, reducedMotion, rhythmHits, showFlash, showToast, speakEncouragement, target, targetLabel, typed, updateProgress, word, worldStatus.distance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (cinematicMoment) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Enter" || event.key === "Escape" || event.key === " ") skipCinematic();
        return;
      }
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
  }, [cinematicMoment, closeSettings, handleKey, helpOpen, parentReportOpen, pauseGame, phase, profileOpen, requestStart, resumeGame, settingsOpen, skipCinematic, tutorialOpen]);

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
    <main className={`magic-game phase-${phase} level-${level.id} mission-${level.mission} ${isExplorationPrototype ? "exploration-active" : ""} ${flash ? `flash-${flash}` : ""} ${combo >= 10 ? "combo-bright" : combo >= 5 ? "combo-awake" : ""} ${isFever ? "fever-mode" : ""} ${reducedMotion ? "reduced-motion" : ""} ${largeText ? "child-text-large" : ""} ${highContrast ? "high-contrast" : ""}`}>
      {phase === "lobby" ? <div className="garden-stage lobby-scene-fallback" aria-hidden="true" /> : (
        <Suspense fallback={<div className="garden-stage garden-loading" aria-hidden="true"><span>✦</span></div>}>
          {isExplorationPrototype ? (
            <ExplorationWorld3D
              mode={cinematicMoment ? "paused" : phase === "exploring" ? "explore" : phase === "playing" ? "encounter" : phase === "complete" ? "complete" : "paused"}
              completedWords={completedWords}
              endlessMode={endlessMode}
              endlessWords={endlessWords}
              reducedMotion={reducedMotion}
              cosmeticColor={equippedCosmetic.color}
              feedback={flash}
              discoveredIds={progress.discoveries}
              onEncounter={beginExplorationEncounter}
              onDiscover={discoverWorldSecret}
              onMovementAudio={playMovementAudio}
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
        <div className="bichon-character-cast" aria-hidden="true">
          <div className="bichon-action-image" />
          <span className="bichon-action-ripple"><i /><i /><i /></span>
          <span className="bichon-motion-trails"><i /><i /><i /><i /></span>
        </div>
      )}
      <div className="cinematic-vignette" aria-hidden="true" />
      <div className="petal petal-a" aria-hidden="true" /><div className="petal petal-b" aria-hidden="true" /><div className="petal petal-c" aria-hidden="true" />
      {flash === "word" && !reducedMotion && <div className="epic-word-reaction" aria-hidden="true"><span /><span /><span />{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>}
      {cinematicMoment && (() => {
        const copy = CINEMATIC_COPY[cinematicMoment.kind];
        return (
          <section key={cinematicMoment.nonce} className={`bichon-cinematic cinematic-${cinematicMoment.kind}`} aria-live="polite" aria-label={copy.title}>
            <div className="bichon-cinematic-image" />
            <div className="cinematic-speed-lines">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
            <div className="bichon-cinematic-copy"><small>{copy.kicker}</small><h2>{copy.title}</h2><p>{copy.detail}</p><span><i /> LIVE ADVENTURE</span></div>
            <button className="cinematic-skip" type="button" onClick={skipCinematic}>跳过 <kbd>Enter</kbd></button>
            <div className="cinematic-letterbox cinematic-letterbox-top" /><div className="cinematic-letterbox cinematic-letterbox-bottom" />
          </section>
        );
      })()}

      <header className="game-topbar">
        <button className="brand-lockup" onClick={returnToLobby} aria-label="返回安琪打字机首页">
          <span className="brand-gem">A</span>
          <span><strong>安琪打字机</strong><small>EXPLORATION TYPING</small></span>
        </button>
        {phase === "lobby" ? (
          <div className="profile-cluster">
            <button className="learner-pill" onClick={() => { setSettingsOpen(false); setProfileOpen((current) => !current); }} aria-expanded={profileOpen} aria-label="切换儿童档案"><i>{activeProfile.name.slice(0, 1)}</i><span><small>正在学习</small><b>{activeProfile.name}</b></span><em>⌄</em></button>
            <div className="profile-strip" aria-label="成长记录">
              <span><i>练</i><b>{progress.petals}</b><small>练习点</small></span>
              <span><i>章</i><b>{progress.totalStars}</b><small>徽章</small></span>
              <span className="player-badge"><i>{playerLevel}</i><b>自然探索者</b></span>
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
          <label><span>沉浸声音与鼓励<small>环境声、脚步、按键和中文语音鼓励</small></span><input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /></label>
          <div className="voice-settings">
            <span><strong>安琪说话声音</strong><small>伙伴、教练和 NPC 会使用不同的语气</small></span>
            <div className="voice-style-grid" role="group" aria-label="选择儿童语音风格">
              {CHILD_VOICE_STYLES.map((style) => <button key={style.id} type="button" className={voiceStyle === style.id ? "active" : ""} aria-pressed={voiceStyle === style.id} onClick={() => setVoiceStyle(style.id)}><b>{style.name}</b><small>{style.description}</small></button>)}
            </div>
            <div className="voice-preview-row"><button type="button" onClick={previewChildVoice}>▶ 试听安琪</button><small aria-live="polite">{voiceLabel}</small></div>
          </div>
          <label><span>减少动态效果<small>需要更安静的画面时，关闭风、粒子和镜头运动</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
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
          <div className="lobby-atmosphere" aria-hidden="true">
            <span className="lobby-sunbeam" />
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
            <b /><b /><b /><b />
          </div>
          <div className="lobby-copy">
            <span className="season-chip"><i /> 为 9 岁孩子设计 · 准确、专注、可持续</span>
            <p className="lobby-eyebrow">ANQI TYPER · OUTDOOR LEARNING</p>
            <h1>安琪打字机</h1>
            <h2>在自然中探索，也把字打准</h2>
            <p className="lobby-lead">跟随比熊安琪穿过山谷、湖岸与林间小路。点击地面前进，在真实场景中寻找任务；每次只练一个清晰目标，先准确，再逐步提速。</p>
            <div className="lobby-actions">
              <button className="play-button" onClick={requestStart}><span>开始探索</span><i>按 Enter</i><b>→</b></button>
              <button className="story-button" onClick={() => setHelpOpen(true)}>了解玩法 <span>▶</span></button>
            </div>
            <div className="promise-row"><span>先准确再提速</span><span>每次约 4–6 分钟</span><span>本机独立学习档案</span></div>
          </div>

          <AdventureHub progress={progress} levelIndex={levelIndex} onChooseLevel={chooseLevel} onStart={requestStart} onStartReview={startReview} onStartEndless={startEndlessWorld} onClaimDaily={claimDaily} onCosmetic={chooseCosmetic} />
        </section>
      )}
      {phase === "lobby" && toast && <div className="hub-toast" aria-live="polite">{toast}</div>}

      {isExplorationPrototype && phase === "exploring" && explorationEncounter && (
        <section className="exploration-interface" aria-label="樱花谷探索任务">
          <div className="explore-focus-card">
            <span className="objective-icon">{explorationEncounter.icon}</span>
            <div><small>现在只做这件事 · {endlessMode ? `第 ${worldStatus.zone} 区` : `主线 ${explorationEncounter.number}/3`}</small><strong>{explorationEncounter.title}</strong><p>{endlessMode ? `${worldStatus.biome} · ${worldStatus.movingByClick ? "正在自动前往" : "点击远处路面出发"}` : explorationEncounter.subtitle}</p></div>
            <div className="focus-world-meta">
              <span>{endlessMode ? `${worldStatus.distance}m · ${explorationStations} 次奇遇` : `发现 ${progress.discoveries.length}/4 · 机关 ${explorationStations}/3`}</span>
              <i>{worldStatus.quality}画质</i>
            </div>
            <button onClick={pauseGame} aria-label="暂停探索">Ⅱ</button>
          </div>
          {toast && <div className="game-toast exploration-toast" aria-live="polite">{toast}</div>}
        </section>
      )}

      {showTypingInterface && (
        <section className={`play-interface ${isExplorationPrototype ? "exploration-encounter-interface" : ""}`} aria-label={isExplorationPrototype ? "探索机关打字解谜" : "花园打字游戏"}>
          {!isExplorationPrototype && <div className={`world-challenge challenge-${level.mission} challenge-world-${level.worldIndex}`} aria-hidden="true">
            {level.mission === "bloom" && <div className="garden-growth">{Array.from({ length: level.targetWords }, (_, index) => <i key={index} className={index < completedWords ? "awake" : ""} />)}</div>}
            {level.mission === "firefly" && <div className={`firefly-trail ${fireflyResting ? "resting" : ""}`}>{Array.from({ length: 8 }, (_, index) => <i key={index} className={index < Math.ceil(questProgress / 12.5) ? "awake" : ""} />)}</div>}
            {level.mission === "rhythm" && <div className="rhythm-ripples">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < Math.min(5, rhythmHits) ? "awake" : ""} />)}<b>♫</b></div>}
            {level.mission === "guardian" && <div className={`guardian-shields phase-${guardianState.phase}`}>{Array.from({ length: 3 }, (_, index) => <i key={index} className={index < Math.floor((completedWords * 3) / level.targetWords) ? "broken" : ""} />)}<b>♛</b></div>}
          </div>}

          <div className={`spell-console ${isExplorationPrototype ? "encounter-console" : ""}`}>
            <div className="typing-focus-strip">
              <span><small>现在只输入这个词</small><strong>{reviewMode ? "弱键复习" : isExplorationPrototype ? explorationEncounter?.title ?? "探索机关" : `${lessonActCopy} · ${missionName}`}</strong></span>
              <em>{isExplorationPrototype ? `${explorationProgress.current}/${explorationProgress.total}` : `${completedWords}/${level.targetWords}`}</em>
              <i>{calmSession ? "不限时" : `${timeLeft}s`}</i>
              <b>{combo > 1 ? `${combo} 连击` : `${score} 分`}</b>
              <button onClick={pauseGame} aria-label="暂停游戏">Ⅱ</button>
            </div>
            <div className="typing-total-track" aria-label={`${isExplorationPrototype ? explorationProgress.percent : questProgress}% 完成`}><i style={{ width: `${isExplorationPrototype ? explorationProgress.percent : questProgress}%` }} /></div>
            {adaptiveKeyLabel && word.toLowerCase().includes(adaptiveKeys[0] === "space" ? " " : adaptiveKeys[0]) && <p className="adaptive-focus-note">露米正在温和巩固 <kbd>{adaptiveKeyLabel}</kbd>：这一词会重点记录准确率和反应时间</p>}
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
          {flash === "word" && <div className="word-burst" aria-live="polite">输入完成 <span>✓</span></div>}
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
            <p>第一关没有倒计时。点击远处地面可让安琪自动前往，也可用方向键自由探索；主路通往打字机关，左右支路藏着收藏和花园朋友。解谜时把双手放回基准位，系统会根据错键与反应时间调整后续词语，错误不会扣生命。</p>
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

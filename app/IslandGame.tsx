"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CHAPTERS, LESSONS, STORAGE_KEY, chapterStart, chapterForLesson, chapterLocalIndex, chapterLessons, emptyProgress, loadIslandProgress, localDay, scoreSession, saveSession, weakKeys, reviewPrompts, keyLabel, fingerFor, type IslandProgress, type Session } from "./island-engine";
import { JOURNEY_KEY, PROJECTS, emptyJourney, freshJourneyRun, loadJourney, checkpointJourney, finishJourney, chapterProjects, type Journey, type JourneyRun } from "./island-journey";
import { IslandKeyboard } from "./IslandKeyboard";
import { IslandJournal } from "./IslandJournal";
import { Icon } from "./IslandIcons";
import { FIRST_ADVENTURE_KEY, emptyFirstAdventure, loadFirstAdventure, advanceAdventure, awardFirstAdventure, type AdventureAction, type FirstAdventureState } from "./first-adventure";
const IslandScene = lazy(() => import("./IslandScene").then(m => ({ default: m.IslandScene })));
const FirstAdventure = lazy(() => import("./FirstAdventure").then(m => ({ default: m.FirstAdventure })));
type Page = "map" | "practice" | "garden" | "journal";
type Phase = "home" | "intro" | "playing" | "paused" | "complete";
type Settings = { sound: boolean; reducedMotion: boolean; keyboard: boolean };
type Run = JourneyRun;
const freshRun = freshJourneyRun;
const NAV: { id: Page; icon: string; label: string }[] = [{ id: "map", icon: "map", label: "探险地图" }, { id: "practice", icon: "keyboard", label: "练习小屋" }, { id: "garden", icon: "leaf", label: "我的花园" }, { id: "journal", icon: "book", label: "成长手账" }];

function Modal({ title, children, close, className = "" }: { title: string; children: React.ReactNode; close: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className={`island-modal ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); close(); }}><button className="icon-button modal-close" onClick={close} aria-label="关闭"><Icon name="close" /></button>{children}</dialog>;
}

export function IslandGame() {
  const [page, setPage] = useState<Page>("map");
  const [phase, setPhase] = useState<Phase>("home");
  const [chapter, setChapter] = useState(0);
  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState<IslandProgress>(emptyProgress);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<Settings>({ sound: true, reducedMotion: false, keyboard: true });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [exploring, setExploring] = useState(true);
  const [journey, setJourney] = useState<Journey>(emptyJourney);
  const journeyRef = useRef(journey);
  const [mapOpen, setMapOpen] = useState(false);
  const [keyboardExpanded, setKeyboardExpanded] = useState(false);
  const lastKeyAt = useRef(0);
  const [review, setReview] = useState(false);
  const [retest, setRetest] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [prompts, setPrompts] = useState(LESSONS[0].prompts);
  const [snapshot, setSnapshot] = useState<Run>(freshRun);
  const [result, setResult] = useState<Session | null>(null);
  const [feedback, setFeedback] = useState("手指准备好了吗？按亮起的字母开始。");
  const [wrong, setWrong] = useState(false);
  const [notice, setNotice] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [rest, setRest] = useState(false);
  const [restSeconds, setRestSeconds] = useState(30);
  const [storageFailed, setStorageFailed] = useState(false);
  const [readyKeys, setReadyKeys] = useState<string[]>([]);
  const [adventureOpen, setAdventureOpen] = useState(false);
  const [firstStory, setFirstStory] = useState<FirstAdventureState>(emptyFirstAdventure);
  const firstStoryRef = useRef(firstStory);
  const run = useRef<Run>(freshRun());
  const phaseRef = useRef<Phase>("home");
  const settingsRef = useRef(settings);
  const progressRef = useRef(progress);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const shell = useRef<HTMLDivElement>(null);
  const soundContext = useRef<AudioContext | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restOffered = useRef(false);
  const lesson = LESSONS[selected];
  const lessonIntroKeys = [...lesson.keys].filter(key => /[a-z;]/.test(key)).slice(0, 2);
  const introKeyPair = lesson.mode === "pinyin" || lessonIntroKeys.length < 2 ? "fj" : lessonIntroKeys.join("");
  const region = CHAPTERS[chapter];
  const active = phase !== "home";
  const worldPage = active || page === "map";
  const localIndex = chapterLocalIndex(selected);
  const project = PROJECTS[localIndex % PROJECTS.length];
  const built = chapterProjects(journey, chapter);
  const previewing = chapterStart(chapter) > progress.unlocked;
  const nextIsland = chapter < CHAPTERS.length - 1 && chapterLessons(chapter).every(l => progress.best[l.id] >= 90);
  const showKeyboard = settings.keyboard && keyboardExpanded && !blindMode && lesson.mode !== "pinyin";
  const todaySessions = progress.history.filter(s => localDay(new Date(s.date)) === localDay());
  const todayMinutes = Math.floor(todaySessions.reduce((n, s) => n + s.seconds, 0) / 60);
  const weak = weakKeys(progress.keyStats, journey.timing);
  const dueLesson = LESSONS.findIndex(item => {
    const mastery = progress.mastery[item.id];
    return mastery?.independentBest >= 90 && mastery.delayedBest < 90 && mastery.independentDate < localDay();
  });
  const target = prompts[snapshot.line]?.[snapshot.position] ?? "f";
  const totalChars = prompts.reduce((n, p) => n + p.length, 0);
  const doneChars = prompts.slice(0, snapshot.line).reduce((n, p) => n + p.length, 0) + snapshot.position;
  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => {
    try {
      // Local storage is an external store and is unavailable during server rendering.
      const original = loadIslandProgress(localStorage.getItem(STORAGE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      const story = loadFirstAdventure(localStorage.getItem(FIRST_ADVENTURE_KEY)); setFirstStory(story); firstStoryRef.current = story;
      const saved = awardFirstAdventure(original, story); setProgress(saved); progressRef.current = saved;
      const restored = loadJourney(localStorage.getItem(JOURNEY_KEY), saved);
      if (story.phase === "complete") restored.projects[LESSONS[0].id] = Math.max(6, restored.projects[LESSONS[0].id] ?? 0);
      setJourney(restored); journeyRef.current = restored;
      setSelected(restored.draft?.lesson ?? saved.unlocked); setChapter(chapterForLesson(restored.draft?.lesson ?? saved.unlocked));
      if (!saved.history.length && !restored.draft && story.phase !== "complete") setAdventureOpen(true);
      const stored = JSON.parse(localStorage.getItem("anqi-island-settings-v1") ?? "null");
      setSettings({ sound: stored?.sound !== false, keyboard: stored?.keyboard !== false, reducedMotion: typeof stored?.reducedMotion === "boolean" ? stored.reducedMotion : matchMedia("(prefers-reduced-motion: reduce)").matches });
    } catch { setStorageFailed(true); }
    setHydrated(true);
  }, []);
  // Report failures of the external storage API without interrupting the lesson.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { setStorageFailed(true); } }, [progress, hydrated]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem("anqi-island-settings-v1", JSON.stringify(settings)); } catch { setStorageFailed(true); } }, [settings, hydrated]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { const update = () => setFullscreen(!!document.fullscreenElement); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current); const context = soundContext.current; if (context && context.state !== "closed") void context.close().catch(() => {}); soundContext.current = null; }, []);

  const chime = useCallback((kind: "key" | "line" | "finish") => {
    if (!settingsRef.current.sound) return;
    try {
      const ctx = soundContext.current && soundContext.current.state !== "closed" ? soundContext.current : new AudioContext(); soundContext.current = ctx; if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const notes = kind === "finish" ? [523.25, 659.25, 783.99, 1046.5] : kind === "line" ? [659.25, 880] : [440 + run.current.combo % 5 * 55];
      notes.forEach((frequency, i) => { const osc = ctx.createOscillator(), gain = ctx.createGain(); const at = ctx.currentTime + i * .09; osc.type = "sine"; osc.frequency.value = frequency; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(kind === "key" ? .018 : .045, at + .012); gain.gain.exponentialRampToValueAtTime(.001, at + .26); osc.connect(gain); gain.connect(ctx.destination); osc.start(at); osc.stop(at + .3); });
    } catch { /* Audio is optional; typing always remains available. */ }
  }, []);
  const storeJourney = useCallback((next: Journey) => {
    journeyRef.current = next; setJourney(next);
    try { localStorage.setItem(JOURNEY_KEY, JSON.stringify(next)); } catch { setStorageFailed(true); }
  }, []);
  const updateFirstStory = useCallback((action: AdventureAction) => {
    const next = advanceAdventure(firstStoryRef.current, action);
    if (next === firstStoryRef.current) return next;
    firstStoryRef.current = next; setFirstStory(next);
    try { localStorage.setItem(FIRST_ADVENTURE_KEY, JSON.stringify(next)); } catch { setStorageFailed(true); }
    if (next.phase === "complete") {
      const awarded = awardFirstAdventure(progressRef.current, next);
      progressRef.current = awarded; setProgress(awarded);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(awarded)); } catch { setStorageFailed(true); }
      storeJourney({ ...journeyRef.current, projects: { ...journeyRef.current.projects, [LESSONS[0].id]: 6 } });
    }
    return next;
  }, [storeJourney]);
  const checkpoint = useCallback(() => {
    if (!run.current.started) return;
    storeJourney(checkpointJourney(journeyRef.current, { lesson: selected, review, retest, prompts, run: run.current }));
  }, [storeJourney, selected, review, retest, prompts]);
  const openLesson = useCallback((index: number, isReview = false, isRetest = false) => {
    if (index > progressRef.current.unlocked) { setNotice("先完成前面的练习，准确率达到 90% 就能解锁啦。"); return; }
    const draft = journeyRef.current.draft;
    if (draft && (draft.lesson !== index || draft.review !== isReview || !!draft.retest !== isRetest)) { setNotice("还有一段未完成的冒险，先继续它；也可以在准备页面选择重新开始。"); index = draft.lesson; isReview = draft.review; isRetest = !!draft.retest; }
    setSelected(index); setChapter(chapterForLesson(index)); setReview(isReview); setRetest(isRetest); setBlindMode(isRetest); setPrompts(draft?.lesson === index && draft.review === isReview && !!draft.retest === isRetest ? draft.prompts : isRetest ? LESSONS[index].prompts : isReview ? reviewPrompts(progressRef.current.keyStats, index, journeyRef.current.timing) : LESSONS[index].prompts); setReadyKeys([]); setExploring(false); setWrong(false); setResult(null); setMapOpen(false); changePhase("intro"); window.scrollTo(0, 0);
  }, [changePhase]);
  function start(restart = false) { const draft = journeyRef.current.draft; run.current = !restart && draft?.lesson === selected && draft.review === review ? structuredClone(draft.run) : freshRun(); if (restart) storeJourney({ ...journeyRef.current, draft: null }); lastKeyAt.current = 0; setSnapshot({ ...run.current }); setKeyboardExpanded(window.innerHeight >= 900); setFeedback(run.current.hits ? "接着上次的位置，慢慢来。" : lesson.mode === "pinyin" ? "切换到中文拼音输入法，选出亮起的汉字。" : `先找到 ${keyLabel(introKeyPair[0])} / ${keyLabel(introKeyPair[1])}，再输入亮起的字母。`); changePhase("playing"); setTimeout(() => input.current?.focus(), 30); }
  const pause = useCallback(() => { if (phaseRef.current === "playing") { checkpoint(); lastKeyAt.current = 0; changePhase("paused"); } }, [changePhase, checkpoint]);
  function resume() { lastKeyAt.current = 0; changePhase("playing"); setTimeout(() => input.current?.focus(), 30); }
  function home() { if (phaseRef.current === "playing" || phaseRef.current === "paused") checkpoint(); changePhase("home"); setPage("map"); setExploring(true); setResult(null); setWrong(false); run.current = freshRun(); setSnapshot({ ...run.current }); window.scrollTo(0, 0); }
  useEffect(() => { const save = () => { if (phaseRef.current === "playing" || phaseRef.current === "paused") checkpoint(); }; window.addEventListener("pagehide", save); return () => window.removeEventListener("pagehide", save); }, [checkpoint]);
  useEffect(() => {
    if (phase !== "playing") return;
    let previous = performance.now();
    const id = setInterval(() => { const now = performance.now(); if (run.current.started && phaseRef.current === "playing") run.current.seconds += (now - previous) / 1000; previous = now; setSnapshot({ ...run.current }); }, 250);
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener("blur", pause); document.addEventListener("visibilitychange", hidden);
    return () => { clearInterval(id); window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", hidden); };
  }, [phase, pause]);
  const acceptKey = useCallback((key: string) => {
    if (phaseRef.current !== "playing") return;
    const r = run.current; const expected = prompts[r.line]?.[r.position]; if (!expected) return;
    r.started = true; const stat = r.stats[expected] ?? { hits: 0, misses: 0 };
    if (key !== expected) {
      r.mistakes++; r.combo = 0; stat.misses++; r.stats[expected] = stat; setWrong(true);
      setFeedback(key.toLowerCase() === expected.toLowerCase() ? "注意大小写：检查 Caps Lock，按提示使用 Shift。" : `没关系，位置还在这里。试试 ${keyLabel(expected)}。`);
      lastKeyAt.current = 0;
      if (errorTimer.current) clearTimeout(errorTimer.current); errorTimer.current = setTimeout(() => setWrong(false), 300); setSnapshot({ ...r }); checkpoint(); return;
    }
    const now = performance.now(); const elapsed = now - lastKeyAt.current;
    if (lastKeyAt.current && elapsed > 0 && elapsed <= 10000) { const t = r.timing[expected] ?? { samples: 0, totalMs: 0, hesitations: 0 }; r.timing[expected] = { samples: t.samples + 1, totalMs: t.totalMs + Math.round(elapsed), hesitations: t.hesitations + (elapsed > 2000 ? 1 : 0) }; }
    lastKeyAt.current = now;
    if (!blindMode) r.assistedHits++;
    r.hits++; r.combo++; stat.hits++; r.stats[expected] = stat; r.position++; setWrong(false);
    if (r.position === prompts[r.line].length) {
      r.line++; r.position = 0; setFeedback(retest ? "这一组独立完成了，手指还记得！" : review ? "这组完成啦，棉棉在为你摇尾巴。" : selected < 4 ? `你完成了第 ${r.line} ${project.unit}。手指回家，继续下一组。` : `这组完成啦，${region.name}又多了一点新风景。`); chime("line");
      if (r.line >= prompts.length) { const summary = scoreSession(selected, r.hits, r.mistakes, r.seconds, review, r.assistedHits === 0 && blindMode); const next = saveSession(progressRef.current, summary, lesson.mode === "pinyin" ? {} : r.stats); progressRef.current = next; setProgress(next); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setStorageFailed(true); } storeJourney(finishJourney(journeyRef.current, { lesson: selected, review, retest, prompts, run: r })); setResult(summary); changePhase("complete"); chime("finish"); }
    } else chime("key");
    if (phaseRef.current === "playing") checkpoint();
    setSnapshot({ ...r });
  }, [prompts, selected, review, retest, blindMode, chime, changePhase, checkpoint, storeJourney, project.unit, lesson.mode, region.name]);
  const acceptCommittedChinese = useCallback((text: string) => {
    for (const char of text) {
      if (/^[\u3400-\u9fff，。！？：；、]$/.test(char)) {
        const expected = prompts[run.current.line]?.[run.current.position];
        acceptKey(char);
        if (char !== expected) break;
      } else if (char.trim()) { setFeedback("请选择中文拼音输入法，并确认候选字后再继续。"); break; }
    }
  }, [acceptKey, prompts]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (settingsOpen || help || rest) return;
      if (phaseRef.current === "intro" && introKeyPair.includes(event.key.toLowerCase())) { setReadyKeys(old => [...new Set([...old, event.key.toLowerCase()])]); return; }
      if (event.key === "Escape" && phaseRef.current === "playing") { event.preventDefault(); pause(); return; }
      if (phaseRef.current !== "playing" || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (lesson.mode === "pinyin") return;
      if (event.target instanceof HTMLElement && event.target.closest("button, select, textarea, input:not(.typing-capture)")) return;
      if (event.isComposing || event.key === "Process" || event.keyCode === 229) { setFeedback("请先切换到英文输入法，再输入亮起的字母。"); return; }
      if (event.key === "Backspace") { event.preventDefault(); setFeedback("打错不用删除，输入亮起的字母就能继续。"); return; }
      if (event.key.length === 1) { event.preventDefault(); acceptKey(event.key); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [acceptKey, settingsOpen, help, rest, pause, lesson.mode, introKeyPair]);
  useEffect(() => { if (phase === "complete" && todayMinutes >= 10 && !restOffered.current) { restOffered.current = true; setRestSeconds(30); setRest(true); } }, [phase, todayMinutes]);
  useEffect(() => { if (!rest) return; const id = setInterval(() => setRestSeconds(v => Math.max(0, v - 1)), 1000); return () => clearInterval(id); }, [rest]);
  function settingsDialog() { pause(); setSettingsOpen(true); }
  async function toggleFullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { setNotice("当前浏览器不支持全屏，可以放大浏览器窗口。"); } }
  function switchPage(next: Page) { setPage(next); setExploring(next === "map"); window.scrollTo(0, 0); }
  function selectChapter(index: number) { setChapter(index); setSelected(Math.max(chapterStart(index), Math.min(progress.unlocked, chapterStart(index + 1) - 1))); setMapOpen(false); setNotice(chapterStart(index) > progress.unlocked ? `欢迎先看看${CHAPTERS[index].name}。完成前面的指法课后，就能在这里做任务。` : ""); }
  function showHelp() { pause(); setHelp(true); }

  if (adventureOpen && hydrated) return <Suspense fallback={<div className="scene-loading"><Icon name="flower" size={32}/><p>正在打开棉棉的故事…</p></div>}><FirstAdventure state={firstStory} dispatch={updateFirstStory} sound={settings.sound} reducedMotion={settings.reducedMotion} storageFailed={storageFailed} onSound={chime} onToggleSound={() => setSettings(s => ({ ...s, sound: !s.sound }))} onExit={next => { setAdventureOpen(false); setPage("map"); setChapter(0); setSelected(Math.min(3, progressRef.current.unlocked)); setExploring(true); if (next !== undefined) openLesson(next); }}/></Suspense>;

  return <div ref={shell} className={`island-app desktop-game ${settings.reducedMotion ? "calm-mode" : ""} ${active ? "is-training" : ""} ${worldPage ? "is-world" : "is-library"} phase-${phase}`}>
    <header className="island-topbar">
      <button className="island-brand" onClick={() => { if (active) pause(); else switchPage("map"); }} aria-label="安琪打字机"><span className="brand-flower"><Icon name="flower" size={27}/></span><span><strong>安琪打字机</strong><small>和棉棉一起，让指尖的小岛生长</small></span></button>
      {!active ? <nav className="desktop-nav" aria-label="游戏导航">{NAV.map(item => <button key={item.id} className={page === item.id ? "nav-active" : ""} onClick={() => switchPage(item.id)} aria-current={page === item.id ? "page" : undefined}><Icon name={item.icon} size={19}/><span>{item.label}</span></button>)}</nav> : <div className="session-label"><span className="status-dot"/>{retest ? "无提示复测" : review ? "专属温习" : lesson.title}<span> · 先打准，再打快</span></div>}
      <div className="island-top-actions"><span className="flower-wallet"><Icon name="flower" size={20}/><strong>{progress.flowers}</strong><span>花种</span></span><button className="icon-button" onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))} aria-label={settings.sound ? "关闭音效" : "开启音效"}><Icon name={settings.sound ? "sound" : "mute"}/></button><button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? "退出全屏" : "进入全屏"}><Icon name="expand"/></button><button className="icon-button" onClick={settingsDialog} aria-label="打开设置"><Icon name="settings"/></button></div>
    </header>
    <main className="island-main">
      {worldPage && <section className={`world-stage biome-${chapter}`} aria-label={`${region.name}三维探索场景`}>
        {hydrated ? <Suspense fallback={<div className="scene-loading"><span className="loading-flower">✿</span><p>正在唤醒小岛…</p></div>}>
          <IslandScene chapter={chapter} growth={progress.flowers} pulse={snapshot.line} keyHits={snapshot.hits} celebrate={phase === "complete"} reducedMotion={settings.reducedMotion} paused={phase === "paused" || phase === "intro" || settingsOpen || help || rest || mapOpen} exploring={!active && exploring} training={active} focus={localIndex} projects={built} garden={chapter === 0 && firstStory.phase === "complete" ? { spot: firstStory.spot, color: firstStory.color } : undefined} available={Math.min(region.count - 1, progress.unlocked - chapterStart(chapter))} onQuest={station => { if (phaseRef.current === "home") openLesson(chapterStart(chapter) + station); }}/>
        </Suspense> : <div className="scene-loading"><span className="loading-flower">✿</span><p>正在唤醒小岛…</p></div>}
        <div className="world-heading">
          <p className="world-eyebrow"><span/>CHAPTER 0{chapter + 1} · {active ? "指尖正在改变世界" : "一座由你亲手唤醒的小岛"}</p>
          <h1>{active ? retest ? "不看提示，试试记住了吗。" : review ? "和熟悉的按键，再见一面。" : chapter === 0 ? project.name : lesson.title : region.name}<span>{!active && ` / ${["溪边的好时光", "风吹过的秘密", "湖畔的星光", "写给远方的信", "写下自己的故事", "中文也能自由表达"][chapter]}`}</span></h1>
          <p>{active ? review ? "慢慢找准手指，棉棉会陪着你。" : chapter === 0 ? project.action : lesson.story : "今天，让这里多一点你的痕迹。"}</p>
          {!active && <button className="world-map-button" onClick={() => setMapOpen(true)}><Icon name="map" size={18}/>岛屿与旅程<Icon name="chevron" size={16}/></button>}
          {!active && chapter === 0 && <button className="world-map-button story-entry" disabled={!hydrated} onClick={() => setAdventureOpen(true)}><Icon name="paw" size={18}/>{firstStory.phase === "complete" ? "打开我们的小院纪念卡" : firstStory.phase === "meet" ? "新故事 · 帮棉棉找到新家" : "继续故事 · 棉棉的新家"}<Icon name="chevron" size={16}/></button>}
        </div>
        <div className="world-status"><Icon name={chapter === 2 ? "star" : "sun"} size={18}/><span>{chapter === 2 ? "星光微亮" : "晴 · 微风"}</span><i/><span>{active ? "Esc 暂停" : `今天练习 ${todayMinutes} 分钟`}</span></div>
        {!active && <aside className="mission-card">
          <div className="mission-kicker"><Icon name="paw" size={19}/><span>{chapter === 0 ? "棉棉的溪边花园" : `${region.name}的旅程`}</span><span>{built.filter(n => n === 6).length}/{region.count}</span></div>
          <h2>{previewing ? `先看看${region.name}` : journey.draft ? "我们的冒险，还差一点点。" : chapter === 0 && built.every(n => n === 6) ? "看，这是我们一起建的花园。" : lesson.title}</h2>
          <p>{previewing ? "你可以自由走走，看看将来的探险。任务会在前面的课程达到 90% 准确率后开放。" : journey.draft ? `已保存「${LESSONS[journey.draft.lesson].title}」第 ${journey.draft.run.line + 1} 组，回来接着玩。` : nextIsland ? `${region.name}的练习完成了。下一座岛已经开放，随时可以回来看你的成果。` : chapter === 0 ? project.action : lesson.story}</p>
          <div className={`mission-steps ${region.count > 4 ? "mission-steps-wide" : ""}`} aria-label="小岛建设进度">{chapterLessons(chapter).map((item, i) => <button key={item.id} aria-label={`${item.title}，已完成 ${built[i]} / 6 组`} aria-disabled={chapterStart(chapter) + i > progress.unlocked} className={`${localIndex === i ? "step-current" : ""} ${built[i] === 6 ? "step-done" : ""}`} onClick={() => { if (chapterStart(chapter) + i > progress.unlocked) setNotice("先完成上一课，准确率达到 90% 后继续。"); else setSelected(chapterStart(chapter) + i); }}><Icon name={built[i] === 6 ? "check" : chapterStart(chapter) + i > progress.unlocked ? "lock" : PROJECTS[i % 4].icon} size={19}/><span>{chapter === 0 ? ["花圃", "小桥", "风铃", "暖灯"][i] : item.title}</span><small>{built[i]}/6</small></button>)}</div>
          <button className="primary-button" disabled={!hydrated} onClick={() => { if (previewing) selectChapter(chapterForLesson(progress.unlocked)); else if (!journey.draft && nextIsland) selectChapter(chapter + 1); else openLesson(journey.draft?.lesson ?? selected, journey.draft?.review ?? false, journey.draft?.retest ?? false); }}>{previewing ? "回到正在学的区域" : journey.draft ? "继续上次冒险" : nextIsland ? `去${CHAPTERS[chapter + 1].name}看看` : "开始小冒险"}<Icon name="arrow" size={20}/></button>
          <div className="mission-footnote"><Icon name="keyboard" size={16}/>{lesson.subtitle}<span>· 不限时</span></div>
        </aside>}
        {active && phase !== "intro" && <div className="world-task-progress" role="status"><Icon name={project.icon} size={20}/><strong>{retest ? `独立复测 ${snapshot.line} / 6 组` : review ? `已温习 ${snapshot.line} / 6 组` : chapter === 0 ? `${project.name} · ${built[localIndex]} / 6` : `已完成 ${snapshot.line} / 6 组`}</strong><span>{phase === "complete" ? "这份改变会留在小岛上" : "完成一组，看见一点改变"}</span></div>}
        {!active && <div className="exploration-tools"><span><Icon name="paw" size={19}/>点击草地，棉棉就会走过去</span><span>拖动转动视角 · 滚轮缩放</span><button className="text-button" onClick={showHelp}>操作帮助 <span>?</span></button></div>}
      </section>}
      {!worldPage && <div className="page-heading"><div><p className="eyebrow">YOUR LITTLE ISLAND</p><h1>{page === "practice" ? "小练习，也有大进步。" : page === "garden" ? "每一朵花，都是你的努力。" : "看看正在成长的自己。"}</h1><p className="heading-note">{page === "practice" ? "从手指的位置开始，慢慢练出自己的节奏。" : page === "garden" ? "这些改变，会一直留在你的小岛上。" : "不和别人比。比昨天更熟练一点，就很棒。"}</p></div><button className="secondary-button" onClick={() => switchPage("map")}><Icon name="map"/>回到小岛</button></div>}
      {!active && page === "practice" && dueLesson >= 0 && <section className="spaced-review-banner"><span><Icon name="sun" size={27}/></span><div><strong>今天的指法巩固</strong><p>昨天独立完成的「{LESSONS[dueLesson].title}」，今天再不看提示打一次，看看手指还记得吗？</p></div><button className="primary-button" onClick={() => openLesson(dueLesson, true, true)}>开始隔日复测<Icon name="arrow" size={18}/></button></section>}
      {!active && page === "garden" && <><section className="garden-builds"><h2>亲手建成的溪边花园</h2><p>完成每组练习就保存一份改变；课程仍以准确率解锁。</p><div>{PROJECTS.map((p, i) => <article key={p.name}><Icon name={p.icon} size={30}/><h3>{p.name}</h3><strong>{chapterProjects(journey, 0)[i]} / 6</strong><span>{chapterProjects(journey, 0)[i] === 6 ? "已留在小岛上" : "正在慢慢生长"}</span></article>)}</div><button className="primary-button" onClick={() => { setChapter(0); setSelected(Math.min(progress.unlocked, 3)); switchPage("map"); }}>去花园看看<Icon name="arrow"/></button></section><section className="souvenir-list"><div className="section-heading"><h2>探险纪念册</h2><span>准确率达到 90% 后获得</span></div><div className="souvenir-grid">{LESSONS.map((l, i) => <div className={(progress.best[l.id] ?? 0) >= 90 ? "souvenir earned" : "souvenir"} key={l.id}><Icon name={(progress.best[l.id] ?? 0) >= 90 ? ["flower", "map", "sound", "mail"][i % 4] : "lock"} size={26}/><strong>{l.reward}</strong><small>{(progress.best[l.id] ?? 0) >= 90 ? "已收藏" : `第 ${i + 1} 课解锁`}</small></div>)}</div></section></>}
      {!active && page === "practice" && <div className="practice-page"><section className="review-banner"><span className="review-symbol"><Icon name="keyboard" size={40}/></span><div><p className="eyebrow">JUST FOR YOU</p><h2>{weak.length ? "把不太熟的键，再认识一次。" : "先和键盘交个朋友吧。"}</h2><p>{weak.length ? `最近可以多练：${weak.map(keyLabel).join("、")}。今天不用急，一次进步一点点。` : "先完成一课，棉棉会根据你的易错键准备专属练习。"}</p></div><button className="primary-button" onClick={() => openLesson(progress.unlocked, weak.length > 0 && LESSONS[progress.unlocked].mode !== "pinyin")}>{weak.length ? "开始针对练习" : "开始基础练习"}<Icon name="arrow" size={18}/></button></section>{CHAPTERS.map((c, ci) => <section className="lesson-collection" key={c.name}><h2><span>0{ci + 1}</span>{c.name}<small>{c.subtitle}</small></h2><div className="lesson-grid">{chapterLessons(ci).map((l, offset) => { const index = chapterStart(ci) + offset; const locked = index > progress.unlocked; return <button key={l.id} aria-disabled={locked} className={`lesson-tile ${locked ? "lesson-locked" : ""}`} onClick={() => openLesson(index)}><span className="tile-top"><span>LESSON {String(index + 1).padStart(2, "0")}</span><Icon name={locked ? "lock" : progress.best[l.id] >= 90 ? "check" : "arrow"} size={18}/></span><h3>{l.title}</h3><p>{l.subtitle}</p><div><kbd>{l.mode === "pinyin" ? "中文 · 拼音" : l.keys ? [...l.keys].map(keyLabel).join(" ") : "Aa · story"}</kbd><small>{progress.best[l.id] ? `最佳 ${progress.best[l.id]}%` : "6 组小练习"}</small></div></button>; })}</div></section>)}</div>}
      {!active && page === "journal" && <IslandJournal progress={progress} journey={journey} onLesson={openLesson}/>}
      {!worldPage && <footer className="island-footer"><span><Icon name="heart" size={15}/>先打准，再打快。每一次认真尝试，都值得被看见。</span><span>为 10 岁左右的小小探险家设计</span></footer>}
      {(phase === "playing" || phase === "paused") && <section className={`typing-workspace ${showKeyboard ? "keyboard-open" : "keyboard-folded"} ${wrong ? "typing-wrong" : ""}`} inert={phase === "paused"} aria-label="打字练习">
        <div className="typing-heading"><button className="text-button" onClick={pause}><Icon name="pause" size={18}/>暂停 <kbd>Esc</kbd></button><span>{retest ? "无提示复测" : review ? "专属温习" : `第 ${selected + 1} 课`} · {lesson.title}</span><span>第 {snapshot.line + 1} / {prompts.length} 组</span></div>
        <div className="lesson-progress" role="progressbar" aria-label="本轮练习进度" aria-valuenow={Math.round(doneChars / totalChars * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${doneChars / totalChars * 100}%` }}/></div>
        <div className="typing-guide-row"><span><Icon name="flower" size={17}/>{snapshot.combo >= 5 ? `连续打对 ${snapshot.combo} 个，继续保持` : blindMode ? "无提示挑战：想起手指的家，再慢慢输入" : lesson.mode === "pinyin" ? "输入拼音，选出亮起的汉字" : "看屏幕，跟着亮起的字母输入"}</span><span>准确率 {snapshot.hits + snapshot.mistakes ? Math.round(snapshot.hits / (snapshot.hits + snapshot.mistakes) * 100) : 100}%</span></div>
        <div className={`typing-prompt ${(prompts[snapshot.line]?.length ?? 0) <= 8 ? "short-prompt" : ""}`} aria-label={`请键入：${prompts[snapshot.line]}`} onClick={() => input.current?.focus()}>{[...(prompts[snapshot.line] ?? "")].map((letter, i) => <span key={`${snapshot.line}-${i}`} className={i < snapshot.position ? "typed-letter" : i === snapshot.position ? "current-letter" : "pending-letter"}>{letter === " " ? "␣" : letter}</span>)}</div>
        {lesson.mode === "pinyin" ? <input ref={input} className="typing-capture typing-capture-ime" aria-label="中文拼音输入区" autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="text" onPaste={e => { e.preventDefault(); setFeedback("请亲手输入拼音，选出目标汉字。"); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={e => { composing.current = false; const value = e.currentTarget.value; e.currentTarget.value = ""; acceptCommittedChinese(value); }} onChange={e => { if (composing.current || (e.nativeEvent as InputEvent).isComposing) return; const value = e.currentTarget.value; e.currentTarget.value = ""; if (value) acceptCommittedChinese(value); }}/> : <input ref={input} className="typing-capture" aria-label="打字输入区" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="text" value="" onPaste={e => { e.preventDefault(); setFeedback("试着用自己的手指，一个字母一个字母地输入。"); }} onChange={e => { const value = e.target.value; if (value.length === 1 && /^[\x20-\x7e]$/.test(value) && !(e.nativeEvent as InputEvent).isComposing) acceptKey(value); else if (value) setFeedback("请切换到英文输入法，再试一次。"); }}/>}
        <p className="typing-feedback" role="status" aria-live="polite">{feedback}</p>{lesson.mode === "pinyin" ? !blindMode && <p className="ime-instruction"><Icon name="keyboard" size={18}/>在系统输入法中选择目标字或词；拼音字母仍按标准指法输入。</p> : !blindMode && <IslandKeyboard target={target} guide={showKeyboard}/>}<div className="typing-bottom"><span>{lesson.fingerGoal ?? "打错不会掉生命，也不会被催促"}</span><button className="text-button" aria-pressed={blindMode} onClick={() => { setBlindMode(!blindMode); setTimeout(() => input.current?.focus(), 30); }}><Icon name="keyboard" size={18}/>{blindMode ? "显示指法提示" : "隐藏提示，独立练习"}</button>{lesson.mode !== "pinyin" && !blindMode && <button className="text-button" aria-expanded={showKeyboard} onClick={() => { setSettings(s => ({ ...s, keyboard: true })); setKeyboardExpanded(!showKeyboard); setTimeout(() => input.current?.focus(), 30); }}>{showKeyboard ? "收起键盘图" : "展开键盘图"}</button>}</div>
      </section>}
    </main>
    {phase === "intro" && <Modal title="出发前的小准备" close={home} className="intro-modal"><span className="modal-symbol"><Icon name="flower" size={32}/></span><p className="eyebrow">READY FOR A LITTLE ADVENTURE?</p><h2>{retest ? "不看提示，试试手指记住了吗" : review ? "和易错键再交一次朋友" : lesson.title}</h2><p className="modal-lead">{retest ? `独立复测「${lesson.title}」。不看指法提示，保持舒服的节奏；打错也可以重试。` : review ? "这一轮只练你已经遇到过的字母。慢一点找到正确的手指，让不太熟的键变得更顺手。" : lesson.story}</p><div className="posture-steps"><span><b>1</b>坐舒服，肩膀放松</span><span><b>2</b>{lesson.mode === "pinyin" ? "切换中文拼音输入法" : "切换英文输入法"}</span><span><b>3</b>{lesson.fingerGoal ?? "食指找到 F / J 的凸点"}</span></div><div className="home-key-demo"><div><kbd className={readyKeys.includes(introKeyPair[0]) ? "ready" : ""}>{keyLabel(introKeyPair[0])}</kbd><span>{fingerFor(introKeyPair[0]).name}</span></div><span className="home-key-line"/><div><kbd className={readyKeys.includes(introKeyPair[1]) ? "ready" : ""}>{keyLabel(introKeyPair[1])}</kbd><span>{fingerFor(introKeyPair[1]).name}</span></div></div><p className="demo-hint">{readyKeys.length === 2 ? "找到啦！现在可以出发了。" : `可以先按一下 ${keyLabel(introKeyPair[0])} 和 ${keyLabel(introKeyPair[1])}，感受手指的位置。`}</p><button className="primary-button modal-primary" onClick={() => start()}>{journey.draft?.lesson === selected ? "接着上次，继续冒险" : "准备好了，出发"}<Icon name="arrow" size={19}/></button>{journey.draft?.lesson === selected && <button className="text-button" onClick={() => start(true)}>重新练这一课（保留已建成果）</button>}<p className="modal-small">{prompts.length} 组练习 · 没有倒计时 · {retest ? "独立准确率 90% 才算掌握" : review ? "温习完成后可重试正式课程" : "准确率 90% 解锁下一课"}</p></Modal>}
    {phase === "paused" && !settingsOpen && !help && <Modal title="练习已暂停" close={resume} className="pause-modal"><span className="modal-symbol"><Icon name="pause" size={32}/></span><h2>小岛会等你。</h2><p className="modal-lead">伸伸手指，休息一下。回来后从刚才的地方继续。</p><div className="pause-progress">已完成 {snapshot.line} / {prompts.length} 组 · 已打对 {snapshot.hits} 个字符</div><button className="primary-button modal-primary" onClick={resume}><Icon name="play" size={18}/>继续这段旅程</button><button className="text-button leave-button" onClick={home}>保存并回到小岛</button></Modal>}
    {phase === "complete" && result && !rest && <section className="completion-card" aria-label="本轮练习完成">
      <div className="completion-icon"><Icon name={project.icon} size={28}/></div><p className="eyebrow">A LITTLE CHANGE, MADE BY YOU</p>
      <h2 aria-live="polite">{retest && result.independent && result.accuracy >= 90 ? "你已经可以独立打出来了！" : review ? "熟悉的按键，更顺手了。" : selected < 4 ? project.complete : "你又完成了一段小旅程。"}</h2>
      <p>{result.accuracy >= 90 ? retest ? progress.mastery[lesson.id]?.delayedBest >= 90 ? "隔天复测也完成了，真正记住了这一课。" : "没有看指法提示也完成了！明天再来一小轮，就更牢固。" : review ? "温习完成，准备好可以回到正式课程。" : `「${lesson.reward}」已收藏，下一段旅程已准备好。` : "成果已经保留。再巩固一下，准确率达到 90% 后开启下一课。"}</p>
      <div className="completion-metrics"><span><strong>{result.accuracy}%</strong>准确率</span><span><strong>{result.wpm}</strong>{lesson.mode === "pinyin" ? "字 / 分" : "词 / 分"}</span><span><strong>+{result.accuracy >= 90 ? 6 : 3}</strong>花种</span></div>
      <button className="primary-button" onClick={() => { if (review) openLesson(selected); else if (result.accuracy >= 90 && selected < LESSONS.length - 1) openLesson(selected + 1); else openLesson(selected, result.accuracy < 90); }}>{review ? "回到正式课程" : result.accuracy >= 90 && selected < LESSONS.length - 1 ? "下一段小冒险" : "再巩固一小轮"}<Icon name="arrow"/></button>
      {!retest && result.accuracy >= 90 && (progress.mastery[lesson.id]?.independentBest ?? 0) < 90 && <button className="secondary-button" onClick={() => openLesson(selected, true, true)}>挑战无提示复测</button>}
      <button className="secondary-button" onClick={home}>回小岛，看看我的成果</button>
      <span className="completion-save"><Icon name="check" size={16}/>{storageFailed ? "保存失败，请勿关闭页面" : "已保存 · 随时可以休息"}</span>
    </section>}
    {mapOpen && <Modal title="岛屿与旅程" close={() => setMapOpen(false)} className="journey-modal"><p className="eyebrow">YOUR NEXT LITTLE ADVENTURE</p><h2>岛屿与旅程</h2><p className="modal-lead">{CHAPTERS.length} 座探索区域，{LESSONS.length} 段从指尖出发的旅程。未解锁区域也可以先参观。</p><div className="chapter-tabs" role="tablist" aria-label="探险岛屿">{CHAPTERS.map((c, i) => <button key={c.name} role="tab" aria-selected={chapter === i} className={chapter === i ? "chapter-active" : ""} onClick={() => selectChapter(i)}>{c.name}{chapterStart(i) > progress.unlocked && <Icon name="lock" size={15}/>}</button>)}</div><div className="map-lessons">{chapterLessons(chapter).map((l, i) => <button key={l.id} aria-disabled={chapterStart(chapter) + i > progress.unlocked} onClick={() => openLesson(chapterStart(chapter) + i)}><Icon name={progress.best[l.id] >= 90 ? "check" : chapterStart(chapter) + i > progress.unlocked ? "lock" : PROJECTS[i % 4].icon}/><span><strong>{l.title}</strong><small>{l.subtitle}</small></span><Icon name="chevron" size={18}/></button>)}</div></Modal>}
    {settingsOpen && <Modal title="游戏设置" close={() => setSettingsOpen(false)}><p className="eyebrow">MAKE YOURSELF COMFORTABLE</p><h2>按照你喜欢的方式。</h2><p className="modal-lead">舒服地坐好，慢慢练习。</p><div className="settings-list">{[{ key: "sound" as const, title: "轻柔音效", detail: "按键的轻响和完成时的小旋律" }, { key: "keyboard" as const, title: "显示键盘提示", detail: "高亮下一个按键，提示应该用哪根手指" }, { key: "reducedMotion" as const, title: "安静画面", detail: "减少漂浮、晃动和粒子动画" }].map(item => <label key={item.key}><span><strong>{item.title}</strong><small>{item.detail}</small></span><input type="checkbox" role="switch" checked={settings[item.key]} onChange={e => setSettings(s => ({ ...s, [item.key]: e.target.checked }))}/></label>)}</div><p className="settings-privacy">进度自动保存在当前浏览器，无需注册。原版学习记录保留在本机，新课程从基础指法开始。</p><button className="primary-button modal-primary" onClick={() => setSettingsOpen(false)}>设置好了</button></Modal>}
    {help && <Modal title="怎么玩" close={() => setHelp(false)} className="help-modal"><span className="modal-symbol"><Icon name="map" size={32}/></span><h2>一场从指尖出发的旅行。</h2><div className="help-steps"><p><b>01</b><span><strong>先找到手指的家</strong>左手 A S D F，右手 J K L ;。食指轻触 F / J 的凸点，拇指放在空格上。</span></p><p><b>02</b><span><strong>跟着亮起的字母输入</strong>字母下面会告诉你用哪根手指。打错时位置不变，慢慢重新试一次。</span></p><p><b>03</b><span><strong>让小岛一朵一朵开花</strong>每完成一组，花圃、小桥、风铃或暖灯就会改变。准确率达到 90% 解锁下一课。</span></p><p><b>04</b><span><strong>也要记得休息</strong>按 Esc 或切换窗口会暂停，位置自动保存。点击草地移动棉棉，点字母路牌开始任务。</span></p></div><button className="primary-button modal-primary" onClick={() => setHelp(false)}>我知道啦</button></Modal>}
    {rest && <Modal title="休息一下" close={() => setRest(false)}><span className="modal-symbol"><Icon name="leaf" size={32}/></span><h2>眼睛和手指，也想休息了。</h2><p className="modal-lead">今天已经练习 10 分钟。看看窗外远处，松开双手，伸一个舒服的懒腰。</p><div className="rest-count">{restSeconds}<small>秒放松时间</small></div><button className="primary-button modal-primary" onClick={() => { setRest(false); home(); }}>今天就到这里</button><button className="text-button leave-button" onClick={() => setRest(false)}>我已经休息好了</button></Modal>}
    {(notice || storageFailed) && <div className="island-toast" role="status"><Icon name={storageFailed ? "book" : "leaf"} size={19}/>{notice || "浏览器未允许保存记录，本次仍可练习，关闭页面后进度可能丢失。"}</div>}
  </div>;
}

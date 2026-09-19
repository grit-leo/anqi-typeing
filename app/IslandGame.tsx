"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CHAPTERS, LESSONS, STORAGE_KEY, emptyProgress, loadIslandProgress, localDay, scoreSession, saveSession, weakKeys, reviewPrompts, keyLabel, type IslandProgress, type Session } from "./island-engine";
import { JOURNEY_KEY, PROJECTS, emptyJourney, freshJourneyRun, loadJourney, checkpointJourney, finishJourney, chapterProjects, type Journey, type JourneyRun } from "./island-journey";
import { IslandKeyboard } from "./IslandKeyboard";
import { Icon } from "./IslandIcons";
const IslandScene = lazy(() => import("./IslandScene").then(m => ({ default: m.IslandScene })));
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
  const run = useRef<Run>(freshRun());
  const phaseRef = useRef<Phase>("home");
  const settingsRef = useRef(settings);
  const progressRef = useRef(progress);
  const input = useRef<HTMLInputElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const soundContext = useRef<AudioContext | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restOffered = useRef(false);
  const lesson = LESSONS[selected];
  const region = CHAPTERS[chapter];
  const active = phase !== "home";
  const worldPage = active || page === "map";
  const project = PROJECTS[selected % 4];
  const built = chapterProjects(journey, chapter);
  const nextIsland = chapter < 3 && LESSONS.slice(chapter * 4, chapter * 4 + 4).every(l => progress.best[l.id] >= 90);
  const showKeyboard = settings.keyboard && keyboardExpanded;
  const todaySessions = progress.history.filter(s => localDay(new Date(s.date)) === localDay());
  const todayMinutes = Math.floor(todaySessions.reduce((n, s) => n + s.seconds, 0) / 60);
  const completed = Object.values(progress.best).filter(score => score >= 90).length;
  const weak = weakKeys(progress.keyStats);
  const target = prompts[snapshot.line]?.[snapshot.position] ?? "f";
  const totalChars = prompts.reduce((n, p) => n + p.length, 0);
  const doneChars = prompts.slice(0, snapshot.line).reduce((n, p) => n + p.length, 0) + snapshot.position;
  const last = progress.history.at(-1);
  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => {
    try {
      // Local storage is an external store and is unavailable during server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      const saved = loadIslandProgress(localStorage.getItem(STORAGE_KEY)); setProgress(saved); progressRef.current = saved;
      const restored = loadJourney(localStorage.getItem(JOURNEY_KEY), saved); setJourney(restored); journeyRef.current = restored;
      setSelected(restored.draft?.lesson ?? saved.unlocked); setChapter(Math.floor((restored.draft?.lesson ?? saved.unlocked) / 4));
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
  const checkpoint = useCallback(() => {
    if (!run.current.started) return;
    storeJourney(checkpointJourney(journeyRef.current, { lesson: selected, review, prompts, run: run.current }));
  }, [storeJourney, selected, review, prompts]);
  const openLesson = useCallback((index: number, isReview = false) => {
    if (index > progressRef.current.unlocked) { setNotice("先完成前面的练习，准确率达到 90% 就能解锁啦。"); return; }
    const draft = journeyRef.current.draft;
    if (draft && (draft.lesson !== index || draft.review !== isReview)) { setNotice("还有一段未完成的冒险，先继续它；也可以在准备页面选择重新开始。"); index = draft.lesson; isReview = draft.review; }
    setSelected(index); setChapter(Math.floor(index / 4)); setReview(isReview); setPrompts(draft?.lesson === index && draft.review === isReview ? draft.prompts : isReview ? reviewPrompts(progressRef.current.keyStats, index) : LESSONS[index].prompts); setReadyKeys([]); setExploring(false); setWrong(false); setResult(null); setMapOpen(false); changePhase("intro"); window.scrollTo(0, 0);
  }, [changePhase]);
  function start(restart = false) { const draft = journeyRef.current.draft; run.current = !restart && draft?.lesson === selected && draft.review === review ? structuredClone(draft.run) : freshRun(); if (restart) storeJourney({ ...journeyRef.current, draft: null }); lastKeyAt.current = 0; setSnapshot({ ...run.current }); setKeyboardExpanded(window.innerHeight >= 900); setFeedback(run.current.hits ? "接着上次的位置，慢慢来。" : "双手找到 F / J，输入亮起的字母。"); changePhase("playing"); setTimeout(() => input.current?.focus(), 30); }
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
    if (showKeyboard) r.assistedHits++;
    r.hits++; r.combo++; stat.hits++; r.stats[expected] = stat; r.position++; setWrong(false);
    if (r.position === prompts[r.line].length) {
      r.line++; r.position = 0; setFeedback(review ? "这组完成啦，棉棉在为你摇尾巴。" : selected < 4 ? `你完成了第 ${r.line} ${project.unit}。手指回家，继续下一组。` : "这组完成啦，花园又长大了一点。"); chime("line");
      if (r.line >= prompts.length) { const summary = scoreSession(selected, r.hits, r.mistakes, r.seconds, review); const next = saveSession(progressRef.current, summary, r.stats); progressRef.current = next; setProgress(next); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setStorageFailed(true); } storeJourney(finishJourney(journeyRef.current, { lesson: selected, review, prompts, run: r })); setResult(summary); changePhase("complete"); chime("finish"); }
    } else chime("key");
    if (phaseRef.current === "playing") checkpoint();
    setSnapshot({ ...r });
  }, [prompts, selected, review, chime, changePhase, checkpoint, storeJourney, showKeyboard, project.unit]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (settingsOpen || help || rest) return;
      if (phaseRef.current === "intro" && (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "j")) { setReadyKeys(old => [...new Set([...old, event.key.toLowerCase()])]); return; }
      if (event.key === "Escape" && phaseRef.current === "playing") { event.preventDefault(); pause(); return; }
      if (phaseRef.current !== "playing" || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, select, textarea, input:not(.typing-capture)")) return;
      if (event.isComposing || event.key === "Process" || event.keyCode === 229) { setFeedback("请先切换到英文输入法，再输入亮起的字母。"); return; }
      if (event.key === "Backspace") { event.preventDefault(); setFeedback("打错不用删除，输入亮起的字母就能继续。"); return; }
      if (event.key.length === 1) { event.preventDefault(); acceptKey(event.key); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [acceptKey, settingsOpen, help, rest, pause]);
  useEffect(() => { if (phase === "complete" && todayMinutes >= 10 && !restOffered.current) { restOffered.current = true; setRestSeconds(30); setRest(true); } }, [phase, todayMinutes]);
  useEffect(() => { if (!rest) return; const id = setInterval(() => setRestSeconds(v => Math.max(0, v - 1)), 1000); return () => clearInterval(id); }, [rest]);
  function settingsDialog() { pause(); setSettingsOpen(true); }
  async function toggleFullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { setNotice("当前浏览器不支持全屏，可以放大浏览器窗口。"); } }
  function switchPage(next: Page) { setPage(next); setExploring(next === "map"); window.scrollTo(0, 0); }
  function selectChapter(index: number) { if (index * 4 > progress.unlocked) { setNotice(`完成${CHAPTERS[index - 1].name}的练习后，这座岛就会开放。`); return; } setChapter(index); setSelected(Math.min(progress.unlocked, index * 4)); }
  function showHelp() { pause(); setHelp(true); }

  return <div ref={shell} className={`island-app desktop-game ${settings.reducedMotion ? "calm-mode" : ""} ${active ? "is-training" : ""} ${worldPage ? "is-world" : "is-library"} phase-${phase}`}>
    <header className="island-topbar">
      <button className="island-brand" onClick={() => { if (active) pause(); else switchPage("map"); }} aria-label="安琪打字机"><span className="brand-flower"><Icon name="flower" size={27}/></span><span><strong>安琪打字机</strong><small>和棉棉一起，让指尖的小岛生长</small></span></button>
      {!active ? <nav className="desktop-nav" aria-label="游戏导航">{NAV.map(item => <button key={item.id} className={page === item.id ? "nav-active" : ""} onClick={() => switchPage(item.id)} aria-current={page === item.id ? "page" : undefined}><Icon name={item.icon} size={19}/><span>{item.label}</span></button>)}</nav> : <div className="session-label"><span className="status-dot"/>{review ? "专属温习" : lesson.title}<span> · 先打准，再打快</span></div>}
      <div className="island-top-actions"><span className="flower-wallet"><Icon name="flower" size={20}/><strong>{progress.flowers}</strong><span>花种</span></span><button className="icon-button" onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))} aria-label={settings.sound ? "关闭音效" : "开启音效"}><Icon name={settings.sound ? "sound" : "mute"}/></button><button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? "退出全屏" : "进入全屏"}><Icon name="expand"/></button><button className="icon-button" onClick={settingsDialog} aria-label="打开设置"><Icon name="settings"/></button></div>
    </header>
    <main className="island-main">
      {worldPage && <section className={`world-stage biome-${chapter}`} aria-label={`${region.name}三维探索场景`}>
        {hydrated ? <Suspense fallback={<div className="scene-loading"><span className="loading-flower">✿</span><p>正在唤醒小岛…</p></div>}>
          <IslandScene chapter={chapter} growth={progress.flowers} pulse={snapshot.line} celebrate={phase === "complete"} reducedMotion={settings.reducedMotion} paused={phase === "paused" || phase === "intro" || settingsOpen || help || rest || mapOpen} exploring={!active && exploring} training={active} focus={selected % 4} projects={built} available={Math.min(3, progress.unlocked - chapter * 4)} onQuest={station => { if (phaseRef.current === "home") openLesson(chapter * 4 + station); }}/>
        </Suspense> : <div className="scene-loading"><span className="loading-flower">✿</span><p>正在唤醒小岛…</p></div>}
        <div className="world-heading">
          <p className="world-eyebrow"><span/>CHAPTER 0{chapter + 1} · {active ? "指尖正在改变世界" : "一座由你亲手唤醒的小岛"}</p>
          <h1>{active ? review ? "和熟悉的按键，再见一面。" : chapter === 0 ? project.name : lesson.title : region.name}<span>{!active && ` / ${["溪边的好时光", "风吹过的秘密", "湖畔的星光", "写给远方的信"][chapter]}`}</span></h1>
          <p>{active ? review ? "慢慢找准手指，棉棉会陪着你。" : chapter === 0 ? project.action : lesson.story : "今天，让这里多一点你的痕迹。"}</p>
          {!active && <button className="world-map-button" onClick={() => setMapOpen(true)}><Icon name="map" size={18}/>岛屿与旅程<Icon name="chevron" size={16}/></button>}
        </div>
        <div className="world-status"><Icon name={chapter === 2 ? "star" : "sun"} size={18}/><span>{chapter === 2 ? "星光微亮" : "晴 · 微风"}</span><i/><span>{active ? "Esc 暂停" : `今天练习 ${todayMinutes} 分钟`}</span></div>
        {!active && <aside className="mission-card">
          <div className="mission-kicker"><Icon name="paw" size={19}/><span>{chapter === 0 ? "棉棉的溪边花园" : `${region.name}的旅程`}</span><span>{built.filter(n => n === 6).length}/4</span></div>
          <h2>{journey.draft ? "我们的冒险，还差一点点。" : chapter === 0 && built.every(n => n === 6) ? "看，这是我们一起建的花园。" : lesson.title}</h2>
          <p>{journey.draft ? `已保存「${LESSONS[journey.draft.lesson].title}」第 ${journey.draft.run.line + 1} 组，回来接着玩。` : nextIsland ? `${region.name}的练习完成了。下一座岛已经开放，随时可以回来看你的成果。` : chapter === 0 ? project.action : lesson.story}</p>
          <div className="mission-steps" aria-label="小岛建设进度">{PROJECTS.map((p, i) => <button key={p.name} aria-label={`${p.name}，已完成 ${built[i]} / 6 组`} aria-disabled={chapter * 4 + i > progress.unlocked} className={`${selected % 4 === i ? "step-current" : ""} ${built[i] === 6 ? "step-done" : ""}`} onClick={() => { if (chapter * 4 + i > progress.unlocked) setNotice("先完成上一课，准确率达到 90% 后继续。"); else setSelected(chapter * 4 + i); }}><Icon name={built[i] === 6 ? "check" : chapter * 4 + i > progress.unlocked ? "lock" : p.icon} size={19}/><span>{chapter === 0 ? ["花圃", "小桥", "风铃", "暖灯"][i] : `第 ${chapter * 4 + i + 1} 课`}</span><small>{built[i]}/6</small></button>)}</div>
          <button className="primary-button" disabled={!hydrated} onClick={() => { if (!journey.draft && nextIsland) selectChapter(chapter + 1); else openLesson(journey.draft?.lesson ?? selected, journey.draft?.review ?? false); }}>{journey.draft ? "继续上次冒险" : nextIsland ? `去${CHAPTERS[chapter + 1].name}看看` : "开始小冒险"}<Icon name="arrow" size={20}/></button>
          <div className="mission-footnote"><Icon name="keyboard" size={16}/>{lesson.subtitle}<span>· 不限时</span></div>
        </aside>}
        {active && phase !== "intro" && <div className="world-task-progress" role="status"><Icon name={project.icon} size={20}/><strong>{review ? `已温习 ${snapshot.line} / 6 组` : chapter === 0 ? `${project.name} · ${built[selected % 4]} / 6` : `已完成 ${snapshot.line} / 6 组`}</strong><span>{phase === "complete" ? "这份改变会留在小岛上" : "完成一组，看见一点改变"}</span></div>}
        {!active && <div className="exploration-tools"><span><Icon name="paw" size={19}/>点击草地，棉棉就会走过去</span><span>拖动转动视角 · 滚轮缩放</span><button className="text-button" onClick={showHelp}>操作帮助 <span>?</span></button></div>}
      </section>}
      {!worldPage && <div className="page-heading"><div><p className="eyebrow">YOUR LITTLE ISLAND</p><h1>{page === "practice" ? "小练习，也有大进步。" : page === "garden" ? "每一朵花，都是你的努力。" : "看看正在成长的自己。"}</h1><p className="heading-note">{page === "practice" ? "从手指的位置开始，慢慢练出自己的节奏。" : page === "garden" ? "这些改变，会一直留在你的小岛上。" : "不和别人比。比昨天更熟练一点，就很棒。"}</p></div><button className="secondary-button" onClick={() => switchPage("map")}><Icon name="map"/>回到小岛</button></div>}
      {!active && page === "garden" && <><section className="garden-builds"><h2>亲手建成的溪边花园</h2><p>完成每组练习就保存一份改变；课程仍以准确率解锁。</p><div>{PROJECTS.map((p, i) => <article key={p.name}><Icon name={p.icon} size={30}/><h3>{p.name}</h3><strong>{chapterProjects(journey, 0)[i]} / 6</strong><span>{chapterProjects(journey, 0)[i] === 6 ? "已留在小岛上" : "正在慢慢生长"}</span></article>)}</div><button className="primary-button" onClick={() => { setChapter(0); setSelected(Math.min(progress.unlocked, 3)); switchPage("map"); }}>去花园看看<Icon name="arrow"/></button></section><section className="souvenir-list"><div className="section-heading"><h2>探险纪念册</h2><span>准确率达到 90% 后获得</span></div><div className="souvenir-grid">{LESSONS.map((l, i) => <div className={(progress.best[l.id] ?? 0) >= 90 ? "souvenir earned" : "souvenir"} key={l.id}><Icon name={(progress.best[l.id] ?? 0) >= 90 ? ["flower", "map", "sound", "mail"][i % 4] : "lock"} size={26}/><strong>{l.reward}</strong><small>{(progress.best[l.id] ?? 0) >= 90 ? "已收藏" : `第 ${i + 1} 课解锁`}</small></div>)}</div></section></>}
      {!active && page === "practice" && <div className="practice-page"><section className="review-banner"><span className="review-symbol"><Icon name="keyboard" size={40}/></span><div><p className="eyebrow">JUST FOR YOU</p><h2>{weak.length ? "把不太熟的键，再认识一次。" : "先和键盘交个朋友吧。"}</h2><p>{weak.length ? `最近可以多练：${weak.map(keyLabel).join("、")}。今天不用急，一次进步一点点。` : "先完成一课，棉棉会根据你的易错键准备专属练习。"}</p></div><button className="primary-button" onClick={() => openLesson(progress.unlocked, weak.length > 0)}>{weak.length ? "开始针对练习" : "开始基础练习"}<Icon name="arrow" size={18}/></button></section>{CHAPTERS.map((c, ci) => <section className="lesson-collection" key={c.name}><h2><span>0{ci + 1}</span>{c.name}<small>{c.subtitle}</small></h2><div className="lesson-grid">{LESSONS.slice(ci * 4, ci * 4 + 4).map((l, offset) => { const index = ci * 4 + offset; const locked = index > progress.unlocked; return <button key={l.id} aria-disabled={locked} className={`lesson-tile ${locked ? "lesson-locked" : ""}`} onClick={() => openLesson(index)}><span className="tile-top"><span>LESSON {String(index + 1).padStart(2, "0")}</span><Icon name={locked ? "lock" : progress.best[l.id] >= 90 ? "check" : "arrow"} size={18}/></span><h3>{l.title}</h3><p>{l.subtitle}</p><div><kbd>{l.keys ? [...l.keys].map(keyLabel).join(" ") : "Aa · story"}</kbd><small>{progress.best[l.id] ? `最佳 ${progress.best[l.id]}%` : "6 组小练习"}</small></div></button>; })}</div></section>)}</div>}
      {!active && page === "journal" && <div className="journal-page"><div className="journal-metrics">{[{ value: String(progress.days.length), unit: "天", title: "认真练习的日子", icon: "sun" }, { value: String(completed), unit: "/ 16", title: "点亮的旅程", icon: "map" }, { value: last ? String(last.accuracy) : "—", unit: "%", title: "最近一次准确率", icon: "flower" }, { value: last ? String(last.wpm) : "—", unit: "词 / 分", title: "最近一次速度", icon: "keyboard" }].map(m => <div className="metric-card" key={m.title}><Icon name={m.icon} size={24}/><strong>{m.value}<small>{m.unit}</small></strong><p>{m.title}</p></div>)}</div><div className="journal-grid"><section className="journal-panel"><p className="eyebrow">YOUR KEYBOARD GARDEN</p><h2>你的键盘花园</h2><p>按键越熟练，颜色越深。先打准，速度会慢慢跟上。</p><div className="mastery-board">{["qwertyuiop", "asdfghjkl;", "zxcvbnm"].map(row => <div key={row}>{[...row].map(k => { const stat = progress.keyStats[k]; const accuracy = stat ? stat.hits / (stat.hits + stat.misses) : 0; return <span key={k} title={stat ? `${k.toUpperCase()}：${Math.round(accuracy * 100)}%，${stat.hits + stat.misses} 次` : `${k.toUpperCase()}：还没练到`} className={!stat ? "" : accuracy >= .9 && stat.hits >= 10 ? "mastered" : "learning"}>{k.toUpperCase()}</span>; })}</div>)}</div><div className="mastery-legend"><span><i/>还没练到</span><span><i/>正在成长</span><span><i/>逐渐熟练</span></div></section><section className="journal-panel suggestion-panel"><Icon name="leaf" size={30}/><h2>{weak.length ? "给明天的自己一个小目标" : "你的第一朵花，正在等你"}</h2><p>{weak.length ? `下次重点认识 ${weak.map(keyLabel).join("、")}，不用多，认真练一小轮就好。` : "每天练习一小会儿，先找到 F / J 的凸点，让每根手指都有自己的位置。"}</p><button className="secondary-button" onClick={() => openLesson(progress.unlocked, weak.length > 0)}>开始适合我的练习<Icon name="arrow" size={17}/></button></section></div><section className="journal-panel recent-history"><h2>最近的小脚印</h2>{progress.history.length ? <div className="history-table"><div className="history-head"><span>练习</span><span>准确率</span><span>速度</span><span>日期</span></div>{progress.history.slice(-8).reverse().map((s, i) => <div className="history-row" key={`${s.date}-${i}`}><span>{s.review ? "易错键温习" : LESSONS[s.lesson].title}</span><strong>{s.accuracy}%</strong><span>{s.wpm} 词 / 分</span><span>{new Date(s.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span></div>)}</div> : <p className="empty-journal">还没有脚印。完成一次练习，这里就会记住你的努力。</p>}<p className="journal-privacy">学习记录只保存在当前浏览器。换设备不会自动同步。速度按每 5 个字符为 1 词计算。</p></section></div>}
      {!worldPage && <footer className="island-footer"><span><Icon name="heart" size={15}/>先打准，再打快。每一次认真尝试，都值得被看见。</span><span>为 10 岁左右的小小探险家设计</span></footer>}
      {(phase === "playing" || phase === "paused") && <section className={`typing-workspace ${showKeyboard ? "keyboard-open" : "keyboard-folded"} ${wrong ? "typing-wrong" : ""}`} inert={phase === "paused"} aria-label="打字练习">
        <div className="typing-heading"><button className="text-button" onClick={pause}><Icon name="pause" size={18}/>暂停 <kbd>Esc</kbd></button><span>{review ? "专属温习" : `第 ${selected + 1} 课`} · {lesson.title}</span><span>第 {snapshot.line + 1} / {prompts.length} 组</span></div>
        <div className="lesson-progress" role="progressbar" aria-label="本轮练习进度" aria-valuenow={Math.round(doneChars / totalChars * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${doneChars / totalChars * 100}%` }}/></div>
        <div className="typing-guide-row"><span><Icon name="flower" size={17}/>{snapshot.combo >= 5 ? `连续打对 ${snapshot.combo} 个，继续保持` : "看屏幕，跟着亮起的字母输入"}</span><span>准确率 {snapshot.hits + snapshot.mistakes ? Math.round(snapshot.hits / (snapshot.hits + snapshot.mistakes) * 100) : 100}%</span></div>
        <div className={`typing-prompt ${(prompts[snapshot.line]?.length ?? 0) <= 8 ? "short-prompt" : ""}`} aria-label={`请键入：${prompts[snapshot.line]}`} onClick={() => input.current?.focus()}>{[...(prompts[snapshot.line] ?? "")].map((letter, i) => <span key={`${snapshot.line}-${i}`} className={i < snapshot.position ? "typed-letter" : i === snapshot.position ? "current-letter" : "pending-letter"}>{letter === " " ? "␣" : letter}</span>)}</div>
        <input ref={input} className="typing-capture" aria-label="打字输入区" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="text" value="" onPaste={e => { e.preventDefault(); setFeedback("试着用自己的手指，一个字母一个字母地输入。"); }} onChange={e => { const value = e.target.value; if (value.length === 1 && /^[\x20-\x7e]$/.test(value) && !(e.nativeEvent as InputEvent).isComposing) acceptKey(value); else if (value) setFeedback("请切换到英文输入法，再试一次。"); }}/>
        <p className="typing-feedback" role="status" aria-live="polite">{feedback}</p><IslandKeyboard target={target} guide={showKeyboard}/><div className="typing-bottom"><span>打错不会掉生命，也不会被催促</span><button className="text-button" aria-expanded={showKeyboard} onClick={() => { setSettings(s => ({ ...s, keyboard: true })); setKeyboardExpanded(!showKeyboard); setTimeout(() => input.current?.focus(), 30); }}><Icon name="keyboard" size={18}/>{showKeyboard ? "收起键盘" : "展开指法键盘"}</button></div>
      </section>}
    </main>
    {phase === "intro" && <Modal title="出发前的小准备" close={home} className="intro-modal"><span className="modal-symbol"><Icon name="flower" size={32}/></span><p className="eyebrow">READY FOR A LITTLE ADVENTURE?</p><h2>{review ? "和易错键再交一次朋友" : lesson.title}</h2><p className="modal-lead">{review ? "这一轮只练你已经遇到过的字母。慢一点找到正确的手指，让不太熟的键变得更顺手。" : lesson.story}</p><div className="posture-steps"><span><b>1</b>坐舒服，肩膀放松</span><span><b>2</b>切换英文输入法</span><span><b>3</b>食指找到 F / J 的凸点</span></div><div className="home-key-demo"><div><kbd className={readyKeys.includes("f") ? "ready" : ""}>F</kbd><span>左手食指</span></div><span className="home-key-line"/><div><kbd className={readyKeys.includes("j") ? "ready" : ""}>J</kbd><span>右手食指</span></div></div><p className="demo-hint">{readyKeys.length === 2 ? "找到啦！现在可以出发了。" : "可以先在键盘上按一下 F 和 J，试试手感。"}</p><button className="primary-button modal-primary" onClick={() => start()}>{journey.draft?.lesson === selected ? "接着上次，继续冒险" : "准备好了，出发"}<Icon name="arrow" size={19}/></button>{journey.draft?.lesson === selected && <button className="text-button" onClick={() => start(true)}>重新练这一课（保留已建成果）</button>}<p className="modal-small">{prompts.length} 组练习 · 没有倒计时 · {review ? "温习完成后可重试正式课程" : "准确率 90% 解锁下一课"}</p></Modal>}
    {phase === "paused" && !settingsOpen && !help && <Modal title="练习已暂停" close={resume} className="pause-modal"><span className="modal-symbol"><Icon name="pause" size={32}/></span><h2>小岛会等你。</h2><p className="modal-lead">伸伸手指，休息一下。回来后从刚才的地方继续。</p><div className="pause-progress">已完成 {snapshot.line} / {prompts.length} 组 · 已打对 {snapshot.hits} 个字符</div><button className="primary-button modal-primary" onClick={resume}><Icon name="play" size={18}/>继续这段旅程</button><button className="text-button leave-button" onClick={home}>保存并回到小岛</button></Modal>}
    {phase === "complete" && result && !rest && <section className="completion-card" aria-label="本轮练习完成">
      <div className="completion-icon"><Icon name={project.icon} size={28}/></div><p className="eyebrow">A LITTLE CHANGE, MADE BY YOU</p>
      <h2 aria-live="polite">{review ? "熟悉的按键，更顺手了。" : selected < 4 ? project.complete : "你又完成了一段小旅程。"}</h2>
      <p>{result.accuracy >= 90 ? review ? "温习完成，准备好可以回到正式课程。" : `「${lesson.reward}」已收藏，下一段旅程已准备好。` : "成果已经保留。再巩固一下，准确率达到 90% 后开启下一课。"}</p>
      <div className="completion-metrics"><span><strong>{result.accuracy}%</strong>准确率</span><span><strong>{result.wpm}</strong>词 / 分</span><span><strong>+{result.accuracy >= 90 ? 6 : 3}</strong>花种</span></div>
      <button className="primary-button" onClick={() => { if (review) openLesson(selected); else if (result.accuracy >= 90 && selected < LESSONS.length - 1) openLesson(selected + 1); else openLesson(selected, result.accuracy < 90); }}>{review ? "回到正式课程" : result.accuracy >= 90 && selected < LESSONS.length - 1 ? "下一段小冒险" : "再巩固一小轮"}<Icon name="arrow"/></button>
      <button className="secondary-button" onClick={home}>回小岛，看看我的成果</button>
      <span className="completion-save"><Icon name="check" size={16}/>{storageFailed ? "保存失败，请勿关闭页面" : "已保存 · 随时可以休息"}</span>
    </section>}
    {mapOpen && <Modal title="岛屿与旅程" close={() => setMapOpen(false)} className="journey-modal"><p className="eyebrow">YOUR NEXT LITTLE ADVENTURE</p><h2>岛屿与旅程</h2><p className="modal-lead">4 座小岛，16 段从指尖出发的旅程。</p><div className="chapter-tabs" role="tablist" aria-label="探险岛屿">{CHAPTERS.map((c, i) => <button key={c.name} role="tab" aria-selected={chapter === i} aria-disabled={i * 4 > progress.unlocked} className={chapter === i ? "chapter-active" : ""} onClick={() => selectChapter(i)}>{c.name}{i * 4 > progress.unlocked && <Icon name="lock" size={15}/>}</button>)}</div><div className="map-lessons">{LESSONS.slice(chapter * 4, chapter * 4 + 4).map((l, i) => <button key={l.id} aria-disabled={chapter * 4 + i > progress.unlocked} onClick={() => openLesson(chapter * 4 + i)}><Icon name={progress.best[l.id] >= 90 ? "check" : chapter * 4 + i > progress.unlocked ? "lock" : PROJECTS[i].icon}/><span><strong>{l.title}</strong><small>{l.subtitle}</small></span><Icon name="chevron" size={18}/></button>)}</div></Modal>}
    {settingsOpen && <Modal title="游戏设置" close={() => setSettingsOpen(false)}><p className="eyebrow">MAKE YOURSELF COMFORTABLE</p><h2>按照你喜欢的方式。</h2><p className="modal-lead">舒服地坐好，慢慢练习。</p><div className="settings-list">{[{ key: "sound" as const, title: "轻柔音效", detail: "按键的轻响和完成时的小旋律" }, { key: "keyboard" as const, title: "显示键盘提示", detail: "高亮下一个按键，提示应该用哪根手指" }, { key: "reducedMotion" as const, title: "安静画面", detail: "减少漂浮、晃动和粒子动画" }].map(item => <label key={item.key}><span><strong>{item.title}</strong><small>{item.detail}</small></span><input type="checkbox" role="switch" checked={settings[item.key]} onChange={e => setSettings(s => ({ ...s, [item.key]: e.target.checked }))}/></label>)}</div><p className="settings-privacy">进度自动保存在当前浏览器，无需注册。原版学习记录保留在本机，新课程从基础指法开始。</p><button className="primary-button modal-primary" onClick={() => setSettingsOpen(false)}>设置好了</button></Modal>}
    {help && <Modal title="怎么玩" close={() => setHelp(false)} className="help-modal"><span className="modal-symbol"><Icon name="map" size={32}/></span><h2>一场从指尖出发的旅行。</h2><div className="help-steps"><p><b>01</b><span><strong>先找到手指的家</strong>左手 A S D F，右手 J K L ;。食指轻触 F / J 的凸点，拇指放在空格上。</span></p><p><b>02</b><span><strong>跟着亮起的字母输入</strong>字母下面会告诉你用哪根手指。打错时位置不变，慢慢重新试一次。</span></p><p><b>03</b><span><strong>让小岛一朵一朵开花</strong>每完成一组，花圃、小桥、风铃或暖灯就会改变。准确率达到 90% 解锁下一课。</span></p><p><b>04</b><span><strong>也要记得休息</strong>按 Esc 或切换窗口会暂停，位置自动保存。点击草地移动棉棉，点字母路牌开始任务。</span></p></div><button className="primary-button modal-primary" onClick={() => setHelp(false)}>我知道啦</button></Modal>}
    {rest && <Modal title="休息一下" close={() => setRest(false)}><span className="modal-symbol"><Icon name="leaf" size={32}/></span><h2>眼睛和手指，也想休息了。</h2><p className="modal-lead">今天已经练习 10 分钟。看看窗外远处，松开双手，伸一个舒服的懒腰。</p><div className="rest-count">{restSeconds}<small>秒放松时间</small></div><button className="primary-button modal-primary" onClick={() => { setRest(false); home(); }}>今天就到这里</button><button className="text-button leave-button" onClick={() => setRest(false)}>我已经休息好了</button></Modal>}
    {(notice || storageFailed) && <div className="island-toast" role="status"><Icon name={storageFailed ? "book" : "leaf"} size={19}/>{notice || "浏览器未允许保存记录，本次仍可练习，关闭页面后进度可能丢失。"}</div>}
  </div>;
}

"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./IslandIcons";
import "./first-adventure.css";
import { IslandKeyboard } from "./IslandKeyboard";
import { FIRST_PROMPTS, GARDEN_COLORS, GARDEN_SPOTS, adventureStep, adventureAccuracy, isAdventureTyping, type FirstAdventureState, type AdventureAction, type AdventureSceneAction } from "./first-adventure";
const IslandScene = lazy(() => import("./IslandScene").then(m => ({ default: m.IslandScene })));

type Props = {
  state: FirstAdventureState; dispatch: (action: AdventureAction) => FirstAdventureState;
  sound: boolean; reducedMotion: boolean; storageFailed: boolean;
  onSound: (kind: "key" | "line" | "finish") => void; onToggleSound: () => void;
  onExit: (lesson?: number) => void;
};
const STEPS = ["认识棉棉", "寻找花种", "种出小芽", "让花开放", "布置小院", "留下纪念"];
const COPY = {
  meet: { title: "一座小院，等你和棉棉来。", description: "棉棉想在溪边安个家。先和它打声招呼，再一起找找院子里藏着什么。", voice: "你好呀！我们一起，把这里变成家吧。", action: "摸摸棉棉，打个招呼", icon: "paw" },
  trail: { title: "跟着小脚印，找找花种。", description: "石头路旁有一个发光的小袋子。点击它，棉棉会走过去；也可以用下面的按钮让它带路。", voice: "闻到了！好像是花种的味道。", action: "让棉棉带我过去", icon: "map" },
  prepare: { title: "找到啦！让手指准备好。", description: "左手食指摸到 F，右手食指摸到 J。轻轻按一下，感受键帽上的小凸点。", voice: "花种准备好了。你的两根食指也找到家了吗？", action: "一起种下第一颗花种", icon: "keyboard" },
  plant: { title: "指尖一动，小芽就长大。", description: "看清亮起的字母，慢慢输入。每完成一组，就种出一片小芽。", voice: "一滴水，一点绿。小院正在慢慢醒来。", action: "", icon: "leaf" },
  sprouts: { title: "看，小芽都探出头了。", description: "棉棉走过来闻了闻。接下来试试不同的 F / J 组合，让这些小芽开出花。", voice: "这是我们一起种的！伸伸手指，再让它们开花吧。", action: "准备好了，让花开放", icon: "flower" },
  bloom: { title: "再试一次，让小院开花。", description: "还是熟悉的 F 和 J，这次换了新的组合。需要帮助时，可以随时打开指法提示。", voice: "我陪着你。每一组认真尝试，都能让花开放。", action: "", icon: "flower" },
  decorate: { title: "这一盆花，你想放在哪里？", description: "选一个喜欢的颜色，再点击小岛上的光圈，或选择下面的位置。也可以给小院起个名字。", voice: "窗边、小路旁、树荫下……你来决定我们的家。", action: "布置好了，留下纪念", icon: "heart" },
  complete: { title: "欢迎回到，我们的小院。", description: "花圃和你摆放的花盆都会留在小岛上。棉棉发现了溪边的小桥，下次可以一起去看看。", voice: "我喜欢这里。谢谢你，和我一起把它变成家。", action: "", icon: "book" },
} as const;

export function FirstAdventure({ state, dispatch, sound, reducedMotion, storageFailed, onSound, onToggleSound, onExit }: Props) {
  const [paused, setPaused] = useState(false);
  const [hints, setHints] = useState(state.phase !== "bloom");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [feedback, setFeedback] = useState("手腕放松，跟着亮起的字母慢慢输入。");
  const [preparationNotice, setPreparationNotice] = useState("");
  const [wrong, setWrong] = useState(false);
  const [command, setCommand] = useState(0);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const capture = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const current = useRef(state);
  useEffect(() => { current.current = state; }, [state]);
  const typing = isAdventureTyping(state.phase), preparation = state.phase === "prepare";
  const coach = typing || preparation;
  const step = adventureStep(state.phase), copy = COPY[state.phase];
  const prompt = FIRST_PROMPTS[state.line] ?? "";
  const target = prompt[state.position] ?? "f";
  const accuracy = adventureAccuracy(state);
  const activeGroups = state.phase === "plant" ? state.line : Math.max(0, state.line - 6);
  const selectedSpot = GARDEN_SPOTS.find(s => s.id === state.spot);

  const send = useCallback((action: AdventureAction) => {
    const next = dispatch(action); current.current = next; return next;
  }, [dispatch]);
  const typeKey = useCallback((key: string) => {
    const before = current.current;
    if (!isAdventureTyping(before.phase)) return;
    const expected = FIRST_PROMPTS[before.line]?.[before.position];
    const next = send({ type: "type", key, assisted: hints });
    if (next.hits > before.hits) {
      setWrong(false);
      setFeedback(next.line > before.line ? before.phase === "plant" ? `第 ${next.line} 片小芽长出来了！` : `第 ${next.line - 6} 片花开放了！` : "小水滴落下了。保持自己的节奏。" );
      onSound(next.phase === "decorate" ? "finish" : next.line > before.line ? "line" : "key");
    } else {
      setWrong(true);
      setFeedback(key.toLowerCase() === expected ? "注意大小写：关掉 Caps Lock，用小写字母试一次。" : `没关系，位置还在。${expected === "f" ? "左" : "右"}手食指找 ${expected?.toUpperCase()}。`);
    }
  }, [send, hints, onSound]);

  useEffect(() => { if (typing && !paused) capture.current?.focus(); }, [typing, paused, state.phase]);
  useEffect(() => {
    if (!paused) return;
    const node = dialog.current; node?.showModal(); return () => node?.close();
  }, [paused]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (paused || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key === "Escape") { event.preventDefault(); setPaused(true); return; }
      if (event.isComposing || event.key === "Process" || event.keyCode === 229) {
        if (typing) setFeedback("请切换到英文输入法，再找 F 和 J。");
        if (preparation) setPreparationNotice("请切换到英文输入法，再找 F 和 J。"); return;
      }
      if (preparation && /^[fj]$/i.test(event.key)) { event.preventDefault(); setPreparationNotice(""); send({ type: "ready", key: event.key.toLowerCase() }); onSound("key"); return; }
      if (preparation && event.key.length === 1 && !(event.target instanceof HTMLElement && event.target.closest("button"))) { event.preventDefault(); setPreparationNotice("先找带小凸点的 F 和 J，分别轻轻按一下。"); return; }
      if (!typing || (event.target instanceof HTMLElement && event.target.closest("button, textarea, select, input:not(.typing-capture)"))) return;
      if (event.key === "Backspace") { event.preventDefault(); setFeedback("不用删除，输入亮起的字母就能继续。"); return; }
      if (event.key.length === 1) { event.preventDefault(); typeKey(event.key); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [paused, typing, preparation, send, typeKey, onSound]);
  useEffect(() => {
    if (!typing || paused) return;
    let last = performance.now();
    const timer = setInterval(() => { const now = performance.now(); if (!document.hidden) send({ type: "tick", seconds: (now - last) / 1000 }); last = now; }, 1000);
    const blur = () => setPaused(true);
    const hidden = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("blur", blur); document.addEventListener("visibilitychange", hidden);
    return () => { clearInterval(timer); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", hidden); };
  }, [typing, paused, send]);

  function storyAction(action: AdventureSceneAction) {
    if (paused) return;
    if (action === "greet" || action === "seeds") { send({ type: action }); onSound("line"); }
    else send({ type: "place", spot: action });
  }
  function continueStory() {
    if (state.phase === "meet") storyAction("greet");
    if (state.phase === "trail") { if (sceneUnavailable) storyAction("seeds"); else setCommand(n => n + 1); }
    if (state.phase === "prepare") { send({ type: "begin" }); setHints(true); setWrong(false); setFeedback("左手食指 F，右手食指 J。输入小写字母。"); }
    if (state.phase === "sprouts") { send({ type: "continue" }); setHints(false); setWrong(false); setFeedback("试着自己找到 F 和 J；需要时随时打开提示。"); }
    if (state.phase === "decorate") { send({ type: "finish" }); onSound("finish"); }
  }
  const disabled = preparation ? state.ready.length !== 2 : state.phase === "decorate" ? !state.spot : false;
  const continueButton = <button className="primary-button story-primary" disabled={disabled} onClick={continueStory}>{copy.action}<Icon name="arrow" size={20}/></button>;

  return <div className={`island-app desktop-game first-adventure ${reducedMotion ? "calm-mode" : ""}`} data-story-phase={state.phase}>
    <header className="island-topbar">
      <button className="island-brand" onClick={() => onExit()} aria-label="保存并返回安琪打字机"><span className="brand-flower"><Icon name="flower" size={27}/></span><span><strong>安琪打字机</strong><small>帮棉棉找到新家</small></span></button>
      <ol className="story-steps" aria-label="故事进度">{STEPS.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className={i <= step ? "reached" : ""}><span>{i < step ? <Icon name="check" size={13}/> : i + 1}</span><small>{label}</small></li>)}</ol>
      <div className="island-top-actions"><button className="icon-button" onClick={onToggleSound} aria-label={sound ? "关闭音效" : "开启音效"}><Icon name={sound ? "sound" : "mute"}/></button><button className="story-exit" onClick={() => onExit()}>保存退出<Icon name="close" size={17}/></button></div>
    </header>
    <main className={`adventure-main ${coach ? "has-coach" : ""}`}>
      <section className={`world-stage biome-0 adventure-world ${coach ? "focused-world" : ""}`} aria-label="棉棉新家的三维故事场景">
        <Suspense fallback={<div className="scene-loading"><Icon name="flower" size={32}/><p>棉棉在准备小院…</p></div>}>
          <IslandScene chapter={0} growth={0} pulse={state.line} keyHits={state.hits} celebrate={state.phase === "complete"} reducedMotion={reducedMotion} paused={paused} exploring={!coach} available={0} onQuest={() => {}} training={coach} focus={0} projects={[Math.min(6, state.line), 0, 0, 0]} adventure={{ phase: state.phase, line: state.line, hits: state.hits, color: state.color, spot: state.spot, command }} onAdventureAction={storyAction} onAvailabilityChange={available => setSceneUnavailable(!available)}/>
        </Suspense>
        <div className="story-world-heading"><p><span/>我们的第一段冒险 · {step + 1} / 6</p><h1>{copy.title}</h1>{coach && <span>{copy.description}</span>}</div>
        <div className="story-save-status"><Icon name={storageFailed ? "book" : "check"} size={16}/>{storageFailed ? "暂时无法保存" : "进度自动保存"}</div>
        {sceneUnavailable && <div className="story-scene-note" role="status">3D 暂时无法显示，仍可使用故事卡片继续练习和布置。</div>}
        {!coach && <aside className={`story-card ${state.phase === "decorate" ? "decorating-card" : ""} ${state.phase === "complete" ? "story-memory" : ""}`} aria-label={state.phase === "complete" ? "小院纪念卡" : "当前故事任务"}>
          <div className="story-kicker"><Icon name={copy.icon} size={20}/><span>{STEPS[step]}</span><small>{state.phase === "complete" ? "我们的第一份作品" : "和棉棉一起"}</small></div>
          <p className="story-dialogue">“{copy.voice}”</p>
          <p className="story-description">{copy.description}</p>
          {state.phase === "decorate" && <div className="garden-editor">
            <fieldset><legend>花朵的颜色</legend><div className="story-colors">{GARDEN_COLORS.map(color => <button key={color.id} aria-pressed={state.color === color.id} onClick={() => send({ type: "color", color: color.id })}><i style={{ background: color.hex }}/>{color.label}</button>)}</div></fieldset>
            <fieldset><legend>把花盆放在哪里？</legend><div className="story-spots">{GARDEN_SPOTS.map(spot => <button key={spot.id} aria-pressed={state.spot === spot.id} onClick={() => send({ type: "place", spot: spot.id })}><Icon name={spot.id === "window" ? "sun" : spot.id === "path" ? "map" : "leaf"} size={17}/><span>{spot.label}</span>{state.spot === spot.id && <Icon name="check" size={15}/>}</button>)}</div></fieldset>
            <label className="garden-name">给小院起个名字<input value={state.gardenName} maxLength={16} onChange={e => send({ type: "name", name: e.target.value })} placeholder="棉棉的小院"/></label>
            <p className="placement-note" aria-live="polite">{selectedSpot ? `${selectedSpot.label}：${selectedSpot.description}` : "选好位置后，花盆就会出现在小岛上。"}</p>
          </div>}
          {state.phase === "complete" ? <>
            <div className="memory-garden"><Icon name="flower" size={32}/><strong>{state.gardenName}</strong><span>{selectedSpot?.label} · {GARDEN_COLORS.find(c => c.id === state.color)?.label}</span></div>
            <div className="story-results"><span><b>F / J</b>今天练过的按键</span><span><b>{accuracy}%</b>本次准确率</span><span><b>{state.hits}</b>认真打对的字符</span></div>
            <p className="memory-next">{accuracy >= 90 ? "F / J 起步练习已通过。接下来可以认识 D / K，修好溪边的小桥。" : "小院已经保存。F / J 再练熟一些，达到 90% 准确率后就能开始修桥。"}</p>
            <button className="primary-button story-primary" onClick={() => onExit(accuracy >= 90 ? 1 : 0)}>{accuracy >= 90 ? "去看看溪边的小桥" : "再和 F / J 熟悉一下"}<Icon name="arrow" size={19}/></button>
            <button className="text-button story-rest" onClick={() => onExit()}>今天先到这里，回小岛看看</button>
          </> : continueButton}
          <small className="story-footnote"><Icon name="leaf" size={15}/>{state.phase === "complete" ? "这份改变会留在小岛上 · 随时可以休息" : "没有倒计时 · 可以随时保存退出"}</small>
        </aside>}
        {coach && <div className="story-world-progress" role="status"><Icon name={state.phase === "bloom" ? "flower" : "leaf"}/><strong>{preparation ? "花种已找到" : state.phase === "plant" ? `${state.line} / 6 片小芽` : `${state.line - 6} / 6 片花圃开放`}</strong><span>{preparation ? "准备好两根食指，就可以种花" : "你的输入，正在让小院生长"}</span></div>}
        {!coach && <div className="story-scene-controls">点击草地移动 · 拖动转动视角 · 滚轮缩放</div>}
      </section>
      {coach && <section className={`story-coach ${wrong ? "story-wrong" : ""}`} aria-label={preparation ? "找到手指的家" : "故事打字练习"} inert={paused}>
        <div className="story-coach-heading"><button className="text-button" onClick={() => setPaused(true)}><Icon name="pause" size={17}/>暂停 <kbd>Esc</kbd></button><span>{preparation ? "坐舒服，肩膀放松，切换到英文输入法" : `${state.phase === "plant" ? "跟着提示种花" : "用新组合唤醒花圃"} · 第 ${activeGroups + 1} / 6 组`}</span><small>{preparation ? "只认识 F 和 J" : "先打准，再打快"}</small></div>
        {preparation ? <div className="story-preparation">
          <div className="story-home-keys" aria-label="请在实体键盘上按 F 和 J">{["f", "j"].map((key, i) => <div key={key} className={state.ready.includes(key) ? "found" : ""}><kbd>{key.toUpperCase()}</kbd><span>{i ? "右手食指" : "左手食指"}</span><small>{state.ready.includes(key) ? "找到啦" : "按一下试试"}</small></div>)}</div>
          <div><p aria-live="polite">{preparationNotice || (state.ready.length === 2 ? "两根食指都找到家了，我们出发吧！" : "摸到小凸点后，在键盘上各按一下 F 和 J。")}</p>{continueButton}<small>用实体键盘练习，打错也不会失去花种。</small></div>
        </div> : <>
          <div className="story-line-progress" role="progressbar" aria-label="当前种花练习进度" aria-valuemin={0} aria-valuemax={6} aria-valuenow={activeGroups}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < activeGroups ? "done" : i === activeGroups ? "current" : ""}/>)}</div>
          <div className="story-prompt" aria-label={`请键入：${prompt}`} onClick={() => capture.current?.focus()}>{[...prompt].map((key, i) => <span key={`${state.line}-${i}`} className={i < state.position ? "typed-letter" : i === state.position ? "current-letter" : "pending-letter"}>{key}</span>)}</div>
          <input ref={capture} className="typing-capture" aria-label="故事打字输入区" value="" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onPaste={e => { e.preventDefault(); setFeedback("试着用自己的手指，一个字母一个字母地输入。"); }} onChange={e => { const text = e.target.value; if (text.length === 1 && /^[\x20-\x7e]$/.test(text) && !(e.nativeEvent as InputEvent).isComposing) typeKey(text); else if (text) setFeedback("请切换到英文输入法，再输入亮起的字母。"); }}/>
          <p className="story-feedback" role="status" aria-live="polite">{feedback}</p>
          {hints ? <IslandKeyboard target={target} guide={keyboardOpen}/> : <p className="story-independent">试着自己找到 F 和 J。需要时，随时打开提示。</p>}
          <div className="story-coach-footer"><span>打错时位置不变，小芽也不会消失</span><div>{hints && <button className="text-button" aria-expanded={keyboardOpen} onClick={() => { setKeyboardOpen(v => !v); capture.current?.focus(); }}>{keyboardOpen ? "收起完整键盘" : "查看完整键盘"}</button>}<button className="text-button" aria-pressed={hints} onClick={() => { setHints(v => !v); capture.current?.focus(); }}>{hints ? "试试自己找按键" : "打开指法提示"}</button></div></div>
        </>}
      </section>}
    </main>
    {storageFailed && <div className="island-toast" role="alert">浏览器暂时无法保存，请先保留这个页面。故事仍可继续。</div>}
    {paused && <dialog ref={dialog} className="island-modal story-pause" aria-label="冒险已暂停" onCancel={e => { e.preventDefault(); setPaused(false); }}><span className="modal-symbol"><Icon name="paw" size={30}/></span><h2>棉棉在这里等你。</h2><p className="modal-lead">伸伸手指，看看远处。回来后接着刚才的位置继续。</p><div className="pause-progress">{STEPS[step]} · 已打对 {state.hits} 个字符</div><button className="primary-button modal-primary" onClick={() => setPaused(false)}>继续这段冒险<Icon name="play" size={18}/></button><button className="text-button leave-button" onClick={() => onExit()}>保存并回到小岛</button></dialog>}
  </div>;
}

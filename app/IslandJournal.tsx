import { LESSONS, keyLabel, localDay, weakKeys, type IslandProgress } from "./island-engine";
import { type Journey } from "./island-journey";
import { Icon } from "./IslandIcons";

export function IslandJournal({ progress, journey, onLesson }: {
  progress: IslandProgress;
  journey: Journey;
  onLesson: (index: number, review?: boolean, retest?: boolean) => void;
}) {
  const last = progress.history.at(-1);
  const weak = weakKeys(progress.keyStats, journey.timing);
  const completed = LESSONS.filter(lesson => (progress.best[lesson.id] ?? 0) >= 90).length;
  const independent = LESSONS.filter(lesson => (progress.mastery[lesson.id]?.independentBest ?? 0) >= 90).length;
  const delayed = LESSONS.filter(lesson => (progress.mastery[lesson.id]?.delayedBest ?? 0) >= 90).length;
  const due = LESSONS.findIndex(lesson => {
    const mastery = progress.mastery[lesson.id];
    return mastery?.independentBest >= 90 && mastery.delayedBest < 90 && mastery.independentDate < localDay();
  });
  const independentTarget = LESSONS.findIndex(lesson => (progress.best[lesson.id] ?? 0) >= 90 && (progress.mastery[lesson.id]?.independentBest ?? 0) < 90);
  const speedUnit = (index: number) => LESSONS[index]?.mode === "pinyin" ? "字 / 分" : "词 / 分";

  return <div className="journal-page">
    <div className="journal-metrics">{[
      { value: String(progress.days.length), unit: "天", title: "认真练习的日子", icon: "sun" },
      { value: String(completed), unit: `/ ${LESSONS.length}`, title: "点亮的旅程", icon: "map" },
      { value: last ? String(last.accuracy) : "—", unit: "%", title: "最近一次准确率", icon: "flower" },
      { value: last ? String(last.wpm) : "—", unit: last ? speedUnit(last.lesson) : "词 / 分", title: "最近一次速度", icon: "keyboard" },
    ].map(item => <div className="metric-card" key={item.title}><Icon name={item.icon} size={24}/><strong>{item.value}<small>{item.unit}</small></strong><p>{item.title}</p></div>)}</div>

    <section className="mastery-summary" aria-label="指法掌握进度">
      <div><strong>指法掌握的三步</strong><p>先完成课程，再不看提示独立输入，隔一天再复测一次。</p></div>
      <span>课程 <b>{completed}</b></span><span>独立 <b>{independent}</b></span><span>隔日巩固 <b>{delayed}</b></span>
      {due >= 0 && <button className="secondary-button" onClick={() => onLesson(due, true, true)}>复测「{LESSONS[due].title}」<Icon name="arrow" size={16}/></button>}
    </section>

    <div className="journal-grid">
      <section className="journal-panel"><p className="eyebrow">YOUR KEYBOARD GARDEN</p><h2>你的键盘花园</h2><p>按键越熟练，颜色越深。先打准，速度会慢慢跟上。</p>
        <div className="mastery-board">{["qwertyuiop", "asdfghjkl;", "zxcvbnm"].map(row => <div key={row}>{[...row].map(key => {
          const stat = progress.keyStats[key];
          const accuracy = stat ? stat.hits / (stat.hits + stat.misses) : 0;
          return <span key={key} title={stat ? `${key.toUpperCase()}：${Math.round(accuracy * 100)}%，${stat.hits + stat.misses} 次` : `${key.toUpperCase()}：还没练到`} className={!stat ? "" : accuracy >= .9 && stat.hits >= 10 ? "mastered" : "learning"}>{key.toUpperCase()}</span>;
        })}</div>)}</div>
        <div className="mastery-legend"><span><i/>还没练到</span><span><i/>正在成长</span><span><i/>逐渐熟练</span></div>
      </section>
      <section className="journal-panel suggestion-panel"><Icon name="leaf" size={30}/><h2>{weak.length ? "给明天的自己一个小目标" : independentTarget >= 0 ? "试试不看提示，也能记住" : completed ? "每根手指，都在慢慢长大" : "你的第一朵花，正在等你"}</h2><p>{weak.length ? `下次重点认识 ${weak.map(keyLabel).join("、")}，不用多，认真练一小轮就好。` : independentTarget >= 0 ? `「${LESSONS[independentTarget].title}」已经完成。再独立试一次，明天还可以回来巩固。` : completed ? "课程都已点亮。按自己的节奏复习喜欢的故事，准确比速度更重要。" : "每天练习一小会儿，先找到 F / J 的凸点，让每根手指都有自己的位置。"}</p><button className="secondary-button" onClick={() => independentTarget >= 0 && !weak.length ? onLesson(independentTarget, true, true) : onLesson(progress.unlocked, weak.length > 0 && LESSONS[progress.unlocked].mode !== "pinyin")}>{independentTarget >= 0 && !weak.length ? "开始无提示复测" : "开始适合我的练习"}<Icon name="arrow" size={17}/></button></section>
    </div>

    <section className="journal-panel recent-history"><h2>最近的小脚印</h2>{progress.history.length ? <div className="history-table"><div className="history-head"><span>练习</span><span>准确率</span><span>速度</span><span>日期</span></div>{progress.history.slice(-8).reverse().map((session, index) => <div className="history-row" key={`${session.date}-${index}`}><span>{session.review ? session.independent ? "独立复测" : "易错键温习" : LESSONS[session.lesson].title}</span><strong>{session.accuracy}%</strong><span>{session.wpm} {speedUnit(session.lesson)}</span><span>{new Date(session.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span></div>)}</div> : <p className="empty-journal">还没有脚印。完成一次练习，这里就会记住你的努力。</p>}<p className="journal-privacy">学习记录只保存在当前浏览器。英文速度按每 5 个字符为 1 词计算，中文速度按汉字数计算。软件只能识别按键，无法判断实际用了哪根手指；请对照提示自己检查。</p></section>
  </div>;
}

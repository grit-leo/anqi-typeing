"use client";

import { GARDEN_LEVELS, getWeakKeys, type GardenProgress } from "./game-engine";

type ParentReportProps = {
  progress: GardenProgress;
  learnerName: string;
  onClose: () => void;
};

const KEY_NAME: Record<string, string> = {
  space: "空格",
  shift: "Shift",
  comma: "逗号",
  period: "句号",
  apostrophe: "撇号",
};

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function ParentReport({ progress, learnerName, onClose }: ParentReportProps) {
  const recent = progress.sessionHistory.slice(-7).reverse();
  const weakKeys = getWeakKeys(progress.keyMastery, 5);
  const masteredKeys = Object.entries(progress.keyMastery)
    .filter(([, mastery]) => mastery.attempts >= 5 && mastery.score >= 85)
    .sort(([, left], [, right]) => right.score - left.score)
    .map(([key]) => key);
  const practiceMinutes = Math.max(0, Math.round(recent.reduce((sum, session) => sum + session.duration, 0) / 60));
  const averageAccuracy = average(recent.map((session) => session.accuracy));
  const averageWpm = average(recent.map((session) => session.wpm));
  const trainingStage = progress.totalWords < 80
    ? { name: "基准键建立", goal: "准确率 85%–90% · 8–12 WPM" }
    : progress.totalWords < 220
      ? { name: "稳定构词", goal: "准确率 90% · 12–18 WPM" }
      : { name: "短句推进", goal: "准确率 90%–95% · 15–25 WPM" };

  return (
    <section className="modal-backdrop parent-report-backdrop" role="dialog" aria-modal="true" aria-label="家长学习报告">
      <div className="parent-report-card modal-card">
        <button className="modal-close" onClick={onClose} aria-label="关闭家长学习报告">×</button>
        <header className="parent-report-heading">
          <span>家长查看 · 本机数据</span>
          <h2>{learnerName}的打字训练报告</h2>
          <p>面向9岁学习阶段，查看最近 {recent.length} 次训练趋势，只和自己的上一次比较。</p>
        </header>

        <div className="parent-metrics">
          <span><small>平均准确率</small><strong>{averageAccuracy}<i>%</i></strong><em>达到 90% 后再逐步追求速度</em></span>
          <span><small>平均速度</small><strong>{averageWpm}<i> WPM</i></strong><em>速度会随正确指法自然提高</em></span>
          <span><small>近期练习</small><strong>{practiceMinutes}<i> 分钟</i></strong><em>{recent.length} 次短练习，控制单次时长</em></span>
          <span><small>当前训练阶段</small><strong className="training-stage">{trainingStage.name}</strong><em>{trainingStage.goal}</em></span>
        </div>

        <div className="parent-report-grid">
          <section>
            <small className="report-label">下一步建议</small>
            <h3>{weakKeys.length ? "先巩固容易按错的键" : "可以安心进入下一课"}</h3>
            <div className="report-key-list">
              {weakKeys.length ? weakKeys.map((key) => <span key={key}><kbd>{KEY_NAME[key] ?? key.toUpperCase()}</kbd><b>{progress.keyMastery[key]?.score ?? 0}%</b></span>) : <p>目前没有明显弱键，继续保持短时、规律的练习。</p>}
            </div>
            <p className="parent-tip">陪练时可以提醒孩子“看屏幕、摸凸点、按对再快”，不要让孩子反复盯着自己的手。</p>
          </section>

          <section>
            <small className="report-label">已稳定掌握</small>
            <h3>{masteredKeys.length} 个键形成了初步肌肉记忆</h3>
            <div className="mastered-key-list">
              {masteredKeys.length ? masteredKeys.slice(0, 18).map((key) => <kbd key={key}>{KEY_NAME[key] ?? key.toUpperCase()}</kbd>) : <p>完成几次练习后，这里会显示稳定掌握的按键。</p>}
            </div>
          </section>
        </div>

        <section className="recent-sessions">
          <div><small className="report-label">最近练习</small><span>准确率优先于速度</span></div>
          {recent.length ? recent.slice(0, 5).map((session, index) => {
            const level = GARDEN_LEVELS.find((item) => item.id === session.levelId);
            return <div className="session-row" key={`${session.date}-${session.levelId}-${index}`}><span><b>{level?.title ?? "花园练习"}</b><small>{session.date}</small></span><strong>{session.accuracy}%</strong><em>{session.wpm} WPM</em><i>{Math.max(1, Math.round(session.duration / 60))} 分钟</i></div>;
          }) : <p className="empty-report">完成第一场打字练习后，这里会出现学习趋势。</p>}
        </section>

        <footer><span>🔒 每位孩子的学习数据独立，只保存在这台设备，不上传、不展示排行榜。</span><button className="modal-primary" onClick={onClose}>返回花园</button></footer>
      </div>
    </section>
  );
}

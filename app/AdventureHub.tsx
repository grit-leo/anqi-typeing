"use client";

import { useMemo, useState } from "react";
import {
  ACHIEVEMENTS,
  COSMETICS,
  GARDEN_LEVELS,
  GARDEN_WORLDS,
  getDailyTarget,
  getLearningRecommendation,
  getLocalDateKey,
  getLumiBond,
  getPlayerLevel,
  getPlayerLevelProgress,
  getLevelMastery,
  getSanctuaryLevel,
  getSuggestedReviewLevel,
  getUnlockedDecorations,
  getWeakKeys,
  LEVEL_MECHANICS,
  SANCTUARY_DECORATIONS,
  type GardenProgress,
  type MissionType,
} from "./game-engine";

type HubView = "map" | "sanctuary" | "review" | "daily" | "collection" | "achievements";

type AdventureHubProps = {
  progress: GardenProgress;
  levelIndex: number;
  onChooseLevel: (index: number) => void;
  onStart: () => void;
  onStartReview: (index: number) => void;
  onStartEndless: () => void;
  onClaimDaily: () => void;
  onCosmetic: (id: string) => void;
};

const MISSION_COPY: Record<MissionType, { icon: string; name: string }> = {
  bloom: { icon: "✿", name: "精准修复" },
  firefly: { icon: "✦", name: "萤火竞速" },
  rhythm: { icon: "♫", name: "节奏挑战" },
  guardian: { icon: "♛", name: "守护者 Boss" },
};

const KEY_NAME: Record<string, string> = { space: "空格", shift: "Shift", comma: "逗号", period: "句号", apostrophe: "撇号" };

export function AdventureHub({ progress, levelIndex, onChooseLevel, onStart, onStartReview, onStartEndless, onClaimDaily, onCosmetic }: AdventureHubProps) {
  const [view, setView] = useState<HubView>("map");
  const [worldIndex, setWorldIndex] = useState(GARDEN_LEVELS[levelIndex].worldIndex);
  const dateKey = getLocalDateKey();
  const dailyTarget = getDailyTarget(dateKey);
  const dailyWords = progress.daily.date === dateKey ? progress.daily.words : 0;
  const dailyClaimed = progress.daily.date === dateKey && progress.daily.claimed;
  const dailyPercent = Math.min(100, Math.round((dailyWords / dailyTarget) * 100));
  const playerLevel = getPlayerLevel(progress.xp);
  const xpProgress = getPlayerLevelProgress(progress.xp);

  const worldLevels = useMemo(() => GARDEN_LEVELS.map((level, index) => ({ level, index })).filter(({ level }) => level.worldIndex === worldIndex), [worldIndex]);
  const world = GARDEN_WORLDS[worldIndex];
  const unlockedAchievements = new Set(progress.achievements);
  const selectedMastery = getLevelMastery(GARDEN_LEVELS[levelIndex], progress.keyMastery);
  const weakKeys = getWeakKeys(progress.keyMastery, 5);
  const reviewLevelIndex = getSuggestedReviewLevel(progress);
  const reviewLevel = GARDEN_LEVELS[reviewLevelIndex];
  const recommendation = getLearningRecommendation(progress);
  const sanctuaryLevel = getSanctuaryLevel(progress);
  const lumiBond = getLumiBond(progress);
  const unlockedDecorations = getUnlockedDecorations(progress);

  const chooseWorld = (index: number) => {
    const firstLevelIndex = index * 3;
    if (firstLevelIndex >= progress.unlocked) return;
    setWorldIndex(index);
    const selectedIsInside = GARDEN_LEVELS[levelIndex].worldIndex === index;
    if (!selectedIsInside) onChooseLevel(firstLevelIndex);
  };

  return (
    <section className="adventure-hub" aria-label="大型冒险中心">
      <nav className="hub-nav" aria-label="冒险中心功能">
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><i>⌁</i><span>世界地图</span></button>
        <button className={view === "sanctuary" ? "active" : ""} onClick={() => setView("sanctuary")}><i>❀</i><span>我的花园</span></button>
        <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><i>⌨</i><span>露米复习屋</span>{weakKeys.length > 0 && <b />}</button>
        <button className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}><i>☀</i><span>每日委托</span>{!dailyClaimed && dailyWords >= dailyTarget && <b />}</button>
        <button className={view === "collection" ? "active" : ""} onClick={() => setView("collection")}><i>♢</i><span>魔法衣橱</span></button>
        <button className={view === "achievements" ? "active" : ""} onClick={() => setView("achievements")}><i>♛</i><span>成就图鉴</span></button>
      </nav>

      <div className="hub-body">
        {view === "map" && (
          <div className="world-map-view">
            <div className="world-tabs" role="tablist" aria-label="选择魔法世界">
              {GARDEN_WORLDS.map((item, index) => {
                const locked = index * 3 >= progress.unlocked;
                return <button role="tab" aria-selected={worldIndex === index} aria-label={`${item.name}${locked ? "，尚未解锁" : ""}`} disabled={locked} className={worldIndex === index ? "active" : ""} key={item.id} onClick={() => chooseWorld(index)} style={{ "--world-accent": item.accent } as React.CSSProperties}><span>{locked ? "◆" : item.icon}</span><small>{item.number}</small><strong>{item.name}</strong></button>;
              })}
            </div>

            <div className="world-overview" style={{ "--world-accent": world.accent } as React.CSSProperties}>
              <div className="world-copy"><span>{world.icon}</span><div><small>{world.number} · {world.subtitle}</small><h3>{world.name}</h3><p>{world.story}</p></div></div>
              <div className="world-stat"><small>世界进度</small><strong>{Math.min(3, Math.max(0, progress.unlocked - worldIndex * 3 - 1))}<i>/3</i></strong></div>
            </div>

            <div className="stage-route" aria-label={`${world.name}关卡路线`}>
              <div className="route-line"><i style={{ width: `${Math.max(0, Math.min(100, (progress.unlocked - worldIndex * 3 - 1) * 50))}%` }} /></div>
              {worldLevels.map(({ level, index }, routeIndex) => {
                const locked = index >= progress.unlocked;
                const selected = index === levelIndex;
                const cleared = index < progress.unlocked - 1 || progress.bestScores[level.id] > 0;
                const mission = MISSION_COPY[level.mission];
                return (
                  <button key={level.id} disabled={locked} className={`stage-node ${selected ? "selected" : ""} ${cleared ? "cleared" : ""} ${locked ? "locked" : ""}`} onClick={() => onChooseLevel(index)} aria-label={`${level.chapter} ${level.title}${locked ? "，尚未解锁" : ""}`}>
                    <span className="stage-gem">{locked ? "◆" : cleared ? "✓" : routeIndex + 1}</span>
                    <small>{level.chapter} · 难度 {"◆".repeat(level.difficulty)}</small>
                    <strong>{level.title}</strong>
                    <em><i>{mission.icon}</i>{LEVEL_MECHANICS[level.id].name}</em>
                    {progress.bestScores[level.id] > 0 && <b>{progress.bestScores[level.id]} 分</b>}
                    <span className="stage-stars" aria-label={`最佳 ${progress.bestStars[level.id] ?? 0} 颗星`}>{[0, 1, 2].map((star) => <i key={star} className={star < (progress.bestStars[level.id] ?? 0) ? "earned" : ""}>★</i>)}</span>
                  </button>
                );
              })}
            </div>

            <div className="selected-mission">
              <span><i>{MISSION_COPY[GARDEN_LEVELS[levelIndex].mission].icon}</i><small>{GARDEN_LEVELS[levelIndex].id === "petal-gate" ? "第三人称探索关 · 3 个互动机关" : LEVEL_MECHANICS[GARDEN_LEVELS[levelIndex].id].name} · 掌握度 {selectedMastery}%</small><strong>{GARDEN_LEVELS[levelIndex].id === "petal-gate" ? "探索樱花谷，找到机关后用准确打字改变世界" : LEVEL_MECHANICS[GARDEN_LEVELS[levelIndex].id].action}</strong></span>
              <div className="selected-actions"><button onClick={onStart}>{GARDEN_LEVELS[levelIndex].id === "petal-gate" ? "开始探索" : "进入关卡"} <b>→</b></button>{GARDEN_LEVELS[levelIndex].id === "petal-gate" && progress.bestScores["petal-gate"] > 0 && <button className="endless-start" onClick={onStartEndless} title={`无限世界最佳 ${progress.endless.bestDistance} 米，完成 ${progress.endless.bestEvents} 次奇遇`}>无限世界 {progress.endless.bestDistance}m <b>∞</b></button>}</div>
            </div>
          </div>
        )}

        {view === "sanctuary" && (
          <div className="sanctuary-view">
            <div className="sanctuary-heading"><div><small>ANQI&apos;S PERSONAL GARDEN</small><h3>安琪与露米的小花园</h3><p>这里不是排行榜。每一次认真练习，都会留下一个真实可见的成长纪念。</p></div><span>花园 <strong>Lv.{sanctuaryLevel}</strong></span></div>
            <div className="sanctuary-layout">
              <div className="sanctuary-scene" aria-label={`已解锁 ${unlockedDecorations.length} 件花园装饰`}>
                <div className="sanctuary-sky"><i /><i /><i /></div>
                <span className="sanctuary-anqi" aria-hidden="true" />
                <span className="sanctuary-lumi" aria-hidden="true" />
                <div className="sanctuary-decorations">{SANCTUARY_DECORATIONS.map((item) => <span key={item.id} className={unlockedDecorations.some((decoration) => decoration.id === item.id) ? "unlocked" : "locked"} title={item.name}><i>{item.icon}</i><small>{item.name}</small></span>)}</div>
                <div className="sanctuary-ground" />
              </div>
              <div className="sanctuary-growth">
                <span><small>露米陪伴值</small><strong>{lumiBond}<i>%</i></strong><div><i style={{ width: `${lumiBond}%` }} /></div><p>{lumiBond < 35 ? "露米正在认识你的学习节奏" : lumiBond < 75 ? "你们已经是可靠的冒险搭档" : "露米会一直记得这些认真练习的时刻"}</p></span>
                <span><small>露米的下一步建议</small><strong className="recommendation-title">{recommendation.title}</strong><p>{recommendation.detail}</p><button onClick={() => onStartReview(reviewLevelIndex)}>按建议练一小关 →</button></span>
              </div>
            </div>
            <div className="world-memories">{GARDEN_WORLDS.map((memory, index) => { const awake = index * 3 < progress.unlocked; return <span key={memory.id} className={awake ? "awake" : "sleeping"}><i>{awake ? memory.icon : "◆"}</i><small>{awake ? "章节记忆" : "尚未抵达"}</small><strong>{memory.name}</strong><p>{awake ? memory.subtitle : "继续冒险后会在这里留下故事"}</p></span>; })}</div>
          </div>
        )}

        {view === "review" && (
          <div className="review-view">
            <div className="review-hero"><span>⌨</span><div><small>LUMI&apos;S PRACTICE ROOM</small><h3>露米复习屋</h3><p>用约 5 分钟集中修正弱键，把正确路线练成肌肉记忆。</p></div></div>
            <div className="weak-key-panel">
              <div><small>本机学习画像</small><h4>{weakKeys.length ? "这些键需要专项修正" : "暂时没有明显弱键"}</h4><p>{weakKeys.length ? "系统会间隔安排弱键，不连续重复，避免形成紧张和错误动作。" : "继续完成当前课程，系统会逐步识别你的指法和准确率。"}</p></div>
              <div className="weak-key-list">{weakKeys.length ? weakKeys.map((key) => <span key={key}><b>{KEY_NAME[key] ?? key.toUpperCase()}</b><small>{progress.keyMastery[key]?.score ?? 0}% 掌握</small></span>) : <span className="all-clear"><b>✦</b><small>准备探索新键</small></span>}</div>
            </div>
            <div className="review-mission"><span><i>✿</i><small>推荐复习关</small><strong>{reviewLevel.chapter} · {reviewLevel.title}</strong><em>{reviewLevel.lesson}</em></span><button onClick={() => onStartReview(reviewLevelIndex)}>开始 5 分钟复习 <b>→</b></button></div>
          </div>
        )}

        {view === "daily" && (
          <div className="daily-view">
            <div className="daily-hero"><span>☀</span><div><small>9岁专注训练 · {dateKey}</small><h3>今天完成一次“准确优先”训练</h3><p>任意关卡中累计完成 {dailyTarget} 个目标，奖励会自动记录到今天。</p></div></div>
            <div className="daily-main-quest">
              <div className="daily-ring" style={{ "--daily-progress": `${dailyPercent * 3.6}deg` } as React.CSSProperties}><span><strong>{dailyWords}</strong><small>/{dailyTarget}</small></span></div>
              <div><span className="quest-rarity">DAILY QUEST</span><h4>完成 {dailyTarget} 个目标词语</h4><p>当前进度 {dailyWords}/{dailyTarget}，可在全部十二关中累计。</p><div className="daily-rewards"><span>✿ 60 花瓣</span><span>✦ 80 XP</span></div></div>
              <button disabled={dailyWords < dailyTarget || dailyClaimed} onClick={onClaimDaily}>{dailyClaimed ? "今日已领取" : dailyWords >= dailyTarget ? "领取奖励" : "进行中"}</button>
            </div>
            <div className="daily-bonus-grid"><span><i>◎</i><small>前 4 分钟</small><strong>基准键与指法热身</strong><p>先把准确率稳定到 85% 以上，不急着追求速度。</p></span><span><i>⌨</i><small>接下来 11 分钟</small><strong>主关 6 分钟 + 弱键 5 分钟</strong><p>完成后活动手腕、看看远处，今天的训练就足够了。</p></span></div>
          </div>
        )}

        {view === "collection" && (
          <div className="collection-view">
            <div className="collection-heading"><div><small>MAGIC WARDROBE</small><h3>魔法衣橱</h3><p>用冒险获得的花瓣收藏不同主题装备。</p></div><span>✿ <strong>{progress.petals}</strong></span></div>
            <div className="cosmetic-grid">
              {COSMETICS.map((item) => {
                const owned = progress.ownedCosmetics.includes(item.id);
                const equipped = progress.equippedCosmetic === item.id;
                const affordable = progress.petals >= item.price;
                return <button key={item.id} className={`${equipped ? "equipped" : ""} ${!owned && !affordable ? "unaffordable" : ""}`} onClick={() => onCosmetic(item.id)} style={{ "--cosmetic-color": item.color } as React.CSSProperties}><span>{item.icon}</span><small>{owned ? "已收藏" : `${item.price} 花瓣`}</small><strong>{item.name}</strong><em>{item.story}</em><b>{equipped ? "使用中" : owned ? "装备" : affordable ? "收藏" : "花瓣不足"}</b></button>;
              })}
            </div>
          </div>
        )}

        {view === "achievements" && (
          <div className="achievements-view">
            <div className="achievement-summary">
              <div className="level-medal"><span>{playerLevel}</span></div>
              <div><small>PLAYER LEVEL</small><h3>等级 {playerLevel} · 花语魔法师</h3><p>累计完成 {progress.totalWords} 个词语，收集 {progress.totalStars} 颗星。</p><div><i style={{ width: `${xpProgress}%` }} /></div></div>
              <strong>{progress.achievements.length}<i>/{ACHIEVEMENTS.length}</i></strong>
            </div>
            <div className="achievement-grid">
              {ACHIEVEMENTS.map((item) => {
                const unlocked = unlockedAchievements.has(item.id);
                return <div key={item.id} className={unlocked ? "unlocked" : "locked"}><span>{unlocked ? item.icon : "◆"}</span><div><small>{unlocked ? "ACHIEVEMENT UNLOCKED" : "尚未解锁"}</small><strong>{item.name}</strong><p>{item.story}</p></div>{unlocked && <b>✓</b>}</div>;
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

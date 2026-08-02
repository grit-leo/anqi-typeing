"use client";

import { useMemo, useState } from "react";
import {
  ACHIEVEMENTS,
  COSMETICS,
  GARDEN_LEVELS,
  GARDEN_WORLDS,
  getDailyTarget,
  getLocalDateKey,
  getPlayerLevel,
  getPlayerLevelProgress,
  getLevelMastery,
  getSuggestedReviewLevel,
  getWeakKeys,
  type GardenProgress,
  type MissionType,
} from "./game-engine";

type HubView = "map" | "review" | "daily" | "collection" | "achievements";

type AdventureHubProps = {
  progress: GardenProgress;
  levelIndex: number;
  onChooseLevel: (index: number) => void;
  onStart: () => void;
  onStartReview: (index: number) => void;
  onClaimDaily: () => void;
  onCosmetic: (id: string) => void;
};

const MISSION_COPY: Record<MissionType, { icon: string; name: string }> = {
  bloom: { icon: "✿", name: "花灵唤醒" },
  firefly: { icon: "✦", name: "萤火竞速" },
  rhythm: { icon: "♫", name: "节奏短句" },
  guardian: { icon: "♛", name: "守护者 Boss" },
};

const KEY_NAME: Record<string, string> = { space: "空格", shift: "Shift", comma: "逗号", period: "句号", apostrophe: "撇号" };

export function AdventureHub({ progress, levelIndex, onChooseLevel, onStart, onStartReview, onClaimDaily, onCosmetic }: AdventureHubProps) {
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
                    <em><i>{mission.icon}</i>{mission.name}</em>
                    {progress.bestScores[level.id] > 0 && <b>{progress.bestScores[level.id]} 分</b>}
                    <span className="stage-stars" aria-label={`最佳 ${progress.bestStars[level.id] ?? 0} 颗星`}>{[0, 1, 2].map((star) => <i key={star} className={star < (progress.bestStars[level.id] ?? 0) ? "earned" : ""}>★</i>)}</span>
                  </button>
                );
              })}
            </div>

            <div className="selected-mission">
              <span><i>{MISSION_COPY[GARDEN_LEVELS[levelIndex].mission].icon}</i><small>{GARDEN_LEVELS[levelIndex].lesson} · 掌握度 {selectedMastery}%</small><strong>{GARDEN_LEVELS[levelIndex].goal}</strong></span>
              <button onClick={onStart}>进入关卡 <b>→</b></button>
            </div>
          </div>
        )}

        {view === "review" && (
          <div className="review-view">
            <div className="review-hero"><span>⌨</span><div><small>LUMI&apos;S PRACTICE ROOM</small><h3>露米复习屋</h3><p>每次只练几分钟，把容易按错的键重新变成魔法。</p></div></div>
            <div className="weak-key-panel">
              <div><small>本机学习画像</small><h4>{weakKeys.length ? "这些键需要再熟悉一点" : "暂时没有明显弱键"}</h4><p>{weakKeys.length ? "系统会把它们放进接下来的练习，但不会连续惩罚你。" : "继续完成当前课程，露米会慢慢认识你的学习节奏。"}</p></div>
              <div className="weak-key-list">{weakKeys.length ? weakKeys.map((key) => <span key={key}><b>{KEY_NAME[key] ?? key.toUpperCase()}</b><small>{progress.keyMastery[key]?.score ?? 0}% 掌握</small></span>) : <span className="all-clear"><b>✦</b><small>准备探索新键</small></span>}</div>
            </div>
            <div className="review-mission"><span><i>✿</i><small>推荐复习关</small><strong>{reviewLevel.chapter} · {reviewLevel.title}</strong><em>{reviewLevel.lesson}</em></span><button onClick={() => onStartReview(reviewLevelIndex)}>开始 5 分钟复习 <b>→</b></button></div>
          </div>
        )}

        {view === "daily" && (
          <div className="daily-view">
            <div className="daily-hero"><span>☀</span><div><small>露米的每日委托 · {dateKey}</small><h3>今天也让花园多开一点花</h3><p>任意关卡中累计完成 {dailyTarget} 个目标，奖励会自动记录到今天。</p></div></div>
            <div className="daily-main-quest">
              <div className="daily-ring" style={{ "--daily-progress": `${dailyPercent * 3.6}deg` } as React.CSSProperties}><span><strong>{dailyWords}</strong><small>/{dailyTarget}</small></span></div>
              <div><span className="quest-rarity">DAILY QUEST</span><h4>完成 {dailyTarget} 个目标词语</h4><p>当前进度 {dailyWords}/{dailyTarget}，可在全部十二关中累计。</p><div className="daily-rewards"><span>✿ 60 花瓣</span><span>✦ 80 XP</span></div></div>
              <button disabled={dailyWords < dailyTarget || dailyClaimed} onClick={onClaimDaily}>{dailyClaimed ? "今日已领取" : dailyWords >= dailyTarget ? "领取奖励" : "进行中"}</button>
            </div>
            <div className="daily-bonus-grid"><span><i>◎</i><small>今日建议</small><strong>准确率优先</strong><p>稳稳输入比盲目追求速度更容易形成肌肉记忆。</p></span><span><i>⌨</i><small>训练提示</small><strong>每 15 分钟休息</strong><p>眨眨眼、活动手腕，再继续下一段冒险。</p></span></div>
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

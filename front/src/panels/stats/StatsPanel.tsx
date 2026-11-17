import React, { useState } from 'react';
import Panel from '../../components/Panel';
import { useApp } from '../../app/context';
import { PAGES } from '../../app/nav';
import { stats } from '../../content/stats';
import { readHistory } from '../../game/storage';
import { computeStats } from '../../game/stats';
import { currentGameDate } from '../../game/stage';
import StatsFigures from './StatsFigures';
import StatsDistribution from './StatsDistribution';
import StatsHistory from './StatsHistory';

/**
 * The panel's content. It mounts each time the panel opens, so the history is read then:
 * a game finished a minute ago is counted.
 */
function StatsBody() {
  const {
    lang, page, closePanel, gameDate,
  } = useApp();
  const c = stats[lang];
  const [history] = useState(readHistory);
  // The stage the game loaded (secret_rider.date); the device clock only where no game is loaded.
  const [today] = useState(() => gameDate ?? currentGameDate());

  if (!history.length) {
    return (
      <div className="stats stats-empty">
        <p className="stats-empty-text">{c.empty}</p>
        {page === 'game' ? (
          <button type="button" className="button button-primary stats-play" onClick={closePanel}>{c.play}</button>
        ) : (
          <a className="button button-primary stats-play" href={PAGES.game[lang]}>{c.play}</a>
        )}
        <p className="stats-storage">{c.storage}</p>
      </div>
    );
  }

  const figures = computeStats(history, today);
  const todayGame = history.find((g) => g.date === today) ?? null;
  const first = history.reduce((min, g) => (g.date < min ? g.date : min), history[0].date);
  return (
    <div className="stats">
      <StatsFigures figures={figures} since={first} />
      <StatsDistribution figures={figures} todayGame={todayGame} />
      <StatsHistory history={history} today={today} />
      <p className="stats-storage">{c.storage}</p>
    </div>
  );
}

/**
 * Opened by the header's Stats button (#stats).
 * Every figure comes from this browser's own history: there is no server, nothing global.
 */
export default function StatsPanel() {
  const { lang, panel, closePanel } = useApp();
  return (
    <Panel open={panel === 'stats'} title={stats[lang].title} onClose={closePanel} className="stats-panel">
      <StatsBody />
    </Panel>
  );
}

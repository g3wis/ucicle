import React from 'react';
import Score from '../../components/Score';
import { useApp } from '../../app/context';
import { stats } from '../../content/stats';
import type { GameParticipation } from '../../types/GameType';
import { MAX_TRIES } from '../../game/compare';
import { formatLongDate } from '../../i18n/format';
import { dayBefore, isoDate, rowDate } from './dates';

/** How many past stages the panel lists; the rest is counted, not listed. */
const SHOWN = 30;

type Props = {
  history: GameParticipation[],
  /** Today's game date (YYYYMMDD). */
  today: string,
};

/**
 * The finished stages, most recent first: the score (the same numeral as the turned mystery
 * bib's number column (D9), X for a missed stage), rider, date.
 * The history only holds finished games, so a rider shown here is never an open mystery.
 */
export default function StatsHistory({ history, today }: Props) {
  const { lang } = useApp();
  const c = stats[lang].history;
  const games = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const shown = games.slice(0, SHOWN);
  const yesterday = dayBefore(today);
  const year = today.slice(0, 4);

  const dateLabel = (date: string): string => {
    if (date === today) return c.today;
    if (date === yesterday) return c.yesterday;
    return rowDate(date, lang, date.slice(0, 4) !== year);
  };

  return (
    <section className="stats-section">
      <h3 className="stats-heading">{c.title}</h3>
      {games.length > SHOWN && <p className="stats-note">{c.latest(SHOWN, games.length)}</p>}
      <ol className="stats-games">
        {shown.map((game, i) => {
          const tries = game.success ? Math.min(Math.max(game.guesses.length, 1), MAX_TRIES) : null;
          const name = game.rider.name.trim();
          // A v1 history may hold one date twice: the position keeps the key unique.
          const key = `${game.date}-${i}`;
          return (
            <li key={key} className="stats-game">
              <span className="sr-only">{c.spoken(formatLongDate(game.date, lang), name, tries, MAX_TRIES)}</span>
              <Score tries={tries} max={MAX_TRIES} />
              <span className="stats-game-rider" aria-hidden="true">
                <span className="stats-game-name">{name}</span>
                <time className="stats-game-date" dateTime={isoDate(game.date)}>{dateLabel(game.date)}</time>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

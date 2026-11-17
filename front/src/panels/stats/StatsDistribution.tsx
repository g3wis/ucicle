import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useApp } from '../../app/context';
import { stats } from '../../content/stats';
import type { Stats } from '../../game/stats';
import type { GameParticipation } from '../../types/GameType';
import { MAX_TRIES } from '../../game/compare';
import {
  DURATION, EASE_OUT, STAGGER,
} from '../../motion/tokens';

type Props = {
  figures: Stats,
  /** Today's finished game, if any: its row is marked. */
  todayGame: GameParticipation | null,
};

type Row = {
  key: string,
  label: string,
  count: number,
  spoken: string,
  today: boolean,
  /** The missed row: its X is the score's red mark (a win is never red). */
  missed: boolean,
};

/** Today's row: the number of tries of a win (1 to 5), 0 for a loss, null when today is not finished. */
function todayRowOf(game: GameParticipation | null): number | null {
  if (!game) return null;
  return game.success ? Math.min(Math.max(game.guesses.length, 1), MAX_TRIES) : 0;
}

/**
 * Wins by number of tries, then the losses, printed like a results sheet (D17): one thin rule
 * per row on the tarmac, its length proportional to the largest count, the count printed right
 * after it. Today's rule is Tyvek; its sentence says "today" to assistive tech only. The row
 * labels follow the score's grammar: 1 to 5 for a win, the red X for a missed stage.
 */
export default function StatsDistribution({ figures, todayGame }: Props) {
  const { lang, content } = useApp();
  const c = stats[lang].distribution;
  const reduce = useReducedMotion();
  const todayRow = todayRowOf(todayGame);

  const rows: Row[] = figures.distribution.map((count, i) => ({
    key: String(i + 1),
    label: String(i + 1),
    count,
    spoken: c.found(i + 1, count, todayRow === i + 1),
    today: todayRow === i + 1,
    missed: false,
  }));
  rows.push({
    key: 'x',
    label: content.game.verdict.missedMark,
    count: figures.losses,
    spoken: c.missed(figures.losses, todayRow === 0),
    today: todayRow === 0,
    missed: true,
  });
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="stats-section">
      <h3 className="stats-heading">{c.title}</h3>
      <ol className="stats-dist">
        {rows.map((row, i) => (
          <li
            key={row.key}
            className="stats-dist-row"
            data-today={row.today || undefined}
            data-missed={row.missed || undefined}
            style={{ '--share': row.count / max } as React.CSSProperties}
          >
            <span className="sr-only">{row.spoken}</span>
            <span className="stats-dist-try" aria-hidden="true">{row.label}</span>
            <span className="stats-dist-track" aria-hidden="true">
              {row.count > 0 && (
                <motion.span
                  className="stats-dist-bar"
                  style={{ originX: 0 }}
                  initial={reduce ? { opacity: 0 } : { scaleX: 0 }}
                  animate={reduce ? { opacity: 1 } : { scaleX: 1 }}
                  transition={reduce
                    ? { duration: DURATION.reduced }
                    : { duration: DURATION.panel, delay: DURATION.fast + i * STAGGER.pins, ease: EASE_OUT }}
                />
              )}
              <span className="stats-dist-count">{row.count}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { GameParticipation } from '../types/GameType';
import { parseGameDate } from '../i18n/format';
import { MAX_TRIES } from './compare';

export type Stats = {
  played: number,
  wins: number,
  /** Whole percent, or null before the first game. */
  winRate: number | null,
  /** Wins in a row, ending on the latest game when that game is today or yesterday. */
  currentStreak: number,
  bestStreak: number,
  /** Wins by number of tries: index 0 is "found in 1", index 4 "found in 5". */
  distribution: number[],
  losses: number,
};

const DAY = 24 * 3600 * 1000;
const dayGap = (a: string, b: string): number => Math.round(
  (parseGameDate(b).getTime() - parseGameDate(a).getTime()) / DAY,
);

/** Every figure comes from this browser's own history: nothing global, nothing invented. */
export function computeStats(history: GameParticipation[], today: string): Stats {
  const games = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const wins = games.filter((g) => g.success);
  const distribution = Array.from({ length: MAX_TRIES }, () => 0);
  wins.forEach((g) => {
    const tries = Math.min(Math.max(g.guesses.length, 1), MAX_TRIES);
    distribution[tries - 1] += 1;
  });

  let best = 0;
  let run = 0;
  games.forEach((g, i) => {
    const follows = i > 0 && dayGap(games[i - 1].date, g.date) === 1 && games[i - 1].success;
    run = g.success ? (follows ? run : 0) + 1 : 0;
    best = Math.max(best, run);
  });
  const last = games[games.length - 1];
  const current = last && last.success && dayGap(last.date, today) <= 1 ? run : 0;

  return {
    played: games.length,
    wins: wins.length,
    winRate: games.length ? Math.round((wins.length * 100) / games.length) : null,
    currentStreak: current,
    bestStreak: best,
    distribution,
    losses: games.length - wins.length,
  };
}

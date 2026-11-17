import { Rider } from '../types/CyclingTypes';
import { GameParticipation, GameProgress } from '../types/GameType';

// `game-history` is the v1 key: players keep their history across the redesign.
const HISTORY_KEY = 'game-history';
const PROGRESS_KEY = 'game-progress';

// localStorage can be missing or throw (private mode, blocked storage): the game still plays.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage refused: the game goes on for this visit.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export function readHistory(): GameParticipation[] {
  const history = read<GameParticipation[]>(HISTORY_KEY, []);
  return Array.isArray(history) ? history.filter((g) => g && typeof g.date === 'string' && g.rider) : [];
}

export function findResult(date: string): GameParticipation | undefined {
  return readHistory().find((g) => g.date === date);
}

export function saveResult(date: string, mystery: Rider, guesses: Rider[], success: boolean): GameParticipation[] {
  const history = [
    ...readHistory().filter((g) => g.date !== date),
    {
      rider: mystery, date, guesses, success,
    },
  ].sort((a, b) => a.date.localeCompare(b.date));
  write(HISTORY_KEY, history);
  remove(PROGRESS_KEY);
  return history;
}

export function readProgress(date: string): string[] {
  const progress = read<GameProgress | null>(PROGRESS_KEY, null);
  return progress && progress.date === date && Array.isArray(progress.guesses) ? progress.guesses : [];
}

export function saveProgress(date: string, guesses: Rider[]): void {
  write(PROGRESS_KEY, { date, guesses: guesses.map((g) => g.name) } as GameProgress);
}

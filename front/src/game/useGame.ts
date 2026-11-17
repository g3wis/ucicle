import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Rider } from '../types/CyclingTypes';
import { GameSession } from '../types/GameType';
import { fetchToday } from '../data/api';
import {
  Comparison, compareRiders, MAX_TRIES,
} from './compare';
import { gatherKnowledge, Knowledge } from './knowledge';
import {
  findResult, readHistory, readProgress, saveProgress, saveResult,
} from './storage';

export type GameStatus = 'loading' | 'error' | 'playing' | 'won' | 'lost';

export type Game = {
  status: GameStatus,
  riders: Rider[],
  session: GameSession | null,
  guesses: Rider[],
  comparisons: Comparison[],
  knowledge: Knowledge | null,
  /** Number of tries restored from storage at load: those bibs do not animate in. */
  restored: number,
  /** No finished game and no try yet in this browser: the one-line help shows. */
  firstVisit: boolean,
  submit: (rider: Rider) => Comparison | null,
  retry: () => void,
};

/** The day's game: data, tries, persistence under the date of secret_rider.json. */
export default function useGame(): Game {
  const [status, setStatus] = useState<GameStatus>('loading');
  const [riders, setRiders] = useState<Rider[]>([]);
  const [session, setSession] = useState<GameSession | null>(null);
  const [guesses, setGuesses] = useState<Rider[]>([]);
  const [restored, setRestored] = useState(0);
  const [firstVisit, setFirstVisit] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    fetchToday(attempt)
      .then(([list, today]) => {
        if (!alive) return;
        setRiders(list);
        setSession(today);
        const result = findResult(today.date);
        if (result) {
          setGuesses(result.guesses);
          setRestored(result.guesses.length);
          setStatus(result.success ? 'won' : 'lost');
          return;
        }
        const byName = new Map(list.map((r) => [r.name, r]));
        const previous = readProgress(today.date)
          .map((name) => byName.get(name))
          .filter((r): r is Rider => Boolean(r))
          .slice(0, MAX_TRIES - 1);
        setGuesses(previous);
        setRestored(previous.length);
        setFirstVisit(previous.length === 0 && readHistory().length === 0);
        setStatus('playing');
      })
      .catch(() => {
        if (alive) setStatus('error');
      });
    return () => { alive = false; };
  }, [attempt]);

  const submit = useCallback((rider: Rider): Comparison | null => {
    if (!session || status !== 'playing' || guesses.some((g) => g.name === rider.name)) return null;
    const next = [...guesses, rider];
    const comparison = compareRiders(rider, session.rider);
    setGuesses(next);
    if (comparison.found) {
      saveResult(session.date, session.rider, next, true);
      setStatus('won');
    } else if (next.length >= MAX_TRIES) {
      saveResult(session.date, session.rider, next, false);
      setStatus('lost');
    } else {
      saveProgress(session.date, next);
    }
    return comparison;
  }, [session, status, guesses]);

  const comparisons = useMemo(
    () => (session ? guesses.map((g) => compareRiders(g, session.rider)) : []),
    [guesses, session],
  );
  const knowledge = useMemo(
    () => (session ? gatherKnowledge(guesses, session.rider) : null),
    [guesses, session],
  );

  return {
    status,
    riders,
    session,
    guesses,
    comparisons,
    knowledge,
    restored,
    firstVisit,
    submit,
    retry: () => setAttempt((a) => a + 1),
  };
}

import { Rider } from '../types/CyclingTypes';
import { compareRiders, toCm, Trend } from './compare';

/** What the tries prove about one numeric attribute, as inclusive integer bounds. */
export type Range = { min?: number, max?: number, exact?: number };

/** What the tries prove about the country or the team. */
export type Identity = { exact?: string, excluded: string[] };

export type Knowledge = {
  age: Range,
  height: Range, // centimetres
  weight: Range,
  country: Identity,
  team: Identity,
  empty: boolean,
};

function narrow(range: Range, value: number | null, t: Trend): Range {
  // An unknown value proves nothing.
  if (range.exact !== undefined || value === null || t === 'unknown') return range;
  if (t === 'eq') return { exact: value };
  // Values are whole numbers (years, cm, kg): "higher than 26" is "27 or more".
  if (t === 'up') return { ...range, min: Math.max(range.min ?? -Infinity, value + 1) };
  return { ...range, max: Math.min(range.max ?? Infinity, value - 1) };
}

function identify(identity: Identity, value: string | null, same: 'eq' | 'no'): Identity {
  // "No UCI team" rules nothing out: the mystery rider always has one.
  if (identity.exact !== undefined || value === null) return identity;
  if (same === 'eq') return { exact: value, excluded: [] };
  return identity.excluded.includes(value) ? identity : { ...identity, excluded: [...identity.excluded, value] };
}

/** A pure function of the tries: no new data, only what the board already shows, gathered. */
export function gatherKnowledge(guesses: Rider[], mystery: Rider): Knowledge {
  return guesses.reduce<Knowledge>((k, guess) => {
    const c = compareRiders(guess, mystery);
    return {
      age: narrow(k.age, guess.age, c.age),
      height: narrow(k.height, toCm(guess.height), c.height),
      weight: narrow(k.weight, guess.weight, c.weight),
      country: identify(k.country, guess.country, c.country),
      team: identify(k.team, guess.team, c.team),
      empty: false,
    };
  }, {
    age: {}, height: {}, weight: {}, country: { excluded: [] }, team: { excluded: [] }, empty: true,
  });
}

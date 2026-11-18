import { Rider } from '../types/CyclingTypes';

/**
 * For a number: equal, or where the mystery rider's value is (up: higher, down: lower);
 * unknown when the guess's value is not in the data (a height or a weight Wikidata lacks).
 */
export type Trend = 'eq' | 'up' | 'down' | 'unknown';
/** For a country or a team: the same as the mystery rider's, or not. */
export type Same = 'eq' | 'no';

export type Comparison = {
  age: Trend,
  height: Trend,
  weight: Trend,
  country: Same,
  team: Same,
  found: boolean,
};

export const MAX_TRIES = 5;

export function trend(guess: number | null, mystery: number | null): Trend {
  if (guess === null || mystery === null) return 'unknown';
  if (guess === mystery) return 'eq';
  return mystery > guess ? 'up' : 'down';
}

/** Heights are metres with float noise (1.8, 1.80): compare them in whole centimetres. */
export const toCm = (metres: number | null): number | null => (metres === null ? null : Math.round(metres * 100));

export function compareRiders(guess: Rider, mystery: Rider): Comparison {
  return {
    age: trend(guess.age, mystery.age),
    height: trend(toCm(guess.height), toCm(mystery.height)),
    weight: trend(guess.weight, mystery.weight),
    country: guess.country === mystery.country ? 'eq' : 'no',
    team: guess.team !== null && guess.team === mystery.team ? 'eq' : 'no',
    found: guess.name === mystery.name,
  };
}

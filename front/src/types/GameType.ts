import { Rider, SecretRider } from './CyclingTypes';

/** A finished game, as stored in localStorage under `game-history` (shape kept from v1). */
export type GameParticipation = {
  rider: Rider,
  date: string, // YYYYMMDD, the date of secret_rider.json
  guesses: Rider[],
  success: boolean
};

/** Content of /api/secret_rider.json. */
export type GameSession = {
  date: string, // YYYYMMDD
  rider: SecretRider,
};

/** A game in progress, stored under `game-progress` so a reload keeps the tries. */
export type GameProgress = {
  date: string, // YYYYMMDD, the date of secret_rider.json
  guesses: string[], // rider names, in order
};

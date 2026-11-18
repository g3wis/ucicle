/**
 * A rider the player can guess.
 * @param rank The current UCI rank of the rider, null for a former top rider who no longer scores UCI points
 * @param name The name of the rider
 * @param country The country of the rider
 * @param age The age of the rider
 * @param weight Rider's weight (in kg), null when unknown
 * @param height Rider's height (in meter), null when unknown
 * @param bestResult Best result of the last 52 weeks, only known for the secret rider candidates
 * @param team The current UCI team, or the last one for a rider without team this season,
 * null when the rider has no UCI team (a rider of a club or of a national team)
 */
export type Rider = {
  rank: number | null,
  name: string,
  country: string,
  age: number,
  weight: number | null,
  height: number | null,
  bestResult: BestResult | null,
  team: string | null
};

/** The mystery rider: always a current top 100 rider with complete data. */
export type SecretRider = Rider & {
  rank: number,
  weight: number,
  height: number,
  bestResult: BestResult,
  team: string,
};

/**
 * @param race Race's title
 * @param position Ranking of the rider for teh race
 * @param raceType Define the type of the race
 * @param recurrence Defines the number of times the rider has obtained this result
 */
export type BestResult = {
  race: string,
  rank: number,
  raceType: RaceType,
  recurrence: number,
  years: number[]
};

export type RaceType = 'GC' | 'Point GC' | 'Points GC' | 'KOM' | 'stage' | 'race';

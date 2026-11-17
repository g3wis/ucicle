import { Rider } from '../types/CyclingTypes';
import { GameSession } from '../types/GameType';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json() as Promise<T>;
}

export const fetchRiders = (): Promise<Rider[]> => getJson<Rider[]>('/api/riders.json');

export const fetchSession = (): Promise<GameSession> => getJson<GameSession>('/api/secret_rider.json');

declare global {
  interface Window {
    /** Both JSON files, requested by an inline script of the game's HTML, in parallel with the bundle. */
    ucicleData?: Promise<[Rider[], GameSession]>,
  }
}

/** Today's riders and session: the requests the HTML already started, or new ones on a retry. */
export const fetchToday = (attempt: number): Promise<[Rider[], GameSession]> => (
  attempt === 0 && window.ucicleData ? window.ucicleData : Promise.all([fetchRiders(), fetchSession()])
);

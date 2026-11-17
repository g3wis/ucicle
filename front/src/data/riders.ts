import { Rider } from '../types/CyclingTypes';

/**
 * Lower case, accents removed, every other sign turned into one space: "Pogačar" and "pogacar"
 * meet, and each character keeps its index, so a match can be located in the original name.
 */
export function searchKey(text: string): string {
  return text
    .normalize('NFC')
    .split('')
    .map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 1) || ' ')
    .join('')
    .replace(/[^a-z0-9]/g, ' ');
}

const queryKey = (text: string): string => searchKey(text).replace(/\s+/g, ' ').trim();

const surname = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
};

/**
 * The name minus its first word, for the label of the validate button
 * ("Mads Pedersen" gives "Pedersen", "Wout van Aert" gives "van Aert"). When another rider of
 * `riders` shares that short name, the first initial is kept ("M. Pedersen", "C. Pedersen").
 * The visible label is also the button's accessible name, so it must never be ambiguous.
 */
export function shortName(name: string, riders: Rider[] = []): string {
  const short = surname(name);
  const shared = riders.some((r) => r.name !== name && surname(r.name) === short);
  if (!shared || short === name.trim()) return short;
  return `${name.trim().charAt(0)}. ${short}`;
}

export type RiderMatch = { rider: Rider, start: number, length: number };

/**
 * Riders whose name matches the query, best first: whole-name prefix, then a word prefix,
 * then anywhere; ties by UCI rank, then by name. `start`/`length` locate the typed part in the name.
 */
export function matchRiders(riders: Rider[], query: string, limit = 6): RiderMatch[] {
  const q = queryKey(query);
  if (q.length < 2) return [];
  const scored: { match: RiderMatch, score: number }[] = [];
  riders.forEach((rider) => {
    const key = searchKey(rider.name);
    let index = key.indexOf(q);
    if (index < 0) return;
    let score = 2;
    if (index === 0) score = 0;
    else if (key[index - 1] === ' ') score = 1;
    else {
      const wordIndex = key.indexOf(` ${q}`);
      if (wordIndex >= 0) { index = wordIndex + 1; score = 1; }
    }
    scored.push({ match: { rider, start: index, length: q.length }, score });
  });
  return scored
    // Former riders, out of the ranking (rank null), come after the ranked ones.
    .sort((a, b) => a.score - b.score
      || (a.match.rider.rank ?? Infinity) - (b.match.rider.rank ?? Infinity)
      || a.match.rider.name.localeCompare(b.match.rider.name))
    .slice(0, limit)
    .map((s) => s.match);
}

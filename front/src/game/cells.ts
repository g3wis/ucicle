import { Rider } from '../types/CyclingTypes';
import type { Lang } from '../i18n/language';
import type { CommonContent, NumericAttribute } from '../content/types';
import { Comparison, MAX_TRIES } from './compare';
import { formatAge, formatHeight, formatWeight } from '../i18n/format';
import { countryCode, countryName } from '../data/countries';

export type CellState = 'eq' | 'up' | 'down' | 'no' | 'plain';

export type CellModel = {
  key: NumericAttribute | 'country',
  value: string,
  state: CellState,
  /** Full sentence for screen readers: attribute, value, comparison. */
  spoken: string,
};

/** The four cells of a bib, in board order. `comparison` null: plain values (the revealed mystery). */
export function cellsFor(rider: Rider, comparison: Comparison | null, lang: Lang, content: CommonContent): CellModel[] {
  const g = content.game;
  const numeric = (key: NumericAttribute, value: string): CellModel => {
    const state = comparison ? comparison[key] : 'plain';
    const tail = comparison ? `, ${g.trends[key][comparison[key]]}` : '';
    return {
      key, value, state, spoken: `${g.attributes[key]} ${value}${tail}`,
    };
  };
  const countryState: CellState = comparison ? comparison.country : 'plain';
  return [
    numeric('age', formatAge(rider.age, lang)),
    numeric('height', formatHeight(rider.height, lang)),
    numeric('weight', formatWeight(rider.weight, lang)),
    {
      key: 'country',
      value: countryCode(rider.country),
      state: countryState,
      spoken: `${g.attributes.country} ${countryName(rider.country, lang)}${
        comparison ? `, ${g.same.country[comparison.country]}` : ''}`,
    },
  ];
}

/** The live-region sentence for one try: one sentence per try, never one per cell. */
export function guessSentence(
  n: number,
  rider: Rider,
  comparison: Comparison,
  lang: Lang,
  content: CommonContent,
): string {
  const g = content.game;
  const parts = [
    `${formatAge(rider.age, lang)}, ${g.trends.age[comparison.age]}`,
    `${formatHeight(rider.height, lang)}, ${g.trends.height[comparison.height]}`,
    `${formatWeight(rider.weight, lang)}, ${g.trends.weight[comparison.weight]}`,
    `${countryName(rider.country, lang)}, ${g.same.country[comparison.country]}`,
    `${rider.team}, ${g.same.team[comparison.team]}`,
  ];
  return g.announce(n, MAX_TRIES, rider.name, parts);
}

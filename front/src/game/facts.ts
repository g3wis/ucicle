import type { Lang } from '../i18n/language';
import type { CommonContent, NumericAttribute } from '../content/types';
import type { Knowledge, Range } from './knowledge';
import { formatAge, formatHeight, formatWeight } from '../i18n/format';
import { countryCode } from '../data/countries';

export type FactKey = NumericAttribute | 'country' | 'team';

/**
 * A fact the tries proved, as printed text. `exact`: the value itself (a blue block on the bib);
 * `range`: one or two bounds; `excluded`: the countries ruled out (secondary ink on the bib).
 */
export type Fact = { key: FactKey, text: string, kind: 'exact' | 'range' | 'excluded' };

type Format = (value: number, lang: Lang, unit: boolean) => string;

const FORMATS: Record<NumericAttribute, Format> = {
  age: formatAge,
  // Knowledge holds heights in centimetres, the data in metres.
  height: (cm, lang, unit) => formatHeight(cm / 100, lang, unit),
  weight: formatWeight,
};

/** The columns of the bib's ruled line, in the guess bibs' order. */
export const LINE_KEYS = ['age', 'height', 'weight', 'country'] as const;

function numericFact(
  key: NumericAttribute,
  range: Range,
  lang: Lang,
  content: CommonContent,
): Fact | null {
  const format = FORMATS[key];
  // Both bounds on one value prove it: 27 or more and 27 or less is 27.
  const exact = range.exact ?? (range.min !== undefined && range.min === range.max ? range.min : undefined);
  if (exact !== undefined) return { key, text: format(exact, lang, true), kind: 'exact' };
  if (range.min === undefined && range.max === undefined) return null;
  const both = range.min !== undefined && range.max !== undefined;
  // "1,77 à 1,79 m": the unit once, after the second bound.
  const min = range.min !== undefined ? format(range.min, lang, !both) : null;
  const max = range.max !== undefined ? format(range.max, lang, true) : null;
  return { key, text: content.game.known.range(min, max), kind: 'range' };
}

function countryFact(knowledge: Knowledge, content: CommonContent): Fact | null {
  const { country } = knowledge;
  if (country.exact) return { key: 'country', text: countryCode(country.exact), kind: 'exact' };
  if (!country.excluded.length) return null;
  return { key: 'country', text: content.game.known.notIn(country.excluded.map(countryCode)), kind: 'excluded' };
}

/**
 * The four columns printed on the mystery bib (age, height, weight, country), in board order.
 * A column is null until a try teaches something about it.
 */
export function lineFacts(knowledge: Knowledge, lang: Lang, content: CommonContent): (Fact | null)[] {
  return [
    numericFact('age', knowledge.age, lang, content),
    numericFact('height', knowledge.height, lang, content),
    numericFact('weight', knowledge.weight, lang, content),
    countryFact(knowledge, content),
  ];
}

/** The team, once a try proved it: the mystery bib's foot band. */
export function provenTeam(knowledge: Knowledge): string | undefined {
  return knowledge.team.exact;
}

/**
 * The facts of the band fixed under the header, ordered by how decisive they are: the exact team,
 * the country (exact or ruled out), the exact values, then the ranges. Those two the player can
 * match against the rider list come first; the ranges drop first when the line is full.
 */
export function bandFacts(knowledge: Knowledge, lang: Lang, content: CommonContent): Fact[] {
  const team = provenTeam(knowledge);
  const [age, height, weight, country] = lineFacts(knowledge, lang, content);
  const values = [age, height, weight].filter((f): f is Fact => f !== null);
  return [
    ...(team ? [{ key: 'team', text: team, kind: 'exact' } as Fact] : []),
    ...(country ? [country] : []),
    ...values.filter((f) => f.kind === 'exact'),
    ...values.filter((f) => f.kind !== 'exact'),
  ];
}

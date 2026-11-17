import type { Lang, PageKey } from '../i18n/language';
import type { RaceType } from '../types/CyclingTypes';
import type { Trend, Same } from '../game/compare';

export type NavKey = 'game' | 'riders' | 'teams' | 'races';
export type NumericAttribute = 'age' | 'height' | 'weight';
export type Attribute = NumericAttribute | 'country' | 'team';

/** Every visible string of the shell and of the game page. Views hold no copy. */
export type CommonContent = {
  lang: Lang,
  siteName: string,
  skipLink: Record<PageKey, string>,
  header: {
    home: string, help: string, stats: string, menu: string, nav: string,
    /**
     * The other language in the header from 1024 px (D24): `code` is the visible "EN" / "FR",
     * `name` its accessible name, written in that language.
     */
    language: { code: string, name: string },
  },
  nav: Record<NavKey, string>,
  menu: { title: string, sections: string, about: string, language: string, otherLanguage: string },
  footer: { data: string, about: string, otherLanguage: string },
  panel: { close: string },
  game: GameContent,
};

export type GameContent = {
  title: string,
  loading: string,
  loadError: string,
  retry: string,
  /** The mystery bib's top band: stage number and date. */
  band: (stage: number, date: string) => string,
  mysteryLabel: string,
  /** Heading (screen readers) of the board of tries. */
  boardTitle: string,
  hint: {
    label: string,
    recurrence: (times: number) => string,
    result: (rank: number, raceType: RaceType) => string,
    years: (years: number[]) => string,
  },
  /** What the tries proved, printed on the mystery bib's ruled line and in the facts band. */
  known: {
    label: string,
    /**
     * "≥ 27 ans", "≤ 1,79 m", "1,77 à 1,79 m" (the first bound comes without its unit). A narrow
     * no-break space follows "≥" and "≤": the operator never leaves its value.
     */
    range: (min: string | null, max: string | null) => string,
    notIn: (values: string[]) => string,
  },
  attributes: Record<Attribute, string>,
  trends: Record<NumericAttribute, Record<Trend, string>>,
  same: Record<'country' | 'team', Record<Same, string>>,
  tryLabel: (n: number, max: number) => string,
  lastTry: string,
  bibLabel: (n: number, name: string) => string,
  placeholder: string,
  validate: string,
  validateRider: (shortName: string) => string,
  firstHelp: string,
  combobox: {
    results: (n: number) => string,
    none: string,
    alreadyPlayed: string,
    instructions: string,
  },
  announce: (n: number, max: number, name: string, parts: string[]) => string,
  found: (tries: number) => string,
  /** Live-region sentence of a loss: it names the rider. */
  missed: (name: string) => string,
  /** Heading of a loss: the name is already on the turned bib. */
  missedTitle: string,
  /**
   * The verdict as a score: `missedMark` is the numeral of a missed stage, on the turned mystery
   * bib (D9) and in the stats history (components/Score). Visual only: the heading keeps
   * `found(n)` / `missedTitle` for screen readers.
   */
  verdict: { missedMark: string },
  resultLabel: string,
  share: string,
  shared: string,
  copied: string,
  shareFailed: string,
  shareHeadline: (stage: number, tries: number | null, max: number) => string,
  shareUrl: string,
  nextStart: string,
  newStart: string,
  reload: string,
};

import type { Lang } from '../i18n/language';
import type { Rider } from '../types/CyclingTypes';
import type { Comparison } from '../game/compare';

// Owner: rules clone. Every visible string of the Help panel, in both languages.
// Voice: tutoiement, short sentences, peloton vocabulary. No emoji, no U+2014.
// French punctuation (: ? « ») carries a no-break space, so it never starts a line (written
// \u00a0 inside template literals: ESLint refuses the raw character there).

/**
 * The example bib of the Help panel (the About page sends here for it, D18). The rider is copied
 * as is from the list (dev-fixtures/api/riders.json, 2026-11-16). The comparison belongs to no
 * real mystery rider: it is built by hand so that every state shows once. Age equal, height
 * lower (arrow down), weight higher (arrow up), another country, the same team (a blue check tile
 * before the name on the ink foot band, D23; the band is printed in the band type, D20).
 * Its caption (exampleCaption) and the conditional of the lines below mark it as made up, so
 * that a player opening the help mid-game never reads it as a clue about today's rider.
 */
export const EXAMPLE_RIDER: Rider = {
  rank: 7,
  name: 'Mads Pedersen',
  country: 'denmark',
  age: 27,
  weight: 70,
  height: 1.8,
  bestResult: {
    race: 'World Championships ME - Road Race',
    raceType: 'race',
    recurrence: 1,
    rank: 1,
    years: [2019],
  },
  team: 'Lidl - Trek',
};

export const EXAMPLE_COMPARISON: Comparison = {
  age: 'eq',
  height: 'down',
  weight: 'up',
  country: 'no',
  team: 'eq',
  found: false,
};

/** The example's try number: any bib but the fifth, which is the red one. */
export const EXAMPLE_TRY = 1;

/** One line under the example bib: the term in bold, then the rest of the sentence. */
export type BibLine = { term: string, text: string };

export type HelpContent = {
  title: string,
  /** What the game is, in one sentence or two. */
  lead: string,
  tryTitle: string,
  /** How a try works. `validate` is the button's own label (common.ts). */
  tryText: (validate: string) => string,
  mysteryText: string,
  bibTitle: string,
  /** Accessible name of the example bib. */
  exampleLabel: string,
  /** Visible mark read before the example bib: it is made up, not a clue about today's rider. */
  exampleCaption: string,
  bibLines: BibLine[],
  startTitle: string,
  startText: string,
  /** The help's way back to the board, shown on the game page only. */
  play: string,
  /** To the About page, which leads with what the help does not say: the data and the hint rule. */
  aboutLink: string,
};

const fr: HelpContent = {
  title: 'Aide',
  lead: 'Trouve le coureur mystère du jour en cinq essais. Au départ, tu n’as que son meilleur résultat.',
  tryTitle: 'Un essai',
  tryText: (validate) => 'Tape au moins deux lettres, choisis le coureur, puis valide. '
    + `Choisir ne coûte rien\u00a0: seul «\u00a0${validate}\u00a0» joue l’essai.`,
  mysteryText: 'Ce que chaque essai prouve s’inscrit sur le dossard mystère.',
  bibTitle: 'Lire un dossard',
  exampleLabel: 'Dossard d’exemple',
  exampleCaption: 'Exemple inventé, pas l’étape du jour.',
  bibLines: [
    {
      term: 'La flèche',
      text: ' pointe vers la valeur du mystère : dans cet exemple, il serait plus petit et plus lourd.',
    },
    { term: 'Bleu avec une coche', text: ' : comme le mystère de l’exemple, ici l’âge et l’équipe.' },
    { term: 'Le dossard 5', text: ' est rouge : c’est ton dernier essai.' },
  ],
  startTitle: 'Chaque jour',
  startText: 'Un nouveau coureur mystère à 5 h UTC, soit 6 h à Paris en hiver et 7 h en été.',
  play: 'Jouer',
  aboutLink: 'L’origine des données et de l’indice de départ',
};

const en: HelpContent = {
  title: 'Help',
  lead: 'Find today’s mystery rider in five tries. At the start, all you have is their best result.',
  tryTitle: 'A try',
  tryText: (validate) => 'Type at least two letters, pick the rider, then confirm. '
    + `Picking costs nothing: only “${validate}” plays the try.`,
  mysteryText: 'What each try proves is written on the mystery bib.',
  bibTitle: 'Reading a bib',
  exampleLabel: 'Example bib',
  exampleCaption: 'Made-up example, not today’s stage.',
  bibLines: [
    {
      term: 'Arrows',
      text: ' point toward the mystery rider’s value: in this example, they would be shorter and heavier.',
    },
    { term: 'Blue with a check', text: ': same as the example’s mystery rider, here the age and the team.' },
    { term: 'Bib 5', text: ' is red: it’s your last try.' },
  ],
  startTitle: 'Every day',
  startText: 'A new mystery rider at 05:00 UTC.',
  play: 'Play',
  aboutLink: 'Where the data and the starting hint come from',
};

export const help: Record<Lang, HelpContent> = { fr, en };

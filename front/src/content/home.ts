import type { Lang } from '../i18n/language';

/**
 * Every visible string of the home (src/views/home), FR and EN, same keys. Every number and every
 * name is computed by the view from the database or the game's own data; these functions only put
 * words around it. The home is indexed: nothing here may describe today's mystery rider.
 */
export type HomeRaceKind =
  | 'one_day' | 'one_day_itt' | 'stage' | 'prologue' | 'gc_final'
  | 'championship_road_race' | 'championship_itt' | 'olympic_road_race' | 'olympic_itt';

export type HomeContent = {
  /** Head title, fixed (synthesis section 6). */
  title: string,
  /** Head description, generated; every field has its fallback (no field may print empty). */
  description: (p: {
    count: string | null, since: number | null, date: string | null, leader: string | null,
  }) => string,
  h1: string,
  /** The one computed line under the H1. `updated`: the "Mis à jour le" sentence, already written. */
  line: (p: { count: string, since: number | null, updated: string | null }) => string,
  /** No version computed yet: the honest line under the H1. */
  emptyLine: string,
  /** The database could not be read: the line under the H1, the game block still stands. */
  unavailableLine: string,
  game: {
    title: string,
    /** The game's tries, from the game's own constant. */
    note: (tries: number) => string,
    play: string,
    /** Same link, once today's stage is finished on this device. */
    result: string,
    /** The bib band when today's date could not be read. */
    bandless: string,
  },
  top: {
    title: (n: number) => string,
    /** `asOf`: the ranking's day; `since`: the day the rank moves are measured from. */
    note: (asOf: string, since: string | null) => string,
    label: (n: number) => string,
    more: string,
    empty: string,
  },
  results: {
    title: string,
    label: string,
    winner: string,
    mover: string,
    /** The biggest change is the winner's own: said, not linked twice. */
    moverIsWinner: string,
    /** The band over the plain lines of the other races (decision E5), and their list's name. */
    others: string,
    othersLabel: string,
    kind: Record<HomeRaceKind, string>,
    stage: (n: number | null, label: string | null) => string,
    empty: string,
  },
  method: {
    title: string,
    /** `entry`: the starting index of a rider whose first counted race is CN or .2 (null without the correction). */
    sentence: (initial: string | null, entry: string | null) => string,
    link: string,
  },
};

/** The game's own band, "Étape N, date" (the mystery bib of /jeu/). Kept apart for the client script. */
export const homeBand: Record<Lang, (stage: number, date: string) => string> = {
  fr: (stage, date) => `Étape ${stage}, ${date}`,
  en: (stage, date) => `Stage ${stage}, ${date}`,
};

const frStage = (n: number | null, label: string | null): string => {
  if (n === 0) return 'prologue';
  const number = label?.replace(/^stage\s*/i, '').trim() || (n === null ? '' : String(n));
  return number ? `étape\u00A0${number}` : 'étape';
};

const enStage = (n: number | null, label: string | null): string => {
  if (n === 0) return 'prologue';
  const number = label?.replace(/^stage\s*/i, '').trim() || (n === null ? '' : String(n));
  return number ? `stage\u00A0${number}` : 'stage';
};

const fr: HomeContent = {
  title: 'Ucicle : l’index des coureurs cyclistes et le coureur mystère du jour',
  description: ({
    count, since, date, leader,
  }) => {
    const scope = since ? ` depuis ${since}` : '';
    const ranked = count
      ? `L’index Ucicle classe ${count} coureurs sur leurs courses UCI${scope}.`
      : `L’index Ucicle classe les coureurs cyclistes sur leurs courses UCI${scope}.`;
    const lead = leader && date ? ` ${leader}, 1er au ${date}.` : '';
    return `${ranked}${lead} Top 10, derniers résultats et le coureur mystère du jour.`;
  },
  h1: 'L’index des coureurs cyclistes',
  line: ({ count, since, updated }) => [
    `${count} coureurs classés sur leurs courses UCI${since ? ` depuis ${since}` : ''}.`,
    updated ? `${updated}.` : null,
  ].filter(Boolean).join(' '),
  emptyLine: 'Le premier calcul de l’index n’a pas encore eu lieu\u00A0: le classement apparaîtra ici.',
  unavailableLine: 'Le classement est indisponible pour le moment.',
  game: {
    title: 'Le coureur mystère du jour',
    note: (tries) => `Trouve-le en ${tries} essais.`,
    play: 'Jouer',
    result: 'Voir mon résultat',
    bandless: 'Étape du jour',
  },
  top: {
    title: (n) => `Top ${n} de l’index`,
    note: (asOf, since) => (since ? `Au ${asOf}. Évolution du rang depuis le ${since}.` : `Au ${asOf}.`),
    label: (n) => `Les ${n} premiers de l’index`,
    more: 'Voir le classement complet',
    empty: 'Aucun coureur n’est encore classé.',
  },
  results: {
    title: 'Derniers résultats',
    label: 'Les derniers classements comptés par l’index',
    winner: 'Vainqueur',
    mover: 'Plus forte variation',
    moverIsWinner: 'le vainqueur',
    others: 'Autres courses',
    othersLabel: 'Les derniers classements des autres courses comptées',
    kind: {
      one_day: '',
      one_day_itt: 'contre-la-montre',
      stage: 'étape',
      prologue: 'prologue',
      gc_final: 'classement général',
      championship_road_race: 'course en ligne',
      championship_itt: 'contre-la-montre',
      olympic_road_race: 'course en ligne',
      olympic_itt: 'contre-la-montre',
    },
    stage: frStage,
    empty: 'Aucun classement n’est encore compté.',
  },
  method: {
    title: 'La méthode',
    sentence: (initial, entry) => {
      const rule = 'son index monte ou descend selon les coureurs qu’il a battus et ceux qui l’ont battu,'
        + ' et tout est recalculé chaque nuit depuis les résultats UCI.';
      const lower = entry ? ` (${entry} s’il débute en classe 2 ou en championnat national)` : '';
      return initial
        ? `Chaque coureur part de ${initial}${lower}\u202F; après chaque course, ${rule}`
        : `Après chaque course, ${rule.replace(/^son index/, 'l’index d’un coureur')}`;
    },
    link: 'Comment l’index est calculé',
  },
};

const en: HomeContent = {
  title: 'Ucicle: the pro cyclist rating index and today’s mystery rider',
  description: ({
    count, since, date, leader,
  }) => {
    const scope = since ? ` since ${since}` : '';
    const ranked = count
      ? `The Ucicle index ranks ${count} riders on their UCI races${scope}.`
      : `The Ucicle index ranks pro cyclists on their UCI races${scope}.`;
    const lead = leader && date ? ` ${leader}, No. 1 on ${date}.` : '';
    return `${ranked}${lead} Top 10, latest results and today’s mystery rider.`;
  },
  h1: 'The pro cyclist rating index',
  line: ({ count, since, updated }) => [
    `${count} riders ranked on their UCI races${since ? ` since ${since}` : ''}.`,
    updated ? `${updated}.` : null,
  ].filter(Boolean).join(' '),
  emptyLine: 'The index has not been computed yet: the ranking will appear here.',
  unavailableLine: 'The ranking is unavailable right now.',
  game: {
    title: 'Today’s mystery rider',
    note: (tries) => `Find him in ${tries} tries.`,
    play: 'Play',
    result: 'See my result',
    bandless: 'Today’s stage',
  },
  top: {
    title: (n) => `Index top ${n}`,
    note: (asOf, since) => (since ? `On ${asOf}. Rank change since ${since}.` : `On ${asOf}.`),
    label: (n) => `The index’s first ${n}`,
    more: 'See the full ranking',
    empty: 'No rider is ranked yet.',
  },
  results: {
    title: 'Latest results',
    label: 'The latest classifications counted by the index',
    winner: 'Winner',
    mover: 'Biggest change',
    moverIsWinner: 'the winner',
    others: 'Other races',
    othersLabel: 'The latest classifications of the other counted races',
    kind: {
      one_day: '',
      one_day_itt: 'time trial',
      stage: 'stage',
      prologue: 'prologue',
      gc_final: 'general classification',
      championship_road_race: 'road race',
      championship_itt: 'time trial',
      olympic_road_race: 'road race',
      olympic_itt: 'time trial',
    },
    stage: enStage,
    empty: 'No classification is counted yet.',
  },
  method: {
    title: 'The method',
    sentence: (initial, entry) => {
      const rule = 'index goes up or down with the riders he beat and those who beat him,'
        + ' and everything is recomputed every night from the UCI results.';
      const lower = entry ? ` (${entry} if he starts out in class 2 or at a national championship)` : '';
      return initial
        ? `Every rider starts at ${initial}${lower}; after each race his ${rule}`
        : `After each race a rider’s ${rule}`;
    },
    link: 'How the index is calculated',
  },
};

export const home: Record<Lang, HomeContent> = { fr, en };

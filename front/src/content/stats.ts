import type { Lang } from '../i18n/language';

// Owner: stats clone. Every visible string of the Stats panel, in both languages.
// Voice: tutoiement, short sentences, peloton vocabulary. No emoji, no U+2014.
// Every figure the panel shows comes from this browser's own `game-history`: nothing global.

export type StatsContent = {
  title: string,
  /** The top band of the player's bib: the first finished stage this browser kept. */
  since: (date: string) => string,
  figures: {
    played: string,
    winRate: string,
    currentStreak: string,
    bestStreak: string,
    /** Spoken in place of the dash shown when there is no rate to give. */
    noRate: string,
  },
  /** Typographic percent sign, with the space the language wants before it. */
  percent: string,
  distribution: {
    title: string,
    /**
     * One sentence per row, read in place of the drawn rule. Today's row says so here only:
     * on screen, its Tyvek rule and the first history row already do (D17).
     */
    found: (tries: number, count: number, today: boolean) => string,
    missed: (count: number, today: boolean) => string,
  },
  history: {
    title: string,
    /** Shown when the history is longer than what the panel lists. */
    latest: (shown: number, total: number) => string,
    today: string,
    yesterday: string,
    /** One sentence per past stage, read in place of the row. */
    spoken: (date: string, name: string, tries: number | null, max: number) => string,
  },
  empty: string,
  play: string,
  storage: string,
};

const frTimes = (count: number): string => {
  if (count === 0) return 'jamais';
  return `${count} fois`;
};

const enTimes = (count: number): string => {
  if (count === 0) return 'never';
  if (count === 1) return 'once';
  return `${count} times`;
};

const fr: StatsContent = {
  title: 'Stats',
  since: (date) => `Depuis le ${date}`,
  figures: {
    played: 'Étapes jouées',
    winRate: 'Victoires',
    currentStreak: 'Série en cours',
    bestStreak: 'Meilleure série',
    noRate: 'aucune',
  },
  percent: '\u202F%',
  distribution: {
    title: 'En combien d’essais',
    found: (tries, count, today) => {
      const base = `Trouvé en ${tries} ${tries > 1 ? 'essais' : 'essai'} : ${frTimes(count)}`;
      return today ? `${base}, dont aujourd’hui.` : `${base}.`;
    },
    missed: (count, today) => (today ? `Raté : ${frTimes(count)}, dont aujourd’hui.` : `Raté : ${frTimes(count)}.`),
  },
  history: {
    title: 'Tes étapes',
    latest: (shown, total) => `Les ${shown} dernières, sur ${total} étapes jouées.`,
    today: 'Aujourd’hui',
    yesterday: 'Hier',
    spoken: (date, name, tries, max) => (tries
      ? `${date} : ${name}, trouvé en ${tries} sur ${max}.`
      : `${date} : ${name}, raté.`),
  },
  empty: 'Aucune étape terminée sur ce navigateur pour l’instant.',
  play: 'Jouer l’étape du jour',
  storage: 'Tes stats restent dans ce navigateur, sur www.ucicle.fr. '
    + 'Sur un autre appareil, ou si tu vides ton navigateur, elles repartent de zéro.',
};

const en: StatsContent = {
  title: 'Stats',
  since: (date) => `Since ${date}`,
  figures: {
    played: 'Stages played',
    winRate: 'Win rate',
    currentStreak: 'Current streak',
    bestStreak: 'Best streak',
    noRate: 'none',
  },
  percent: '%',
  distribution: {
    title: 'In how many tries',
    found: (tries, count, today) => {
      const base = `Found in ${tries} ${tries > 1 ? 'tries' : 'try'}: ${enTimes(count)}`;
      return today ? `${base}, including today.` : `${base}.`;
    },
    missed: (count, today) => (today ? `Missed: ${enTimes(count)}, including today.` : `Missed: ${enTimes(count)}.`),
  },
  history: {
    title: 'Your stages',
    latest: (shown, total) => `The latest ${shown}, of ${total} stages played.`,
    today: 'Today',
    yesterday: 'Yesterday',
    spoken: (date, name, tries, max) => (tries
      ? `${date}: ${name}, found in ${tries} of ${max}.`
      : `${date}: ${name}, missed.`),
  },
  empty: 'No stage finished in this browser yet.',
  play: 'Play today’s stage',
  storage: 'Your stats stay in this browser, on www.ucicle.fr. '
    + 'On another device, or once you clear your browser, they start again from zero.',
};

export const stats: Record<Lang, StatsContent> = { fr, en };

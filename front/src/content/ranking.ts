import type { Lang } from '../i18n/language';

/**
 * Every visible string of the ranking pages (src/views/ranking): /classement/ and /classement/<p>/,
 * /en/ranking/ and /en/ranking/<p>/. Every number and name is computed by the view from the
 * database; these functions only put words around it. Figures arrive already formatted ("1 512",
 * "51e"). FR and EN, same keys.
 */
export type RankingContent = {
  breadcrumb: { label: string, home: string, ranking: string, page: (page: number) => string },
  /** The H1. */
  title: string,
  head: {
    /** Page 1: the ranking's date in the title. */
    title: (date: string) => string,
    /** Page p >= 2: its rank range, as ordinals ("51e", "100e"). */
    titlePage: (from: string, to: string) => string,
    /** Page 1. `top`: the first names of the ranking, with their ordinal, at most three. */
    description: (p: { count: string, date: string, top: { rank: string, name: string }[] }) => string,
    /** Page p >= 2. `first`, `last`: the names at both ends of the page (null when unknown). */
    descriptionPage: (p: {
      from: string, to: string, date: string, first: string | null, last: string | null,
    }) => string,
    /** The ItemList's name in the structured data. */
    listName: (from: string, to: string) => string,
  },
  /** The computed line under the H1: "618 coureurs classés au 8 nov. 2026." */
  count: (n: number, formatted: string, date: string) => string,
  /** The reference of the move column, around the arrows printed on the strips. */
  moves: { before: string, glyphs: string, after: (date: string) => string },
  methodLink: string,
  /** The heading of the start list: "Rangs 51 à 100". */
  listTitle: (from: string, to: string) => string,
  /** No rider is classified yet (the first computation published nobody). */
  empty: string,
  pagination: {
    top: string,
    bottom: string,
    previous: string,
    next: string,
    previousShort: string,
    nextShort: string,
    /** Accessible prefix of a page number ("Page 5"). */
    page: string,
  },
  /** Under the list: who is not in the ranking, with the version's own thresholds. */
  note: (p: { threshold: string | null, days: string | null }) => string,
  noteLink: string,
  /** `range`: the field's placeholder, the ranks it takes ("1 à 4 020"). */
  rankJump: { label: string, submit: string, range: (last: string) => string },
};

const fr: RankingContent = {
  breadcrumb: {
    label: 'Fil d’Ariane', home: 'Accueil', ranking: 'Classement', page: (p) => `Page ${p}`,
  },
  title: 'Classement de l’index Ucicle',
  head: {
    title: (date) => `Classement des coureurs cyclistes\u00a0: index Ucicle au ${date}`,
    titlePage: (from, to) => `Classement des coureurs cyclistes, ${from} à ${to}\u00a0: index Ucicle`,
    description: (p) => {
      const top = p.top.length ? ` ${p.top.map((t) => `${t.rank} ${t.name}`).join(', ')}.` : '';
      return `${p.count} coureurs classés par l’index Ucicle au ${p.date}\u00a0: rang, index, équipe, pays.${top}`
        + ' Méthode publique.';
    },
    descriptionPage: (p) => {
      // "d’Alexey", "de Quentin": the elision before a vowel.
      const from = (name: string) => (/^[aeiouàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`);
      const ends = p.first && p.last ? `, ${from(p.first)} à ${p.last}` : '';
      return `Rangs ${p.from} à ${p.to} de l’index Ucicle au ${p.date}${ends}.`
        + ' Rang, index, équipe, pays de chaque coureur.';
    },
    listName: (from, to) => `Classement de l’index Ucicle, rangs ${from} à ${to}`,
  },
  count: (n, formatted, date) => (n > 1
    ? `${formatted} coureurs classés au ${date}.`
    : `${formatted} coureur classé au ${date}.`),
  moves: { before: 'Évolution du rang', glyphs: '(▲\u00a0▼\u00a0=)', after: (date) => `depuis le ${date}.` },
  methodLink: 'Comment l’index est calculé',
  listTitle: (from, to) => `Rangs ${from} à ${to}`,
  empty: 'Aucun coureur n’est encore classé\u00a0: le premier calcul n’a classé personne.',
  pagination: {
    top: 'Pages du classement',
    bottom: 'Pages du classement, fin de liste',
    previous: 'Page précédente',
    next: 'Page suivante',
    previousShort: 'Précédente',
    nextShort: 'Suivante',
    page: 'Page',
  },
  note: (p) => {
    const provisional = p.threshold
      ? `Les coureurs provisoires (moins de ${p.threshold} unités d’expérience)`
      : 'Les coureurs provisoires';
    const inactive = p.days
      ? `ceux sans course comptée depuis plus de ${p.days} jours`
      : 'les coureurs inactifs';
    return `${provisional} et ${inactive} ne figurent pas au classement.`;
  },
  noteLink: 'La méthode et ses seuils',
  rankJump: { label: 'Aller au rang', submit: 'Aller', range: (last) => `1 à ${last}` },
};

const en: RankingContent = {
  breadcrumb: {
    label: 'Breadcrumb', home: 'Home', ranking: 'Ranking', page: (p) => `Page ${p}`,
  },
  title: 'Ucicle index ranking',
  head: {
    title: (date) => `Pro cyclist ranking: Ucicle index, ${date}`,
    titlePage: (from, to) => `Pro cyclist ranking, ${from} to ${to}: Ucicle index`,
    description: (p) => {
      const top = p.top.length ? ` ${p.top.map((t) => `${t.rank} ${t.name}`).join(', ')}.` : '';
      return `${p.count} riders ranked by the Ucicle index on ${p.date}: rank, index, team, country.${top}`
        + ' The method is public.';
    },
    descriptionPage: (p) => {
      const ends = p.first && p.last ? `, from ${p.first} to ${p.last}` : '';
      return `Ranks ${p.from} to ${p.to} of the Ucicle index on ${p.date}${ends}.`
        + ' Each rider’s rank, index, team and country.';
    },
    listName: (from, to) => `Ucicle index ranking, ranks ${from} to ${to}`,
  },
  count: (n, formatted, date) => (n === 1
    ? `${formatted} rider ranked on ${date}.`
    : `${formatted} riders ranked on ${date}.`),
  moves: { before: 'Rank change', glyphs: '(▲\u00a0▼\u00a0=)', after: (date) => `since ${date}.` },
  methodLink: 'How the index is calculated',
  listTitle: (from, to) => `Ranks ${from} to ${to}`,
  empty: 'No rider is ranked yet: the first computation ranked nobody.',
  pagination: {
    top: 'Ranking pages',
    bottom: 'Ranking pages, end of list',
    previous: 'Previous page',
    next: 'Next page',
    previousShort: 'Previous',
    nextShort: 'Next',
    page: 'Page',
  },
  note: (p) => {
    const provisional = p.threshold
      ? `Provisional riders (below ${p.threshold} experience units)`
      : 'Provisional riders';
    const inactive = p.days
      ? `riders with no counted race for more than ${p.days} days`
      : 'inactive riders';
    return `${provisional} and ${inactive} are not in the ranking.`;
  },
  noteLink: 'The method and its thresholds',
  rankJump: { label: 'Go to rank', submit: 'Go', range: (last) => `1 to ${last}` },
};

export const ranking: Record<Lang, RankingContent> = { fr, en };

import type { Lang } from '../i18n/language';

/**
 * The index's shared vocabulary, used by more than one page (home, ranking, rider pages, method,
 * search, 404). Page-specific copy lives in the page's own content file. FR and EN, same keys.
 */
export type RatingStatus = 'classified' | 'provisional' | 'inactive';

export type IndexCommonContent = {
  /** The index's name in running text and headings. */
  indexName: string,
  /** The short label above an index value ("Index"). */
  index: string,
  rank: string,
  /** Status words, printed in the numeral column of an unranked rider's bib. */
  status: Record<RatingStatus, string>,
  /** Accessible sentence for a rank change over the stated window, e.g. "up 2 places". */
  rankMove: (delta: number) => string,
  /** Accessible sentence for an index change, e.g. "index up 5.9". */
  indexMove: (delta: number) => string,
  /** "Updated on 17 Nov 2026" */
  updatedOn: (date: string) => string,
  search: { label: string, placeholder: string, submit: string },
  notFound: { title: string, text: string, ranking: string, game: string },
  /** The scope said in words wherever an absence could surprise. */
  scope: string,
  /** The 500 page: the database or the server failed; the game (static) still works. */
  serverError: { title: string, text: string, game: string, home: string },
};

export const indexCommon: Record<Lang, IndexCommonContent> = {
  fr: {
    indexName: 'index Ucicle',
    index: 'Index',
    rank: 'Rang',
    status: { classified: 'Classé', provisional: 'Provisoire', inactive: 'Inactif' },
    rankMove: (d) => {
      if (d === 0) return 'rang inchangé';
      return d > 0 ? `gagne ${d} place${d > 1 ? 's' : ''}` : `perd ${-d} place${d < -1 ? 's' : ''}`;
    },
    indexMove: (d) => {
      if (d === 0) return 'index inchangé';
      return d >= 0 ? `index en hausse de ${String(d).replace('.', ',')}` : `index en baisse de ${String(-d).replace('.', ',')}`;
    },
    updatedOn: (date) => `Mis à jour le ${date}`,
    search: { label: 'Rechercher un coureur', placeholder: 'Nom d’un coureur', submit: 'Rechercher' },
    notFound: {
      title: 'Cette page n’existe pas',
      text: 'Le lien est peut-être ancien. Cherche le coureur par son nom, ou repars du classement.',
      ranking: 'Voir le classement',
      game: 'Jouer au coureur mystère du jour',
    },
    scope: 'L’index couvre les hommes élite sur route, en courses UCI, depuis 2019.',
    serverError: {
      title: 'Le site ne répond pas pour l’instant',
      text: 'Réessaie dans un moment. Le jeu du jour reste jouable.',
      game: 'Jouer au coureur mystère du jour',
      home: 'Revenir à l’accueil',
    },
  },
  en: {
    indexName: 'Ucicle index',
    index: 'Index',
    rank: 'Rank',
    status: { classified: 'Ranked', provisional: 'Provisional', inactive: 'Inactive' },
    rankMove: (d) => {
      if (d === 0) return 'rank unchanged';
      return d > 0 ? `up ${d} place${d > 1 ? 's' : ''}` : `down ${-d} place${d < -1 ? 's' : ''}`;
    },
    indexMove: (d) => {
      if (d === 0) return 'index unchanged';
      return d >= 0 ? `index up ${d}` : `index down ${-d}`;
    },
    updatedOn: (date) => `Updated on ${date}`,
    search: { label: 'Search for a rider', placeholder: 'A rider’s name', submit: 'Search' },
    notFound: {
      title: 'This page does not exist',
      text: 'The link may be old. Look the rider up by name, or start again from the ranking.',
      ranking: 'See the ranking',
      game: 'Play today’s mystery rider',
    },
    scope: 'The index covers elite men on the road, in UCI races, since 2019.',
    serverError: {
      title: 'The site is not answering right now',
      text: 'Try again in a moment. Today’s game is still playable.',
      game: 'Play today’s mystery rider',
      home: 'Back to the home page',
    },
  },
};

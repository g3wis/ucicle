import type { Lang } from '../i18n/language';

/**
 * Every visible string of the rider search: the search field and its list (src/components/search,
 * on the ranking and the search page) and the search page without JavaScript (src/views/search,
 * /recherche/?q= and /en/search/?q=). The field's label, placeholder and button are the index's
 * shared vocabulary (indexCommon.search); the status words too (indexCommon.status). FR and EN,
 * same keys.
 */
export type SearchContent = {
  field: {
    /** Read by screen readers with the field: how the list works. */
    instructions: string,
    /** The list's count, said in the live region once typing pauses: "8 coureurs". */
    count: (n: number) => string,
    none: string,
    /** The search service did not answer: the button still works. */
    failed: string,
  },
  page: {
    /** H1 and head title without a query (or a query under 2 letters). */
    title: string,
    headTitle: string,
    description: string,
    /** H1 with the query. */
    titleQuery: (query: string) => string,
    headTitleQuery: (query: string) => string,
    descriptionQuery: (query: string) => string,
    short: string,
    /** "12 coureurs correspondent." / "128 coureurs correspondent : voici les 50 premiers." */
    count: (total: number, formattedTotal: string, shown: number) => string,
    none: (query: string) => string,
    /** A rank typed in the search that the ranking does not hold. */
    rankOut: (rank: string, total: string) => string,
    rankingLink: string,
    listLabel: (query: string) => string,
  },
  /** A rider with results but no counted classification: no index yet (as on his page). */
  noIndex: string,
};

const fr: SearchContent = {
  field: {
    instructions: 'Tape au moins deux lettres. Les flèches parcourent la liste, Entrée ouvre la fiche du coureur choisi,'
      + ' Échap ferme la liste.',
    count: (n) => (n > 1 ? `${n} coureurs` : `${n} coureur`),
    none: 'Aucun coureur ne correspond.',
    failed: 'La liste ne répond pas\u00a0: le bouton Rechercher affiche les résultats.',
  },
  page: {
    title: 'Rechercher un coureur',
    headTitle: 'Rechercher un coureur\u00a0: index Ucicle',
    description: 'Retrouver un coureur de l’index Ucicle par son nom.',
    titleQuery: (q) => `Recherche\u00a0: «\u00a0${q}\u00a0»`,
    headTitleQuery: (q) => `Recherche «\u00a0${q}\u00a0»\u00a0: index Ucicle`,
    descriptionQuery: (q) => `Les coureurs de l’index Ucicle dont le nom correspond à «\u00a0${q}\u00a0».`,
    short: 'Tape au moins deux lettres du nom d’un coureur.',
    count: (total, formatted, shown) => {
      if (total > shown) return `${formatted} coureurs correspondent\u00a0: voici les ${shown} premiers.`;
      return total > 1 ? `${formatted} coureurs correspondent.` : '1 coureur correspond.';
    },
    none: (q) => `Aucun coureur ne correspond à «\u00a0${q}\u00a0».`,
    rankOut: (rank, total) => `Le classement compte ${total} coureurs\u00a0: il n’a pas de rang ${rank}.`,
    rankingLink: 'Voir le classement',
    listLabel: (q) => `Coureurs dont le nom correspond à «\u00a0${q}\u00a0»`,
  },
  noIndex: 'Sans index',
};

const en: SearchContent = {
  field: {
    instructions: 'Type at least two letters. The arrow keys move through the list, Enter opens the chosen rider’s page,'
      + ' Escape closes the list.',
    count: (n) => (n === 1 ? '1 rider' : `${n} riders`),
    none: 'No rider matches.',
    failed: 'The list is not answering: the Search button shows the results.',
  },
  page: {
    title: 'Search for a rider',
    headTitle: 'Search for a rider: Ucicle index',
    description: 'Find a rider of the Ucicle index by name.',
    titleQuery: (q) => `Search: “${q}”`,
    headTitleQuery: (q) => `Search “${q}”: Ucicle index`,
    descriptionQuery: (q) => `The riders of the Ucicle index whose name matches “${q}”.`,
    short: 'Type at least two letters of a rider’s name.',
    count: (total, formatted, shown) => {
      if (total > shown) return `${formatted} riders match: here are the first ${shown}.`;
      return total === 1 ? '1 rider matches.' : `${formatted} riders match.`;
    },
    none: (q) => `No rider matches “${q}”.`,
    rankOut: (rank, total) => `The ranking holds ${total} riders: there is no rank ${rank}.`,
    rankingLink: 'See the ranking',
    listLabel: (q) => `Riders whose name matches “${q}”`,
  },
  noIndex: 'No index',
};

export const search: Record<Lang, SearchContent> = { fr, en };

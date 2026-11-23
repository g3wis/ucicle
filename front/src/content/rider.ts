import type { Lang } from '../i18n/language';

/**
 * Every visible string of the rider page (src/views/rider). Every number is computed by the view
 * from the database; these functions only put words around it. FR and EN, same keys.
 */
export type RaceKind =
  | 'one_day' | 'one_day_itt' | 'stage' | 'prologue' | 'gc_final'
  | 'championship_road_race' | 'championship_itt' | 'olympic_road_race' | 'olympic_itt';

export type RiderContent = {
  breadcrumb: { label: string, home: string, ranking: string },
  /** Head title: ranked riders carry their rank (the answer in the search result itself). */
  title: (name: string, rank: string | null) => string,
  description: (p: {
    name: string, nation: string | null, team: string | null, age: number | null,
    rank: string | null, index: string, date: string, results: number, wins: number,
    last: string | null,
  }) => string,
  /** Under the name: "Coureur cycliste, Slovénie, 28 ans" */
  identity: (nation: string | null, age: number | null) => string,
  born: (date: string) => string,
  bibBand: (date: string) => string,
  line: { index: string, last: string, best: string, nation: string },
  /** Beside the bib: the race behind the printed line's last delta (a later abandon is not it). */
  lastCountedLabel: string,
  noLastRace: string,
  /** Beside the bib (decision E2): the latest season, from the season table's first row. */
  seasonLine: {
    label: (year: number) => string,
    text: (p: { rank: string | null, wins: number, counted: number }) => string,
  },
  /** A rider with results but no counted classification yet; minField from the version. */
  noIndex: { word: string, text: (minField: string) => string },
  status: {
    provisional: (experience: string, threshold: string) => string,
    inactive: (date: string) => string,
  },
  rankLink: (rank: string) => string,
  rankingLink: string,
  uciRank: (rank: string, date: string) => string,
  methodLink: string,
  history: {
    title: string,
    chartLabel: (name: string, from: string, to: string, best: string) => string,
    warmUp: string,
    bestMark: (value: string, date: string) => string,
    seasons: string,
    columns: { season: string, index: string, rank: string, counted: string, wins: string },
    unranked: string,
  },
  results: {
    title: string,
    scope: string,
    /** A season's summary: its title in band type, then its count of results in a quieter tone. */
    season: (year: number, count: number) => { title: string, count: string },
    columns: { date: string, race: string, place: string, delta: string },
    place: (rank: string, of: number) => string,
    status: Record<string, string>,
    notCounted: string,
    warmUp: string,
    kind: Record<RaceKind, string>,
    /** Always after a comma ("Tour de France, étape 7"): lower case, number bound to its word. */
    stage: (n: number | null, label: string | null) => string,
    calc: (p: {
      before: string, counted: number, won: string, expected: string, k: string,
      multiplier: string | null, after: string, top: number | null,
    }) => string,
    calcOpen: string,
    /** Under the calculation, when the page renames a championship: the UCI's own name of it. */
    uciName: (name: string) => string,
    /** The open season shows its 10 latest lines; this opens the rest. */
    more: (n: number, season: number) => string,
  },
  around: {
    title: string,
    neighbours: string,
    teammates: (team: string) => string,
  },
  profile: {
    title: string, height: string, weight: string, uciId: string, links: string,
    uci: string, wikidata: string, wikipediaFr: string, wikipediaEn: string,
  },
  game: string,
};

const fr: RiderContent = {
  breadcrumb: { label: 'Fil d’Ariane', home: 'Accueil', ranking: 'Classement' },
  title: (name, rank) => (rank
    ? `${name}, ${rank} de l’index Ucicle : résultats et historique`
    : `${name} : index Ucicle, résultats et historique`),
  description: (p) => {
    const who = [p.nation ? `coureur cycliste, ${p.nation}` : 'coureur cycliste', p.team, p.age ? `${p.age} ans` : null]
      .filter(Boolean).join(', ');
    const rank = p.rank ? `${p.rank} de l’index Ucicle au ${p.date} (${p.index}).` : `Index Ucicle ${p.index} au ${p.date}.`;
    const wins = p.wins > 0 ? `, dont ${p.wins} victoire${p.wins > 1 ? 's' : ''}` : '';
    const results = `${p.results} course${p.results > 1 ? 's' : ''} comptée${p.results > 1 ? 's' : ''} depuis 2020${wins}.`;
    return [`${p.name}, ${who}.`, rank, results, p.last ? `Dernière course comptée : ${p.last}.` : null].filter(Boolean).join(' ');
  },
  identity: (nation, age) => ['Coureur cycliste', nation, age ? `${age} ans` : null].filter(Boolean).join(', '),
  born: (date) => `né le ${date}`,
  bibBand: (date) => `Index Ucicle, ${date}`,
  line: {
    index: 'Index', last: 'Dernière course', best: 'Meilleur', nation: 'Nation',
  },
  lastCountedLabel: 'Dernière course comptée',
  noLastRace: 'aucune',
  seasonLine: {
    label: (year) => `Saison ${year}`,
    text: ({ rank, wins, counted }) => {
      const races = `${counted} course${counted > 1 ? 's' : ''} comptée${counted > 1 ? 's' : ''}`;
      const won = wins > 0 ? `${wins} victoire${wins > 1 ? 's' : ''} en ${races}` : races;
      return rank ? `${rank} au classement, ${won}` : `${won.charAt(0).toUpperCase()}${won.slice(1)}`;
    },
  },
  noIndex: {
    word: 'Sans index',
    text: (minField) => `Aucune de ses courses n’est encore comptée (abandons, ou pelotons de moins de ${minField} arrivants). Son index commencera à sa première course comptée.`,
  },
  status: {
    provisional: (x, t) => `Provisoire : ${x} sur ${t} unités d’expérience. Le coureur entre au classement à ${t}.`,
    inactive: (date) => `Inactif : aucune course comptée depuis le ${date}. L’index reste figé, hors du classement.`,
  },
  rankLink: (rank) => `Sa place au classement (${rank})`,
  rankingLink: 'Voir le classement',
  uciRank: (rank, date) => `Classement mondial UCI : ${rank} au ${date}`,
  methodLink: 'Comment l’index est calculé',
  history: {
    title: 'Historique',
    chartLabel: (name, from, to, best) => `Index de ${name}, du ${from} au ${to}. Meilleur index : ${best}.`,
    warmUp: 'Rodage 2019',
    bestMark: (value, date) => `${value}, ${date}`,
    seasons: 'Par saison',
    columns: {
      season: 'Saison', index: 'Index en fin de saison', rank: 'Rang', counted: 'Courses comptées', wins: 'Victoires',
    },
    unranked: 'non classé',
  },
  results: {
    title: 'Résultats',
    scope: 'Courses UCI hommes élite sur route depuis 2019. Ouvre une ligne pour voir son calcul.',
    season: (year, count) => ({ title: `Saison ${year}`, count: `${count} résultat${count > 1 ? 's' : ''}` }),
    columns: {
      date: 'Date', race: 'Course', place: 'Place', delta: 'Index',
    },
    place: (rank, of) => `${rank} sur ${of}`,
    status: {
      DNF: 'Abandon', DNS: 'Non-partant', OTL: 'Hors délais', DSQ: 'Disqualifié', NR: 'Non classé',
    },
    notCounted: 'non compté',
    warmUp: 'rodage',
    kind: {
      one_day: 'course d’un jour',
      one_day_itt: 'contre-la-montre',
      stage: 'étape',
      prologue: 'prologue',
      gc_final: 'classement général',
      championship_road_race: 'course en ligne',
      championship_itt: 'contre-la-montre',
      olympic_road_race: 'course en ligne',
      olympic_itt: 'contre-la-montre',
    },
    stage: (n, label) => (n === 0 ? 'prologue' : `étape\u00a0${label?.replace(/^Stage\s*/i, '') ?? n ?? ''}`),
    calc: (p) => `Index avant ${p.before}. ${p.counted} duel${p.counted > 1 ? 's' : ''} compté${p.counted > 1 ? 's' : ''}, ${p.won} gagné${Number(p.won.replace(',', '.')) >= 2 ? 's' : ''} pour ${p.expected} attendu${Number(p.expected.replace(',', '.')) >= 2 ? 's' : ''}${p.top ? ` (les ${p.top} premiers comptent)` : ''}. K = ${p.k}${p.multiplier ? `, multiplicateur ${p.multiplier} (coureur provisoire ou de retour)` : ''}. Index après ${p.after}.`,
    uciName: (name) => `Nom UCI de l’épreuve : ${name}.`,
    calcOpen: 'Voir le calcul',
    more: (n, season) => `Voir les ${n} autres résultats de ${season}`,
  },
  around: {
    title: 'Autour de lui',
    neighbours: 'Ses voisins au classement',
    teammates: (team) => `Ses coéquipiers classés (${team})`,
  },
  profile: {
    title: 'Profil',
    height: 'Taille',
    weight: 'Poids',
    uciId: 'Identifiant UCI',
    links: 'Ailleurs',
    uci: 'Fiche UCI',
    wikidata: 'Wikidata',
    wikipediaFr: 'Wikipédia',
    wikipediaEn: 'Wikipédia en anglais',
  },
  game: 'Jouer au coureur mystère du jour',
};

const en: RiderContent = {
  breadcrumb: { label: 'Breadcrumb', home: 'Home', ranking: 'Ranking' },
  title: (name, rank) => (rank
    ? `${name}, No. ${rank} in the Ucicle index: results and history`
    : `${name}: Ucicle index, results and history`),
  description: (p) => {
    const who = [p.nation ? `cyclist, ${p.nation}` : 'cyclist', p.team, p.age ? `aged ${p.age}` : null]
      .filter(Boolean).join(', ');
    // p.rank is already an ordinal ("1st"): no "No." before it.
    const rank = p.rank ? `${p.rank} in the Ucicle index on ${p.date} (${p.index}).` : `Ucicle index ${p.index} on ${p.date}.`;
    const wins = p.wins > 0 ? `, ${p.wins} win${p.wins === 1 ? '' : 's'}` : '';
    const results = `${p.results} race${p.results === 1 ? '' : 's'} counted since 2020${wins}.`;
    return [`${p.name}, ${who}.`, rank, results, p.last ? `Last counted race: ${p.last}.` : null].filter(Boolean).join(' ');
  },
  identity: (nation, age) => ['Cyclist', nation, age ? `${age} years old` : null].filter(Boolean).join(', '),
  born: (date) => `born ${date}`,
  bibBand: (date) => `Ucicle index, ${date}`,
  line: {
    index: 'Index', last: 'Last race', best: 'Best', nation: 'Nation',
  },
  lastCountedLabel: 'Last counted race',
  noLastRace: 'none',
  seasonLine: {
    label: (year) => `${year} season`,
    text: ({ rank, wins, counted }) => {
      const races = `${counted} counted race${counted > 1 ? 's' : ''}`;
      const won = wins > 0 ? `${wins} win${wins > 1 ? 's' : ''} from ${races}` : races;
      return rank ? `${rank} in the ranking, ${won}` : `${won.charAt(0).toUpperCase()}${won.slice(1)}`;
    },
  },
  noIndex: {
    word: 'No index',
    text: (minField) => `None of his races is counted yet (abandons, or fields of fewer than ${minField} finishers). His index starts with his first counted race.`,
  },
  status: {
    provisional: (x, t) => `Provisional: ${x} of ${t} experience units. The rider enters the ranking at ${t}.`,
    inactive: (date) => `Inactive: no counted race since ${date}. The index is frozen, out of the ranking.`,
  },
  rankLink: (rank) => `His place in the ranking (${rank})`,
  rankingLink: 'See the ranking',
  uciRank: (rank, date) => `UCI World Ranking: ${rank} on ${date}`,
  methodLink: 'How the index is calculated',
  history: {
    title: 'History',
    chartLabel: (name, from, to, best) => `${name}’s index from ${from} to ${to}. Best index: ${best}.`,
    warmUp: '2019 warm-up',
    bestMark: (value, date) => `${value}, ${date}`,
    seasons: 'By season',
    columns: {
      season: 'Season', index: 'Index at season end', rank: 'Rank', counted: 'Races counted', wins: 'Wins',
    },
    unranked: 'unranked',
  },
  results: {
    title: 'Results',
    scope: 'UCI elite men’s road races since 2019. Open a line to see its calculation.',
    season: (year, count) => ({ title: `${year} season`, count: `${count} result${count > 1 ? 's' : ''}` }),
    columns: {
      date: 'Date', race: 'Race', place: 'Place', delta: 'Index',
    },
    place: (rank, of) => `${rank} of ${of}`,
    status: {
      DNF: 'Did not finish', DNS: 'Did not start', OTL: 'Outside time limit', DSQ: 'Disqualified', NR: 'Unranked',
    },
    notCounted: 'not counted',
    warmUp: 'warm-up',
    kind: {
      one_day: 'one-day race',
      one_day_itt: 'time trial',
      stage: 'stage',
      prologue: 'prologue',
      gc_final: 'general classification',
      championship_road_race: 'road race',
      championship_itt: 'time trial',
      olympic_road_race: 'road race',
      olympic_itt: 'time trial',
    },
    stage: (n, label) => (n === 0 ? 'prologue' : `stage\u00a0${label?.replace(/^Stage\s*/i, '') ?? n ?? ''}`),
    calc: (p) => `Index before ${p.before}. ${p.counted} duel${p.counted > 1 ? 's' : ''} counted, ${p.won} won for ${p.expected} expected${p.top ? ` (the first ${p.top} count)` : ''}. K = ${p.k}${p.multiplier ? `, multiplier ${p.multiplier} (provisional or returning rider)` : ''}. Index after ${p.after}.`,
    uciName: (name) => `UCI name of the race: ${name}.`,
    calcOpen: 'See the calculation',
    more: (n, season) => `Show the other ${n} results of ${season}`,
  },
  around: {
    title: 'Around him',
    neighbours: 'His neighbours in the ranking',
    teammates: (team) => `His ranked teammates (${team})`,
  },
  profile: {
    title: 'Profile',
    height: 'Height',
    weight: 'Weight',
    uciId: 'UCI ID',
    links: 'Elsewhere',
    uci: 'UCI page',
    wikidata: 'Wikidata',
    wikipediaFr: 'Wikipedia in French',
    wikipediaEn: 'Wikipedia',
  },
  game: 'Play today’s mystery rider',
};

export const rider: Record<Lang, RiderContent> = { fr, en };

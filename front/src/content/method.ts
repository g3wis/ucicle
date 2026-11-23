import type { Lang } from '../i18n/language';

/**
 * Every visible string of the method page (src/views/method). Every number is read by the loader
 * from the current version of the index (rating_version.parameters, its summary, rating_change)
 * and formatted by the view; these functions only put words around it. FR and EN, same keys.
 *
 * OWNER: rating_version.note (why a version exists) is free English text written by the engine;
 * the version history prints the version, its dates and its state, not that note. A bilingual
 * note per version would let the history say why each version changed.
 */

type Term = { term: string, text: string };
type Source = { term: string, link: string, href: string, after: string };
/** A table value: its figure, printed in the bib's numerals (decision D7), then its words. */
type Figure = { figure: string, text: string };

export type MethodContent = {
  head: {
    title: string,
    /** `counted`: classifications counted, formatted; `since`: the first season counted. */
    description: (counted: string | null, since: number | null) => string,
  },
  breadcrumb: { label: string, home: string, ranking: string, method: string },
  title: string,
  /** The page index under the lede: its landmark name. The links reuse the section titles. */
  toc: { label: string },
  /** "Index v1 du 17 nov. 2026": the version and the day its parameters were frozen. */
  version: (name: string, frozen: string | null) => string,
  computed: (computed: string | null, asOf: string) => string,
  empty: string,
  plain: {
    title: string,
    /** `entry`: the starting index at CN and .2; `kLower`: the K multiplier of .2 races (both null without it). */
    text: (p: {
      initial: string, nOneDay: number | null, nGc: number | null, nStage: number | null,
      stage: string | null, grandTour: string | null,
      entry: string | null, kLower: string | null,
    }) => string[],
  },
  gap: {
    title: string,
    intro: string,
    caption: string,
    columns: { gap: string, share: string, odds: string },
    gap: (points: string) => string,
    odds: (x: string) => string,
    beat: (gap: string, win: string, loss: string) => string,
  },
  accuracy: {
    title: string,
    /**
     * `baseline`: the UCI World Ranking's accuracy on the same duels; `undecided`: the share of
     * those duels it cannot separate (no ranking place, or a tie), counted as misses.
     */
    text: (p: {
      accuracy: string, duels: string | null, test: string | null, baseline: string | null, undecided: string | null,
    }) => string,
    seasons: (train: string, test: string) => string,
    logLoss: (value: string) => string,
    /**
     * The lower levels: `gap` the scale gap left between the riders of the upper levels and those
     * who only raced CN and .2 (`gapBefore` without the correction); the share of test duels whose
     * winner was picked in .2 races and national championships, with and without it.
     */
    levels: (p: {
      gap: string, gapBefore: string,
      two: string | null, twoBefore: string | null, cn: string | null, cnBefore: string | null,
    }) => string[],
    /** Seasons joined in running text: "2024 et 2025". */
    join: (items: string[]) => string,
    /** A [from, to] pair of seasons: "2020 à 2023", or "2024 et 2025" for two seasons in a row. */
    range: (a: number, b: number) => string,
  },
  example: {
    title: string,
    intro: (p: { finishers: string, top: number | null, duels: string }) => string,
    k: (formula: string, k: string) => string,
    duel: (p: { a: string, aIndex: string, b: string, bIndex: string, expected: string, gain: string }) => string,
    listLabel: string,
    line: { before: string, counted: string, won: string, expected: string },
    multiplier: (m: string, why: 'provisional' | 'return' | null) => string,
    after: string,
  },
  formula: {
    title: string,
    intro: string,
    /** The words under K and w: K_base, w_classe, w_type. */
    sub: { base: string, cls: string, type: string },
    /** `kLower`: the K multiplier of .2 races, null without the correction. */
    spoken: { e: (scale: string) => string, k: (kLower: string | null) => string, delta: string },
    /** The factor printed after K in the formula: "× 2,5 en classe 2". */
    kLower: (m: string) => string,
    symbolsLabel: string,
    symbols: {
      r: string, e: string, s: string, n: string, sum: string, k: (kLower: string | null) => string, m: string,
    },
    properties: { title: string, items: string[] },
  },
  parameters: {
    title: string,
    caption: (name: string) => string,
    columns: { name: string, value: string },
    rows: {
      initial: string, scale: string, kBase: string, minField: string, threshold: string,
      provisional: string, returnBonus: string, activeDays: string, publishedFrom: string,
      lowerEntry: string, lowerK: string,
    },
    /** The K multiplier of .2 races: "× 2,5". */
    lowerK: (m: string) => string,
    minField: (n: string) => Figure,
    threshold: (x: string, oneDay: string | null) => Figure,
    returnBonus: (m: string, x: string, days: string) => string,
    provisional: (threshold: string) => string,
    activeDays: (days: string) => Figure,
  },
  classes: {
    title: string,
    caption: string,
    columns: { code: string, what: string, weight: string },
    names: Record<string, string>,
    /** Under the table, when .2 races multiply K: `m` the multiplier, `effective` the .2 weight times it. */
    lowerNote: (m: string, effective: string) => string,
  },
  types: {
    title: string,
    caption: string,
    columns: { kind: string, weight: string, top: string },
    names: Record<string, string>,
  },
  scope: {
    title: string,
    text: (from: number | null) => string[],
    counters: (counted: string, rows: string, riders: string) => string,
    skipped: (p: {
      cancelled: number, small: number, noDuel: number, minField: string | null, f: (n: number) => string,
    }) => string | null,
    seasons: string,
    caption: string,
    columns: { cls: string, total: string },
    total: string,
    warmUp: string,
    listTitle: string,
    /** A season's ruled line (decision D8): the season in band type, then its count, quieter. */
    season: (year: number, warmUp: boolean, classifications: string, competitions: string, n: number) => {
      title: string, count: string,
    },
    group: (cls: string, count: string, n: number) => string,
    /** A race whose name comes back in another year of the same season: "Championnat du Paraguay 2020". */
    edition: (name: string, year: number) => string,
  },
  rules: {
    title: string,
    items: (p: {
      threshold: string, oneDay: string | null, stage: string | null, activeDays: string,
      returnBonus: { gapDays: string, multiplier: string, experience: string } | null,
      minField: string, publishedFrom: string | null,
      lower: { initial: string, entry: string, m: string } | null,
    }) => Term[],
  },
  uci: { title: string, text: string },
  limits: {
    title: string,
    items: (p: {
      nextAfterTop: string | null, stage: string | null, nStage: number | null,
      drift: { from: string, fromDate: string, to: string, toDate: string } | null,
      lower: boolean,
    }) => { lead: string, text: string }[],
  },
  versions: {
    title: string,
    caption: string,
    columns: { name: string, frozen: string, computed: string, status: string },
    current: string,
    archived: string,
    note: string,
  },
  sources: {
    title: string,
    items: Source[],
    collected: (date: string) => string,
  },
  rankingLink: string,
};

const fr: MethodContent = {
  head: {
    title: 'Index Ucicle : comment le classement est calculé',
    description: (counted, since) => (counted
      ? `Formule, paramètres et un exemple réel de l’index Ucicle : des duels sur le haut de chaque arrivée, pondérés par classe UCI, sur ${counted} classements${since ? ` depuis ${since}` : ''}.`
      : 'Formule, paramètres et un exemple réel de l’index Ucicle : des duels sur le haut de chaque arrivée, pondérés par classe UCI et type de course.'),
  },
  breadcrumb: {
    label: 'Fil d’Ariane', home: 'Accueil', ranking: 'Classement', method: 'Méthode',
  },
  title: 'Comment l’index Ucicle est calculé',
  toc: { label: 'Sur cette page' },
  version: (name, frozen) => (frozen ? `Index ${name} du ${frozen}` : `Index ${name}`),
  computed: (computed, asOf) => (computed
    ? `Dernier calcul le ${computed}, sur les résultats jusqu’au ${asOf}.`
    : `Calculé sur les résultats jusqu’au ${asOf}.`),
  empty: 'Aucun calcul de l’index n’est encore publié. La formule, les paramètres et un exemple réel s’afficheront ici après le premier calcul.',
  plain: {
    title: 'En clair',
    text: (p) => {
      let top: string | null = null;
      if (p.nOneDay && p.nStage) {
        const firsts = p.nGc && p.nGc !== p.nOneDay
          ? `les ${p.nOneDay} premiers d’une course d’un jour, les ${p.nGc} premiers d’un classement général`
          : `les ${p.nOneDay} premiers d’une course d’un jour ou d’un classement général`;
        top = `Seul le haut de l’ordre d’arrivée compte : ${firsts}, les ${p.nStage} premiers d’une étape. Ceux-là affrontent tous les arrivants. Plus loin, l’ordre dépend surtout du travail d’équipe et des groupes : ces coureurs ne s’affrontent pas entre eux.`;
      }
      const weights = [
        p.stage ? `une étape pèse ${p.stage} course d’un jour` : null,
        p.grandTour ? `le classement général d’un grand tour ${p.grandTour}` : null,
      ].filter(Boolean).join(', ');
      return [
        `Chaque coureur part de ${p.initial}${p.entry ? `, ou de ${p.entry} si sa première course comptée est un championnat national ou une course de classe 2` : ''}. Après chaque course, son index monte ou descend selon les coureurs qu’il a battus et ceux qui l’ont battu.`,
        'Une course se lit comme une série de duels. Battre un coureur à l’index plus élevé rapporte beaucoup, battre un coureur bien moins fort rapporte peu. Perdre contre plus fort coûte peu, perdre contre moins fort coûte davantage.',
        top,
        `Une course pèse selon sa classe UCI et son type (tableaux plus bas)${weights ? ` : ${weights}` : ''}.`,
        p.entry && p.kLower
          ? `Les coureurs qui ne courent qu’en classe 2 et aux championnats nationaux rencontrent rarement ceux du WorldTour : sans correction, leur index dériverait sur une échelle à part. D’où ce départ plus bas, et un K multiplié par ${p.kLower} en classe 2.`
          : null,
        'Tout est recalculé chaque nuit depuis zéro, à partir des résultats officiels de l’UCI. La variation de chaque course est détaillée sur la page du coureur.',
      ].filter((s): s is string => Boolean(s));
    },
  },
  gap: {
    title: 'Ce que veut dire un écart',
    intro: 'L’écart entre deux index dit quelle part de leurs duels le mieux noté devrait gagner, selon le modèle.',
    caption: 'Part des duels que le mieux noté devrait gagner, selon l’écart',
    columns: { gap: 'Écart', share: 'Le mieux noté gagne', odds: 'Soit' },
    gap: (points) => `${points} points`,
    odds: (x) => `${x} contre 1`,
    beat: (gap, win, loss) => `Battre un coureur noté ${gap} points de plus rapporte ${win} duel ; perdre contre lui coûte ${loss} duel.`,
  },
  accuracy: {
    title: 'Précision mesurée',
    text: (p) => {
      const undecided = p.undecided ? `, qui ne départage pas ${p.undecided} de ces duels (coureurs sans place au classement UCI, ou à égalité), comptés comme ratés` : '';
      const baseline = p.baseline ? `, contre ${p.baseline} pour le classement mondial UCI${undecided}` : '';
      return `Sur ${p.test ? `les saisons ${p.test}` : 'les saisons de test'}, le modèle a désigné le vainqueur de ${p.accuracy} des ${p.duels ? `${p.duels} ` : ''}duels de test${baseline}.`;
    },
    seasons: (train, test) => `Paramètres choisis sur les saisons ${train}, mesurés sur ${test}.`,
    logLoss: (value) => `Perte logarithmique : ${value}. Plus elle est basse, plus les prévisions sont justes.`,
    levels: (p) => [
      `Face à un coureur passé par le WorldTour ou les ProSeries, un coureur resté en classe 2 et aux championnats nationaux est encore surestimé de ${p.gap} points en moyenne, contre ${p.gapBefore} sans la correction des petites courses.`,
      ...(p.two && p.twoBefore && p.cn && p.cnBefore
        ? [`Avec elle, le vainqueur est désigné dans ${p.two} des duels de classe 2 (${p.twoBefore} sans elle) et ${p.cn} des duels de championnat national (${p.cnBefore}).`]
        : []),
    ],
    join: (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}` : items.join('')),
    range: (a, b) => (b - a > 1 ? `${a} à ${b}` : `${a} et ${b}`),
  },
  example: {
    title: 'Un exemple réel',
    intro: (p) => (p.top
      ? `Course d’un jour, ${p.finishers} coureurs à l’arrivée. Les ${p.top} premiers affrontent tous les autres arrivants, soit ${p.duels} duels chacun ; les suivants n’affrontent que ces ${p.top}. Voici les trois premiers, avec les nombres enregistrés par le calcul.`
      : `Course d’un jour, ${p.finishers} coureurs à l’arrivée. Voici les trois premiers, avec les nombres enregistrés par le calcul.`),
    k: (formula, k) => `K = ${formula} = ${k} pour toute la course : K de base, poids de la classe, poids du type.`,
    duel: (p) => `Un duel : ${p.a}, index ${p.aIndex}, finit devant ${p.b}, index ${p.bIndex}. Selon l’écart, il devait en gagner ${p.expected} ; il le gagne : ${p.gain} de plus que prévu, autant de perdu pour ${p.b}.`,
    listLabel: 'Les trois premiers et leur calcul',
    line: {
      before: 'Index avant', counted: 'Duels comptés', won: 'Gagnés', expected: 'Attendus',
    },
    multiplier: (m, why) => {
      if (why === 'provisional') return `Multiplicateur ${m} : coureur encore provisoire, ses résultats comptent davantage.`;
      if (why === 'return') return `Multiplicateur ${m} : retour après une longue période sans course comptée.`;
      return `Multiplicateur ${m}.`;
    },
    after: 'Index après',
  },
  formula: {
    title: 'La formule',
    intro: 'Pour chaque coureur i d’une course, avec les index d’avant la course ; toutes les variations s’appliquent ensemble après elle.',
    sub: { base: 'base', cls: 'classe', type: 'type' },
    spoken: {
      e: (scale) => `E i j égale 1 divisé par 1 plus 10 puissance R j moins R i sur ${scale}.`,
      k: (m) => `K égale K base, fois w classe, fois w type${m ? `, fois ${m} en classe 2` : ''}.`,
      delta: 'Delta R i égale K, fois m i, fois la somme sur les duels comptés de S i j moins E i j, le tout divisé par n moins 1.',
    },
    kLower: (m) => `× ${m} en classe 2`,
    symbolsLabel: 'Les symboles',
    symbols: {
      r: 'Index des coureurs i et j avant la course.',
      e: 'Part du duel entre i et j que i devait gagner.',
      s: 'Résultat du duel : 1 si i finit devant j, 0,5 au même rang, 0 derrière.',
      n: 'Coureurs classés à l’arrivée. Abandons, non-partants, hors délais et disqualifiés n’en font pas partie.',
      sum: 'Les duels comptés : contre tous les arrivants pour un coureur des N premiers, contre les seuls N premiers pour les autres.',
      k: (m) => `Le poids de la course : K de base, multiplié par le poids de sa classe UCI et celui de son type${m ? `, puis par ${m} en classe 2` : ''}.`,
      m: 'Multiplicateur : 1 en général, plus grand pour un coureur provisoire ou de retour.',
    },
    properties: {
      title: 'Vrai par construction',
      items: [
        'Finir plus haut ne rapporte jamais moins.',
        'Une course ne fait jamais bouger un index de plus de K × m.',
        'Sans multiplicateur, chaque course est à somme nulle : ce que les uns gagnent, les autres le perdent.',
      ],
    },
  },
  parameters: {
    title: 'Les paramètres',
    caption: (name) => `Paramètres de l’index ${name}`,
    columns: { name: 'Paramètre', value: 'Valeur' },
    rows: {
      initial: 'Index initial',
      scale: 'Échelle de l’écart (dans E)',
      kBase: 'K de base',
      minField: 'Peloton minimum',
      threshold: 'Expérience pour sortir du statut provisoire',
      provisional: 'Multiplicateur d’un provisoire',
      returnBonus: 'Multiplicateur de retour',
      activeDays: 'Inactif après',
      publishedFrom: 'Classement publié depuis',
      lowerEntry: 'Index initial en championnat national et classe 2',
      lowerK: 'K en classe 2',
    },
    lowerK: (m) => `× ${m}`,
    minField: (n) => ({ figure: n, text: 'arrivants' }),
    threshold: (x, oneDay) => ({ figure: x, text: oneDay ? `(une course d’un jour vaut ${oneDay})` : '' }),
    returnBonus: (m, x, days) => `au moins ${m}, pendant ${x} unités d’expérience, après plus de ${days} jours sans course comptée`,
    provisional: (t) => `1 + max(0, 1 − X / ${t}), X étant l’expérience`,
    activeDays: (days) => ({ figure: days, text: 'jours sans course comptée' }),
  },
  classes: {
    title: 'Poids par classe UCI',
    caption: 'w classe : le poids de chaque classe UCI',
    columns: { code: 'Classe', what: 'Épreuves', weight: 'Poids' },
    names: {
      '1.UWT': 'UCI WorldTour, course d’un jour',
      '2.UWT': 'UCI WorldTour, course par étapes',
      CM: 'Championnats du monde',
      JO: 'Jeux olympiques',
      '1.Pro': 'UCI ProSeries, course d’un jour',
      '2.Pro': 'UCI ProSeries, course par étapes',
      '1.HC': 'Hors catégorie, course d’un jour (jusqu’en 2019)',
      '2.HC': 'Hors catégorie, course par étapes (jusqu’en 2019)',
      1.1: 'Classe 1, course d’un jour',
      2.1: 'Classe 1, course par étapes',
      CC: 'Championnats continentaux',
      CN: 'Championnats nationaux',
      1.2: 'Classe 2, course d’un jour',
      2.2: 'Classe 2, course par étapes',
    },
    lowerNote: (m, effective) => `En classe 2, K est en plus multiplié par ${m} : une course y pèse ${effective}.`,
  },
  types: {
    title: 'Poids par type de classement',
    caption: 'w type : le poids de chaque type de classement, et les premiers qui affrontent tout le peloton',
    columns: { kind: 'Classement', weight: 'Poids', top: 'N premiers' },
    names: {
      one_day: 'Course d’un jour en ligne',
      one_day_itt: 'Contre-la-montre d’un jour',
      stage: 'Étape, en ligne ou contre-la-montre',
      prologue: 'Prologue',
      gc_final: 'Classement général final',
      gc_final_grand_tour: 'Général final d’un grand tour (Tour, Giro, Vuelta)',
      championship_road_race: 'Championnat, course en ligne',
      championship_itt: 'Championnat, contre-la-montre',
      olympic_road_race: 'Jeux olympiques, course en ligne',
      olympic_itt: 'Jeux olympiques, contre-la-montre',
    },
  },
  scope: {
    title: 'Périmètre et épreuves comptées',
    text: (from) => [
      `Hommes élite, sur route, dans les classes UCI du tableau${from ? `, depuis la saison ${from}` : ''}. Comptent : les courses d’un jour, chaque étape et le classement général final des courses par étapes, les courses en ligne et les contre-la-montre des championnats et des Jeux olympiques.`,
      'Ne comptent pas : les contre-la-montre par équipes, les relais mixtes, les classements par points, de la montagne, des jeunes et par équipes, les généraux intermédiaires, les courses des moins de 23 ans.',
    ],
    counters: (counted, rows, riders) => `${counted} classements comptés, ${rows} résultats, ${riders} coureurs notés.`,
    skipped: (p) => {
      const parts = [
        p.cancelled ? `${p.f(p.cancelled)} classement${p.cancelled > 1 ? 's' : ''} annulé${p.cancelled > 1 ? 's' : ''}` : null,
        p.small ? `${p.f(p.small)} avec moins de ${p.minField ?? ''} arrivants` : null,
        p.noDuel ? `${p.f(p.noDuel)} sans duel possible` : null,
      ].filter(Boolean);
      return parts.length ? `Non comptés : ${parts.join(', ')}.` : null;
    },
    seasons: 'Les saisons sont celles de l’UCI, de mi-octobre à mi-octobre.',
    caption: 'Classements comptés, par classe et par saison',
    columns: { cls: 'Classe', total: 'Total' },
    total: 'Total',
    warmUp: 'rodage',
    listTitle: 'Les épreuves comptées, saison par saison',
    season: (year, warmUp, classifications, competitions, n) => ({
      title: `Saison ${year}${warmUp ? ' (rodage)' : ''}`,
      count: `${classifications} classements, ${competitions} épreuve${n > 1 ? 's' : ''}`,
    }),
    group: (cls, count, n) => `${cls}, ${count} épreuve${n > 1 ? 's' : ''}`,
    edition: (name, year) => `${name} ${year}`,
  },
  rules: {
    title: 'Les règles',
    items: (p) => [
      {
        term: 'Provisoire',
        text: `Tant que son expérience reste sous ${p.threshold}${p.oneDay && p.stage ? ` (une course d’un jour vaut ${p.oneDay}, une étape ${p.stage})` : ''}, un coureur est provisoire : son index s’affiche sur sa page avec cette étiquette, il n’entre pas au classement, et ses résultats comptent davantage, jusqu’au double à sa première course.`,
      },
      {
        term: 'Inactif',
        text: `Après ${p.activeDays} jours sans course comptée, l’index est figé et le coureur sort du classement, jusqu’à sa prochaine course comptée.`,
      },
      ...(p.returnBonus ? [{
        term: 'Retour',
        text: `Après plus de ${p.returnBonus.gapDays} jours sans course comptée, ses résultats comptent au moins ${p.returnBonus.multiplier} fois pendant ${p.returnBonus.experience} unités d’expérience.`,
      }] : []),
      {
        term: 'Abandons',
        text: 'Abandon, non-partant, hors délais, disqualification : la course ne compte pas pour lui, ni en plus ni en moins. Ses étapes terminées comptent ; il n’a pas de classement général.',
      },
      ...(p.lower ? [{
        term: 'Petites courses',
        text: `Un coureur dont la première course comptée est un championnat national ou une course de classe 2 part de ${p.lower.entry}, et non de ${p.lower.initial}. En classe 2, K est multiplié par ${p.lower.m}. Ces deux réglages ont été choisis sur les saisons d’entraînement et mesurés sur les saisons de test, comme les autres.`,
      }] : []),
      {
        term: 'Petits pelotons',
        text: `Un classement de moins de ${p.minField} arrivants ne compte pas.`,
      },
      {
        term: 'Corrections',
        text: 'Quand l’UCI corrige ou retire un résultat, le recalcul complet répercute le changement sur toutes les courses qui suivent.',
      },
      {
        term: 'Recalcul',
        text: 'Chaque nuit, tout l’historique est recalculé depuis zéro, dans l’ordre des dates ; une étape passe avant le général final du même jour.',
      },
      {
        term: 'Sans érosion',
        text: 'L’index ne baisse jamais par simple inactivité, et ne revient pas vers la moyenne en fin de saison.',
      },
      ...(p.publishedFrom ? [{
        term: 'Rodage',
        text: `Les courses d’avant le ${p.publishedFrom} servent de rodage : elles sont calculées et visibles sur les pages des coureurs, mais le classement n’est publié qu’à partir de cette date.`,
      }] : []),
    ],
  },
  uci: {
    title: 'L’index et le classement UCI',
    text: 'Les points UCI additionnent ce qu’un coureur gagne sur 52 semaines ; l’index compte qui il bat.',
  },
  limits: {
    title: 'Les limites assumées',
    items: (p) => [
      { lead: 'Un Elo simple plutôt qu’un modèle bayésien :', text: 'tout se vérifie à la main, mais le statut provisoire vient d’un seuil de comptage, pas d’une incertitude mesurée.' },
      { lead: 'Un index unique :', text: 'un seul classement pour tous, mais il mélange sprinteurs, grimpeurs et rouleurs.' },
      { lead: 'Des résultats, pas le travail d’équipier :', text: 'un équipier qui n’atteint jamais le haut de l’ordre descend lentement.' },
      {
        lead: 'La troncature :',
        text: p.nextAfterTop
          ? `elle retire le bruit des fins de course, mais le ${p.nextAfterTop} et le dernier comptent pareil.`
          : 'elle retire le bruit des fins de course, mais tous les coureurs au-delà des N premiers comptent pareil.',
      },
      { lead: 'Les poids de classe :', text: 'un choix éditorial, publié ici, comme les barèmes de points de l’UCI.' },
      ...(p.lower ? [{
        lead: 'Les petites courses :',
        text: 'un coureur qui ne court qu’en classe 2 rencontre rarement le WorldTour. La correction réduit l’écart d’échelle sans l’effacer (voir la précision mesurée).',
      }] : []),
      { lead: 'L’abandon compte comme une absence :', text: 'abandonner n’est jamais puni, ce que la troncature rend presque neutre.' },
      { lead: 'Les étapes et le général comptent tous deux :', text: `les mêmes jours comptent deux fois, d’où le poids faible des étapes${p.stage ? ` (${p.stage})` : ''}.` },
      { lead: 'Les échappées :', text: `une échappée qui va au bout « bat » des leaders qui n’ont pas disputé l’étape ; l’effet reste limité par ce poids${p.nStage ? ` et par les ${p.nStage} premiers comptés` : ''}.` },
      {
        lead: 'Une somme nulle imparfaite :',
        text: p.drift
          ? `les multiplicateurs de provisoire et de retour font dériver la moyenne. Moyenne des coureurs notés : ${p.drift.from} au ${p.drift.fromDate}, ${p.drift.to} au ${p.drift.toDate}.`
          : 'les multiplicateurs de provisoire et de retour font dériver la moyenne ; chaque calcul la mesure.',
      },
    ],
  },
  versions: {
    title: 'Les versions',
    caption: 'Historique des versions de l’index',
    columns: {
      name: 'Version', frozen: 'Paramètres figés le', computed: 'Dernier calcul', status: 'État',
    },
    current: 'Publiée',
    archived: 'Archivée',
    note: 'Changer un paramètre crée une nouvelle version, datée, et recalcule tout l’historique.',
  },
  sources: {
    title: 'Sources',
    items: [
      {
        term: 'Résultats',
        link: 'UCI DataRide',
        href: 'https://dataride.uci.ch/',
        after: ', tous les partants de chaque classement, avec les abandons, les non-partants et les hors délais, et le classement mondial UCI cité sur les pages des coureurs.',
      },
      {
        term: 'Profils',
        link: 'Wikidata',
        href: 'https://www.wikidata.org/',
        after: ', taille, poids, liens vers Wikipédia et graphie des noms.',
      },
    ],
    collected: (date) => `Dernière collecte des résultats le ${date}.`,
  },
  rankingLink: 'Voir le classement',
};

const en: MethodContent = {
  head: {
    title: 'Ucicle index: how the ranking is calculated',
    description: (counted, since) => (counted
      ? `Formula, parameters and a real example of the Ucicle index: duels on the top of each finish, weighted by UCI class, over ${counted} classifications${since ? ` since ${since}` : ''}.`
      : 'Formula, parameters and a real example of the Ucicle index: duels on the top of each finish, weighted by UCI class and race type.'),
  },
  breadcrumb: {
    label: 'Breadcrumb', home: 'Home', ranking: 'Ranking', method: 'Method',
  },
  title: 'How the Ucicle index is calculated',
  toc: { label: 'On this page' },
  version: (name, frozen) => (frozen ? `Index ${name}, ${frozen}` : `Index ${name}`),
  computed: (computed, asOf) => (computed
    ? `Last computed on ${computed}, from results up to ${asOf}.`
    : `Computed from results up to ${asOf}.`),
  empty: 'No computation of the index is published yet. The formula, the parameters and a real example will show here after the first computation.',
  plain: {
    title: 'In plain words',
    text: (p) => {
      let top: string | null = null;
      if (p.nOneDay && p.nStage) {
        const firsts = p.nGc && p.nGc !== p.nOneDay
          ? `the first ${p.nOneDay} of a one-day race, the first ${p.nGc} of a general classification`
          : `the first ${p.nOneDay} of a one-day race or a general classification`;
        top = `Only the top of the finish order counts: ${firsts}, the first ${p.nStage} of a stage. Those face every finisher. Further down, the order mostly depends on team work and groups: those riders do not face each other.`;
      }
      const weights = [
        p.stage ? `a stage weighs ${p.stage} of a one-day race` : null,
        p.grandTour ? `the general classification of a grand tour ${p.grandTour}` : null,
      ].filter(Boolean).join(', ');
      return [
        `Every rider starts at ${p.initial}${p.entry ? `, or at ${p.entry} when his first counted race is a national championship or a class 2 race` : ''}. After each race, his index goes up or down according to the riders he beat and those who beat him.`,
        'A race reads as a series of duels. Beating a rider with a higher index earns a lot, beating a much weaker rider earns little. Losing to a stronger rider costs little, losing to a weaker one costs more.',
        top,
        `A race weighs according to its UCI class and its type (tables below)${weights ? `: ${weights}` : ''}.`,
        p.entry && p.kLower
          ? `Riders who only race class 2 and national championships rarely meet WorldTour riders: without a correction, their index would drift on a scale of its own. Hence the lower start, and a K multiplied by ${p.kLower} in class 2.`
          : null,
        'Everything is recalculated from scratch every night, from the UCI’s official results. The change of every race is detailed on the rider’s page.',
      ].filter((s): s is string => Boolean(s));
    },
  },
  gap: {
    title: 'What a gap means',
    intro: 'The gap between two indexes says what share of their duels the better rated rider should win, according to the model.',
    caption: 'Share of duels the better rated rider should win, by gap',
    columns: { gap: 'Gap', share: 'The better rated wins', odds: 'Odds' },
    gap: (points) => `${points} points`,
    odds: (x) => `${x} to 1`,
    beat: (gap, win, loss) => `Beating a rider rated ${gap} points higher earns ${win} of a duel; losing to him costs ${loss}.`,
  },
  accuracy: {
    title: 'Measured accuracy',
    text: (p) => {
      const undecided = p.undecided ? `, which cannot separate ${p.undecided} of them (riders without a UCI ranking place, or tied), counted as misses` : '';
      const baseline = p.baseline ? `, against ${p.baseline} for the UCI World Ranking${undecided}` : '';
      return `Over ${p.test ? `the ${p.test} seasons` : 'the test seasons'}, the model picked the winner of ${p.accuracy} of the ${p.duels ? `${p.duels} ` : ''}test duels${baseline}.`;
    },
    seasons: (train, test) => `Parameters chosen on the ${train} seasons, measured on ${test}.`,
    logLoss: (value) => `Log loss: ${value}. The lower it is, the better the predictions.`,
    levels: (p) => [
      `Against a rider who has raced the WorldTour or the ProSeries, a rider who stayed in class 2 and national championships is still rated ${p.gap} points too high on average, against ${p.gapBefore} without the lower-level correction.`,
      ...(p.two && p.twoBefore && p.cn && p.cnBefore
        ? [`With it, the model picks the winner of ${p.two} of class 2 duels (${p.twoBefore} without it) and ${p.cn} of national championship duels (${p.cnBefore}).`]
        : []),
    ],
    join: (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items.join('')),
    range: (a, b) => (b - a > 1 ? `${a} to ${b}` : `${a} and ${b}`),
  },
  example: {
    title: 'A real example',
    intro: (p) => (p.top
      ? `One-day race, ${p.finishers} riders at the finish. The first ${p.top} face every other finisher, ${p.duels} duels each; the others face only those ${p.top}. Here are the first three, with the numbers the computation stored.`
      : `One-day race, ${p.finishers} riders at the finish. Here are the first three, with the numbers the computation stored.`),
    k: (formula, k) => `K = ${formula} = ${k} for the whole race: base K, class weight, type weight.`,
    duel: (p) => `One duel: ${p.a}, index ${p.aIndex}, finishes ahead of ${p.b}, index ${p.bIndex}. From the gap he was expected to win ${p.expected} of it; he wins it, ${p.gain} more than expected, which ${p.b} loses.`,
    listLabel: 'The first three and their calculation',
    line: {
      before: 'Index before', counted: 'Duels counted', won: 'Won', expected: 'Expected',
    },
    multiplier: (m, why) => {
      if (why === 'provisional') return `Multiplier ${m}: a rider still provisional, his results count more.`;
      if (why === 'return') return `Multiplier ${m}: back after a long spell without a counted race.`;
      return `Multiplier ${m}.`;
    },
    after: 'Index after',
  },
  formula: {
    title: 'The formula',
    intro: 'For every rider i of a race, with the indexes from before the race; every change applies together after it.',
    sub: { base: 'base', cls: 'class', type: 'type' },
    spoken: {
      e: (scale) => `E i j equals 1 divided by 1 plus 10 to the power of R j minus R i over ${scale}.`,
      k: (m) => `K equals K base, times w class, times w type${m ? `, times ${m} in class 2` : ''}.`,
      delta: 'Delta R i equals K, times m i, times the sum over the counted duels of S i j minus E i j, all divided by n minus 1.',
    },
    kLower: (m) => `× ${m} in class 2`,
    symbolsLabel: 'The symbols',
    symbols: {
      r: 'Indexes of riders i and j before the race.',
      e: 'Share of the duel between i and j that i was expected to win.',
      s: 'Result of the duel: 1 if i finishes ahead of j, 0.5 on the same rank, 0 behind.',
      n: 'Riders classified at the finish. Abandons, non-starters, riders outside the time limit and disqualified riders are not.',
      sum: 'The counted duels: against every finisher for a rider of the first N, against the first N only for the others.',
      k: (m) => `The weight of the race: base K, times the weight of its UCI class and that of its type${m ? `, then times ${m} in class 2` : ''}.`,
      m: 'Multiplier: 1 as a rule, higher for a provisional or returning rider.',
    },
    properties: {
      title: 'True by construction',
      items: [
        'Finishing higher never earns less.',
        'A race never moves an index by more than K × m.',
        'Without a multiplier, every race sums to zero: what some gain, the others lose.',
      ],
    },
  },
  parameters: {
    title: 'The parameters',
    caption: (name) => `Parameters of index ${name}`,
    columns: { name: 'Parameter', value: 'Value' },
    rows: {
      initial: 'Initial index',
      scale: 'Gap scale (in E)',
      kBase: 'Base K',
      minField: 'Minimum field',
      threshold: 'Experience to leave the provisional status',
      provisional: 'Multiplier of a provisional rider',
      returnBonus: 'Return multiplier',
      activeDays: 'Inactive after',
      publishedFrom: 'Ranking published from',
      lowerEntry: 'Initial index at national championships and class 2',
      lowerK: 'K in class 2',
    },
    lowerK: (m) => `× ${m}`,
    minField: (n) => ({ figure: n, text: 'finishers' }),
    threshold: (x, oneDay) => ({ figure: x, text: oneDay ? `(a one-day race is worth ${oneDay})` : '' }),
    returnBonus: (m, x, days) => `at least ${m}, for ${x} experience units, after more than ${days} days without a counted race`,
    provisional: (t) => `1 + max(0, 1 − X / ${t}), X being the experience`,
    activeDays: (days) => ({ figure: days, text: 'days without a counted race' }),
  },
  classes: {
    title: 'Weight by UCI class',
    caption: 'w class: the weight of each UCI class',
    columns: { code: 'Class', what: 'Races', weight: 'Weight' },
    names: {
      '1.UWT': 'UCI WorldTour, one-day race',
      '2.UWT': 'UCI WorldTour, stage race',
      CM: 'World Championships',
      JO: 'Olympic Games',
      '1.Pro': 'UCI ProSeries, one-day race',
      '2.Pro': 'UCI ProSeries, stage race',
      '1.HC': 'Hors catégorie, one-day race (until 2019)',
      '2.HC': 'Hors catégorie, stage race (until 2019)',
      1.1: 'Class 1, one-day race',
      2.1: 'Class 1, stage race',
      CC: 'Continental Championships',
      CN: 'National Championships',
      1.2: 'Class 2, one-day race',
      2.2: 'Class 2, stage race',
    },
    lowerNote: (m, effective) => `In class 2, K is also multiplied by ${m}: a race there weighs ${effective}.`,
  },
  types: {
    title: 'Weight by classification type',
    caption: 'w type: the weight of each classification type, and the first riders who face the whole field',
    columns: { kind: 'Classification', weight: 'Weight', top: 'First N' },
    names: {
      one_day: 'One-day road race',
      one_day_itt: 'One-day time trial',
      stage: 'Stage, road or time trial',
      prologue: 'Prologue',
      gc_final: 'Final general classification',
      gc_final_grand_tour: 'Final GC of a grand tour (Tour, Giro, Vuelta)',
      championship_road_race: 'Championship road race',
      championship_itt: 'Championship time trial',
      olympic_road_race: 'Olympic road race',
      olympic_itt: 'Olympic time trial',
    },
  },
  scope: {
    title: 'Scope and races counted',
    text: (from) => [
      `Elite men, on the road, in the UCI classes of the table${from ? `, since the ${from} season` : ''}. Counted: one-day races, every stage and the final general classification of stage races, the road races and time trials of championships and the Olympic Games.`,
      'Not counted: team time trials, mixed relays, points, mountains, youth and team classifications, intermediate general classifications, under-23 races.',
    ],
    counters: (counted, rows, riders) => `${counted} classifications counted, ${rows} results, ${riders} riders rated.`,
    skipped: (p) => {
      const parts = [
        p.cancelled ? `${p.f(p.cancelled)} cancelled classification${p.cancelled === 1 ? '' : 's'}` : null,
        p.small ? `${p.f(p.small)} with fewer than ${p.minField ?? ''} finishers` : null,
        p.noDuel ? `${p.f(p.noDuel)} with no possible duel` : null,
      ].filter(Boolean);
      return parts.length ? `Not counted: ${parts.join(', ')}.` : null;
    },
    seasons: 'Seasons are the UCI’s, from mid-October to mid-October.',
    caption: 'Classifications counted, by class and season',
    columns: { cls: 'Class', total: 'Total' },
    total: 'Total',
    warmUp: 'warm-up',
    listTitle: 'The races counted, season by season',
    season: (year, warmUp, classifications, competitions, n) => ({
      title: `${year} season${warmUp ? ' (warm-up)' : ''}`,
      count: `${classifications} classifications, ${competitions} race${n === 1 ? '' : 's'}`,
    }),
    group: (cls, count, n) => `${cls}, ${count} race${n === 1 ? '' : 's'}`,
    edition: (name, year) => `${name} ${year}`,
  },
  rules: {
    title: 'The rules',
    items: (p) => [
      {
        term: 'Provisional',
        text: `While his experience stays under ${p.threshold}${p.oneDay && p.stage ? ` (a one-day race is worth ${p.oneDay}, a stage ${p.stage})` : ''}, a rider is provisional: his index shows on his page with that label, he is not in the ranking, and his results count more, up to double in his first race.`,
      },
      {
        term: 'Inactive',
        text: `After ${p.activeDays} days without a counted race, the index is frozen and the rider leaves the ranking, until his next counted race.`,
      },
      ...(p.returnBonus ? [{
        term: 'Return',
        text: `After more than ${p.returnBonus.gapDays} days without a counted race, his results count at least ${p.returnBonus.multiplier} times for ${p.returnBonus.experience} experience units.`,
      }] : []),
      {
        term: 'Abandons',
        text: 'Did not finish, did not start, outside the time limit, disqualified: the race does not count for him, neither up nor down. His finished stages count; he has no general classification.',
      },
      ...(p.lower ? [{
        term: 'Lower levels',
        text: `A rider whose first counted race is a national championship or a class 2 race starts at ${p.lower.entry}, not ${p.lower.initial}. In class 2, K is multiplied by ${p.lower.m}. Both settings were chosen on the training seasons and measured on the test seasons, like the others.`,
      }] : []),
      {
        term: 'Small fields',
        text: `A classification with fewer than ${p.minField} finishers does not count.`,
      },
      {
        term: 'Corrections',
        text: 'When the UCI corrects or withdraws a result, the full recomputation carries the change through every later race.',
      },
      {
        term: 'Recomputation',
        text: 'Every night, the whole history is recalculated from scratch, in date order; a stage comes before the final GC of the same day.',
      },
      {
        term: 'No decay',
        text: 'The index never drops from inactivity alone, and does not move back towards the mean at the end of a season.',
      },
      ...(p.publishedFrom ? [{
        term: 'Warm-up',
        text: `Races before ${p.publishedFrom} are a warm-up: they are computed and shown on the riders’ pages, but the ranking is published only from that day.`,
      }] : []),
    ],
  },
  uci: {
    title: 'The index and the UCI ranking',
    text: 'UCI points add up what a rider earns over 52 weeks; the index counts whom he beats.',
  },
  limits: {
    title: 'The limits we accept',
    items: (p) => [
      { lead: 'A simple Elo rather than a Bayesian model:', text: 'everything can be checked by hand, but the provisional status comes from a count threshold, not from a measured uncertainty.' },
      { lead: 'A single index:', text: 'one ranking for every rider, but it mixes sprinters, climbers and rouleurs.' },
      { lead: 'Results, not domestique work:', text: 'a domestique who never reaches the top of the order slowly goes down.' },
      {
        lead: 'Truncation:',
        text: p.nextAfterTop
          ? `it removes the noise at the back of the race, but the ${p.nextAfterTop} and the last rider count the same.`
          : 'it removes the noise at the back of the race, but every rider beyond the first N counts the same.',
      },
      { lead: 'Class weights:', text: 'an editorial choice, published here, like the UCI’s points scales.' },
      ...(p.lower ? [{
        lead: 'Lower levels:',
        text: 'a rider who only races class 2 rarely meets the WorldTour. The correction shrinks the scale gap without removing it (see the measured accuracy).',
      }] : []),
      { lead: 'An abandon counts as an absence:', text: 'abandoning is never punished, which truncation makes almost neutral.' },
      { lead: 'Stages and the general classification both count:', text: `the same days count twice, hence the low weight of stages${p.stage ? ` (${p.stage})` : ''}.` },
      { lead: 'Breakaways:', text: `a breakaway that stays clear “beats” leaders who did not contest the stage; the effect stays limited by that weight${p.nStage ? ` and by the first ${p.nStage} counted` : ''}.` },
      {
        lead: 'An imperfect zero sum:',
        text: p.drift
          ? `the provisional and return multipliers make the mean drift. Mean index of rated riders: ${p.drift.from} on ${p.drift.fromDate}, ${p.drift.to} on ${p.drift.toDate}.`
          : 'the provisional and return multipliers make the mean drift; every computation measures it.',
      },
    ],
  },
  versions: {
    title: 'Versions',
    caption: 'History of the index versions',
    columns: {
      name: 'Version', frozen: 'Parameters frozen on', computed: 'Last computed', status: 'State',
    },
    current: 'Published',
    archived: 'Archived',
    note: 'Changing a parameter creates a new, dated version and recalculates the whole history.',
  },
  sources: {
    title: 'Sources',
    items: [
      {
        term: 'Results',
        link: 'UCI DataRide',
        href: 'https://dataride.uci.ch/',
        after: ', every starter of every classification, with abandons, non-starters and riders outside the time limit, and the UCI World Ranking quoted on the riders’ pages.',
      },
      {
        term: 'Profiles',
        link: 'Wikidata',
        href: 'https://www.wikidata.org/',
        after: ', height, weight, links to Wikipedia and the spelling of names.',
      },
    ],
    collected: (date) => `Results last collected on ${date}.`,
  },
  rankingLink: 'See the ranking',
};

export const method: Record<Lang, MethodContent> = { fr, en };

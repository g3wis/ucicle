import type { Lang } from '../i18n/language';

// Owner: rules clone. Every visible string of the About page, in both languages.
// Voice: tutoiement, short sentences, peloton vocabulary. No emoji, no U+2014.
// French punctuation (: ? « ») carries a no-break space, so it never starts a line.
// The page leads with what the Help panel does not say (decisions/round-3.md, D18): the data and
// the rule of the starting hint first, then the rules in short, with a button to the Help panel,
// which keeps the example bib.

export type AboutSection = {
  /** Anchor of the section (/a-propos/#donnees). Stable: links may point to it. */
  id: string,
  title: string,
};

export type AboutContent = {
  title: string,
  data: AboutSection & {
    /** The data sheet: what comes from where, who can be guessed, when it changes. */
    facts: { term: string, text: string }[],
    hintTitle: string,
    hintText: string[],
  },
  rules: AboutSection & {
    /** The rules in three sentences. The Help panel tells the rest, on its example bib. */
    summary: string,
    /** The button that opens the Help panel (#help) over this page. */
    readHelp: string,
    /** The page's way back to the board, under the rules. */
    play: string,
  },
  report: AboutSection & {
    text: string,
    link: string,
    href: string,
  },
  privacy: AboutSection & {
    text: string[],
  },
};

// Sources of the Data section: functions/README.md and functions/src (riderLoader.ts,
// bestResult.ts, GenerateSecretRider.ts, riderUtils.ts). The top 1,000 is riderLoader.ts
// RANKING_SIZE, the former riders FORMER_RIDERS_TOP (100) and FORMER_RIDERS_SINCE (2016): change the
// 'Coureurs du jeu' / 'Game riders' fact if those constants move (it describes the game's list
// only, not the index, which rates every rider of the UCI results).
// Round numbers in running prose are spelled out (decisions/round-4.md, D25): "les mille
// premiers", "les cent premiers"; "the top thousand", "the top hundred". Clock times (5 h UTC,
// 05:00 UTC), the 52 weeks of the ranking and the scores the board prints (3/5, X/5, 2×) stay
// in figures.
// OWNER: the live riders.json (harvested 2026-11-16) still holds the former procyclingstats list,
// whose hints are career results (years 2006 to 2023). The hint rule below is the DataRide
// loader's (last 52 weeks, most UCI points). Confirm that loader has run in production before
// this page ships, or the page describes a rule the live hints do not follow yet.
// OWNER: confirm the monthly refresh of the list (functions/README.md, cron `0 0 1 * *`).

// OWNER: confirm https://github.com/g3wis/ucicle/issues may be shown as the place to report a data
// error (public repository, issues open to players).

// OWNER: legal mentions (publisher, host, contact) to supply; the site now runs on a Linux server
// the owner provides, whose host is not named yet. When they exist, they go in
// the privacy section (its title can become "Vie privée et mentions légales" /
// "Privacy and legal notice"). Until then the page states only what is known.
// OWNER: no audience measurement is known in the repository. Confirm there is none before adding
// "Aucune mesure d’audience." / "No audience measurement." to the privacy section.

const fr: AboutContent = {
  title: 'À propos d’Ucicle',
  data: {
    id: 'donnees',
    title: 'Données',
    facts: [
      {
        term: 'Classement et résultats',
        text: 'UCI DataRide, le service de données de l’Union cycliste internationale.',
      },
      {
        term: 'Taille et poids',
        text: 'Wikidata, à défaut Wikipédia en anglais. Si ni l’un ni l’autre ne les donne, le dossard affiche '
          + '« ? » et ne compare pas.',
      },
      {
        term: 'Index Ucicle',
        text: 'Les résultats UCI des hommes élite sur route depuis 2019, recalculés chaque nuit. La méthode est '
          + 'détaillée sur la page « Comment l’index est calculé ».',
      },
      {
        term: 'Coureurs du jeu',
        text: 'Les mille premiers du classement mondial UCI sur route, hommes élite, et les cent premiers '
          + 'de chaque classement depuis 2016, retraités compris. Un coureur sorti du classement garde sa '
          + 'dernière équipe UCI ; un coureur de club ou d’équipe nationale est « sans équipe UCI ». '
          + 'Tu peux proposer n’importe lequel.',
      },
      {
        term: 'Coureur mystère',
        text: 'Tiré au sort chaque jour à 5 h UTC parmi les cent premiers du classement actuel '
          + 'dont on connaît l’équipe, la taille, le poids et au moins un résultat. '
          + 'À Paris, c’est 6 h en hiver et 7 h en été.',
      },
      { term: 'Coureurs du jeu, mise à jour', text: 'La liste des coureurs du jeu est refaite une fois par mois.' },
    ],
    hintTitle: 'L’indice de départ',
    hintText: [
      'L’indice est le meilleur résultat du coureur sur les 52 dernières semaines, la période que couvre '
        + 'le classement UCI : celui qui lui a rapporté le plus de points UCI. À points égaux, la meilleure '
        + 'place passe devant, puis la plus récente.',
      'Comptent les classements généraux, les étapes, les classements par points et de la montagne, '
        + 'et les courses d’un jour, championnats compris. Si le coureur a obtenu ce résultat plusieurs '
        + 'fois, l’indice le dit (2×) et donne les années.',
    ],
  },
  rules: {
    id: 'regles',
    title: 'Règles',
    summary: 'Tu as cinq essais pour trouver le coureur mystère du jour. Chaque essai épingle un dossard '
      + 'qui compare ton coureur au mystère : âge, taille, poids, pays et équipe. Trouvé ou pas, '
      + 'le dossard mystère se retourne et son numéro devient ton score : 3/5 si tu l’as trouvé '
      + 'au troisième essai, X/5 en rouge si tu l’as raté.',
    readHelp: 'Lire l’aide',
    play: 'Jouer l’étape du jour',
  },
  report: {
    id: 'signaler',
    title: 'Signaler une erreur',
    text: 'Une taille, une équipe ou un résultat te semble faux ? Signale-le avec le nom du coureur '
      + 'et la donnée en cause.',
    link: 'Ouvrir un ticket sur GitHub',
    href: 'https://github.com/g3wis/ucicle/issues',
  },
  privacy: {
    id: 'vie-privee',
    title: 'Vie privée',
    text: [
      // OWNER: add 'sans publicité' only if you commit to it publicly ('gratuit, sans compte et sans
      // publicité'). Nothing in the repository makes that promise today.
      'Ucicle est gratuit et sans compte.',
      'Ta partie en cours, ton historique et tes stats restent dans ton navigateur, sur www.ucicle.fr. '
        + 'Tes essais ne quittent pas ton appareil : c’est ton navigateur qui fait la comparaison.',
      'Sur un autre appareil ou un autre navigateur, tu repars de zéro. Effacer les données du site '
        + 'efface aussi ton historique.',
      'Le site tourne sur un serveur avec une base de données, que la recherche de coureur interroge.',
    ],
  },
};

const en: AboutContent = {
  title: 'About Ucicle',
  data: {
    id: 'data',
    title: 'Data',
    facts: [
      {
        term: 'Ranking and results',
        text: 'UCI DataRide, the data service of the Union Cycliste Internationale.',
      },
      {
        term: 'Height and weight',
        text: 'Wikidata, or failing that English Wikipedia. When neither has them, the bib shows “?” and '
          + 'does not compare.',
      },
      {
        term: 'Ucicle index',
        text: 'The UCI results of elite men on the road since 2019, recomputed every night. The method is '
          + 'set out on the page “How the index is calculated”.',
      },
      {
        term: 'Game riders',
        text: 'The top thousand of the UCI men’s elite road world ranking, and the top hundred of every ranking '
          + 'since 2016, retired riders included. A rider who left the ranking keeps their last UCI team; '
          + 'a rider of a club or a national team has “no UCI team”. You can guess any of them.',
      },
      {
        term: 'Mystery rider',
        text: 'Drawn at random every day at 05:00 UTC from the top hundred of the current ranking '
          + 'whose team, height, weight and at least one result are known.',
      },
      { term: 'Game riders, updates', text: 'The list of the game’s riders is rebuilt once a month.' },
    ],
    hintTitle: 'The starting hint',
    hintText: [
      'The hint is the rider’s best result over the last 52 weeks, the period the UCI ranking covers: '
        + 'the one that earned them the most UCI points. On equal points, the better place comes first, '
        + 'then the more recent.',
      'General classifications, stages, points and mountains classifications and one-day races count, '
        + 'championships included. If the rider got that result more than once, the hint says so (2×) '
        + 'and gives the years.',
    ],
  },
  rules: {
    id: 'rules',
    title: 'Rules',
    summary: 'You have five tries to find today’s mystery rider. Each try pins a bib that compares your rider '
      + 'with the mystery rider: age, height, weight, country and team. Found or not, the mystery bib turns '
      + 'over and its number becomes your score: 3/5 if you found them on the third try, a red X/5 if you '
      + 'missed.',
    readHelp: 'Read the help',
    play: 'Play today’s stage',
  },
  report: {
    id: 'report',
    title: 'Report a data error',
    text: 'A height, a team or a result looks wrong? Report it with the rider’s name and the value in question.',
    link: 'Open an issue on GitHub',
    href: 'https://github.com/g3wis/ucicle/issues',
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy',
    text: [
      // OWNER: add 'no advertising' only if you commit to it publicly ('free, with no account and no
      // advertising'). Nothing in the repository makes that promise today.
      'Ucicle is free, with no account.',
      'Your game in progress, your history and your stats stay in your browser, on www.ucicle.fr. '
        + 'Your tries never leave your device: your browser does the comparison.',
      'On another device or another browser, you start from zero. Clearing the site’s data also '
        + 'clears your history.',
      'The site runs on a server with a database, which the rider search queries.',
    ],
  },
};

export const about: Record<Lang, AboutContent> = { fr, en };

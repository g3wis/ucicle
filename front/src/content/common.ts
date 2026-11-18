import type { Lang } from '../i18n/language';
import type { RaceType } from '../types/CyclingTypes';
import type { CommonContent } from './types';

// Voice: tutoiement, short sentences, peloton vocabulary. No emoji in the interface, no U+2014.

const frRank = (rank: number): string => (rank === 1 ? '1er' : `${rank}e`);

function frResult(rank: number, raceType: RaceType): string {
  switch (raceType) {
    case 'GC': return `${frRank(rank)} du classement général`;
    case 'Point GC':
    case 'Points GC': return `${frRank(rank)} du classement par points`;
    case 'KOM': return `${frRank(rank)} du classement de la montagne`;
    case 'stage': return rank === 1 ? 'vainqueur d’étape' : `${frRank(rank)} d’étape`;
    default: return rank === 1 ? 'vainqueur' : frRank(rank);
  }
}

function enRank(rank: number): string {
  const teen = rank % 100 >= 11 && rank % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[rank % 10] ?? 'th';
  return `${rank}${suffix}`;
}

function enResult(rank: number, raceType: RaceType): string {
  switch (raceType) {
    case 'GC': return `${enRank(rank)} overall`;
    case 'Point GC':
    case 'Points GC': return `${enRank(rank)} in the points classification`;
    case 'KOM': return `${enRank(rank)} in the mountains classification`;
    case 'stage': return rank === 1 ? 'stage winner' : `${enRank(rank)} on a stage`;
    default: return rank === 1 ? 'winner' : enRank(rank);
  }
}

// Narrow no-break space after a bound operator, so "≥ 1,77 m" never leaves its "≥" alone on a line.
const NNBSP = '\u202F';

const joinYears = (years: number[], and: string): string => {
  const sorted = [...years].sort((a, b) => a - b).map(String);
  if (sorted.length < 2) return sorted.join('');
  return `${sorted.slice(0, -1).join(', ')} ${and} ${sorted[sorted.length - 1]}`;
};

const fr: CommonContent = {
  lang: 'fr',
  siteName: 'Ucicle',
  skipLink: { game: 'Aller au jeu', content: 'Aller au contenu' },
  header: {
    home: 'Ucicle, accueil',
    help: 'Aide',
    stats: 'Stats',
    nav: 'Sections',
    language: { code: 'EN', name: 'EN, English version' },
  },
  nav: {
    game: 'Jeu', ranking: 'Classement', teams: 'Équipes', races: 'Courses',
  },
  footer: {
    data: 'Données UCI DataRide, Wikidata et Wikipédia', about: 'À propos', otherLanguage: 'English',
  },
  panel: { close: 'Fermer' },
  game: {
    title: 'Le coureur mystère du jour',
    loading: 'Le peloton arrive…',
    noScript: 'Le jeu a besoin de JavaScript. En attendant, le classement de l’index et la page À propos se lisent sans.',
    loadError: 'Les données du jour ne sont pas arrivées.',
    retry: 'Réessayer',
    band: (stage, date) => `Étape ${stage}, ${date}`,
    mysteryLabel: 'Dossard du coureur mystère',
    boardTitle: 'Tes essais',
    hint: {
      label: 'Meilleur résultat du coureur mystère',
      recurrence: (times) => `${times}×`,
      result: frResult,
      years: (years) => joinYears(years, 'et'),
    },
    known: {
      label: 'Ce que tu sais',
      range: (min, max) => {
        if (min && max) return `${min} à ${max}`;
        if (min) return `≥${NNBSP}${min}`;
        return `≤${NNBSP}${max}`;
      },
      // The countries ruled out, on the bib's country column: "pas SLO, DEN".
      notIn: (values) => `pas ${values.join(', ')}`,
    },
    attributes: {
      age: 'Âge', height: 'Taille', weight: 'Poids', country: 'Pays', team: 'Équipe',
    },
    trends: {
      age: { eq: 'même âge', up: 'le mystère est plus âgé', down: 'le mystère est plus jeune' },
      height: { eq: 'même taille', up: 'le mystère est plus grand', down: 'le mystère est plus petit' },
      weight: { eq: 'même poids', up: 'le mystère est plus lourd', down: 'le mystère est plus léger' },
    },
    same: {
      country: { eq: 'même pays', no: 'autre pays' },
      team: { eq: 'même équipe', no: 'autre équipe' },
    },
    tryLabel: (n, max) => `Essai ${n} sur ${max}`,
    lastTry: 'Dernier essai',
    bibLabel: (n, name) => `Essai ${n} : ${name}`,
    placeholder: 'Nom d’un coureur',
    validate: 'Valider',
    validateRider: (shortName) => `Valider ${shortName}`,
    firstHelp: 'Tape un coureur : on compare son âge, sa taille, son poids, son pays et son équipe à ceux du mystère.',
    combobox: {
      results: (n) => (n > 1 ? `${n} coureurs trouvés` : '1 coureur trouvé'),
      none: 'Aucun coureur à ce nom',
      alreadyPlayed: 'déjà joué',
      instructions: 'Tape au moins deux lettres, puis choisis avec les flèches et Entrée.',
    },
    announce: (n, max, name, parts) => `Essai ${n} sur ${max} : ${name}. ${parts.join('. ')}.`,
    found: (tries) => `Trouvé en ${tries}.`,
    missed: (name) => `C’était ${name}.`,
    missedTitle: 'Raté.',
    verdict: { missedMark: 'X' },
    resultLabel: 'Résultat du jour',
    share: 'Partager',
    shared: 'Partagé',
    copied: 'Résultat copié',
    shareFailed: 'Copie impossible',
    shareHeadline: (stage, tries, max) => (tries
      ? `Ucicle #${stage}, trouvé en ${tries}/${max} 🚴`
      : `Ucicle #${stage}, raté X/${max} 🚴`),
    shareUrl: 'https://www.ucicle.fr/jeu/',
    nextStart: 'Prochain départ dans',
    riderLink: 'Sa fiche : index et résultats',
    newStart: 'Le prochain coureur est au départ.',
    reload: 'Jouer',
  },
};

const en: CommonContent = {
  lang: 'en',
  siteName: 'Ucicle',
  skipLink: { game: 'Skip to the game', content: 'Skip to the content' },
  header: {
    home: 'Ucicle, home',
    help: 'Help',
    stats: 'Stats',
    nav: 'Sections',
    language: { code: 'FR', name: 'FR, version française' },
  },
  nav: {
    game: 'Game', ranking: 'Ranking', teams: 'Teams', races: 'Races',
  },
  footer: {
    data: 'Data from UCI DataRide, Wikidata and Wikipedia', about: 'About', otherLanguage: 'Français',
  },
  panel: { close: 'Close' },
  game: {
    title: 'Today’s mystery rider',
    loading: 'The bunch is coming…',
    noScript: 'The game needs JavaScript. Meanwhile, the index ranking and the About page work without it.',
    loadError: 'Today’s data did not arrive.',
    retry: 'Try again',
    band: (stage, date) => `Stage ${stage}, ${date}`,
    mysteryLabel: 'The mystery rider’s bib',
    boardTitle: 'Your tries',
    hint: {
      label: 'The mystery rider’s best result',
      recurrence: (times) => `${times}×`,
      result: enResult,
      years: (years) => joinYears(years, 'and'),
    },
    known: {
      label: 'What you know',
      range: (min, max) => {
        if (min && max) return `${min} to ${max}`;
        if (min) return `≥${NNBSP}${min}`;
        return `≤${NNBSP}${max}`;
      },
      notIn: (values) => `not ${values.join(', ')}`,
    },
    attributes: {
      age: 'Age', height: 'Height', weight: 'Weight', country: 'Country', team: 'Team',
    },
    trends: {
      age: { eq: 'same age', up: 'the mystery rider is older', down: 'the mystery rider is younger' },
      height: { eq: 'same height', up: 'the mystery rider is taller', down: 'the mystery rider is shorter' },
      weight: { eq: 'same weight', up: 'the mystery rider is heavier', down: 'the mystery rider is lighter' },
    },
    same: {
      country: { eq: 'same country', no: 'other country' },
      team: { eq: 'same team', no: 'other team' },
    },
    tryLabel: (n, max) => `Try ${n} of ${max}`,
    lastTry: 'Last try',
    bibLabel: (n, name) => `Try ${n}: ${name}`,
    placeholder: 'A rider’s name',
    validate: 'Confirm',
    validateRider: (shortName) => `Confirm ${shortName}`,
    firstHelp: 'Type a rider: we compare their age, height, weight, country and team with the mystery rider’s.',
    combobox: {
      results: (n) => (n > 1 ? `${n} riders found` : '1 rider found'),
      none: 'No rider by that name',
      alreadyPlayed: 'already played',
      instructions: 'Type at least two letters, then pick with the arrow keys and Enter.',
    },
    announce: (n, max, name, parts) => `Try ${n} of ${max}: ${name}. ${parts.join('. ')}.`,
    found: (tries) => `Found in ${tries}.`,
    missed: (name) => `It was ${name}.`,
    missedTitle: 'Missed.',
    verdict: { missedMark: 'X' },
    resultLabel: 'Today’s result',
    share: 'Share',
    shared: 'Shared',
    copied: 'Result copied',
    shareFailed: 'Could not copy',
    shareHeadline: (stage, tries, max) => (tries
      ? `Ucicle #${stage}, found in ${tries}/${max} 🚴`
      : `Ucicle #${stage}, missed X/${max} 🚴`),
    shareUrl: 'https://www.ucicle.fr/en/play/',
    nextStart: 'Next start in',
    riderLink: 'His page: index and results',
    newStart: 'The next rider is on the start line.',
    reload: 'Play',
  },
};

export const common: Record<Lang, CommonContent> = { fr, en };

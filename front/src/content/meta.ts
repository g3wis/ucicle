import type { Lang } from '../i18n/language';

/**
 * Head copy of the pages whose text does not come from the database (the game and About), and
 * the default share image. Link previews do not run JavaScript: all of it is rendered in the HTML.
 */
export type HeadCopy = { title: string, description: string, ogTitle?: string };

export type MetaContent = {
  /** The default share image of the site, rendered from "Le dossard" (public/og/): the game. */
  ogImage: { path: string, alt: string },
  /**
   * The share image of the index's pages (ranking, rider, method, search, 404): a blank printed
   * start list. It names no rider and prints no figure, so it never dates.
   */
  ogIndexImage: { path: string, alt: string },
  game: HeadCopy,
  about: HeadCopy,
  notFound: HeadCopy,
  /** The 500 page (the server or the database failed). */
  serverError: HeadCopy,
};

export const meta: Record<Lang, MetaContent> = {
  fr: {
    ogImage: {
      path: '/og/ucicle.png',
      alt: 'Un dossard mystère « ? » au meilleur résultat imprimé, et deux dossards épinglés qui comparent âge, taille, poids et pays, le cinquième en rouge : le coureur mystère du jour en 5 essais.',
    },
    ogIndexImage: {
      path: '/og/index.png',
      alt: 'Ucicle, l’index des coureurs cyclistes : une liste des engagés imprimée, numérotée de 1 à 6. Hommes élite, courses UCI sur route, recalculé chaque nuit.',
    },
    game: {
      title: 'Ucicle : devine le coureur cycliste mystère du jour en 5 essais',
      description: 'Devine le coureur pro du jour en 5 essais : meilleur résultat, âge, taille, poids, pays et équipe. Nouveau coureur chaque matin.',
      ogTitle: 'Ucicle, le coureur mystère du jour',
    },
    about: {
      title: 'À propos d’Ucicle : données et règles',
      description: 'D’où viennent les données des coureurs, comment est choisi l’indice de départ, quand change le coureur mystère, et les règles en bref.',
    },
    notFound: {
      title: 'Page introuvable : Ucicle',
      description: 'Cette page n’existe pas sur Ucicle.',
    },
    serverError: {
      title: 'Le site ne répond pas : Ucicle',
      description: 'Le site ne répond pas pour l’instant. Le jeu du jour reste jouable.',
    },
  },
  en: {
    ogImage: {
      path: '/og/ucicle-en.png',
      alt: 'A “?” mystery bib with its best result printed, and two pinned bibs comparing age, height, weight and country, the fifth in red: today’s mystery rider in 5 tries.',
    },
    ogIndexImage: {
      path: '/og/index-en.png',
      alt: 'Ucicle, the pro cyclist rating index: a printed start list numbered 1 to 6. Elite men, UCI road races, recomputed every night.',
    },
    game: {
      title: 'Ucicle: guess today’s mystery pro cyclist in 5 tries',
      description: 'Guess today’s pro cyclist in 5 tries from their best result, then age, height, weight, country and team. A new rider every morning.',
      ogTitle: 'Ucicle, today’s mystery rider',
    },
    about: {
      title: 'About Ucicle: data and rules',
      description: 'Where the rider data comes from, how the starting hint is chosen, when the mystery rider changes, and the rules in short.',
    },
    notFound: {
      title: 'Page not found: Ucicle',
      description: 'This page does not exist on Ucicle.',
    },
    serverError: {
      title: 'Site not answering: Ucicle',
      description: 'The site is not answering right now. Today’s game is still playable.',
    },
  },
};

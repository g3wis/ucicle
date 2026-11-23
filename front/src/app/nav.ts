import type { Lang } from '../i18n/language';
import type { NavKey } from '../content/types';

/** The site's origin: canonical URLs, hreflang, Open Graph and sitemaps are absolute. */
export const SITE = 'https://www.ucicle.fr';

/** An absolute URL on the site, from a path that starts with "/". */
export const absolute = (path: string): string => `${SITE}${path}`;

/**
 * The site's sections, in the navigation row (it shows only when two sections or more are
 * visible). Teams and races are declared, hidden: when one ships, set `visible: true`.
 */
export type Section = { key: NavKey, visible: boolean, path: Record<Lang, string> };

export const SECTIONS: Section[] = [
  { key: 'game', visible: true, path: { fr: '/jeu/', en: '/en/play/' } },
  { key: 'ranking', visible: true, path: { fr: '/classement/', en: '/en/ranking/' } },
  { key: 'teams', visible: false, path: { fr: '/equipes/', en: '/en/teams/' } },
  { key: 'races', visible: false, path: { fr: '/courses/', en: '/en/races/' } },
];

/** The pages with one fixed path per language. Paths are explicit: Astro does not translate them. */
export const PAGES = {
  home: { fr: '/', en: '/en/' },
  game: { fr: '/jeu/', en: '/en/play/' },
  about: { fr: '/a-propos/', en: '/en/about/' },
  ranking: { fr: '/classement/', en: '/en/ranking/' },
  method: { fr: '/classement/methode/', en: '/en/ranking/method/' },
  search: { fr: '/recherche/', en: '/en/search/' },
} as const satisfies Record<string, Record<Lang, string>>;

export type StaticPage = keyof typeof PAGES;

/** Page p of the ranking: page 1 is the ranking itself, `/classement/1/` redirects there. */
export const rankingPagePath = (lang: Lang, page: number): string => (
  page <= 1 ? PAGES.ranking[lang] : `${PAGES.ranking[lang]}${page}/`
);

/** A rider page: the same slug in both languages. */
export const riderPath = (lang: Lang, slug: string): string => (
  lang === 'fr' ? `/coureurs/${slug}/` : `/en/riders/${slug}/`
);

/** The anchor of a rank inside its ranking page, e.g. `/classement/3/#rang-104`. */
export const RANKS_PER_PAGE = 50;
export const rankAnchor = (lang: Lang, rank: number): string => {
  const page = Math.ceil(rank / RANKS_PER_PAGE);
  return `${rankingPagePath(lang, page)}#${lang === 'fr' ? 'rang' : 'rank'}-${rank}`;
};

export const visibleSections = (): Section[] => SECTIONS.filter((s) => s.visible);

export const showNavRow = (): boolean => visibleSections().length >= 2;

export const otherLang = (lang: Lang): Lang => (lang === 'fr' ? 'en' : 'fr');

/** The two language versions of one page, as paths. A plain link, never an automatic redirect. */
export type Alternates = Record<Lang, string>;

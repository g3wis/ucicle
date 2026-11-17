import type { Lang, PageKey } from '../i18n/language';
import type { NavKey } from '../content/types';

/**
 * The site's sections. The data sections (riders, teams, races) are declared now, hidden: when
 * one ships, set `visible: true` and the navigation row appears on its own (it shows only when
 * two sections or more are visible). The game is always first.
 */
export type Section = { key: NavKey, visible: boolean, path: Record<Lang, string> };

export const SECTIONS: Section[] = [
  { key: 'game', visible: true, path: { fr: '/', en: '/en/' } },
  { key: 'riders', visible: false, path: { fr: '/coureurs/', en: '/en/riders/' } },
  { key: 'teams', visible: false, path: { fr: '/equipes/', en: '/en/teams/' } },
  { key: 'races', visible: false, path: { fr: '/courses/', en: '/en/races/' } },
];

/** Pages outside the navigation row, reached from the menu and the footer. */
export const PAGES: Record<PageKey, Record<Lang, string>> = {
  game: { fr: '/', en: '/en/' },
  about: { fr: '/a-propos/', en: '/en/about/' },
};

export const visibleSections = (): Section[] => SECTIONS.filter((s) => s.visible);

export const showNavRow = (): boolean => visibleSections().length >= 2;

export const otherLang = (lang: Lang): Lang => (lang === 'fr' ? 'en' : 'fr');

/** The same page in the other language: a plain link, never an automatic redirect. */
export const alternatePath = (page: PageKey, lang: Lang): string => PAGES[page][otherLang(lang)];

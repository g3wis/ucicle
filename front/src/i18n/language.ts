export type Lang = 'fr' | 'en';

export type PageKey = 'game' | 'about';

/** The language is the page's own: `<html lang>` of the static HTML file, French by default. */
export function pageLang(): Lang {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

/** Which view this HTML file renders: `<html data-page>`, the game by default. */
export function pageKey(): PageKey {
  return document.documentElement.dataset.page === 'about' ? 'about' : 'game';
}

export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

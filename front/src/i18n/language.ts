export type Lang = 'fr' | 'en';

/** Which page a document is: drives aria-current in the shell and the skip link's target. */
export type PageKey = 'home' | 'game' | 'about' | 'ranking' | 'rider' | 'method' | 'search' | 'notFound';

export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

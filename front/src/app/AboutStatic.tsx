import React from 'react';
import { AppProvider } from './context';
import type { Lang } from '../i18n/language';
import AboutPage from './AboutPage';

/**
 * About, rendered to HTML at build time (no client directive): its sections are in the page, so
 * the browser itself opens a shared /a-propos/#donnees on its section.
 */
export default function AboutStatic({ lang }: { lang: Lang }) {
  return (
    <AppProvider lang={lang} page="about">
      <AboutPage />
    </AppProvider>
  );
}

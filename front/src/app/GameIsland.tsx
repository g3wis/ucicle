import React, { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { AppProvider, useApp } from './context';
import type { Lang } from '../i18n/language';
import GamePage from './GamePage';
import HelpPanel from '../panels/help/HelpPanel';
import StatsPanel from '../panels/stats/StatsPanel';

/**
 * The header is Astro's (src/components/shell/Header.astro): its Aide and Stats links open the
 * panels through the URL hash. This keeps their aria-expanded in step with the open panel.
 */
function PanelLinks() {
  const { panel } = useApp();
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-panel-link]').forEach((link) => {
      link.setAttribute('aria-expanded', String(link.dataset.panelLink === panel));
    });
  }, [panel]);
  return null;
}

function LiveRegion() {
  const { announcement } = useApp();
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>;
}

/** The daily game, a client-only island of /jeu/ and /en/play/. */
export default function GameIsland({ lang }: { lang: Lang }) {
  return (
    // "user": motion follows the system's reduced-motion setting everywhere.
    <MotionConfig reducedMotion="user">
      <AppProvider lang={lang} page="game">
        <GamePage />
        <HelpPanel />
        <StatsPanel />
        <PanelLinks />
        <LiveRegion />
      </AppProvider>
    </MotionConfig>
  );
}

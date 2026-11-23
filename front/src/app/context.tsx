import React, {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { Lang, PageKey } from '../i18n/language';
import type { CommonContent } from '../content/types';
import { common } from '../content/common';

export type PanelKey = 'help' | 'stats';
const PANELS: PanelKey[] = ['help', 'stats'];

type AppContextValue = {
  lang: Lang,
  page: PageKey,
  content: CommonContent,
  /** The panel named in the URL hash (#help, #stats, #menu), or null. */
  panel: PanelKey | null,
  openPanel: (panel: PanelKey) => void,
  closePanel: () => void,
  /** One sentence for screen readers, through the page's single live region. */
  announce: (message: string) => void,
  announcement: string,
  /** The date of today's game (secret_rider.json `date`, YYYYMMDD) once loaded, else null. */
  gameDate: string | null,
  setGameDate: (date: string) => void,
};

const AppContext = createContext<AppContextValue | null>(null);

const panelFromHash = (): PanelKey | null => {
  if (typeof window === 'undefined') return null; // rendered on the server (About)
  const key = window.location.hash.replace('#', '') as PanelKey;
  return PANELS.includes(key) ? key : null;
};

export function AppProvider({ lang, page, children }: { lang: Lang, page: PageKey, children: ReactNode }) {
  const [panel, setPanel] = useState<PanelKey | null>(panelFromHash);
  const [announcement, setAnnouncement] = useState('');
  const [gameDate, setGameDate] = useState<string | null>(null);
  // True when the open panel added a history entry: closing then goes back, so the
  // phone's back gesture and the close button do the same thing.
  const pushed = useRef(false);

  useEffect(() => {
    const onHash = () => {
      const next = panelFromHash();
      // A panel opened by a link of the shell's header (href="#help") added a history entry too.
      pushed.current = next !== null;
      setPanel(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openPanel = useCallback((next: PanelKey) => {
    if (panelFromHash() === next) return;
    pushed.current = true;
    window.location.hash = next;
  }, []);

  const closePanel = useCallback(() => {
    if (pushed.current) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setPanel(null);
  }, []);

  const announce = useCallback((message: string) => {
    // Cleared first so the same sentence twice is still read.
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(message), 60);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    lang,
    page,
    content: common[lang],
    panel,
    openPanel,
    closePanel,
    announce,
    announcement,
    gameDate,
    setGameDate,
  }), [lang, page, panel, openPanel, closePanel, announce, announcement, gameDate]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

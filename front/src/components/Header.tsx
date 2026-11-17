import React from 'react';
import Icon from './Icon';
import { useApp, PanelKey } from '../app/context';
import {
  alternatePath, otherLang, PAGES, showNavRow, visibleSections,
} from '../app/nav';

/**
 * The wordmark is the way home; three tools on the right. The section row appears only once there
 * are sections. From 1024 px, À propos, the tools and the language are written out in one type
 * system (band type); the language, "EN" / "FR", is quieter and set apart by a thin rule, and the
 * Menu tool hides. Below 1024 px the menu and the footer carry the language's full word.
 */
export default function Header() {
  const {
    lang, page, content, panel, openPanel,
  } = useApp();
  const tools: { key: PanelKey, label: string, icon: 'help' | 'stats' | 'menu' }[] = [
    { key: 'help', label: content.header.help, icon: 'help' },
    { key: 'stats', label: content.header.stats, icon: 'stats' },
    { key: 'menu', label: content.header.menu, icon: 'menu' },
  ];
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          className="wordmark"
          href={PAGES.game[lang]}
          aria-label={content.header.home}
          aria-current={page === 'game' ? 'page' : undefined}
        >
          {content.siteName}
        </a>
        {showNavRow() && (
          <nav className="site-nav" aria-label={content.header.nav}>
            <ul>
              {visibleSections().map((s) => (
                <li key={s.key}>
                  <a href={s.path[lang]} aria-current={s.key === 'game' && page === 'game' ? 'page' : undefined}>
                    {content.nav[s.key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <ul className="site-links">
          <li>
            <a href={PAGES.about[lang]} aria-current={page === 'about' ? 'page' : undefined}>{content.menu.about}</a>
          </li>
        </ul>
        <div className="site-tools">
          {tools.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`icon-button tool-${t.key}`}
              aria-haspopup="dialog"
              aria-expanded={panel === t.key}
              onClick={() => openPanel(t.key)}
            >
              <Icon name={t.icon} />
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </div>
        {/* From 1024 px only: the code in the band type, named in full (D24). */}
        <a
          className="site-language"
          href={alternatePath(page, lang)}
          hrefLang={otherLang(lang)}
          lang={otherLang(lang)}
          aria-label={content.header.language.name}
        >
          {content.header.language.code}
        </a>
      </div>
    </header>
  );
}

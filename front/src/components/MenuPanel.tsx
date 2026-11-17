import React from 'react';
import Panel from './Panel';
import { useApp } from '../app/context';
import {
  alternatePath, otherLang, PAGES, visibleSections,
} from '../app/nav';

/** Sections (only the visible ones), then the pages outside the game, then the language. */
export default function MenuPanel() {
  const {
    lang, page, content, panel, closePanel,
  } = useApp();
  const sections = visibleSections();
  return (
    <Panel open={panel === 'menu'} title={content.menu.title} onClose={closePanel} className="menu-panel">
      <nav aria-label={content.menu.sections}>
        <ul className="menu-list">
          {sections.map((s) => (
            <li key={s.key}>
              <a
                className="menu-link"
                href={s.path[lang]}
                aria-current={s.key === 'game' && page === 'game' ? 'page' : undefined}
              >
                {content.nav[s.key]}
              </a>
            </li>
          ))}
          <li>
            <a className="menu-link" href={PAGES.about[lang]} aria-current={page === 'about' ? 'page' : undefined}>
              {content.menu.about}
            </a>
          </li>
        </ul>
      </nav>
      <p className="menu-language">
        <span>{content.menu.language}</span>
        <a href={alternatePath(page, lang)} hrefLang={otherLang(lang)} lang={otherLang(lang)}>
          {content.menu.otherLanguage}
        </a>
      </p>
    </Panel>
  );
}

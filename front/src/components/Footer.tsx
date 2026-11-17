import React from 'react';
import { useApp } from '../app/context';
import { alternatePath, otherLang, PAGES } from '../app/nav';

/**
 * Below 1024 px: the data credit on its own line, then À propos and the language together. From
 * 1024 px the header carries both links, so the footer keeps only the credit: each link once.
 */
export default function Footer() {
  const { lang, page, content } = useApp();
  return (
    <footer className="site-footer">
      <ul className="site-footer-inner">
        <li className="footer-credit">{content.footer.data}</li>
        <li className="footer-link">
          <a href={PAGES.about[lang]} aria-current={page === 'about' ? 'page' : undefined}>{content.footer.about}</a>
        </li>
        <li className="footer-link">
          <a href={alternatePath(page, lang)} hrefLang={otherLang(lang)} lang={otherLang(lang)}>
            {content.footer.otherLanguage}
          </a>
        </li>
      </ul>
    </footer>
  );
}

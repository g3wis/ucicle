import React, { ReactNode, useEffect } from 'react';
import { useApp } from '../../app/context';
import { PAGES } from '../../app/nav';
import { about, AboutSection } from '../../content/about';

function Section({ section, children }: { section: AboutSection, children: ReactNode }) {
  const titleId = `${section.id}-title`;
  return (
    <section className="about-section" id={section.id} aria-labelledby={titleId}>
      <h2 className="about-heading" id={titleId}>{section.title}</h2>
      {children}
    </section>
  );
}

const paragraphs = (texts: string[]) => texts.map((text) => <p key={text}>{text}</p>);

/**
 * A shared or bookmarked /a-propos/#donnees opens on its section. The sections render on the
 * client, after the browser looked for the fragment, so the page jumps itself; the root
 * scroll-padding keeps the section clear of the sticky header. Once the fonts are in, the text
 * above may have reflowed: the jump is made again, unless the player has scrolled meanwhile.
 */
function useSectionFromHash(ids: string[]) {
  const key = ids.join(' ');
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || !key.split(' ').includes(id)) return undefined;
    const target = document.getElementById(id);
    if (!target) return undefined;
    target.scrollIntoView({ block: 'start' });
    const landed = window.scrollY;
    let live = true;
    document.fonts.ready.then(() => {
      if (live && window.scrollY === landed) target.scrollIntoView({ block: 'start' });
    });
    return () => {
      live = false;
    };
  }, [key]);
}

/**
 * /a-propos/ and /en/about/: what the Help panel does not say comes first (D18). Where the data
 * comes from and how the starting hint is chosen; then the rules in three sentences, with a button
 * that opens the Help panel over the page (#help, the panel keeps the example bib) and the way
 * back to the board; then how to report an error and what stays in the browser. One reading
 * column on the tarmac.
 */
export default function AboutPage() {
  const { lang, openPanel } = useApp();
  const {
    title, data, rules, report, privacy,
  } = about[lang];
  useSectionFromHash([data.id, rules.id, report.id, privacy.id]);
  return (
    <main id="main" className="about">
      <div className="about-column">
        <h1 className="about-title">{title}</h1>

        <Section section={data}>
          <dl className="about-facts">
            {data.facts.map((fact) => (
              <div className="about-fact" key={fact.term}>
                <dt>{fact.term}</dt>
                <dd>{fact.text}</dd>
              </div>
            ))}
          </dl>
          <h3 className="about-subheading">{data.hintTitle}</h3>
          {paragraphs(data.hintText)}
        </Section>

        <Section section={rules}>
          <p>{rules.summary}</p>
          <div className="about-link">
            <button
              type="button"
              className="button button-secondary"
              aria-haspopup="dialog"
              onClick={() => openPanel('help')}
            >
              {rules.readHelp}
            </button>
            <a className="button button-primary" href={PAGES.game[lang]}>{rules.play}</a>
          </div>
        </Section>

        <Section section={report}>
          <p>{report.text}</p>
          <p className="about-link">
            <a className="button button-secondary" href={report.href}>{report.link}</a>
          </p>
        </Section>

        <Section section={privacy}>
          {paragraphs(privacy.text)}
        </Section>
      </div>
    </main>
  );
}

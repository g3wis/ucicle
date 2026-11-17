import React from 'react';
import Panel from '../../components/Panel';
import Countdown from '../../components/Countdown';
import { useApp } from '../../app/context';
import { PAGES } from '../../app/nav';
import { help } from '../../content/help';
import ExampleBib from './ExampleBib';
import BibLines from './BibLines';

/**
 * Opened by the header's Help button and by the About page's "Lire l'aide" (#help). For a
 * newcomer arriving from a shared result and for a player who forgot: what the game is, how a try
 * works, one bib to read, the next start, then, on the game page, a way back to the board.
 */
export default function HelpPanel() {
  const {
    lang, page, content, panel, closePanel,
  } = useApp();
  const c = help[lang];
  return (
    <Panel open={panel === 'help'} title={c.title} onClose={closePanel} className="help-panel">
      <div className="help">
        <p className="help-lead">{c.lead}</p>
        <div className="help-section">
          <h3 className="help-heading">{c.tryTitle}</h3>
          <p>{c.tryText(content.game.validate)}</p>
          <p>{c.mysteryText}</p>
        </div>
        <div className="help-section">
          <h3 className="help-heading">{c.bibTitle}</h3>
          <ExampleBib label={c.exampleLabel} caption={c.exampleCaption} />
          <BibLines lines={c.bibLines} />
        </div>
        <div className="help-section">
          <h3 className="help-heading">{c.startTitle}</h3>
          <p>{c.startText}</p>
          <Countdown />
        </div>
        {page === 'game' && (
          <p className="help-play">
            <button type="button" className="button button-primary" onClick={closePanel}>{c.play}</button>
          </p>
        )}
        {page !== 'about' && (
          <p className="help-more">
            <a className="text-link" href={PAGES.about[lang]}>{c.aboutLink}</a>
          </p>
        )}
      </div>
    </Panel>
  );
}

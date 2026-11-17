import React, { useEffect } from 'react';
import { BestResult } from '../types/CyclingTypes';
import { Knowledge } from '../game/knowledge';
import { bandFacts } from '../game/facts';
import { useApp } from '../app/context';
import { isPhone } from '../app/media';
import useOutOfView from './useOutOfView';
import Icon from './Icon';

/**
 * The element the band stands in for: the hint and the ruled line printed on the mystery bib's
 * front (components/MysteryBib). The band shows while it is not wholly in view below the header.
 */
export const MYSTERY_FACTS = '.mystery-front .mystery-facts';

/**
 * html class while the band shows: scroll-padding-top grows by the band's height
 * (--facts-band-height, _base.scss), so no scroll ever stops under it.
 */
export const BAND_SHOWN_CLASS = 'has-facts-band';

type Props = {
  knowledge: Knowledge,
  /** The mystery rider's best result: the band's first line. */
  hint: BestResult,
};

/**
 * Below 1024 px, the band fixed under the sticky header: the hint, then what the tries proved,
 * while the mystery bib's facts are out of view. A copy, so hidden from assistive tech (the bib
 * is the accessible one). Opacity only; never covers the active field (scroll-padding and the
 * picking lift count its height). Renders nothing until a try has taught something.
 */
export default function FactsBand({ knowledge, hint }: Props) {
  const { lang, content } = useApp();
  const g = content.game;
  const facts = bandFacts(knowledge, lang, content);
  const known = facts.length > 0;
  const outOfView = useOutOfView(MYSTERY_FACTS, known, knowledge);
  const shown = known && outOfView;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(BAND_SHOWN_CLASS, shown && isPhone());
    return () => root.classList.remove(BAND_SHOWN_CLASS);
  }, [shown]);

  if (!known) return null;
  return (
    <div className="facts-band" aria-hidden="true" data-shown={shown || undefined}>
      <div className="facts-band-inner">
        <p className="facts-band-hint">
          {hint.recurrence > 1 && <span className="facts-band-recurrence">{g.hint.recurrence(hint.recurrence)}</span>}
          <span className="facts-band-result">{g.hint.result(hint.rank, hint.raceType)}</span>
          {' '}
          <span className="facts-band-race">{hint.race}</span>
        </p>
        <ul className="facts-band-facts">
          {facts.map((fact) => (
            <li key={fact.key} className={`facts-band-fact facts-band-${fact.key}`} data-kind={fact.kind}>
              {fact.kind === 'exact' && <Icon name="check" className="facts-band-icon" />}
              <span className="facts-band-text">{fact.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

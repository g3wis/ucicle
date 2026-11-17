import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Knowledge } from '../game/knowledge';
import { Fact, LINE_KEYS, lineFacts } from '../game/facts';
import { useApp } from '../app/context';
import Icon from './Icon';
import { DURATION, EASE_OUT } from '../motion/tokens';

/** A fact's state on the ruled line, in the guess bibs' cell grammar (components/_cells.scss). */
const STATE: Record<Fact['kind'], string> = { exact: 'eq', range: 'plain', excluded: 'no' };

type Props = {
  knowledge: Knowledge,
  /** Delay before the newest facts appear on the bib (after the new bib's cells). */
  delay: number,
};

/**
 * What the tries proved, printed on the mystery bib as the guess bibs' ruled line: age, height,
 * weight, country. A column stays empty until a try teaches something; bounds in ink, the
 * countries ruled out in secondary ink, a value proved exact as a blue block with its check.
 * The phone copy is the band fixed under the header (components/FactsBand).
 */
export default function KnownStrip({ knowledge, delay }: Props) {
  const { lang, content } = useApp();
  const reduce = useReducedMotion();
  const facts = lineFacts(knowledge, lang, content);
  if (facts.every((fact) => fact === null)) return null;
  const g = content.game;

  return (
    <ul className="cells known" aria-label={g.known.label}>
      {facts.map((fact, i) => (fact ? (
        <motion.li
          key={`${fact.key}-${fact.text}`}
          className={`cell known-cell known-${fact.key}`}
          data-state={STATE[fact.kind]}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? DURATION.reduced : DURATION.base, delay, ease: EASE_OUT }}
        >
          <span className="sr-only">{`${g.attributes[fact.key]} `}</span>
          <span className="cell-value known-value">{fact.text}</span>
          {fact.kind === 'exact' && <Icon name="check" className="cell-icon" />}
        </motion.li>
      ) : (
        <li key={LINE_KEYS[i]} className={`cell known-cell known-${LINE_KEYS[i]}`} aria-hidden="true" />
      )))}
    </ul>
  );
}

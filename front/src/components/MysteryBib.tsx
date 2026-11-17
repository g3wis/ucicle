import React, {
  ReactNode, useEffect, useId, useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Rider } from '../types/CyclingTypes';
import { Knowledge } from '../game/knowledge';
import { cellsFor } from '../game/cells';
import { MAX_TRIES } from '../game/compare';
import { provenTeam } from '../game/facts';
import { useApp } from '../app/context';
import { formatBandDate } from '../i18n/format';
import { stageNumber } from '../game/stage';
import Cell from './Cell';
import Icon from './Icon';
import KnownStrip from './KnownStrip';
import Pins from './Pin';
import { DURATION, EASE_OUT } from '../motion/tokens';

/** How the stage ended: the turned bib's number (D9). */
export type MysteryOutcome = { found: boolean, tries: number };

type Props = {
  date: string,
  mystery: Rider,
  knowledge: Knowledge,
  /** The game is over: the bib is turned over and shows the rider. */
  revealed: boolean,
  /** It turned over during this visit (not restored from storage): animate the flip. */
  animateReveal: boolean,
  /** Delay before the known strip's newest chips appear (after the new bib's cells). */
  knownDelay: number,
  /** Seconds before the flip starts (it waits for the last bib's cells and the scroll). */
  flipDelay?: number,
  /**
   * The end of the stage, printed on the turned bib's numeral column: on a win a blue column with
   * the tries in white and a blue team band (D14), and the four values drop (the winning bib
   * prints them, all blue); on a loss a red column with an X, the ink band and the values.
   * Without it the turned bib shows no score.
   */
  outcome?: MysteryOutcome,
};

/**
 * The mystery bib: number hidden, best result printed on it, and what the tries proved written
 * onto it as the guess bibs' ruled line, the team on a blue foot band once proved. At the end it
 * turns over, once, and shows the rider with the score as its number. It takes the height of the
 * face that shows: both faces share one grid cell only during the turn.
 */
export default function MysteryBib({
  date, mystery, knowledge, revealed, animateReveal, knownDelay, flipDelay = 0, outcome,
}: Props) {
  const { lang, content } = useApp();
  const reduce = useReducedMotion();
  const titleId = useId();
  const [turned, setTurned] = useState(false);
  // Reduced motion: the cross-fade that stands in for the flip waits for the same moment as the
  // flip (after the last bib and the scroll), so the story keeps its order.
  const [backDue, setBackDue] = useState(false);
  useEffect(() => {
    if (!reduce || !revealed || !animateReveal) return undefined;
    const timer = window.setTimeout(() => setBackDue(true), flipDelay * 1000);
    return () => window.clearTimeout(timer);
  }, [reduce, revealed, animateReveal, flipDelay]);

  const g = content.game;
  const band = g.band(stageNumber(date), formatBandDate(date, lang));
  const best = mystery.bestResult;

  const hint = (
    <div className="mystery-hint">
      <p className="sr-only">{g.hint.label}</p>
      <p className="hint-result">
        {best.recurrence > 1 && <span className="hint-recurrence">{g.hint.recurrence(best.recurrence)}</span>}
        {g.hint.result(best.rank, best.raceType)}
      </p>
      <p className="hint-race">{best.race}</p>
      <p className="hint-years">{g.hint.years(best.years)}</p>
    </div>
  );

  // The team, once proved: the full blue foot band with its check. The team is the proved fact
  // here; a guess bib's same team is only a check tile on its ink band (D23).
  const team = provenTeam(knowledge);
  const front = (
    <div className="bib mystery-face mystery-front" aria-hidden={revealed} data-team={team ? 'eq' : undefined}>
      <Pins set="mystery" />
      <p className="bib-band">{band}</p>
      <p className="mystery-number" aria-hidden="true">?</p>
      {/* The facts the band under the header stands in for (components/FactsBand). */}
      <div className="mystery-facts">
        {hint}
        <KnownStrip knowledge={knowledge} delay={knownDelay} />
      </div>
      {team && (
        <motion.p
          className="bib-foot"
          data-state="eq"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? DURATION.reduced : DURATION.base, delay: knownDelay, ease: EASE_OUT }}
        >
          <Icon name="check" className="bib-foot-icon" />
          <span className="sr-only">{`${g.attributes.team} `}</span>
          <span className="bib-foot-team">{team}</span>
        </motion.p>
      )}
    </div>
  );

  // On a win the winning bib already prints the four values, all blue: the turned bib drops them.
  const showValues = !outcome || !outcome.found;
  let result: 'found' | 'missed' | undefined;
  if (outcome) result = outcome.found ? 'found' : 'missed';
  // A win is as loud as a loss, in the colour of "same" (D14): the found rider is the mystery
  // rider, so the foot band is the same-team band (blue, check). A loss keeps the ink band.
  const won = result === 'found';
  const back = (
    <div className="bib mystery-face mystery-back" aria-hidden={!revealed} data-result={result}>
      <Pins set="mystery" />
      <p className="bib-band">{band}</p>
      <div className="mystery-back-body">
        {outcome && (
          // Visual only: the result heading under the bib says "Trouvé en 3." / "Raté.".
          <div className="bib-number mystery-score" aria-hidden="true">
            <span className="mystery-score-figure">
              {outcome.found ? outcome.tries : g.verdict.missedMark}
              <span className="mystery-score-max">{`/${MAX_TRIES}`}</span>
            </span>
          </div>
        )}
        <div className="mystery-back-main">
          <p className="mystery-name">{mystery.name}</p>
          {showValues && (
            <ul className="cells">
              {cellsFor(mystery, null, lang, content).map((cell) => (
                <Cell key={cell.key} cell={cell} delay={null} reduce={reduce} />
              ))}
            </ul>
          )}
          {hint}
        </div>
      </div>
      <p className="bib-foot" data-state={won ? 'eq' : undefined}>
        {won && <Icon name="check" className="bib-foot-icon" />}
        <span className="sr-only">{`${g.attributes.team} `}</span>
        <span className="bib-foot-team">{mystery.team}</span>
      </p>
    </div>
  );

  const shell = (children: ReactNode) => (
    <section className="mystery" aria-labelledby={titleId}>
      <h2 className="sr-only" id={titleId}>{g.mysteryLabel}</h2>
      {children}
    </section>
  );

  // Reduced motion: no flip, the faces cross-fade once flipDelay has passed. A stage restored
  // from storage shows the back at once.
  const showBack = revealed && (!animateReveal || backDue);
  if (reduce) {
    return shell(
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={showBack ? 'back' : 'front'}
          className="mystery-still"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.reduced }}
        >
          {showBack ? back : front}
        </motion.div>
      </AnimatePresence>,
    );
  }

  if (!revealed) return shell(<div className="mystery-still">{front}</div>);

  // Restored from storage, or the turn is over: only the face that shows, at its own height.
  if (!animateReveal || turned) return shell(<div className="mystery-still">{back}</div>);

  // The single flip of this visit.
  return shell(
    <motion.div
      className="mystery-card"
      initial={{ rotateY: 0 }}
      animate={{ rotateY: 180 }}
      transition={{ duration: DURATION.flip, ease: EASE_OUT, delay: flipDelay }}
      onAnimationComplete={() => setTurned(true)}
    >
      {front}
      {back}
    </motion.div>,
  );
}

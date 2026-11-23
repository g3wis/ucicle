import React, {
  useEffect, useRef, useState,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Rider } from '../types/CyclingTypes';
import useGame from '../game/useGame';
import { MAX_TRIES } from '../game/compare';
import { guessSentence } from '../game/cells';
import { shareText } from '../game/share';
import { stageNumber } from '../game/stage';
import { useApp } from './context';
import { isPhone } from './media';
import MysteryBib from '../components/MysteryBib';
import GuessBib from '../components/GuessBib';
import FactsBand from '../components/FactsBand';
import RiderCombobox from '../components/RiderCombobox';
import ShareButton from '../components/ShareButton';
import Countdown from '../components/Countdown';
import {
  CELLS_DELAY, DURATION, EASE_OUT, STAGGER,
} from '../motion/tokens';

/** The next slot opens when the new bib's pins land (after its four cells have stamped). */
const SLOT_OPEN_DELAY = CELLS_DELAY + 4 * STAGGER.cells + 0.06;

/** The signature surface: the mystery bib, the board of pinned bibs, the end of the stage. */
export default function GamePage() {
  const {
    lang, content, announce, panel, setGameDate,
  } = useApp();
  const g = content.game;
  const game = useGame();
  const reduce = useReducedMotion();
  const [played, setPlayed] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const finished = game.status === 'won' || game.status === 'lost';
  const playedThisVisit = played > 0;

  // The end of a stage played now: the last bib's cells stamp, the phone scrolls to the mystery
  // bib, the bib turns over, then the verdict, Partager and the countdown fade in.
  const phone = isPhone();
  const landed = reduce ? DURATION.reduced : CELLS_DELAY + 4 * STAGGER.cells + DURATION.fast;
  const scrollTime = phone && !reduce ? 0.45 : 0;
  const flipDelay = playedThisVisit ? landed + scrollTime : 0;
  const flipTime = reduce ? DURATION.reduced : DURATION.flip;
  const resultVisible = finished && (!playedThisVisit || showResult);

  useEffect(() => {
    if (!finished || !playedThisVisit) return undefined;
    const t1 = window.setTimeout(() => {
      setShowResult(true);
      if (!isPhone()) return;
      const behavior = reduce ? 'auto' : 'smooth';
      document.querySelector('.game-mystery')?.scrollIntoView({ block: 'start', behavior });
    }, landed * 1000);
    const focusTitle = () => resultTitle.current?.focus({ preventScroll: true });
    const t2 = window.setTimeout(focusTitle, (flipDelay + flipTime) * 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [finished, playedThisVisit]);

  // After a try played now, still in play, on a phone: once the next slot has opened, scroll the
  // least that brings the whole of it into view (the field stays in reach). Never on page load:
  // the first screen leads with the mystery bib. scroll-padding-top counts the header and the band.
  useEffect(() => {
    if (!played || game.status !== 'playing' || !isPhone()) return undefined;
    const wait = reduce ? 0 : SLOT_OPEN_DELAY + DURATION.base;
    const timer = window.setTimeout(() => {
      const slot = document.querySelector('.bib-slot.is-active');
      // The player already typed: the picking lift has placed the slot, leave it there.
      if (!slot || slot.querySelector('input')?.value) return;
      slot.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }, wait * 1000);
    return () => window.clearTimeout(timer);
  }, [played]);

  // Hands on the keyboard: a letter typed with nothing focused lands in the rider field.
  useEffect(() => {
    if (game.status !== 'playing' || panel) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1 || event.key === ' ') return;
      const focused = document.activeElement;
      if (focused && focused !== document.body) return;
      document.querySelector<HTMLInputElement>('.bib-slot.is-active input')?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [game.status, panel]);

  // The Stats panel reads the game's own date, not the device clock.
  useEffect(() => {
    if (game.session) setGameDate(game.session.date);
  }, [game.session, setGameDate]);

  if (game.status === 'loading') {
    return <main id="main" className="game game-wait"><p className="game-status">{g.loading}</p></main>;
  }
  if (game.status === 'error' || !game.session || !game.knowledge) {
    return (
      <main id="main" className="game game-wait">
        <p className="game-status" role="alert">{g.loadError}</p>
        <button type="button" className="button button-secondary" onClick={game.retry}>{g.retry}</button>
      </main>
    );
  }

  const { session, guesses, comparisons } = game;
  const mystery = session.rider;
  const tries = guesses.length;
  const next = tries + 1;
  const stage = stageNumber(session.date);
  const newBib = playedThisVisit ? tries - 1 : -1;

  const onSubmit = (rider: Rider) => {
    const comparison = game.submit(rider);
    if (!comparison) return;
    setPlayed((p) => p + 1);
    let sentence = guessSentence(tries + 1, rider, comparison, lang, content);
    if (comparison.found) sentence += ` ${g.found(tries + 1)}`;
    else if (tries + 1 >= MAX_TRIES) sentence += ` ${g.missed(mystery.name)}`;
    announce(sentence);
  };

  const won = game.status === 'won';
  const headline = g.shareHeadline(stage, won ? tries : null, MAX_TRIES);
  const tryLabel = next === MAX_TRIES ? g.lastTry : g.tryLabel(next, MAX_TRIES);
  const knownDelay = playedThisVisit ? CELLS_DELAY + 4 * STAGGER.cells + 0.1 : 0;
  const slotDelay = playedThisVisit && !reduce ? SLOT_OPEN_DELAY : 0;

  return (
    <main id="main" className="game">
      <h1 className="sr-only">{g.title}</h1>
      {/* Phones: the hint and the proved facts under the header while the bib's facts are out of view. */}
      {game.status === 'playing' && <FactsBand knowledge={game.knowledge} hint={mystery.bestResult} />}
      <div className="game-grid">
        <div className="game-mystery">
          <MysteryBib
            date={session.date}
            mystery={mystery}
            knowledge={game.knowledge}
            revealed={finished}
            animateReveal={playedThisVisit}
            knownDelay={knownDelay}
            flipDelay={flipDelay}
            outcome={finished ? { found: won, tries } : undefined}
          />
          {resultVisible && (
            <motion.section
              className="result"
              aria-label={g.resultLabel}
              initial={playedThisVisit ? { opacity: 0, y: reduce ? 0 : 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduce ? DURATION.reduced : DURATION.base,
                ease: EASE_OUT,
                delay: playedThisVisit ? flipDelay + flipTime - landed : 0,
              }}
            >
              {/* The score is the turned bib's number: the heading keeps the sentence, for screen readers. */}
              <h2 className="result-title sr-only" ref={resultTitle} tabIndex={-1}>
                {won ? g.found(tries) : g.missedTitle}
              </h2>
              <ShareButton text={shareText(headline, comparisons, g.shareUrl)} />
              <Countdown />
              {/* After the reveal only: the rider's index page (the name is already on the turned bib). */}
              <a className="text-link result-rider" href={`/api/fiche/?nom=${encodeURIComponent(mystery.name)}&lang=${lang}`}>
                {g.riderLink}
              </a>
            </motion.section>
          )}
        </div>
        <div className="game-board">
          <h2 className="sr-only" id="board-title">{g.boardTitle}</h2>
          <ol className="board" aria-labelledby="board-title">
            {guesses.map((rider, i) => (
              <GuessBib key={rider.name} n={i + 1} rider={rider} comparison={comparisons[i]} isNew={i === newBib} />
            ))}
            {game.status === 'playing' && (
              <motion.li
                key={`active-${next}`}
                className={`bib-slot is-active${next === MAX_TRIES ? ' bib-red' : ''}`}
                initial={playedThisVisit ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: reduce ? DURATION.reduced : DURATION.base, ease: EASE_OUT, delay: slotDelay }}
              >
                <span className="bib-number" aria-hidden="true">{next}</span>
                <div className="slot-body">
                  <RiderCombobox
                    key={next}
                    riders={game.riders}
                    played={guesses.map((r) => r.name)}
                    label={tryLabel}
                    onSubmit={onSubmit}
                    focusOnMount={playedThisVisit}
                  />
                  {game.firstVisit && tries === 0 && <p className="first-help">{g.firstHelp}</p>}
                </div>
              </motion.li>
            )}
            {game.status === 'playing' && Array.from({ length: MAX_TRIES - next }, (_, k) => next + k + 1).map((n) => (
              <motion.li
                key={n}
                className={`bib-slot${n === MAX_TRIES ? ' bib-red' : ''}`}
                aria-hidden="true"
                layout="position"
                transition={{ duration: DURATION.base, ease: EASE_OUT }}
              >
                <span className="bib-number">{n}</span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}

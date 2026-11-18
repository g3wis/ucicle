import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Rider } from '../types/CyclingTypes';
import { Comparison, MAX_TRIES } from '../game/compare';
import { cellsFor } from '../game/cells';
import { useApp } from '../app/context';
import Cell from './Cell';
import Icon from './Icon';
import Pins from './Pin';
import {
  CELLS_DELAY, DURATION, SPRING, STAGGER,
} from '../motion/tokens';

type Props = {
  n: number,
  rider: Rider,
  comparison: Comparison,
  /** A try just played: the bib drops, its cells stamp in, its pins land. */
  isNew: boolean,
  /** Rendered as a plain div (an example in the help, a history row) instead of a list item. */
  as?: 'li' | 'div',
};

/**
 * A pinned bib for one try: the try number in bib numerals, the rider, four cells,
 * the team on the ink foot band (a blue check tile before it when it is the mystery rider's).
 * Bib 5 is the red bib.
 */
export default function GuessBib({
  n, rider, comparison, isNew, as = 'li',
}: Props) {
  const { lang, content } = useApp();
  const reduce = useReducedMotion();
  const cells = cellsFor(rider, comparison, lang, content);
  const { team } = comparison;
  const pinsDelay = CELLS_DELAY + cells.length * STAGGER.cells + 0.06;
  const Tag = as === 'li' ? motion.li : motion.div;
  let transition = {};
  if (isNew) transition = reduce ? { duration: DURATION.reduced } : { y: SPRING, opacity: { duration: DURATION.fast } };
  return (
    <Tag
      className={`bib guess-bib${n === MAX_TRIES ? ' bib-red' : ''}`}
      data-team={team}
      initial={isNew ? { opacity: 0, y: reduce ? 0 : -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      <Pins set={n} land={isNew} delay={pinsDelay} stagger={STAGGER.pins} reduce={reduce} />
      <span className="bib-number" aria-hidden="true">{n}</span>
      <div className="bib-body">
        <p className="guess-name">
          <span className="sr-only">{content.game.bibLabel(n, '')}</span>
          {rider.name}
        </p>
        <ul className="cells">
          {cells.map((cell, i) => (
            <Cell key={cell.key} cell={cell} reduce={reduce} delay={isNew ? CELLS_DELAY + i * STAGGER.cells : null} />
          ))}
        </ul>
      </div>
      {/* The band stays ink: a same team is a blue check tile before the name (D23). */}
      <p className="bib-foot">
        {team === 'eq' && (
          <span className="bib-foot-tile">
            <Icon name="check" className="bib-foot-icon" />
          </span>
        )}
        <span className="sr-only">{`${content.game.attributes.team} `}</span>
        <span className="bib-foot-team">{rider.team ?? content.game.noTeam}</span>
        <span className="sr-only">{`, ${content.game.same.team[team]}`}</span>
      </p>
    </Tag>
  );
}

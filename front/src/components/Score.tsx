import React from 'react';
import { useApp } from '../app/context';

type Props = {
  /** Tries taken on a found stage; null on a missed one (printed X). */
  tries: number | null,
  max: number,
};

/**
 * The score of a stage set as a bib numeral: "3/5", the "/5" at 40 %; "X/5" with a red X on a
 * missed stage (a win is never red, so the two differ at a glance). Visual only: the row that
 * holds it carries the sentence for screen readers.
 */
export default function Score({ tries, max }: Props) {
  const { content } = useApp();
  const missed = tries === null;
  return (
    <span className="score" data-result={missed ? 'missed' : 'found'} aria-hidden="true">
      <span className="score-figure">
        <span className="score-tries">
          {missed ? content.game.verdict.missedMark : tries}
        </span>
        <span className="score-max">{`/${max}`}</span>
      </span>
    </span>
  );
}

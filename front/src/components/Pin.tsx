import React from 'react';
import { motion } from 'motion/react';
import { DURATION } from '../motion/tokens';

export type PinCorner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: PinCorner[] = ['tl', 'tr', 'bl', 'br'];

/** The bib a set of pins fastens: a guess bib by its try number (1 to 5), or the mystery bib. */
export type PinSet = number | 'mystery';

/** One pin as it was pinned by hand: its angle (deg) and its offset from the corner (px, ±2). */
type Placement = [rotate: number, x: number, y: number];

/**
 * Each bib was pinned by hand, so each has its own four angles and offsets. Fixed: never
 * animated, never tied to hover. Read by the .pin-wrap rules (components/_bib.scss) through
 * --pin-<corner>-rotate, --pin-<corner>-x and --pin-<corner>-y.
 */
const SETS: Record<string, Record<PinCorner, Placement>> = {
  1: {
    tl: [-18, 1, -1], tr: [9, -1, 1], bl: [6, 2, 0], br: [-9, 0, -1],
  },
  2: {
    tl: [-8, 0, 1], tr: [15, 2, -1], bl: [12, -1, -1], br: [-15, 1, 2],
  },
  3: {
    tl: [-13, 2, 0], tr: [6, 0, 2], bl: [15, 1, 1], br: [-7, -2, 0],
  },
  4: {
    tl: [-5, -1, 2], tr: [13, 1, 0], bl: [8, 0, -2], br: [-13, 2, 1],
  },
  5: {
    tl: [-11, 1, 1], tr: [10, -2, 0], bl: [11, 2, -1], br: [-10, 0, 2],
  },
  mystery: {
    tl: [-14, 0, 1], tr: [12, -1, 0], bl: [10, 1, -1], br: [-12, 0, 0],
  },
};

function placementStyle(set: PinSet, corner: PinCorner): React.CSSProperties {
  const [rotate, x, y] = (SETS[set] ?? SETS.mystery)[corner];
  return {
    [`--pin-${corner}-rotate`]: `${rotate}deg`,
    [`--pin-${corner}-x`]: `${x}px`,
    [`--pin-${corner}-y`]: `${y}px`,
  } as React.CSSProperties;
}

/**
 * A safety pin seen from above, 30 x 11: the hole it punched in the Tyvek under the coil, the
 * wire coil, the two shafts converging, the clasp hood over the point. It fastens a bib, nothing
 * else (never a summary card, a panel or a stat block).
 */
function PinShape() {
  return (
    <svg className="pin" viewBox="0 0 30 11" aria-hidden="true" focusable="false">
      <circle className="pin-hole" cx="5" cy="5.5" r="2" />
      <circle className="pin-wire" cx="5" cy="5.5" r="3.4" />
      <path className="pin-wire" d="M7.6 3.3L22.4 4.5M7.6 7.7L22.4 6.5" />
      <path className="pin-hood" d="M21.4 3.7Q21.4 2.6 22.5 2.6H26.3A2.9 2.9 0 0 1 26.3 8.4H22.5Q21.4 8.4 21.4 7.3Z" />
    </svg>
  );
}

type PinsProps = {
  /** Which bib these pins fasten: its own hand-pinned set (D12). */
  set?: PinSet,
  /** Animate the pins landing after the bib (a new try); false when the bib was already there. */
  land?: boolean,
  delay?: number,
  stagger?: number,
  reduce?: boolean | null,
};

/** The four pins of a bib, one per corner. */
export default function Pins({
  set = 'mystery', land = false, delay = 0, stagger = 0.04, reduce = false,
}: PinsProps) {
  return (
    <>
      {CORNERS.map((c, i) => (land && !reduce ? (
        <motion.span
          key={c}
          className={`pin-wrap pin-wrap-${c}`}
          style={placementStyle(set, c)}
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.fast, delay: delay + i * stagger, ease: 'easeOut' }}
        >
          <PinShape />
        </motion.span>
      ) : (
        <span key={c} className={`pin-wrap pin-wrap-${c}`} style={placementStyle(set, c)} aria-hidden="true">
          <PinShape />
        </span>
      )))}
    </>
  );
}

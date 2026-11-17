import React from 'react';
import { motion } from 'motion/react';
import Icon, { IconName } from './Icon';
import type { CellModel } from '../game/cells';
import { DURATION } from '../motion/tokens';

const ICONS: Partial<Record<CellModel['state'], IconName>> = { up: 'up', down: 'down', eq: 'check' };

type Props = {
  cell: CellModel,
  /** Seconds before this cell stamps in; null when it is already on the board. */
  delay: number | null,
  reduce: boolean | null,
};

/** One value of a bib: fill, icon and text say the same thing three ways. */
export default function Cell({ cell, delay, reduce }: Props) {
  const icon = ICONS[cell.state];
  const animated = delay !== null && !reduce;
  return (
    <motion.li
      className={`cell cell-${cell.key}`}
      data-state={cell.state}
      initial={animated ? { opacity: 0, scale: 0.96 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DURATION.fast, delay: delay ?? 0, ease: 'easeOut' }}
    >
      <span className="cell-value" aria-hidden="true">{cell.value}</span>
      {icon && <Icon name={icon} className="cell-icon" />}
      <span className="sr-only">{cell.spoken}</span>
    </motion.li>
  );
}

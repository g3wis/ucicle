import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Icon from './Icon';
import { useApp } from '../app/context';
import { shareResult, ShareOutcome } from '../game/share';
import { DURATION } from '../motion/tokens';

/** The main call to action once the game is over. Its label tells what just happened. */
export default function ShareButton({ text }: { text: string }) {
  const { content, announce } = useApp();
  const reduce = useReducedMotion();
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  useEffect(() => {
    if (!outcome || outcome === 'cancelled') return undefined;
    const timer = window.setTimeout(() => setOutcome(null), 2600);
    return () => window.clearTimeout(timer);
  }, [outcome]);

  const labels: Record<ShareOutcome, string> = {
    shared: content.game.shared,
    copied: content.game.copied,
    failed: content.game.shareFailed,
    cancelled: content.game.share,
  };
  const label = outcome ? labels[outcome] : content.game.share;

  return (
    <button
      type="button"
      className="button button-primary share"
      data-outcome={outcome ?? undefined}
      onClick={async () => {
        const result = await shareResult(text);
        setOutcome(result);
        if (result !== 'cancelled') announce(labels[result]);
      }}
    >
      <Icon name={outcome === 'copied' || outcome === 'shared' ? 'check' : 'share'} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? DURATION.reduced : DURATION.fast }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

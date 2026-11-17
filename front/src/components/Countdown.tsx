import React, { useEffect, useState } from 'react';
import { msUntilNextStart } from '../game/stage';
import { formatClock } from '../i18n/format';
import { useApp } from '../app/context';

/** Time to the next 05:00 UTC, the hour the next mystery rider is published. */
export default function Countdown() {
  const { content } = useApp();
  const [left, setLeft] = useState(() => msUntilNextStart());
  const [start] = useState(() => Date.now() + msUntilNextStart());

  useEffect(() => {
    const timer = window.setInterval(() => setLeft(Math.max(0, start - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [start]);

  if (left <= 0) {
    return (
      <p className="next-start">
        {content.game.newStart}
        {' '}
        <a className="text-link" href={window.location.pathname}>{content.game.reload}</a>
      </p>
    );
  }
  return (
    <p className="next-start">
      {content.game.nextStart}
      {' '}
      <time className="next-start-clock" dateTime={new Date(start).toISOString()}>{formatClock(left)}</time>
    </p>
  );
}

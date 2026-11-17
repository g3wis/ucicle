import React from 'react';
import GuessBib from '../../components/GuessBib';
import { EXAMPLE_COMPARISON, EXAMPLE_RIDER, EXAMPLE_TRY } from '../../content/help';

type Props = {
  /** Accessible name of the figure, when it has no visible caption. */
  label: string,
  /** A visible caption that reads the example; it then names the figure. */
  caption?: string,
};

/**
 * The example bib of the Help panel (the About page sends here for it, D18): one real rider, a
 * hand-built comparison showing every state once. Shown, not described: the shared GuessBib,
 * already pinned. The caption comes first, so the "made up" mark is read before the bib.
 */
export default function ExampleBib({ label, caption }: Props) {
  return (
    <figure className="example-bib" aria-label={caption ? undefined : label}>
      {caption && <figcaption className="example-caption">{caption}</figcaption>}
      <GuessBib as="div" n={EXAMPLE_TRY} rider={EXAMPLE_RIDER} comparison={EXAMPLE_COMPARISON} isNew={false} />
    </figure>
  );
}

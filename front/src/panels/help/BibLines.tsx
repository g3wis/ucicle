import React from 'react';
import type { BibLine } from '../../content/help';

/** The few lines that name what a newcomer cannot guess from the example bib. */
export default function BibLines({ lines }: { lines: BibLine[] }) {
  return (
    <ul className="bib-lines">
      {lines.map((line) => (
        <li key={line.term}>
          <strong>{line.term}</strong>
          {line.text}
        </li>
      ))}
    </ul>
  );
}

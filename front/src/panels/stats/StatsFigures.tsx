import React from 'react';
import { useApp } from '../../app/context';
import { stats } from '../../content/stats';
import type { Stats } from '../../game/stats';
import { bandDate } from './dates';

type Props = {
  figures: Stats,
  /** The first finished stage this browser kept (YYYYMMDD). */
  since: string,
};

type Figure = { key: string, label: string, value: number | null, unit?: string };

/**
 * The player's summary: a Tyvek card, the first stage kept on its top band, four figures in
 * bib numerals, each with its label under it. A summary is not a bib, so it carries no pins.
 */
export default function StatsFigures({ figures, since }: Props) {
  const { lang } = useApp();
  const c = stats[lang];
  const items: Figure[] = [
    { key: 'played', label: c.figures.played, value: figures.played },
    {
      key: 'rate', label: c.figures.winRate, value: figures.winRate, unit: c.percent,
    },
    { key: 'current', label: c.figures.currentStreak, value: figures.currentStreak },
    { key: 'best', label: c.figures.bestStreak, value: figures.bestStreak },
  ];
  return (
    <div className="bib stats-card">
      <p className="bib-band">{c.since(bandDate(since, lang))}</p>
      <dl className="stats-figures">
        {items.map((item) => (
          <div key={item.key} className="stats-figure">
            <dt className="stats-figure-label">{item.label}</dt>
            <dd className="stats-figure-value">
              {item.value === null ? (
                <>
                  <span aria-hidden="true">–</span>
                  <span className="sr-only">{c.figures.noRate}</span>
                </>
              ) : (
                <>
                  {item.value}
                  {item.unit && <span className="stats-figure-unit">{item.unit}</span>}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

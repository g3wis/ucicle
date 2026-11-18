import { rider as copy } from '../../content/rider';
import { formatDecimal, formatOrdinal } from '../../i18n/format';
import { competitionName } from '../../i18n/races';
import type { Lang } from '../../i18n/language';
import type { RiderResultRow } from './load';

/**
 * How a result row is told, shared by the bib's aside (RiderView) and the results lines
 * (ResultItem): the race's name, the place, and the figures of the calculation line.
 */
export function resultText(lang: Lang, kBase: number | null, topN: Record<string, number>) {
  const c = copy[lang];
  const fmt1 = (n: number) => formatDecimal(n, lang, 1);
  // A weight prints with one decimal ("0,5") or two when it needs them ("0,35").
  const fmtW = (n: number) => formatDecimal(n, lang, (n * 100) % 10 === 0 ? 1 : 2);

  /** The competition in the reader's language: championships are named from their class (races.ts). */
  const competition = (r: RiderResultRow): string => competitionName(lang, r.classCode, r.competition, r.country);

  const raceName = (r: RiderResultRow): string => {
    const { kind } = r;
    const name = competition(r);
    if (kind === 'stage' || kind === 'prologue') return `${name}, ${c.results.stage(r.stageNumber, r.stageLabel)}`;
    if (kind === 'gc_final') return `${name}, ${c.results.kind.gc_final}`;
    if (kind.startsWith('championship') || kind.startsWith('olympic') || kind === 'one_day_itt') {
      return `${name}, ${c.results.kind[kind]}`;
    }
    return name;
  };

  /** Inside a race group (decision E1): the line without the race's name, "Étape 7", "Classement général". */
  const shortName = (r: RiderResultRow): string => {
    const { kind } = r;
    const cap = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    if (kind === 'stage' || kind === 'prologue') return cap(c.results.stage(r.stageNumber, r.stageLabel));
    if (kind === 'one_day') return raceName(r);
    return cap(c.results.kind[kind]);
  };

  const placeText = (r: RiderResultRow): string => {
    if (r.status === 'FIN' && r.rank) {
      const rank = formatOrdinal(r.rank, lang);
      return r.finishers ? c.results.place(rank, r.finishers) : rank;
    }
    return c.results.status[r.status] ?? r.status;
  };

  /**
   * "80 × 1,0 × 0,35": K before the weights, then each weight (the stored K when one is missing).
   * A .2 race multiplies K once more (parameters.lower_levels): that factor is read from the stored
   * K, so the line always multiplies out to the K the calculation used ("80 × 0,4 × 1,0 × 2,5").
   */
  const kText = (r: RiderResultRow): string => {
    if (r.calc && kBase !== null && r.calc.wClass !== null && r.calc.wType !== null) {
      const product = kBase * r.calc.wClass * r.calc.wType;
      const factor = product > 0 ? r.calc.k / product : 1;
      const extra = Math.abs(factor - 1) > 1e-6 ? ` × ${fmtW(Math.round(factor * 100) / 100)}` : '';
      return `${kBase} × ${fmtW(r.calc.wClass)} × ${fmtW(r.calc.wType)}${extra}`;
    }
    return fmt1(r.calc?.k ?? 0);
  };

  const topOf = (r: RiderResultRow): number | null => topN[r.kind] ?? null;

  return {
    raceName, shortName, competition, placeText, kText, topOf, fmt1,
  };
}

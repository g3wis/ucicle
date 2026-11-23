import type { Lang } from '../../i18n/language';
import { competitionName } from '../../i18n/races';
import { db } from '../../server/db';
import { indexVersion, type IndexVersion } from '../../server/index-data';

/**
 * Everything the method page prints, read from the current version of the index: its parameters
 * (rating_version.parameters), its run summary, the classifications it counted, one real worked
 * example (rating_change rows) and the version history. Nothing here is copy: every number comes
 * from the database or is computed from it with the published formula. Days are ISO text.
 * Competitions are named in the page's language (decision D1): a championship by its class and
 * host country (competitionName), every other race by its UCI name.
 */

/** The parameters the page prints, read from `rating_version.parameters` (functions/SCHEMA.md). */
export type MethodParams = {
  initialIndex: number,
  /** The logistic scale of E (400). */
  scale: number,
  kBase: number,
  minField: number,
  /** Experience needed to leave the provisional status. */
  threshold: number,
  activeDays: number,
  publishedFrom: string | null,
  returnBonus: null | { gapDays: number, experience: number, minMultiplier: number },
  /** N, the top of the finish order that duels everyone, by classification kind. */
  topN: Record<string, number>,
  classWeights: { code: string, weight: number }[],
  typeWeights: { kind: string, weight: number, top: number | null }[],
  /**
   * The lower levels (parameters.lower_levels): a rider whose first counted race is of an entry
   * class (CN, .2) starts at `entryIndex`; K is multiplied by `kMultiplier` in the `kClasses` (.2).
   * Null for a version without the correction.
   */
  lower: null | { entryClasses: string[], entryIndex: number, kClasses: string[], kMultiplier: number },
};

export type ExampleRider = {
  slug: string,
  name: string,
  rank: number,
  before: number,
  delta: number,
  /** The delta recomputed from the stored numbers with the formula (equal to `delta`). */
  recomputed: number,
  k: number,
  wClass: number | null,
  wType: number | null,
  multiplier: number,
  fieldSize: number,
  counted: number,
  won: number,
  expected: number,
  after: number,
  /** Why the multiplier is not 1: experience before the race under the threshold, or a return. */
  boost: 'provisional' | 'return' | null,
};

export type MethodExample = {
  date: string,
  competition: string,
  classCode: string,
  finishers: number,
  top: number | null,
  riders: ExampleRider[],
  /** The duel of the first two finishers, when they did not tie: E of the winner. */
  duel: null | { expected: number },
};

/**
 * One race of a season's list, named in the page's language. The UCI files some championships as
 * two competitions (road race and time trial, or the Olympic road race and time trial): under one
 * name in the same year, they are one race. `year` is set only when the same name comes back in
 * another year of the same season (an edition postponed from the year before), to tell them apart.
 */
export type CountedRace = { name: string, year: number | null };

export type SeasonCount = {
  season: number,
  /** Every classification of the season is dated before `published_from`: the warm-up. */
  warmUp: boolean,
  classifications: number,
  /** The races of the lists below, after the championships filed twice are joined. */
  competitions: number,
  byClass: Record<string, { classifications: number, competitions: number }>,
  /** The races counted, by class, in calendar order. */
  lists: { classCode: string, races: CountedRace[] }[],
};

export type VersionRow = {
  name: string, frozen: string | null, computed: string | null, current: boolean,
};

export type Calibration = {
  accuracy: number,
  logLoss: number | null,
  baseline: number | null,
  /** Share of the test duels the UCI ranking cannot separate (no ranking place, or a tie). */
  undecided: number | null,
  duels: number | null,
  trainSeasons: number[],
  testSeasons: number[],
  /**
   * The lower-level calibration (parameters.level_calibration): the scale gap between the riders of
   * the upper levels and those who only raced CN and .2, with the correction and without it, and
   * the share of test duels predicted in national championships (CN) and .2 races.
   */
  levels: null | {
    gap: number, gapBefore: number,
    cn: { accuracy: number, before: number } | null,
    two: { accuracy: number, before: number } | null,
  },
};

export type MethodData = {
  version: IndexVersion | null,
  current: null | {
    name: string,
    label: string | null,
    frozen: string | null,
    /** Day of the last full computation (Europe/Paris): the page's date, and its dateModified. */
    computed: string | null,
  },
  params: MethodParams | null,
  /** Expected share of duels won by the better rated rider, for gaps of 100, 200 and 400 points. */
  gaps: { gap: number, share: number, odds: number }[],
  calibration: Calibration | null,
  example: MethodExample | null,
  seasons: SeasonCount[],
  /** The classes present in the counts, in the order of the class weights table. */
  classes: string[],
  counters: null | {
    counted: number, rows: number, riders: number,
    skipped: { cancelled: number, small: number, noDuel: number },
  },
  drift: null | { from: { date: string, mean: number }, to: { date: string, mean: number } },
  versions: VersionRow[],
};

const GAPS = [100, 200, 400];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOr = (v: unknown): number | null => {
  if (isNum(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const record = (v: unknown): Record<string, unknown> | null => (
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
);
const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.map(numOr).filter((n): n is number => n !== null) : []);

/** The UCI classes in a stable reading order: one-day before stage race, at equal weight. */
const CLASS_ORDER = [
  '1.UWT', '2.UWT', 'CM', 'JO', '1.Pro', '2.Pro', '1.HC', '2.HC', '1.1', '2.1', 'CC', 'CN', '1.2', '2.2',
];
const KIND_ORDER = [
  'one_day', 'gc_final', 'gc_final_grand_tour', 'championship_road_race', 'olympic_road_race',
  'one_day_itt', 'championship_itt', 'olympic_itt', 'stage', 'prologue',
];
const orderOf = (list: string[], key: string) => {
  const i = list.indexOf(key);
  return i === -1 ? list.length : i;
};

/** Reads the parameters; null when one the page needs is missing (the page then prints none). */
function readParams(raw: Record<string, unknown>): MethodParams | null {
  const initialIndex = numOr(raw.initial_index);
  const scale = numOr(raw.logistic_scale);
  const kBase = numOr(raw.k_base);
  const minField = numOr(raw.min_field_size);
  const threshold = numOr(raw.experience_threshold);
  const activeDays = numOr(raw.active_days);
  const classes = record(raw.class_weights);
  const types = record(raw.type_weights);
  const top = record(raw.top_n_by_kind) ?? {};
  if (initialIndex === null || scale === null || kBase === null || minField === null || threshold === null
    || activeDays === null || !classes || !types) return null;

  const topN: Record<string, number> = {};
  Object.entries(top).forEach(([kind, n]) => {
    const value = numOr(n);
    if (value !== null) topN[kind] = value;
  });
  const classWeights = Object.entries(classes)
    .map(([code, w]) => ({ code, weight: numOr(w) }))
    .filter((c): c is { code: string, weight: number } => c.weight !== null)
    .sort((a, b) => b.weight - a.weight
      || orderOf(CLASS_ORDER, a.code) - orderOf(CLASS_ORDER, b.code)
      || a.code.localeCompare(b.code));
  const typeWeights = Object.entries(types)
    .map(([kind, w]) => ({ kind, weight: numOr(w) }))
    .filter((t): t is { kind: string, weight: number } => t.weight !== null)
    .map((t) => ({ ...t, top: topN[t.kind] ?? (t.kind === 'gc_final_grand_tour' ? topN.gc_final ?? null : null) }))
    .sort((a, b) => orderOf(KIND_ORDER, a.kind) - orderOf(KIND_ORDER, b.kind) || a.kind.localeCompare(b.kind));
  const lowerRaw = record(raw.lower_levels);
  const strings = (v: unknown): string[] => (
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  );
  const entryIndex = numOr(lowerRaw?.entry_index);
  const kMultiplier = numOr(lowerRaw?.k_multiplier);
  const lower = lowerRaw && entryIndex !== null && kMultiplier !== null
    && (entryIndex !== initialIndex || kMultiplier !== 1)
    ? {
      entryClasses: strings(lowerRaw.entry_classes), entryIndex, kClasses: strings(lowerRaw.k_classes), kMultiplier,
    }
    : null;
  const bonus = record(raw.return_bonus);
  const gapDays = numOr(bonus?.gap_days);
  const experience = numOr(bonus?.experience);
  const minMultiplier = numOr(bonus?.min_multiplier);

  return {
    initialIndex,
    scale,
    kBase,
    minField,
    threshold,
    activeDays,
    publishedFrom: typeof raw.published_from === 'string' ? raw.published_from.slice(0, 10) : null,
    returnBonus: gapDays !== null && experience !== null && minMultiplier !== null
      ? { gapDays, experience, minMultiplier }
      : null,
    topN,
    classWeights,
    typeWeights,
    lower,
  };
}

/** One level of test_by_level ('4' CN, '5' .2) with the correction and without it. */
function readLevel(after: Record<string, unknown> | null, before: Record<string, unknown> | null, key: string) {
  const accuracy = numOr(record(after?.[key])?.accuracy);
  const was = numOr(record(before?.[key])?.accuracy);
  return accuracy !== null && was !== null ? { accuracy, before: was } : null;
}

/**
 * The measured accuracy of the published setting. The lower-level calibration ran last, on the
 * same test duels, with every published value: its figures replace those of the main grid; the
 * UCI baseline and the duel count come from the main calibration.
 */
function readCalibration(raw: unknown, rawLevels: unknown): Calibration | null {
  const c = record(raw);
  const l = record(rawLevels);
  const accuracy = numOr(l?.test_accuracy) ?? numOr(c?.test_accuracy);
  if (!c || accuracy === null) return null;
  const gap = numOr(l?.test_scale_gap);
  const gapBefore = numOr(l?.uncorrected_test_scale_gap);
  const byLevel = record(l?.test_by_level);
  const byLevelBefore = record(l?.uncorrected_test_by_level);
  return {
    accuracy,
    logLoss: numOr(l?.test_log_loss) ?? numOr(c.test_log_loss),
    baseline: numOr(c.baseline_uci_rank_accuracy),
    undecided: numOr(c.baseline_uci_rank_undecided_share),
    duels: numOr(c.test_duels),
    trainSeasons: numbers(c.train_seasons),
    testSeasons: numbers(c.test_seasons),
    levels: l && gap !== null && gapBefore !== null ? {
      gap,
      gapBefore,
      cn: readLevel(byLevel, byLevelBefore, '4'),
      two: readLevel(byLevel, byLevelBefore, '5'),
    } : null,
  };
}

function readCounters(summary: Record<string, unknown> | null): MethodData['counters'] {
  if (!summary) return null;
  const counted = numOr(summary.classifications_counted);
  const rows = numOr(summary.rating_change_rows);
  const riders = numOr(summary.riders_rated);
  if (counted === null || rows === null || riders === null) return null;
  const skipped = record(summary.classifications_skipped);
  return {
    counted,
    rows,
    riders,
    skipped: {
      cancelled: numOr(skipped?.cancelled) ?? 0,
      small: numOr(skipped?.field_too_small) ?? 0,
      noDuel: numOr(skipped?.no_duel) ?? 0,
    },
  };
}

/** The mean index of every rated rider on the first published day and at the latest season end. */
function readDrift(summary: Record<string, unknown> | null): MethodData['drift'] {
  const drift = record(summary?.drift);
  const first = record(drift?.first_published_day);
  const ends = Array.isArray(drift?.season_ends) ? (drift?.season_ends as unknown[]).map(record).filter(Boolean) : [];
  const last = ends[ends.length - 1];
  const fromMean = numOr(first?.mean_index_rated);
  const toMean = numOr(last?.mean_index_rated);
  if (!first || !last || fromMean === null || toMean === null
    || typeof first.date !== 'string' || typeof last.end_date !== 'string') return null;
  return { from: { date: first.date, mean: fromMean }, to: { date: last.end_date, mean: toMean } };
}

export async function loadMethod(lang: Lang): Promise<MethodData> {
  const version = await indexVersion();
  const empty: MethodData = {
    version,
    current: null,
    params: null,
    gaps: [],
    calibration: null,
    example: null,
    seasons: [],
    classes: [],
    counters: null,
    drift: null,
    versions: [],
  };
  if (!version) return empty;
  const sql = db();
  const v = version.id;

  const [versionRows, competitions, races] = await Promise.all([
    sql<{
      id: number, name: string, label: string | null, is_current: boolean,
      frozen: string | null, computed: string | null,
      summary: Record<string, unknown> | null,
    }[]>`
      select id, name, label, is_current,
             (frozen_at at time zone 'Europe/Paris')::date::text as frozen,
             (computed_at at time zone 'Europe/Paris')::date::text as computed,
             case when is_current then summary end as summary
      from rating_version
      order by coalesce(frozen_at, created_at) desc, id desc`,
    // Every competition with at least one counted classification, by season, in calendar order,
    // with its host country (a national championship is named after it).
    sql<{
      season: number, class_code: string, name: string, country: string | null,
      first_date: string, last_date: string, n: number,
    }[]>`
      with counted as (
        select distinct classification_id from rating_change where rating_version_id = ${v}
      )
      select c.season, min(c.class_code) as class_code, min(c.competition_name) as name,
             min(comp.country_iso2) as country,
             min(c.date)::text as first_date, max(c.date)::text as last_date, count(*)::int as n
      from counted k join classification c on c.id = k.classification_id
      left join competition comp on comp.id = c.competition_id
      group by c.season, c.competition_id
      order by c.season desc, min(c.date), c.competition_id`,
    // The worked example: the latest WorldTour one-day race counted by this version.
    sql<{
      id: number, date: string, competition_name: string, country_iso2: string | null, class_code: string,
      finishers_count: number | null,
    }[]>`
      select c.id, c.date::text, c.competition_name, comp.country_iso2, c.class_code, c.finishers_count
      from classification c
      left join competition comp on comp.id = c.competition_id
      where c.kind = 'one_day' and not c.cancelled and c.date <= ${version.asOf}
        and exists (select 1 from rating_change rc where rc.rating_version_id = ${v} and rc.classification_id = c.id)
      order by (c.class_code = '1.UWT') desc, c.date desc, c.id desc
      limit 1`,
  ]);

  const params = readParams(version.parameters);
  const currentRow = versionRows.find((r) => r.is_current) ?? null;
  const summary = record(currentRow?.summary);

  let example: MethodExample | null = null;
  const race = races[0];
  if (race && params) {
    const rows = await sql<{
      slug: string, name: string, rank: number, index_before: number, delta: number, k: number,
      w_class: number | null, w_type: number | null, multiplier: number, field_size: number,
      duels_counted: number, duels_won: number, duels_expected: number, index_after: number,
      experience_after: number | null,
    }[]>`
      select ri.slug, ri.display_name as name, rc.rank, rc.index_before, rc.delta, rc.k, rc.w_class, rc.w_type,
             rc.multiplier, rc.field_size, rc.duels_counted, rc.duels_won, rc.duels_expected, rc.index_after,
             rc.experience_after
      from rating_change rc
      join rider ri on ri.id = rc.rider_id
      join result r on r.classification_id = rc.classification_id and r.rider_id = rc.rider_id
      where rc.rating_version_id = ${v} and rc.classification_id = ${race.id}
      order by rc.rank, r.position, rc.rider_id
      limit 3`;
    const riders: ExampleRider[] = rows.map((x) => {
      const multiplier = Number(x.multiplier);
      const wType = numOr(x.w_type);
      const expAfter = numOr(x.experience_after);
      const expBefore = expAfter !== null && wType !== null ? expAfter - wType : null;
      let boost: ExampleRider['boost'] = null;
      if (Math.abs(multiplier - 1) > 1e-9) {
        if (expBefore !== null) boost = expBefore < params.threshold - 1e-9 ? 'provisional' : 'return';
      }
      const k = Number(x.k);
      const won = Number(x.duels_won);
      const expected = Number(x.duels_expected);
      const fieldSize = Number(x.field_size);
      return {
        slug: x.slug,
        name: x.name,
        rank: Number(x.rank),
        before: Number(x.index_before),
        delta: Number(x.delta),
        recomputed: fieldSize > 1 ? (k * multiplier * (won - expected)) / (fieldSize - 1) : 0,
        k,
        wClass: numOr(x.w_class),
        wType,
        multiplier,
        fieldSize,
        counted: Number(x.duels_counted),
        won,
        expected,
        after: Number(x.index_after),
        boost,
      };
    });
    if (riders.length >= 3) {
      const [a, b] = riders;
      example = {
        date: race.date,
        competition: competitionName(lang, race.class_code, race.competition_name, race.country_iso2),
        classCode: race.class_code,
        finishers: numOr(race.finishers_count) ?? riders[0].fieldSize,
        top: params.topN.one_day ?? null,
        riders,
        duel: a.rank < b.rank ? { expected: 1 / (1 + 10 ** ((b.before - a.before) / params.scale)) } : null,
      };
    }
  }

  // Counted classifications by season and class, and the races behind them. Two competitions
  // printed under the same name in the same year are one race (a championship the UCI files as
  // road race and time trial); the same name in two years of one season keeps both, with the year.
  const publishedFrom = params?.publishedFrom ?? null;
  const bySeason = new Map<number, SeasonCount>();
  competitions.forEach((row) => {
    const season = Number(row.season);
    let entry = bySeason.get(season);
    if (!entry) {
      entry = {
        season, warmUp: true, classifications: 0, competitions: 0, byClass: {}, lists: [],
      };
      bySeason.set(season, entry);
    }
    const n = Number(row.n);
    entry.classifications += n;
    if (!publishedFrom || row.last_date >= publishedFrom) entry.warmUp = false;
    const cls = entry.byClass[row.class_code] ?? { classifications: 0, competitions: 0 };
    cls.classifications += n;
    entry.byClass[row.class_code] = cls;
    let list = entry.lists.find((l) => l.classCode === row.class_code);
    if (!list) {
      list = { classCode: row.class_code, races: [] };
      entry.lists.push(list);
    }
    const name = competitionName(lang, row.class_code, row.name, row.country);
    const year = Number(row.first_date.slice(0, 4));
    if (!list.races.some((r) => r.name === name && r.year === year)) {
      list.races.push({ name, year });
      entry.competitions += 1;
      cls.competitions += 1;
    }
  });
  // The year stays only on a name that comes back in another year of the same season.
  const withEditions = (list: CountedRace[]): CountedRace[] => list.map((r) => (
    list.filter((o) => o.name === r.name).length > 1 ? r : { ...r, year: null }
  ));
  const weightOf = (code: string) => params?.classWeights.find((c) => c.code === code)?.weight ?? -1;
  const byWeight = (a: string, b: string) => weightOf(b) - weightOf(a)
    || orderOf(CLASS_ORDER, a) - orderOf(CLASS_ORDER, b) || a.localeCompare(b);
  const seasons = [...bySeason.values()]
    .map((s) => ({ ...s, lists: s.lists.map((l) => ({ ...l, races: withEditions(l.races) })) }))
    .sort((a, b) => b.season - a.season);
  seasons.forEach((s) => s.lists.sort((a, b) => byWeight(a.classCode, b.classCode)));
  const classes = [...new Set(seasons.flatMap((s) => Object.keys(s.byClass)))].sort(byWeight);

  return {
    version,
    current: currentRow ? {
      name: currentRow.name, label: currentRow.label, frozen: currentRow.frozen, computed: currentRow.computed,
    } : null,
    params,
    gaps: params ? GAPS.map((gap) => {
      const share = 1 / (1 + 10 ** (-gap / params.scale));
      return { gap, share, odds: share / (1 - share) };
    }) : [],
    calibration: readCalibration(version.parameters.calibration, version.parameters.level_calibration),
    example,
    seasons,
    classes,
    counters: readCounters(summary),
    drift: readDrift(summary),
    versions: versionRows.map((r) => ({
      name: r.name, frozen: r.frozen, computed: r.computed, current: r.is_current,
    })),
  };
}

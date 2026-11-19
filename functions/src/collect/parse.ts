import type { ClassificationKind, CompetitionKind, ResultStatus } from '../db/rows.js';
import { toIsoDate } from '../utils/formatUtils.js';

import { foldToAscii } from './names.js';

/** UCI classes collected: men elite road, U23 classes (1.2U, 2.2U), JC, JR, 1.2S, CRT, CRTP and N/A left out */
export const IN_SCOPE_CLASSES: ReadonlySet<string> = new Set([
    '1.UWT', '2.UWT', '1.Pro', '2.Pro', '1.HC', '2.HC', '1.1', '2.1', '1.2', '2.2', 'CN', 'CC', 'CM', 'JO',
]);

/** DataRide category of the races collected (championships also hold women, U23 and junior races) */
export const MEN_ELITE_CATEGORY = 'Men Elite';

/** Earliest plausible date: DataRide writes unknown dates as /Date(-62135596800000)/ (year 1) */
const EARLIEST_DATE_MS: number = Date.UTC(1900, 0, 1);

/**
 * @param value A date serialized by ASP.NET ("/Date(906328800000)/"), midnight in Central European Time
 * @return The calendar date 'YYYY-MM-DD', null when missing or a placeholder
 */
export function dataRideIsoDate(value: string | null | undefined): string | null {
    const timestamp: string | undefined = value?.match(/-?\d+/)?.[0];
    if (!timestamp) return null;
    const ms: number = Number(timestamp);
    if (!Number.isFinite(ms) || ms < EARLIEST_DATE_MS) return null;
    return toIsoDate(new Date(ms));
}

/**
 * @param classCode UCI class of a competition
 * @return The kind of competition, null when the class is out of scope
 */
export function competitionKind(classCode: string): CompetitionKind | null {
    if (!IN_SCOPE_CLASSES.has(classCode)) return null;
    if (classCode === 'JO') return 'olympic';
    if (classCode === 'CN' || classCode === 'CC' || classCode === 'CM') return 'championship';
    return classCode.startsWith('1.') ? 'one_day' : 'stage_race';
}

/**
 * @param name Competition name as DataRide writes it
 * @param classCode UCI class
 * @return Whether it is the Tour de France, the Giro d'Italia or the Vuelta a España
 */
export function isGrandTour(name: string, classCode: string): boolean {
    return classCode === '2.UWT' && /^(tour de france|giro d italia|(la )?vuelta( ciclista)? a espana)$/.test(foldToAscii(name));
}

export type ClassificationShape = {
    kind: ClassificationKind,
    raceType: 'IRR' | 'ITT',
    stageNumber: number | null,
    stageLabel: string | null,
};

/**
 * Decides whether a DataRide race holds a classification to store, and which.
 * @param competition Kind of the competition
 * @param race The race: RaceCode (F = final classification or one-day race, S = stage), name, type (IRR, ITT, TTT, TTM) and category
 * @return The classification shape, null for races out of scope (other categories, team time trials, mixed relays)
 */
export function classificationShape(
    competition: CompetitionKind,
    race: { code: string | null, name: string, type: string | null, category: string | null },
): ClassificationShape | null {
    if (race.category?.trim() !== MEN_ELITE_CATEGORY) return null;
    const raceType: string | undefined = race.type?.trim().toUpperCase();
    if (raceType !== 'IRR' && raceType !== 'ITT') return null;
    const itt: boolean = raceType === 'ITT';
    const base = { raceType: raceType as 'IRR' | 'ITT', stageNumber: null, stageLabel: null };

    switch (competition) {
        case 'championship':
            return { ...base, kind: itt ? 'championship_itt' : 'championship_road_race' };
        case 'olympic':
            return { ...base, kind: itt ? 'olympic_itt' : 'olympic_road_race' };
        case 'one_day':
            return { ...base, kind: itt ? 'one_day_itt' : 'one_day' };
        case 'stage_race': {
            const isStage: boolean = race.code?.trim().toUpperCase() === 'S' || /\b(stage|prolog)/i.test(race.name);
            if (!isStage) return { ...base, kind: 'gc_final' };
            if (/prolog/i.test(race.name)) return { ...base, kind: 'prologue', stageNumber: 0, stageLabel: race.name };
            const number: string | undefined = race.name.match(/(\d+)/)?.[1];
            return { ...base, kind: 'stage', stageNumber: number ? Number(number) : null, stageLabel: race.name };
        }
    }
}

/**
 * @param shape Classification shape
 * @param events Classifications DataRide lists for the race
 * @return The event holding the classification to store: "Stage Classification" for a stage, "General Classification" otherwise
 */
export function pickEvent<T extends { EventName: string | null, IsTeamEvent: boolean }>(shape: ClassificationShape, events: T[]): T | null {
    const individual: T[] = events.filter(event => !event.IsTeamEvent);
    const isStage: boolean = shape.kind === 'stage' || shape.kind === 'prologue';
    const wanted: RegExp = isStage ? /^stage classification$/i : /^(general|final) classification$/i;
    const match: T | undefined = individual.find(event => wanted.test(event.EventName?.trim() ?? ''));
    if (match) return match;
    // A single individual classification that is neither points, mountains nor youth is the race result
    const others: T[] = individual.filter(event => !/(point|mountain|youth|team|sprint|combat|combined)/i.test(event.EventName ?? ''));
    return others.length === 1 ? others[0] : null;
}

/**
 * @param irm UCI "IRM" code of the row (DNF, DNS, OTL, DSQ...), null for a classified rider
 * @param rankNumber Numeric rank of the row
 * @return The stored status
 */
export function resultStatus(irm: string | null | undefined, rankNumber: number | null | undefined): ResultStatus {
    const code: string | undefined = irm?.trim().toUpperCase();
    if (code) return code;
    return typeof rankNumber === 'number' ? 'FIN' : 'NR';
}

const SAME_TIME = /^(,,|s\.?\s?t\.?|=|"|st)$/i;

/**
 * @param value A clock value: "5:50:28", "+1:42", "45", "00:36:54.550"
 * @return The number of seconds, null when not a clock value
 */
export function parseClock(value: string): number | null {
    const match: RegExpMatchArray | null = value.trim().replace(/^\+\s*/, '').match(/^(\d+)(?::(\d{1,2}))?(?::(\d{1,2}))?(?:[.,](\d+))?$/);
    if (!match) return null;
    const parts: number[] = [match[1], match[2], match[3]].filter((part): part is string => part !== undefined).map(Number);
    const whole: number = parts.reduce((total, part) => total * 60 + part, 0);
    const fraction: number = match[4] ? Number(`0.${match[4]}`) : 0;
    return Math.round((whole + fraction) * 1000) / 1000;
}

/**
 * Reads the `ResultValue` of the classified rows of one classification, in finish order.
 * The first value is the winner's time; a later value is a gap when it starts with "+" or is smaller
 * than the winner's time, an absolute time otherwise; "s.t." or ",," repeats the previous gap.
 * @param values Raw values of the classified rows, in finish order
 * @return For each value, the absolute time and the gap to the winner, in seconds (null when unknown)
 */
export function parseResultValues(values: (string | null)[]): { time: number | null, gap: number | null }[] {
    let winnerTime: number | null = null;
    let previousGap: number | null = null;
    return values.map((raw, index) => {
        const value: string = raw?.trim() ?? '';
        if (value.length === 0) return { time: null, gap: null };

        if (SAME_TIME.test(value)) {
            const gap: number | null = previousGap;
            return { time: winnerTime !== null && gap !== null ? round(winnerTime + gap) : null, gap };
        }
        const seconds: number | null = parseClock(value);
        if (seconds === null) return { time: null, gap: null };

        if (index === 0 || winnerTime === null) {
            if (value.startsWith('+')) {
                previousGap = seconds;
                return { time: null, gap: seconds };
            }
            winnerTime = seconds;
            previousGap = 0;
            return { time: seconds, gap: index === 0 ? 0 : null };
        }
        const isGap: boolean = value.startsWith('+') || seconds < winnerTime;
        const gap: number = isGap ? seconds : round(seconds - winnerTime);
        previousGap = gap;
        return { time: round(winnerTime + gap), gap };
    });
}

function round(seconds: number): number {
    return Math.round(seconds * 1000) / 1000;
}

/**
 * @param uciId 11-digit UCI ID (e.g. 10014972740)
 * @return The Wikidata "UCI rider ID" (P11020) derived from it: floor(UciId / 100) - 100000000 (e.g. 149727)
 */
export function uciRiderPageId(uciId: number): number | null {
    if (!Number.isFinite(uciId) || uciId < 10_000_000_000) return null;
    const derived: number = Math.floor(uciId / 100) - 100_000_000;
    return derived > 0 ? derived : null;
}

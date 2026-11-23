/**
 * Freezes calibrated values: rewrites the block between "// BEGIN FROZEN" and "// END FROZEN" of
 * src/rating/params.ts with the chosen values and their calibration metrics (used by `yarn calibrate --freeze`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { CalibratedValues, CalibrationRecord, LevelCalibrationRecord } from './params.js';

/** src/rating/params.ts, from build/rating/ or src/rating/ */
export const PARAMS_SOURCE: string = fileURLToPath(new URL('../../src/rating/params.ts', import.meta.url));

const BEGIN = '// BEGIN FROZEN';
const END = '// END FROZEN';

function quote(text: string): string {
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n')}'`;
}

/**
 * @param value A JSON-like value
 * @param indent Current indentation
 * @return It as a TypeScript literal in the style of the code base (single quotes, trailing commas)
 */
export function toLiteral(value: unknown, indent = ''): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 'Number.NaN';
        return String(value);
    }
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `[${value.map(item => toLiteral(item, indent)).join(', ')}]`;
    const entries: [string, unknown][] = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const inner: string = `${indent}    `;
    const lines: string[] = entries.map(([key, item]) => {
        const name: string = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : quote(key);
        return `${inner}${name}: ${toLiteral(item, inner)},`;
    });
    return `{\n${lines.join('\n')}\n${indent}}`;
}

/** What a freeze writes: the values, the calibration of the main grid and the one of the lower levels */
export type Frozen = { values: CalibratedValues, record: CalibrationRecord | null, levelRecord: LevelCalibrationRecord | null };

/**
 * @param day Day of freezing 'YYYY-MM-DD'
 * @param frozen Values and calibrations
 * @return The frozen block of params.ts
 */
export function frozenBlock(day: string, { values, record, levelRecord }: Frozen): string {
    const seasons: string = record ? ` (train ${record.train_seasons.join('-')}, test ${record.test_seasons.join('-')})` : '';
    return `${BEGIN}: values of the published Index v1, rewritten by \`yarn calibrate --freeze\` (or by hand), then \`yarn build && yarn rate\`
/** Day the v1 parameters were frozen (label "Index v1 (<day>)") */
export const FROZEN_ON = ${quote(day)};

/** Values frozen for Index v1, chosen by \`yarn calibrate\`${seasons} and \`yarn calibrate --levels\` */
export const FROZEN_VALUES: Readonly<CalibratedValues> = ${toLiteral(values)};

/** Calibration of the frozen values (see CalibrationRecord) */
export const FROZEN_CALIBRATION: CalibrationRecord | null = ${toLiteral(record)};

/** Calibration of the lower levels (see LevelCalibrationRecord), null before the first one */
export const FROZEN_LEVEL_CALIBRATION: LevelCalibrationRecord | null = ${toLiteral(levelRecord)};
${END}`;
}

/**
 * Rewrites the frozen block of params.ts.
 * @param frozen Values and calibrations
 * @param day Day of freezing
 * @param file params.ts
 */
export function freezeParameters(frozen: Frozen, day: string, file: string = PARAMS_SOURCE): void {
    const source: string = readFileSync(file, 'utf8');
    const begin: number = source.indexOf(BEGIN);
    const end: number = source.indexOf(END);
    if (begin < 0 || end < begin) throw new Error(`${file}: no "${BEGIN}" ... "${END}" block`);
    writeFileSync(file, source.slice(0, begin) + frozenBlock(day, frozen) + source.slice(end + END.length));
}

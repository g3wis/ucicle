import { BestResult, RaceType } from '../types/CyclingTypes.js';
import { toIsoDate } from '../utils/formatUtils.js';

import { UciResult } from './uciScrapper.js';

type Candidate = { result: UciResult, race: string, raceType: RaceType };

/**
 * @param result A UCI result
 * @return The game's race type of the result, null for classifications the game doesn't describe
 * (standings after each stage, youth or team classifications...)
 */
export function getRaceType(result: UciResult): RaceType | null {
    const event: string = result.eventName.toLowerCase();
    if (event.includes('stage general')) return null;
    // Stage races have a "2.x" class, one-day races and championships "1.x", "CN", "CC", "CM"...
    if (event.includes('general classification')) return result.classCode.startsWith('2.') ? 'GC' : 'race';
    if (event.includes('stage')) return 'stage';
    if (event.includes('mountain')) return 'KOM';
    if (event.includes('point')) return 'Point GC';
    return null;
}

/**
 * @param result A UCI result
 * @param raceType Its race type
 * @return The race name shown in the hint, without the edition year. For championships, the event is
 * added unless it is the elite road race (e.g. "UCI Road World Championships - Under 23 Road Race")
 */
export function getRaceName(result: UciResult, raceType: RaceType): string {
    const competition: string = result.competition
        .replace(/\s*\((?:ME|MU|MJ)\)$/, '')
        .replace(/\b(?:19|20)\d{2}\b/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s-]+|[\s-]+$/g, '');

    // One-day races and championships carry the event in the race name, e.g. "Men Under 23 - Individual Time Trial"
    const event: string = result.raceName;
    const isEliteRoadRace: boolean = /\belite\b/i.test(event) && !/time trial/i.test(event);
    if (raceType === 'race' && event && !/final classification/i.test(event) && !isEliteRoadRace) {
        const detail: string = event
            .replace(/^Men\s+/i, '')
            .replace(/^Elite\b\s*-?\s*/i, '')
            .replace(/\s*-\s*/g, ' ')
            .trim();
        if (detail) return `${competition} - ${detail}`;
    }
    return competition;
}

function isBetter(a: Candidate, b: Candidate): boolean {
    if (a.result.points !== b.result.points) return a.result.points > b.result.points;
    if (a.result.rank !== b.result.rank) return a.result.rank < b.result.rank;
    return a.result.date > b.result.date;
}

/**
 * The best result is the one that earned the most UCI points, a fair proxy of the race prestige
 * (Tour de France winner: 1300 points, Monument: 800, Tour de France stage: 210...).
 * @param results The rider's results in the UCI ranking window
 * @return The best result, with how many times the rider got it, null when no result can be described
 */
export function computeBestResult(results: UciResult[]): BestResult | null {
    const candidates: Candidate[] = results
        .filter(result => !result.invalid && result.points > 0 && result.rank > 0 && result.competition)
        .flatMap(result => {
            const raceType: RaceType | null = getRaceType(result);
            return raceType ? [{ result, raceType, race: getRaceName(result, raceType) }] : [];
        });
    if (candidates.length === 0) return null;

    const best: Candidate = candidates.reduce((a, b) => (isBetter(b, a) ? b : a));
    const same: Candidate[] = candidates.filter(candidate =>
        candidate.race === best.race && candidate.raceType === best.raceType && candidate.result.rank === best.result.rank
    );
    const years: number[] = [...new Set(same.map(candidate => parseInt(toIsoDate(candidate.result.date).slice(0, 4), 10)))]
        .sort((a, b) => a - b);

    return {
        race: best.race,
        rank: best.result.rank,
        raceType: best.raceType,
        recurrence: same.length,
        years,
    };
}

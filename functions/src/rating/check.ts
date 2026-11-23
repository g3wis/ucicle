/**
 * Checks of the rating formula on hand-made classifications (no database):
 * monotonicity (finishing higher never gives less), the bound |delta| <= K_c x m_i, the zero sum when every
 * m_i = 1, the recomputation of each delta from the stored numbers, and the experience, provisional and return
 * multipliers of the engine. Usage: yarn build && yarn check:rating (exits 1 on the first failure).
 */
import { buildRatingData, type ClassificationInput } from './data.js';
import { fromDay, toDay } from './days.js';
import { runEngine, scoreField, topSize } from './engine.js';
import { DEFAULT_PARAMETERS, type RatingParameters, withValues } from './params.js';

const EPSILON = 1e-9;
let checks = 0;

function assert(condition: boolean, message: string): void {
    checks++;
    if (!condition) throw new Error(`Check failed: ${message}`);
}

type Scored = { t: number, won: number[], expected: number[], delta: number[] };

/**
 * @param ratings Index before the classification of each finisher, in finish order
 * @param ranks Rank of each finisher (ascending, ties allowed)
 * @param top N
 * @param k K_c
 * @param multipliers m_i of each finisher
 */
function score(ratings: number[], ranks: number[], top: number, k: number, multipliers: number[]): Scored {
    const n: number = ratings.length;
    const rankArray = Int32Array.from(ranks);
    const q = Float64Array.from(ratings, rating => Math.pow(10, rating / 400));
    const won = new Float64Array(n);
    const expected = new Float64Array(n);
    const t: number = topSize(rankArray, 0, n, top);
    scoreField(rankArray, 0, n, t, q, won, expected);
    const delta: number[] = ratings.map((_, place) => k * multipliers[place] * (won[place] - expected[place]) / (n - 1));
    return { t, won: [...won], expected: [...expected], delta };
}

/** A small seeded generator, so a failure can be replayed */
function random(seed: number): () => number {
    let state: number = seed;
    return () => {
        state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
        return state / 2_147_483_648;
    };
}

function checkFiveRiders(): void {
    // Five riders, indexes before the race, in finish order
    const ratings: number[] = [1600, 1750, 1500, 1450, 1520];
    const ranks: number[] = [1, 2, 3, 4, 5];
    const k = 40;
    for (const top of [5, 3, 2, 1]) {
        const ones: number[] = ratings.map(() => 1);
        const scored: Scored = score(ratings, ranks, top, k, ones);
        const sum: number = scored.delta.reduce((total, value) => total + value, 0);
        assert(Math.abs(sum) < EPSILON, `zero sum with every m = 1 (N = ${top}): sum ${sum}`);
        scored.delta.forEach((value, place) => {
            assert(Math.abs(value) <= k + EPSILON, `bound |delta| <= K (N = ${top}, place ${place + 1}): ${value}`);
            const duels: number = place < scored.t ? ratings.length - 1 : scored.t;
            assert(scored.won[place] <= duels && scored.expected[place] <= duels + EPSILON, `won and expected within the duels counted (N = ${top})`);
        });
        console.info(`N = ${top}: |T| = ${scored.t}, deltas ${scored.delta.map(value => value.toFixed(3)).join(', ')} (sum ${sum.toExponential(1)})`);

        // Provisional multipliers: the bound is K x m_i, the sum is no longer zero
        const multipliers: number[] = [2, 1, 1.5, 1, 1.25];
        const boosted: Scored = score(ratings, ranks, top, k, multipliers);
        boosted.delta.forEach((value, place) => {
            assert(Math.abs(value) <= k * multipliers[place] + EPSILON, `bound |delta| <= K x m (N = ${top}, place ${place + 1})`);
            const recomputed: number = k * multipliers[place] * (boosted.won[place] - boosted.expected[place]) / (ratings.length - 1);
            assert(recomputed === value, 'delta recomputes exactly from k, multiplier, duels won, duels expected and field size');
        });
    }

    // Monotonicity on the five riders: move each rider through every place, the others keeping their order
    for (let rider = 0; rider < ratings.length; rider++) {
        for (const top of [5, 3, 2, 1]) {
            let previous: number = Number.POSITIVE_INFINITY;
            for (let place = 0; place < ratings.length; place++) {
                const others: number[] = ratings.filter((_, index) => index !== rider);
                const order: number[] = [...others.slice(0, place), ratings[rider], ...others.slice(place)];
                const value: number = score(order, ranks, top, k, order.map(() => 1)).delta[place];
                assert(value <= previous + EPSILON, `monotonicity: rider ${rider + 1} at place ${place + 1} (N = ${top}) gets ${value} > ${previous}`);
                previous = value;
            }
        }
    }

    // Ties: two riders at the same rank draw; T keeps both when the tie is at the N-th place
    const tied: Scored = score([1500, 1500, 1500, 1500, 1500], [1, 2, 2, 4, 5], 2, k, [1, 1, 1, 1, 1]);
    assert(tied.t === 3, `|T| includes the riders tied with the N-th finisher: ${tied.t}`);
    assert(Math.abs(tied.delta[1] - tied.delta[2]) < EPSILON, 'riders tied in rank get the same delta at equal index');
    assert(tied.won[1] === 2.5, `a tie is half a duel won: ${tied.won[1]}`);
    assert(Math.abs(tied.delta.reduce((total, value) => total + value, 0)) < EPSILON, 'zero sum with ties');
}

function checkRandomFields(): void {
    const next = random(20261117);
    for (let trial = 0; trial < 3000; trial++) {
        const n: number = 2 + Math.floor(next() * 12);
        const ratings: number[] = Array.from({ length: n }, () => 1200 + next() * 900);
        const ranks: number[] = [];
        for (let place = 0; place < n; place++) ranks.push(place === 0 ? 1 : next() < 0.15 ? ranks[place - 1] : place + 1);
        const top: number = 1 + Math.floor(next() * n);
        const k: number = 10 + next() * 60;
        const multipliers: number[] = ratings.map(() => 1 + next());
        const scored: Scored = score(ratings, ranks, top, k, multipliers);
        scored.delta.forEach((value, place) => assert(Math.abs(value) <= k * multipliers[place] + EPSILON, `random bound (trial ${trial})`));
        const plain: Scored = score(ratings, ranks, top, k, ratings.map(() => 1));
        const sum: number = plain.delta.reduce((total, value) => total + value, 0);
        assert(Math.abs(sum) < 1e-7, `random zero sum (trial ${trial}): ${sum}`);

        // Monotonicity without ties: one rider moves down the order, others keep theirs
        const distinct: number[] = ratings.map((_, place) => place + 1);
        const rider: number = Math.floor(next() * n);
        let previous: number = Number.POSITIVE_INFINITY;
        for (let place = 0; place < n; place++) {
            const others: number[] = ratings.filter((_, index) => index !== rider);
            const order: number[] = [...others.slice(0, place), ratings[rider], ...others.slice(place)];
            const value: number = score(order, distinct, top, k, order.map(() => multipliers[rider])).delta[place];
            assert(value <= previous + EPSILON, `random monotonicity (trial ${trial}, place ${place + 1})`);
            previous = value;
        }
    }
}

function checkEngine(): void {
    const parameters: RatingParameters = withValues({
        kBase: 40, stageWeight: 0.35, topOneDay: 30, topStage: 15, minFieldSize: 2, lowerEntryIndex: 1500, lowerK: 1,
    });
    // Riders 1..5 race twelve one-day 1.UWT races, same order each time, a week apart; rider 5 comes back after 200 days
    const inputs: ClassificationInput[] = [];
    let day: number = toDay('2021-03-01');
    for (let race = 1; race <= 12; race++) {
        const late: boolean = race === 12;
        if (late) day += 200;
        inputs.push({
            id: race, date: fromDay(day), season: 2021, kind: 'one_day', classCode: '1.UWT', isGrandTour: false, cancelled: false,
            riderIds: late ? [5, 1, 2, 3, 4] : [1, 2, 3, 4, 5], ranks: [1, 2, 3, 4, 5],
        });
        day += 7;
    }
    // A stage and the final GC of a grand tour on the same day: the stage goes first whatever the ids
    const gcDay: string = fromDay(day + 1);
    inputs.push({ id: 101, date: gcDay, season: 2021, kind: 'gc_final', classCode: '2.UWT', isGrandTour: true, cancelled: false, riderIds: [1, 2, 3], ranks: [1, 2, 3] });
    inputs.push({ id: 102, date: gcDay, season: 2021, kind: 'stage', classCode: '2.UWT', isGrandTour: true, cancelled: false, riderIds: [3, 2, 1], ranks: [1, 2, 3] });
    // Cancelled and too small: skipped
    inputs.push({ id: 103, date: gcDay, season: 2021, kind: 'one_day', classCode: '1.1', isGrandTour: false, cancelled: true, riderIds: [], ranks: [] });

    const data = buildRatingData(inputs);
    const order: number[] = [...data.ids];
    assert(order.indexOf(102) < order.indexOf(101) && order[order.length - 1] === 101, 'a stage comes before the final GC of the same day');
    const result = runEngine(data, { parameters, record: true, snapshotDays: [toDay(gcDay)] });
    const changes = result.changes!;
    assert(result.skipped.cancelled === 1, 'cancelled classification skipped');

    // First race: everybody at 1500 with X = 0, so m = 2 and E = 0.5 for every duel
    assert(changes.multiplier[0] === 2, `first race multiplier is 2: ${changes.multiplier[0]}`);
    assert(changes.duelsExpected[0] === 2, `four duels at E = 0.5: ${changes.duelsExpected[0]}`);
    assert(Math.abs(changes.delta[0] - 40 * 2 * (4 - 2) / 4) < EPSILON, `winner of the first race gains 40: ${changes.delta[0]}`);

    // Race 11: X = 10 before it, m = 1, zero sum
    const race11: number[] = changes.classification.flatMap((id, row) => id === 11 ? [row] : []);
    assert(race11.every(row => changes.multiplier[row] === 1), 'multiplier is 1 at X = 10');
    const sum11: number = race11.reduce((total, row) => total + changes.delta[row], 0);
    assert(Math.abs(sum11) < EPSILON, `zero sum once every rider is experienced: ${sum11}`);

    // Race 12: rider 5 returns after more than 180 days: m >= 1.5 (the others too: they all paused)
    const race12: number[] = changes.classification.flatMap((id, row) => id === 12 ? [row] : []);
    assert(race12.every(row => changes.multiplier[row] === 1.5), 'return multiplier 1.5 after more than 180 days');

    // Grand tour: the stage (w 0.35) then the final GC (w 1.5), experience 12 + 0.35 + 1.5
    const gcRow: number = changes.classification.findIndex((id, row) => id === 101 && changes.rider[row] === 1);
    assert(Math.abs(changes.experienceAfter[gcRow] - 13.85) < EPSILON, `experience after a stage and a grand tour GC: ${changes.experienceAfter[gcRow]}`);
    assert(Math.abs(changes.k[gcRow] - 40 * 1.0 * 1.5) < EPSILON, `K of a grand tour GC: ${changes.k[gcRow]}`);
    const stageRow: number = changes.classification.findIndex((id, row) => id === 102 && changes.rider[row] === 1);
    assert(changes.multiplier[stageRow] === 1.5, 'the return multiplier lasts five units of experience');
    assert(Math.abs(changes.k[stageRow] - 40 * 1.0 * 0.35) < EPSILON, `K of a stage: ${changes.k[stageRow]}`);
    for (let row = 0; row < changes.delta.length; row++) {
        const n: number = changes.fieldSize[row];
        const recomputed: number = changes.k[row] * changes.multiplier[row] * (changes.duelsWon[row] - changes.duelsExpected[row]) / (n - 1);
        assert(recomputed === changes.delta[row], `row ${row}: delta recomputes exactly`);
        assert(changes.indexAfter[row] === changes.indexBefore[row] + changes.delta[row], `row ${row}: index_after = index_before + delta`);
    }

    // Snapshot: riders 1..5 are classified (X >= 10, raced within 365 days), ranked by index
    const snapshots = result.snapshots!;
    assert(snapshots.rider.length === 5, `five riders classified: ${snapshots.rider.length}`);
    for (let row = 1; row < snapshots.index.length; row++) assert(snapshots.index[row] <= snapshots.index[row - 1], 'snapshot sorted by index');
    console.info(`engine: ${changes.delta.length} rating rows, ranking ${snapshots.rider.map((id, row) => `${id}:${snapshots.index[row].toFixed(1)}`).join(' ')}`);
}

function checkLowerLevels(): void {
    const parameters: RatingParameters = withValues({
        kBase: 40, stageWeight: 0.35, topOneDay: 30, topStage: 15, minFieldSize: 2, lowerEntryIndex: 1300, lowerK: 1.5,
    });
    // Riders 1-3 start in a 1.UWT race; riders 4 and 5 start in a 1.2 race with rider 1; rider 6 starts at a national championship
    const day: number = toDay('2022-04-03');
    const inputs: ClassificationInput[] = [
        { id: 1, date: fromDay(day), season: 2022, kind: 'one_day', classCode: '1.UWT', isGrandTour: false, cancelled: false, riderIds: [1, 2, 3], ranks: [1, 2, 3] },
        { id: 2, date: fromDay(day + 7), season: 2022, kind: 'one_day', classCode: '1.2', isGrandTour: false, cancelled: false, riderIds: [4, 1, 5], ranks: [1, 2, 3] },
        {
            id: 3, date: fromDay(day + 70), season: 2022, kind: 'championship_road_race', classCode: 'CN', isGrandTour: false, cancelled: false,
            riderIds: [6, 4], ranks: [1, 2],
        },
    ];
    const changes = runEngine(buildRatingData(inputs), { parameters, record: true }).changes!;
    const row = (classification: number, rider: number): number =>
        changes.classification.findIndex((id, index) => id === classification && changes.rider[index] === rider);
    for (const rider of [1, 2, 3]) assert(changes.indexBefore[row(1, rider)] === 1500, `rider ${rider} enters a 1.UWT race at 1500`);
    assert(changes.indexBefore[row(2, 4)] === 1300 && changes.indexBefore[row(2, 5)] === 1300, 'riders 4 and 5 enter a 1.2 race at 1300');
    assert(changes.indexBefore[row(2, 1)] === changes.indexAfter[row(1, 1)], 'rider 1 keeps his index in the 1.2 race');
    assert(changes.indexBefore[row(3, 6)] === 1300, 'rider 6 enters a national championship at 1300');
    assert(changes.indexBefore[row(3, 4)] === changes.indexAfter[row(2, 4)], 'rider 4 keeps his index at the national championship');
    assert(Math.abs(changes.k[row(1, 1)] - 40 * 1.0 * 1.0) < EPSILON, `K of a 1.UWT race is not multiplied: ${changes.k[row(1, 1)]}`);
    assert(Math.abs(changes.k[row(2, 1)] - 40 * 0.4 * 1.0 * 1.5) < EPSILON, `K of a 1.2 race x 1.5: ${changes.k[row(2, 1)]}`);
    assert(Math.abs(changes.k[row(3, 6)] - 40 * 0.5 * 1.0) < EPSILON, `K of a national championship is not multiplied: ${changes.k[row(3, 6)]}`);
    for (let index = 0; index < changes.delta.length; index++) {
        const recomputed: number = changes.k[index] * changes.multiplier[index] * (changes.duelsWon[index] - changes.duelsExpected[index])
            / (changes.fieldSize[index] - 1);
        assert(recomputed === changes.delta[index], `lower levels, row ${index}: delta recomputes exactly`);
    }
    console.info(`lower levels: entry 1300 in the 1.2 race and the national championship, K x 1.5 in the 1.2 race (${changes.delta.length} rating rows)`);
}

function main(): void {
    console.info(`Rating formula checks (defaults: K_base ${DEFAULT_PARAMETERS.kBase}, N ${DEFAULT_PARAMETERS.topOneDay}/${DEFAULT_PARAMETERS.topStage})`);
    checkFiveRiders();
    checkRandomFields();
    checkEngine();
    checkLowerLevels();
    console.info(`${checks} checks passed: monotonicity, |delta| <= K_c x m_i, zero sum when every m = 1, exact recomputation, multipliers, `
        + 'lower levels');
}

try {
    main();
} catch (error: unknown) {
    console.error((error as Error).message);
    process.exit(1);
}

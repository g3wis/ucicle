/**
 * Enriches riders from Wikidata: item (QID), labels, height, weight, French and English Wikipedia articles,
 * matched by "UCI rider ID" (P11020). Writes rider_profile, rider_external_id (wikidata_qid) and, when the label
 * is the rule-built name up to accents and case, the display name. Read-only on Wikidata, no image.
 *
 *   yarn enrich:wikidata [--batch 300] [--limit N]
 */
import { parseArgs } from 'node:util';

import type { Sql } from 'postgres';

import { connect } from '../db/connection.js';
import { enrichFromWikidata, type EnrichmentReport } from '../enrich/wikidata.js';

async function main(): Promise<void> {
    const { values } = parseArgs({
        args: process.argv.slice(2).filter(arg => arg !== '--'),
        options: { batch: { type: 'string', default: '300' }, limit: { type: 'string' } },
    });
    const batch = Number(values.batch);
    const limit: number | undefined = values.limit !== undefined ? Number(values.limit) : undefined;
    if (!Number.isInteger(batch) || batch < 1 || batch > 1000) throw new Error('--batch expects an integer from 1 to 1000');
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error('--limit expects a positive integer');

    const sql: Sql = connect(2);
    try {
        const started: number = Date.now();
        const report: EnrichmentReport = await enrichFromWikidata(sql, batch, limit);
        console.info(`Wikidata: ${report.idsQueried} UCI rider ids of ${report.riders} riders in ${report.requests} requests `
            + `(${report.retries} retried), ${((Date.now() - started) / 1000).toFixed(0)} s`);
        console.info(`  QID ${report.qid}, height ${report.height}, weight ${report.weight}, frwiki ${report.frwiki}, enwiki ${report.enwiki}`);
        console.info(`  display names changed: ${report.namesChanged} (subset of the UCI name ${report.changedByRule.subset}, `
            + `spelling ${report.changedByRule.spelling}); skipped: ${report.ambiguousRiders} riders with several items, `
            + `${report.sharedItems} items with several riders`);
        for (const change of report.changes) {
            console.info(`    [${change.rule}] ${change.before} -> ${change.after}${change.doubt ? `   DOUBT: ${change.doubt}` : ''}`);
        }
        console.info(`  display names back to the rule-built name (no label qualifies any more): ${report.reverted.length}`);
        for (const revert of report.reverted) console.info(`    [reverted] ${revert.before} -> ${revert.after}`);
    } finally {
        await sql.end();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});

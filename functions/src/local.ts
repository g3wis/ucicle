import { writeFile } from 'node:fs/promises';

import { loadRiders } from './scrappers/riderLoader.js';
import { getMaxMemoryConsumed } from './utils/statUtils.js';

/**
 * Local dry run of LOAD_RIDERS: builds the riders list and writes it to a file instead of the bucket.
 * Usage: node build/local.js [output file, default build/riders.local.json]
 */
const output: string = process.argv[2] ?? 'build/riders.local.json';
const startDate: number = Date.now();

const riders = await loadRiders();
await writeFile(output, JSON.stringify(riders, null, 2));

console.info(`Wrote ${riders.length} riders to ${output} in ${((Date.now() - startDate) / 1000).toFixed(2)}s (max heap ${getMaxMemoryConsumed()}MB)`);

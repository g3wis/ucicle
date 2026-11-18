import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);

/** Default archive directory: functions/.data/raw (git-ignored) */
const DEFAULT_ARCHIVE_DIR: string = fileURLToPath(new URL('../../.data/raw/', import.meta.url));

/**
 * Keeps every raw DataRide response, gzipped, so the data can be parsed again if the API changes.
 * Files are overwritten when the same resource is fetched again (the latest version is kept).
 */
export class RawArchive {
    readonly root: string;

    /**
     * @param root Directory of the archive, RAW_ARCHIVE_DIR by default, else functions/.data/raw
     */
    constructor(root: string = process.env.RAW_ARCHIVE_DIR || DEFAULT_ARCHIVE_DIR) {
        this.root = resolve(root);
    }

    /**
     * @param relativePath Path inside the archive, without extension (e.g. "dataride/competitions/76363/races")
     * @param body Raw response body
     */
    async write(relativePath: string, body: string): Promise<void> {
        const file: string = join(this.root, `${relativePath}.json.gz`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, await gzipAsync(body));
    }
}

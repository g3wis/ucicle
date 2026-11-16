import { uploadObject } from '../s3/S3Service.js';
import { loadRiders } from '../scrappers/riderLoader.js';
import { Rider } from '../types/CyclingTypes.js';
import { HandlerResponse } from '../types/ResponseTypes.js';
import { getMaxMemoryConsumed } from '../utils/statUtils.js';

export { handleLoadRiders };

// Never replace the game data with a list too short to play: keep the previous one instead
const MIN_RIDERS = 300;
const MIN_SECRET_RIDER_CANDIDATES = 50;

async function handleLoadRiders(): Promise<HandlerResponse> {

    const startDate: Date = new Date();

    if (!process.env.BUCKET_NAME) throw new Error('BUCKET_NAME environment variable not defined');

    try {
        const riders: Rider[] = await loadRiders();

        const secretRiderCandidates: number = riders.filter(rider => rider.rank <= 100).length;
        if (riders.length < MIN_RIDERS || secretRiderCandidates < MIN_SECRET_RIDER_CANDIDATES) {
            throw new Error(`Only ${riders.length} complete riders (${secretRiderCandidates} in the top 100), not uploading`);
        }

        await uploadObject(
            riders,
            'api/riders.json',
            process.env.BUCKET_NAME,
            'ONEZONE_IA',
            'public-read'
        );

        const endDate: Date = new Date();
        const runTime: number = (endDate.getTime() - startDate.getTime()) / 1000;

        console.info(`Successfully uploaded ${riders.length} riders with a maximum memory consumption of ${getMaxMemoryConsumed()}MB in ${runTime?.toFixed(2)}s`);
        return {
            body: `Successfully uploaded ${riders.length} riders with a maximum memory consumption of ${getMaxMemoryConsumed()}MB in ${runTime?.toFixed(2)}s`,
            statusCode: 200
        };
    } catch (e: unknown) {
        const err: Error = e as Error;
        const endDate: Date = new Date();
        const runTime: number = (endDate.getTime() - startDate.getTime()) / 1000;

        console.error(`Failed importing riders (duration ${runTime?.toFixed(2)}s) with error ${err?.message || 'Unknown error'}: ${err?.stack || 'Unknown stacktrace'}`);
        return {
            body: `Failed importing riders (duration ${runTime?.toFixed(2)}s) with error ${err?.message || 'Unknown error'}: ${err?.stack || 'Unknown stacktrace'}`,
            statusCode: 500
        };
    }
}

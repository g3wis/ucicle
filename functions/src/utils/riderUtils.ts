import { Rider, SecretRider } from '../types/CyclingTypes.js';

/** The secret rider of the day is drawn from the riders ranked up to this UCI rank. */
export const SECRET_RIDER_MAX_RANK = 100;

/**
 * @param rider A rider of riders.json
 * @return Whether the rider can be the secret rider: ranked in the current top 100, with a UCI team,
 * a height, a weight and a best result (the starting hint)
 */
export function isSecretRiderCandidate(rider: Rider): rider is SecretRider {
    return rider.rank !== null && rider.rank <= SECRET_RIDER_MAX_RANK && rider.team !== null
        && rider.height !== null && rider.weight !== null && rider.bestResult !== null;
}

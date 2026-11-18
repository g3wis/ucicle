import type { APIRoute } from 'astro';
import { relayGameFile } from '../../server/gameData';

export const GET: APIRoute = () => relayGameFile('secret_rider.json');

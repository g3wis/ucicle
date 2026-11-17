import { Comparison } from './compare';

// The arrows are bare triangles (no tile on any platform), so the blue square stays the only blue
// tile and a found row is the only all-blue row (D22).
const ROW_EMOJI = {
  up: '🔺', down: '🔻', eq: '🟦', no: '⬛',
} as const;

/**
 * One row per try, in the order of the board: age, height, weight, country, team.
 * 🔺 the mystery value is higher, 🔻 lower; a blue square is equal or same; black is different.
 * Never the rider's name: the answer stays out of everything shared.
 */
export function shareGrid(comparisons: Comparison[]): string {
  return comparisons
    .map((c) => [c.age, c.height, c.weight, c.country, c.team].map((s) => ROW_EMOJI[s]).join(''))
    .join('\n');
}

export function shareText(headline: string, comparisons: Comparison[], url: string): string {
  return `${headline}\n${shareGrid(comparisons)}\n${url}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

/** The native share sheet on touch devices, the clipboard everywhere else. */
export async function shareResult(text: string): Promise<ShareOutcome> {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    // Guarded: browsers without the async clipboard throw here and fall back to the selection copy.
    // eslint-disable-next-line compat/compat
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return copyWithSelection(text) ? 'copied' : 'failed';
  }
}

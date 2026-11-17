/**
 * Below this width the mystery bib sits above the board and scrolls out of view while the board
 * is played: the facts band shows, a try scrolls the next field into reach. From 1024 px the
 * mystery bib is sticky beside the board. Mirrors the 1024 px breakpoint of the stylesheets.
 */
export const PHONE_QUERY = '(max-width: 1023px)';

export function isPhone(): boolean {
  return window.matchMedia(PHONE_QUERY).matches;
}

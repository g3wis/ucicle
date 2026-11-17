/**
 * Motion tokens of the interaction thesis (.bunshin/direction.md). The CSS mirrors them in
 * assets/scss/_tokens.scss (--dur-*, --ease-*). Nothing else may introduce a duration or an easing.
 */
export const DURATION = {
  fast: 0.14,
  base: 0.2,
  panel: 0.24,
  panelOut: 0.18,
  flip: 0.42,
  reduced: 0.12,
} as const;

export const EASE_OUT = [0.2, 0.7, 0.2, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** The bib landing: one small overshoot, about 300 ms. */
export const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

export const STAGGER = { cells: 0.08, pins: 0.04 } as const;

/** Delay before a landed bib's cells start stamping in. */
export const CELLS_DELAY = 0.18;

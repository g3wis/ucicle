export type ComparisionResult = 'lower' | 'equals' | 'higher';

export function compareNumbers(compared: number, comparator: number): ComparisionResult {
  if (comparator === compared) return 'equals';
  if (comparator > compared) return 'lower';
  return 'higher';
}

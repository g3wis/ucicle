/** Calendar days as integers (days since 1970-01-01), the engine's unit of time */

const MS_PER_DAY = 86_400_000;

/**
 * @param date 'YYYY-MM-DD'
 * @return Days since 1970-01-01
 */
export function toDay(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/**
 * @param day Days since 1970-01-01
 * @return 'YYYY-MM-DD'
 */
export function fromDay(day: number): string {
    return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * @param day Days since 1970-01-01
 * @return Day of the week, 0 = Sunday ... 1 = Monday
 */
export function weekDay(day: number): number {
    return new Date(day * MS_PER_DAY).getUTCDay();
}

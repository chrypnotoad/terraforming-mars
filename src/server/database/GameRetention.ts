import {addDays, stringToNumber} from './utils';

export function getMaxGameDays(value: string | undefined = process.env.MAX_GAME_DAYS): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const days = stringToNumber(value, Number.NaN);
  return Number.isInteger(days) && days > 0 ? days : undefined;
}

// Explicit arguments are also used by database maintenance tests to force a
// cutoff in the future. Runtime configuration still requires a positive value.
export function getPurgeGameDaysForMaintenance(override?: string): number | undefined {
  if (override === undefined) {
    return getMaxGameDays();
  }

  const days = stringToNumber(override, Number.NaN);
  return Number.isInteger(days) ? days : undefined;
}

export function getExpectedPurgeTimeMs(createdTime: Date, value: string | undefined = process.env.MAX_GAME_DAYS): number {
  const days = getMaxGameDays(value);
  if (createdTime.getTime() === 0 || days === undefined) {
    return 0;
  }
  return addDays(createdTime, days).getTime();
}

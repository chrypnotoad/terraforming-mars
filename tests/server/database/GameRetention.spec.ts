import {expect} from 'chai';
import {getExpectedPurgeTimeMs, getMaxGameDays, getPurgeGameDaysForMaintenance} from '../../../src/server/database/GameRetention';

describe('GameRetention', () => {
  const createdTime = new Date('2026-08-09T12:00:00.000Z');

  it('retains games indefinitely when MAX_GAME_DAYS is absent or blank', () => {
    expect(getMaxGameDays(undefined)).eq(undefined);
    expect(getMaxGameDays('')).eq(undefined);
    expect(getExpectedPurgeTimeMs(createdTime, undefined)).eq(0);
    expect(getExpectedPurgeTimeMs(createdTime, '  ')).eq(0);
  });

  it('uses a configured retention period for the purge warning', () => {
    expect(getMaxGameDays('30')).eq(30);
    expect(getExpectedPurgeTimeMs(createdTime, '30')).eq(new Date('2026-09-08T12:00:00.000Z').getTime());
  });

  it('hides the warning for invalid or non-positive values', () => {
    expect(getMaxGameDays('invalid')).eq(undefined);
    expect(getMaxGameDays('0')).eq(undefined);
    expect(getMaxGameDays('-1')).eq(undefined);
    expect(getExpectedPurgeTimeMs(createdTime, 'invalid')).eq(0);
    expect(getExpectedPurgeTimeMs(createdTime, '0')).eq(0);
    expect(getExpectedPurgeTimeMs(createdTime, '-1')).eq(0);
  });

  it('allows an explicit maintenance override without treating it as runtime configuration', () => {
    expect(getPurgeGameDaysForMaintenance('-1')).eq(-1);
  });
});

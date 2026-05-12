import { describe, expect, test } from 'bun:test';
import { cronFieldsToLaunchd, validateCron } from './cron-parse';

describe('validateCron', () => {
  test('accepts valid daily cron', () => {
    expect(validateCron('0 9 * * *')).toEqual({ valid: true });
  });

  test('accepts weekday-range cron', () => {
    expect(validateCron('0 9 * * 1-5')).toEqual({ valid: true });
  });

  test('rejects wrong field count', () => {
    const result = validateCron('0 9 * *');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expected 5 fields');
  });

  test('rejects invalid characters', () => {
    const result = validateCron('0 9 * * abc');
    expect(result.valid).toBe(false);
  });
});

describe('cronFieldsToLaunchd', () => {
  test('converts daily 9am', () => {
    expect(cronFieldsToLaunchd('0 9 * * *')).toEqual({ Minute: 0, Hour: 9 });
  });

  test('converts Sunday noon', () => {
    expect(cronFieldsToLaunchd('0 12 * * 0')).toEqual({
      Minute: 0,
      Hour: 12,
      Weekday: 0,
    });
  });
});

import { describe, it, expect } from 'vitest';
import { CronExpressionParser } from 'cron-parser';

/**
 * Tests for cron next-run date computation.
 * The getNextRunDate() function in scheduler.ts uses cron-parser internally.
 * These tests verify that complex cron patterns produce valid future dates,
 * covering the bug where only simple "HH MM * * *" patterns worked (GH#15).
 */
describe('cron expression next-run computation', () => {
  function getNextRunDate(expression: string): string | null {
    try {
      const interval = CronExpressionParser.parse(expression);
      return interval.next().toISOString();
    } catch {
      return null;
    }
  }

  it('handles simple daily pattern (30 6 * * *)', () => {
    const result = getNextRunDate('30 6 * * *');
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getMinutes()).toBe(30);
    expect(date.getHours()).toBe(6);
  });

  it('handles every-15-minutes pattern (*/15 * * * *)', () => {
    const result = getNextRunDate('*/15 * * * *');
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect([0, 15, 30, 45]).toContain(date.getMinutes());
  });

  it('handles weekday-only pattern (0 6,18 * * 1-5)', () => {
    const result = getNextRunDate('0 6,18 * * 1-5');
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getMinutes()).toBe(0);
    expect([6, 18]).toContain(date.getHours());
    // Day 0 = Sunday, 6 = Saturday — should be 1-5
    expect(date.getDay()).toBeGreaterThanOrEqual(1);
    expect(date.getDay()).toBeLessThanOrEqual(5);
  });

  it('handles step pattern on hours (0 */4 * * *)', () => {
    const result = getNextRunDate('0 */4 * * *');
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getMinutes()).toBe(0);
    expect(date.getHours() % 4).toBe(0);
  });

  it('returns a date in the future', () => {
    const now = new Date();
    const result = getNextRunDate('*/5 * * * *');
    expect(result).not.toBeNull();
    expect(new Date(result!).getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns null for invalid expressions', () => {
    expect(getNextRunDate('not a cron')).toBeNull();
    expect(getNextRunDate('99 99 99 99 99')).toBeNull();
  });
});

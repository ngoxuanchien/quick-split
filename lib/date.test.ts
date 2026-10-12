import { describe, expect, it } from 'vitest';
import { formatDate } from './date';

describe('formatDate', () => {
  it('uses Vietnam time regardless of server timezone', () => {
    // 01:30 on 12/10 in Vietnam is still 11/10 in UTC
    expect(formatDate(new Date('2026-10-11T18:30:00Z'))).toBe('12/10/2026');
  });
  it('formats en as day, short month, year in Vietnam time', () => {
    expect(formatDate(new Date('2026-10-11T18:30:00Z'), 'en')).toBe('12 Oct 2026');
  });
});

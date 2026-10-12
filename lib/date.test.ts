import { describe, expect, it } from 'vitest';
import { formatDateVn } from './date';

describe('formatDateVn', () => {
  it('uses Vietnam time regardless of server timezone', () => {
    // 01:30 on 12/10 in Vietnam is still 11/10 in UTC
    expect(formatDateVn(new Date('2026-10-11T18:30:00Z'))).toBe('12/10/2026');
  });
});

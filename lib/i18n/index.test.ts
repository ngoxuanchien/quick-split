import { describe, expect, it } from 'vitest';
import { dicts, pickLocale } from '.';

describe('pickLocale', () => {
  it('uses a valid cookie over the header', () => expect(pickLocale('en', 'vi-VN')).toBe('en'));
  it('ignores an unsupported cookie', () => expect(pickLocale('xx', 'en-US')).toBe('en'));
  it('ignores a prototype-name cookie', () => expect(pickLocale('__proto__', null)).toBe('vi'));
  it('matches the primary subtag', () => expect(pickLocale(undefined, 'en-US,en;q=0.9')).toBe('en'));
  it('skips unsupported languages', () => expect(pickLocale(undefined, 'fr,vi;q=0.5')).toBe('vi'));
  it('respects q order, not header order', () => expect(pickLocale(undefined, 'vi;q=0.4,en;q=0.8')).toBe('en'));
  it('defaults to vi when nothing matches', () => expect(pickLocale(undefined, 'fr-FR')).toBe('vi'));
  it('defaults to vi without a header', () => expect(pickLocale(undefined, null)).toBe('vi'));
  it('treats q=0 as not acceptable', () => expect(pickLocale(undefined, 'en;q=0')).toBe('vi'));
  it('survives garbage', () => {
    expect(pickLocale(undefined, '')).toBe('vi');
    expect(pickLocale(undefined, '*')).toBe('vi');
    expect(pickLocale(undefined, 'en;q=abc')).toBe('vi');
  });
});

describe('dictionaries', () => {
  // tsc enforces this too; the test catches it without a build
  const shape = (o: object): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? shape(v).map((s) => `${k}.${s}`) : [k])).sort();
  it('en has exactly the vi keys', () => expect(shape(dicts.en)).toEqual(shape(dicts.vi)));
});

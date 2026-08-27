import { describe, expect, it } from 'vitest';
import { compareVersions, VERSION_PATTERN } from '@/lib/version';

describe('online version checks', () => {
  it('compares semantic version numbers', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
    expect(compareVersions('1.0.9', '1.1.0')).toBe(-1);
  });

  it('accepts only simple release versions', () => {
    expect(VERSION_PATTERN.test('2.4.1')).toBe(true);
    expect(VERSION_PATTERN.test('latest')).toBe(false);
  });
});

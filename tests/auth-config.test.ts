import { describe, expect, it } from 'vitest';
import { INITIAL_AUTH, PASSWORD_ITERATIONS } from '@/lib/constants';

describe('password configuration', () => {
  it('stays within the Cloudflare Workers PBKDF2 limit', () => {
    expect(PASSWORD_ITERATIONS).toBeGreaterThanOrEqual(100_000);
    expect(PASSWORD_ITERATIONS).toBeLessThanOrEqual(100_000);
    expect(INITIAL_AUTH.iterations).toBe(PASSWORD_ITERATIONS);
  });
});

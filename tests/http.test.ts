import { describe, expect, it } from 'vitest'; import { monthBounds } from '@/lib/http';
describe('上海时区月份边界', () => { it('按东八区计算月初并正确跨年', () => { expect(monthBounds('2026-01')).toEqual({ month: '2026-01', start: '2025-12-31T16:00:00.000Z', end: '2026-01-31T16:00:00.000Z' }); }); it('正确处理闰年二月', () => { expect(monthBounds('2024-02').end).toBe('2024-02-29T16:00:00.000Z'); }); });

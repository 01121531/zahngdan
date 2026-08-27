import { describe, expect, it } from 'vitest'; import { dateRangeBounds, monthBounds } from '@/lib/http';
describe('上海时区月份边界', () => {
  it('按东八区计算月初并正确跨年', () => { expect(monthBounds('2026-01')).toEqual({ month: '2026-01', start: '2025-12-31T16:00:00.000Z', end: '2026-01-31T16:00:00.000Z' }); });
  it('正确处理闰年二月', () => { expect(monthBounds('2024-02').end).toBe('2024-02-29T16:00:00.000Z'); });
  it('自定义区间包含开始和结束日期的整天', () => { expect(dateRangeBounds('2024-02-29', '2024-03-01')).toEqual({ start: '2024-02-28T16:00:00.000Z', end: '2024-03-01T16:00:00.000Z' }); });
  it('拒绝缺失、倒置或不存在的日期', () => { expect(() => dateRangeBounds('2026-01-01', null)).toThrow('同时填写'); expect(() => dateRangeBounds('2026-02-02', '2026-02-01')).toThrow('不能晚于'); expect(() => dateRangeBounds('2023-02-29', '2023-03-01')).toThrow('格式不正确'); });
});

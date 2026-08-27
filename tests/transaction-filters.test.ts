import { describe, expect, it } from 'vitest';
import { decodeTransactionCursor, encodeTransactionCursor, transactionFilterSql } from '@/lib/transaction-filters';

describe('账单时间筛选和分页', () => {
  it('全部时间不添加日期限制', () => { const result = transactionFilterSql(new URL('https://example.test/api/transactions?type=expense')); expect(result.clauses).toEqual(['t.deleted_at IS NULL', 't.type = ?']); expect(result.values).toEqual(['expense']); });
  it('自定义日期优先于月份并包含筛选参数', () => { const result = transactionFilterSql(new URL('https://example.test/api/transactions?month=2026-08&dateFrom=2024-02-29&dateTo=2024-03-01&payment=微信')); expect(result.clauses.join(' ')).toContain('t.occurred_at >= ?'); expect(result.values).toEqual(['2024-02-28T16:00:00.000Z', '2024-03-01T16:00:00.000Z', '微信']); });
  it('分页游标可稳定往返并拒绝伪造内容', () => { const value = { occurredAt: '2026-08-27T08:00:00.000Z', id: 'bill-1' }; expect(decodeTransactionCursor(encodeTransactionCursor(value))).toEqual(value); expect(() => decodeTransactionCursor('bad')).toThrow('分页位置无效'); });
});

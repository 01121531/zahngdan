import { dateRangeBounds, monthBounds } from '@/lib/http';

export class TransactionFilterError extends Error {}

export function transactionFilterSql(url: URL, alias = 't') {
  const clauses = [`${alias}.deleted_at IS NULL`];
  const values: unknown[] = [];
  let range;
  try { range = dateRangeBounds(url.searchParams.get('dateFrom'), url.searchParams.get('dateTo')); }
  catch (error) { throw new TransactionFilterError(error instanceof Error ? error.message : '日期筛选条件不正确'); }
  if (range) {
    clauses.push(`${alias}.occurred_at >= ? AND ${alias}.occurred_at < ?`); values.push(range.start, range.end);
  } else {
    const month = url.searchParams.get('month');
    if (month) { const bounds = monthBounds(month); clauses.push(`${alias}.occurred_at >= ? AND ${alias}.occurred_at < ?`); values.push(bounds.start, bounds.end); }
  }
  const type = url.searchParams.get('type'); if (type === 'expense' || type === 'income') { clauses.push(`${alias}.type = ?`); values.push(type); }
  const category = url.searchParams.get('category'); if (category) { clauses.push(`${alias}.category_id = ?`); values.push(category); }
  const payment = url.searchParams.get('payment'); if (payment) { clauses.push(`${alias}.payment_method = ?`); values.push(payment); }
  const search = url.searchParams.get('q')?.trim(); if (search) { clauses.push(`(${alias}.title LIKE ? OR ${alias}.note LIKE ?)`); values.push(`%${search}%`, `%${search}%`); }
  return { clauses, values };
}

export type TransactionCursor = { occurredAt: string; id: string };

export function encodeTransactionCursor(cursor: TransactionCursor) {
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function decodeTransactionCursor(value: string | null) {
  if (!value) return null;
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const parsed = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Partial<TransactionCursor>;
    if (typeof parsed.occurredAt !== 'string' || Number.isNaN(Date.parse(parsed.occurredAt)) || typeof parsed.id !== 'string' || !parsed.id) throw new Error();
    return { occurredAt: parsed.occurredAt, id: parsed.id };
  } catch {
    throw new TransactionFilterError('分页位置无效，请重新加载');
  }
}

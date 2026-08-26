import { getD1 } from '@/lib/database';
import { monthBounds } from '@/lib/http';
export type ExportTransaction = { id: string; type: 'expense' | 'income'; amountCents: number; title: string; categoryName: string | null; paymentMethod: string | null; occurredAt: string; note: string | null };

export async function exportTransactions(url: URL) {
  const clauses = ['t.deleted_at IS NULL']; const values: unknown[] = [];
  const month = url.searchParams.get('month'); if (month) { const bounds = monthBounds(month); clauses.push('t.occurred_at >= ? AND t.occurred_at < ?'); values.push(bounds.start, bounds.end); }
  const type = url.searchParams.get('type'); if (type === 'expense' || type === 'income') { clauses.push('t.type = ?'); values.push(type); }
  const category = url.searchParams.get('category'); if (category) { clauses.push('t.category_id = ?'); values.push(category); }
  const payment = url.searchParams.get('payment'); if (payment) { clauses.push('t.payment_method = ?'); values.push(payment); }
  const search = url.searchParams.get('q')?.trim(); if (search) { clauses.push('(t.title LIKE ? OR t.note LIKE ?)'); values.push(`%${search}%`, `%${search}%`); }
  return (await getD1().prepare(`SELECT t.id, t.type, t.amount_cents AS amountCents, t.title, c.name AS categoryName, t.payment_method AS paymentMethod, t.occurred_at AS occurredAt, t.note FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${clauses.join(' AND ')} ORDER BY t.occurred_at DESC`).bind(...values).all<ExportTransaction>()).results;
}

function csvCell(value: unknown) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function transactionsCsv(rows: ExportTransaction[]) {
  const header = ['账单ID', '类型', '金额（元）', '标题', '分类', '支付方式', '发生时间', '备注'];
  const body = rows.map((row) => [row.id, row.type === 'expense' ? '支出' : '收入', (row.amountCents / 100).toFixed(2), row.title, row.categoryName || '未分类', row.paymentMethod || '', new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.occurredAt)), row.note || '']);
  return `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(',')).join('\r\n')}`;
}

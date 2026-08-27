import { getD1 } from '@/lib/database';
import { transactionFilterSql } from '@/lib/transaction-filters';
export type ExportTransaction = { id: string; type: 'expense' | 'income'; amountCents: number; title: string; categoryName: string | null; paymentMethod: string | null; occurredAt: string; note: string | null };

export async function exportTransactions(url: URL) {
  const { clauses, values } = transactionFilterSql(url);
  return (await getD1().prepare(`SELECT t.id, t.type, t.amount_cents AS amountCents, t.title, c.name AS categoryName, t.payment_method AS paymentMethod, t.occurred_at AS occurredAt, t.note FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${clauses.join(' AND ')} ORDER BY t.occurred_at DESC, t.id DESC`).bind(...values).all<ExportTransaction>()).results;
}

function csvCell(value: unknown) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function transactionsCsv(rows: ExportTransaction[]) {
  const header = ['账单ID', '类型', '金额（元）', '标题', '分类', '支付方式', '发生时间', '备注'];
  const body = rows.map((row) => [row.id, row.type === 'expense' ? '支出' : '收入', (row.amountCents / 100).toFixed(2), row.title, row.categoryName || '未分类', row.paymentMethod || '', new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.occurredAt)), row.note || '']);
  return `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(',')).join('\r\n')}`;
}

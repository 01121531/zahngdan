import { requireAuth, verifySameOrigin } from '@/lib/auth';
import { ensureDatabase, getD1, purgeExpiredTrash } from '@/lib/database';
import { jsonError, monthBounds, readJson } from '@/lib/http';
import { amountToCents, transactionSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request); if (unauthorized) return unauthorized; await ensureDatabase(); const url = new URL(request.url); const db = getD1();
  const clauses = ['t.deleted_at IS NULL']; const values: unknown[] = [];
  const month = url.searchParams.get('month'); if (month) { const bounds = monthBounds(month); clauses.push('t.occurred_at >= ? AND t.occurred_at < ?'); values.push(bounds.start, bounds.end); }
  const type = url.searchParams.get('type'); if (type === 'expense' || type === 'income') { clauses.push('t.type = ?'); values.push(type); }
  const category = url.searchParams.get('category'); if (category) { clauses.push('t.category_id = ?'); values.push(category); }
  const payment = url.searchParams.get('payment'); if (payment) { clauses.push('t.payment_method = ?'); values.push(payment); }
  const search = url.searchParams.get('q')?.trim(); if (search) { clauses.push('(t.title LIKE ? OR t.note LIKE ?)'); values.push(`%${search}%`, `%${search}%`); }
  const result = await db.prepare(`SELECT t.id, t.type, t.amount_cents AS amountCents, t.currency, t.title, t.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor, t.payment_method AS paymentMethod, t.occurred_at AS occurredAt, t.note, t.created_at AS createdAt, t.updated_at AS updatedAt, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id AND a.deleted_at IS NULL) AS attachmentCount FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${clauses.join(' AND ')} ORDER BY t.occurred_at DESC LIMIT 500`).bind(...values).all();
  return Response.json({ transactions: result.results });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth(request); if (unauthorized) return unauthorized; if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403);
  const parsed = transactionSchema.safeParse(await readJson(request)); if (!parsed.success) return jsonError('账单信息不完整', 400, parsed.error.flatten()); await ensureDatabase();
  const category = await getD1().prepare('SELECT id FROM categories WHERE id = ? AND type = ?').bind(parsed.data.categoryId, parsed.data.type).first(); if (!category) return jsonError('所选分类不可用');
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const occurredAt = new Date(parsed.data.occurredAt).toISOString();
  await getD1().prepare('INSERT INTO transactions (id, type, amount_cents, currency, title, category_id, payment_method, occurred_at, note, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)').bind(id, parsed.data.type, amountToCents(parsed.data.amount), 'CNY', parsed.data.title, parsed.data.categoryId, parsed.data.paymentMethod, occurredAt, parsed.data.note, now, now).run();
  await purgeExpiredTrash(); return Response.json({ id }, { status: 201 });
}

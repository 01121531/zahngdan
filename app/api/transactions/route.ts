import { requireAuth, verifySameOrigin } from '@/lib/auth';
import { ensureDatabase, getD1, isDatabaseBusy, purgeExpiredTrash, retryDatabase } from '@/lib/database';
import { jsonError, readJson } from '@/lib/http';
import { decodeTransactionCursor, encodeTransactionCursor, TransactionFilterError, transactionFilterSql } from '@/lib/transaction-filters';
import { amountToCents, transactionSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request); if (unauthorized) return unauthorized; await ensureDatabase(); const url = new URL(request.url); const db = getD1();
  try {
    const { clauses, values } = transactionFilterSql(url); const cursor = decodeTransactionCursor(url.searchParams.get('cursor'));
    const summary = await retryDatabase(() => db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount_cents ELSE 0 END), 0) AS income, COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount_cents ELSE 0 END), 0) AS expense FROM transactions t WHERE ${clauses.join(' AND ')}`).bind(...values).first<{ count: number; income: number; expense: number }>());
    if (cursor) { clauses.push('(t.occurred_at < ? OR (t.occurred_at = ? AND t.id < ?))'); values.push(cursor.occurredAt, cursor.occurredAt, cursor.id); }
    const result = await retryDatabase(() => db.prepare(`SELECT t.id, t.type, t.amount_cents AS amountCents, t.currency, t.title, t.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor, t.payment_method AS paymentMethod, t.occurred_at AS occurredAt, t.note, t.created_at AS createdAt, t.updated_at AS updatedAt, (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id AND a.deleted_at IS NULL) AS attachmentCount FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${clauses.join(' AND ')} ORDER BY t.occurred_at DESC, t.id DESC LIMIT 51`).bind(...values).all<{ id: string; occurredAt: string }>());
    const transactions = result.results.slice(0, 50); const last = transactions.at(-1); const nextCursor = result.results.length > 50 && last ? encodeTransactionCursor(last) : null;
    return Response.json({ transactions, nextCursor, summary: summary || { count: 0, income: 0, expense: 0 } });
  } catch (error) {
    if (error instanceof TransactionFilterError) return jsonError(error.message, 400);
    if (isDatabaseBusy(error)) return Response.json({ error: '数据库暂时繁忙，请重试', code: 'DATABASE_BUSY', retryable: true }, { status: 503 });
    console.error('Transaction list failed', error); return jsonError('账单列表暂时无法加载', 500);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth(request); if (unauthorized) return unauthorized; if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403);
  const parsed = transactionSchema.safeParse(await readJson(request)); if (!parsed.success) return jsonError('账单信息不完整', 400, parsed.error.flatten());
  const requestId = request.headers.get('idempotency-key')?.trim() || null;
  if (requestId && !/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) return jsonError('保存请求标识无效', 400);
  await ensureDatabase(); const db = getD1();
  try {
    if (requestId) { const previous = await db.prepare('SELECT transaction_id AS id FROM transaction_requests WHERE request_id = ?').bind(requestId).first<{ id: string }>(); if (previous) return Response.json({ id: previous.id, duplicate: true }); }
    const category = await db.prepare('SELECT id FROM categories WHERE id = ? AND type = ?').bind(parsed.data.categoryId, parsed.data.type).first(); if (!category) return jsonError('所选分类不可用');
    const id = crypto.randomUUID(); const now = new Date().toISOString(); const occurredAt = new Date(parsed.data.occurredAt).toISOString();
    const insert = db.prepare('INSERT INTO transactions (id, type, amount_cents, currency, title, category_id, payment_method, occurred_at, note, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)').bind(id, parsed.data.type, amountToCents(parsed.data.amount), 'CNY', parsed.data.title, parsed.data.categoryId, parsed.data.paymentMethod, occurredAt, parsed.data.note, now, now);
    if (requestId) await retryDatabase(() => db.batch([insert, db.prepare('INSERT INTO transaction_requests (request_id, transaction_id, created_at) VALUES (?, ?, ?)').bind(requestId, id, now)]));
    else await retryDatabase(() => insert.run());
    try { await purgeExpiredTrash(); } catch (error) { console.error('Trash cleanup after transaction save failed', error); }
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (requestId) { const previous = await db.prepare('SELECT transaction_id AS id FROM transaction_requests WHERE request_id = ?').bind(requestId).first<{ id: string }>().catch(() => null); if (previous) return Response.json({ id: previous.id, duplicate: true }); }
    if (isDatabaseBusy(error)) return Response.json({ error: '数据库暂时繁忙，请重试', code: 'DATABASE_BUSY', retryable: true }, { status: 503 });
    console.error('Transaction creation failed', error); return jsonError('账单没有保存成功，请稍后重试', 500);
  }
}

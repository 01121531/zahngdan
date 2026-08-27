import { env } from 'cloudflare:workers';
import { CATEGORY_SEEDS, INITIAL_AUTH } from '@/lib/constants';

export function getD1(): D1Database { if (!env.DB) throw new Error('数据库暂不可用'); return env.DB; }
export function getFiles(): R2Bucket { if (!env.FILES) throw new Error('文件存储暂不可用'); return env.FILES; }

function randomBase64Url(bytes = 32) {
  const value = new Uint8Array(bytes); crypto.getRandomValues(value); let binary = ''; value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function ensureDatabase() {
  const db = getD1();
  const statements = [
    `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL, color TEXT NOT NULL, is_builtin INTEGER NOT NULL DEFAULT 0, is_hidden INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', title TEXT NOT NULL, category_id TEXT REFERENCES categories(id) ON DELETE SET NULL, payment_method TEXT, occurred_at TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY NOT NULL, transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE, object_key TEXT NOT NULL, preview_object_key TEXT, original_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS auth_config (id INTEGER PRIMARY KEY NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, password_iterations INTEGER NOT NULL, session_secret TEXT, session_version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS login_attempts (source_hash TEXT PRIMARY KEY NOT NULL, failure_count INTEGER NOT NULL DEFAULT 0, window_started_at TEXT NOT NULL, locked_until TEXT)`,
    `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS update_state (id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1), state TEXT NOT NULL, message TEXT NOT NULL, current_version TEXT, request_id TEXT, requested_at TEXT, started_at TEXT, finished_at TEXT, heartbeat_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_categories_type_hidden_order ON categories(type, is_hidden, sort_order)`, `CREATE INDEX IF NOT EXISTS idx_transactions_deleted_occurred ON transactions(deleted_at, occurred_at)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`, `CREATE INDEX IF NOT EXISTS idx_transactions_type_occurred ON transactions(type, occurred_at)`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_transaction_deleted ON attachments(transaction_id, deleted_at)`, `CREATE INDEX IF NOT EXISTS idx_attachments_deleted ON attachments(deleted_at)`,
  ];
  await db.batch(statements.map((sql) => db.prepare(sql)));
  const now = new Date().toISOString();
  await db.prepare(`INSERT OR IGNORE INTO update_state (id, state, message, current_version, request_id, requested_at, started_at, finished_at, heartbeat_at) VALUES (1, 'idle', '可以检查并安装新版本', NULL, NULL, NULL, NULL, NULL, NULL)`).run();
  await db.prepare(`INSERT OR IGNORE INTO auth_config (id, password_salt, password_hash, password_iterations, session_secret, session_version, updated_at) VALUES (1, ?, ?, ?, NULL, 1, ?)`)
    .bind(INITIAL_AUTH.salt, INITIAL_AUTH.hash, INITIAL_AUTH.iterations, now).run();
  await db.prepare(`UPDATE auth_config SET password_salt = ?, password_hash = ?, password_iterations = ?, session_version = session_version + 1, updated_at = ? WHERE id = 1 AND password_iterations > ?`)
    .bind(INITIAL_AUTH.salt, INITIAL_AUTH.hash, INITIAL_AUTH.iterations, now, INITIAL_AUTH.iterations).run();
  const categoryCount = await db.prepare('SELECT COUNT(*) AS count FROM categories').first<{ count: number }>();
  if (!categoryCount?.count) await db.batch(CATEGORY_SEEDS.map(([id, type, name, icon, color, order]) => db.prepare(`INSERT INTO categories (id, type, name, icon, color, is_builtin, is_hidden, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`).bind(id, type, name, icon, color, order, now, now)));
  const config = await db.prepare('SELECT session_secret FROM auth_config WHERE id = 1').first<{ session_secret: string | null }>();
  if (!config?.session_secret) await db.prepare('UPDATE auth_config SET session_secret = ?, updated_at = ? WHERE id = 1').bind(randomBase64Url(), now).run();
}

export async function purgeExpiredTrash() {
  await ensureDatabase(); const db = getD1(); const cutoff = new Date(Date.now() - 30 * 86400000).toISOString(); const files = getFiles();
  const old = await db.prepare(`SELECT id, object_key, preview_object_key FROM attachments WHERE (deleted_at IS NOT NULL AND deleted_at <= ?) OR transaction_id IN (SELECT id FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at <= ?)`)
    .bind(cutoff, cutoff).all<{ id: string; object_key: string; preview_object_key: string | null }>();
  for (const item of old.results) { await files.delete(item.object_key); if (item.preview_object_key) await files.delete(item.preview_object_key); }
  await db.batch([db.prepare(`DELETE FROM attachments WHERE deleted_at IS NOT NULL AND deleted_at <= ?`).bind(cutoff), db.prepare(`DELETE FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at <= ?`).bind(cutoff), db.prepare(`DELETE FROM login_attempts WHERE window_started_at <= ?`).bind(new Date(Date.now() - 2 * 86400000).toISOString())]);
}

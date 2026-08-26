import { createSessionCookie, sourceKey, verifyPassword, verifySameOrigin } from '@/lib/auth';
import { ensureDatabase, getD1, purgeExpiredTrash } from '@/lib/database';
import { jsonError, readJson } from '@/lib/http';

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403);
  await ensureDatabase();
  const body = await readJson(request) as { password?: string } | null;
  if (!body?.password || body.password.length > 200) return jsonError('请输入访问密码');
  const db = getD1(); const key = await sourceKey(request); const now = Date.now();
  const attempt = await db.prepare('SELECT failure_count, window_started_at, locked_until FROM login_attempts WHERE source_hash = ?').bind(key).first<{ failure_count: number; window_started_at: string; locked_until: string | null }>();
  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > now) return jsonError('尝试次数过多，请15分钟后再试', 429);
  const valid = await verifyPassword(body.password);
  if (!valid) {
    const inWindow = !!attempt && now - new Date(attempt.window_started_at).getTime() < 15 * 60_000;
    const failures = inWindow ? attempt.failure_count + 1 : 1;
    const windowStart = inWindow ? attempt.window_started_at : new Date(now).toISOString();
    const lockedUntil = failures >= 5 ? new Date(now + 15 * 60_000).toISOString() : null;
    await db.prepare(`INSERT INTO login_attempts (source_hash, failure_count, window_started_at, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(source_hash) DO UPDATE SET failure_count = excluded.failure_count, window_started_at = excluded.window_started_at, locked_until = excluded.locked_until`).bind(key, failures, windowStart, lockedUntil).run();
    return jsonError(failures >= 5 ? '尝试次数过多，请15分钟后再试' : '访问密码不正确', failures >= 5 ? 429 : 401);
  }
  await db.prepare('DELETE FROM login_attempts WHERE source_hash = ?').bind(key).run();
  await purgeExpiredTrash();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': await createSessionCookie() } });
}

import { changePassword, clearSessionCookie, requireAuth, verifySameOrigin } from '@/lib/auth';
import { jsonError, readJson } from '@/lib/http';
export async function POST(request: Request) {
  const unauthorized = await requireAuth(request); if (unauthorized) return unauthorized;
  if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403);
  const body = await readJson(request) as { currentPassword?: string; nextPassword?: string } | null;
  if (!body?.currentPassword || !body.nextPassword || body.nextPassword.length < 10 || body.nextPassword.length > 128) return jsonError('新密码至少10位，最多128位');
  if (!await changePassword(body.currentPassword, body.nextPassword)) return jsonError('当前密码不正确', 401);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': clearSessionCookie(request) } });
}

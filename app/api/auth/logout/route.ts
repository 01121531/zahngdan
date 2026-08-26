import { clearSessionCookie, verifySameOrigin } from '@/lib/auth';
import { jsonError } from '@/lib/http';
export async function POST(request: Request) { if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403); return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': clearSessionCookie() } }); }

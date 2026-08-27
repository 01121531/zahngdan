import { env } from 'cloudflare:workers';
import { requireAuth, verifySameOrigin } from '@/lib/auth';
import { jsonError } from '@/lib/http';

const REQUEST_TIMEOUT_MS = 5_000;

function validIpv4(hostname: string) {
  const parts = hostname.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function updaterConfig() {
  const serviceUrl = env.QINGZHANG_UPDATE_URL?.trim();
  const token = env.QINGZHANG_UPDATE_TOKEN?.trim();
  if (!serviceUrl || !token) return null;

  try {
    const url = new URL(serviceUrl);
    const allowedHost = validIpv4(url.hostname)
      || ['localhost', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'http:' || !allowedHost || url.port !== '8871') return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return { url, token };
  } catch {
    return null;
  }
}

async function callUpdater(path: '/status' | '/update', method: 'GET' | 'POST') {
  const config = updaterConfig();
  if (!config) {
    return Response.json({
      supported: false,
      state: 'unsupported',
      message: '当前部署环境未配置自动更新器',
    });
  }

  const target = new URL(path, config.url);
  try {
    const response = await fetch(target, {
      method,
      headers: { authorization: `Bearer ${config.token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const candidate: unknown = await response.json().catch(() => null);
    const payload = candidate && typeof candidate === 'object'
      ? candidate as Record<string, unknown>
      : { message: '更新服务返回了无效响应' };
    return Response.json({ supported: true, ...payload }, {
      status: response.status,
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return jsonError('更新服务暂时不可用，请稍后重试', 503);
  }
}

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  return callUpdater('/status', 'GET');
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403);
  return callUpdater('/update', 'POST');
}

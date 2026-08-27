import { requireAuth, verifySameOrigin } from '@/lib/auth';
import { ensureDatabase, getD1 } from '@/lib/database';
import { jsonError } from '@/lib/http';

type UpdateRow = {
  state: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
  message: string;
  currentVersion: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
};

async function status() {
  await ensureDatabase();
  const row = await getD1().prepare(`SELECT state, message, current_version AS currentVersion, requested_at AS requestedAt, started_at AS startedAt, finished_at AS finishedAt, heartbeat_at AS heartbeatAt FROM update_state WHERE id = 1`).first<UpdateRow>();
  const heartbeat = row?.heartbeatAt ? new Date(row.heartbeatAt).getTime() : 0;
  return {
    supported: heartbeat > Date.now() - 15_000,
    state: row?.state || 'idle',
    message: row?.message || '当前部署环境未配置自动更新器',
    currentVersion: row?.currentVersion || null,
    requestedAt: row?.requestedAt || null,
    startedAt: row?.startedAt || null,
    finishedAt: row?.finishedAt || null,
  };
}

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  return Response.json(await status(), { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  if (!verifySameOrigin(request)) return jsonError('请求来源不可信', 403);

  const current = await status();
  if (!current.supported) return jsonError('更新器未运行，请检查服务器服务', 503);
  if (current.state === 'queued' || current.state === 'running') return jsonError('更新正在进行中', 409);

  const now = new Date().toISOString();
  await getD1().prepare(`UPDATE update_state SET state = 'queued', message = '更新请求已提交，正在准备…', request_id = ?, requested_at = ?, started_at = NULL, finished_at = NULL WHERE id = 1`)
    .bind(crypto.randomUUID(), now).run();
  return Response.json(await status(), { status: 202, headers: { 'cache-control': 'no-store' } });
}

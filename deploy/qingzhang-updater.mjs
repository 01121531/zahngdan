import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.QINGZHANG_UPDATE_PORT || '8871', 10);
const token = process.env.QINGZHANG_UPDATE_TOKEN || '';
const script = process.env.QINGZHANG_UPDATE_SCRIPT || '/usr/local/sbin/qingzhang-update';
const statusFile = process.env.QINGZHANG_UPDATE_STATUS || '/var/lib/qingzhang/update-status.json';
const versionFile = process.env.QINGZHANG_VERSION_FILE || '/opt/qingzhang/public/version.json';

if (token.length < 32) throw new Error('QINGZHANG_UPDATE_TOKEN must contain at least 32 characters');

let child = null;

async function currentVersion() {
  try {
    return JSON.parse(await readFile(versionFile, 'utf8')).version || null;
  } catch {
    return null;
  }
}

async function readStatus() {
  try {
    return JSON.parse(await readFile(statusFile, 'utf8'));
  } catch {
    return { state: 'idle', message: '可以检查并安装新版本', currentVersion: await currentVersion() };
  }
}

async function writeStatus(status) {
  const temporary = `${statusFile}.tmp`;
  await writeFile(temporary, `${JSON.stringify(status)}\n`, { mode: 0o600 });
  await rename(temporary, statusFile);
}

function authorized(request) {
  const header = request.headers.authorization || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expectedBuffer = Buffer.from(token);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function send(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function startUpdate() {
  const startedAt = new Date().toISOString();
  await writeStatus({
    state: 'running',
    message: '正在下载、验证并安装新版本…',
    currentVersion: await currentVersion(),
    startedAt,
    finishedAt: null,
  });

  child = spawn(script, [], { stdio: 'inherit' });
  child.once('error', async (error) => {
    child = null;
    await writeStatus({
      state: 'failed',
      message: `无法启动更新：${error.message}`,
      currentVersion: await currentVersion(),
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  });
  child.once('exit', async (code, signal) => {
    child = null;
    const succeeded = code === 0;
    await writeStatus({
      state: succeeded ? 'succeeded' : 'failed',
      message: succeeded ? '更新完成，服务已恢复运行' : '更新失败，服务器已自动恢复原版本',
      currentVersion: await currentVersion(),
      startedAt,
      finishedAt: new Date().toISOString(),
      ...(succeeded ? {} : { failureCode: code, failureSignal: signal }),
    });
  });
}

const server = createServer(async (request, response) => {
  const remote = request.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) || !authorized(request)) {
    send(response, 403, { error: 'forbidden' });
    return;
  }

  if (request.method === 'GET' && request.url === '/status') {
    send(response, 200, await readStatus());
    return;
  }

  if (request.method === 'POST' && request.url === '/update') {
    if (child) {
      send(response, 409, { ...(await readStatus()), error: '更新正在进行中' });
      return;
    }
    await startUpdate();
    send(response, 202, await readStatus());
    return;
  }

  send(response, 404, { error: 'not found' });
});

server.listen(port, host, () => {
  process.stdout.write(`Qingzhang updater listening on http://${host}:${port}\n`);
});

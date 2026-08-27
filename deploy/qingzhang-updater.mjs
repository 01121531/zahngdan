import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const script = process.env.QINGZHANG_UPDATE_SCRIPT || '/usr/local/sbin/qingzhang-update';
const databaseDirectory = process.env.QINGZHANG_D1_DIR || '/var/lib/qingzhang/v3/d1/miniflare-D1DatabaseObject';
const versionFile = process.env.QINGZHANG_VERSION_FILE || '/opt/qingzhang/public/version.json';
const pollIntervalMs = 2_000;

let child = null;
let database = null;

async function currentVersion() {
  try {
    return JSON.parse(await readFile(versionFile, 'utf8')).version || null;
  } catch {
    return null;
  }
}

async function findDatabase() {
  const entries = await readdir(databaseDirectory);
  const filename = entries.find((entry) => entry.endsWith('.sqlite') && entry !== 'metadata.sqlite');
  if (!filename) throw new Error('Qingzhang D1 database file was not found');
  return join(databaseDirectory, filename);
}

async function openDatabase() {
  if (database) return database;
  database = new DatabaseSync(await findDatabase());
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec(`CREATE TABLE IF NOT EXISTS update_state (id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1), state TEXT NOT NULL, message TEXT NOT NULL, current_version TEXT, request_id TEXT, requested_at TEXT, started_at TEXT, finished_at TEXT, heartbeat_at TEXT)`);
  database.prepare(`INSERT OR IGNORE INTO update_state (id, state, message, current_version, request_id, requested_at, started_at, finished_at, heartbeat_at) VALUES (1, 'idle', '可以检查并安装新版本', NULL, NULL, NULL, NULL, NULL, NULL)`).run();
  database.prepare(`UPDATE update_state SET state = 'failed', message = '更新器重启，上一次更新未完成', finished_at = ? WHERE id = 1 AND state = 'running'`).run(new Date().toISOString());
  return database;
}

async function finishUpdate(startedAt, succeeded, code, signal) {
  const db = await openDatabase();
  db.prepare(`UPDATE update_state SET state = ?, message = ?, current_version = ?, finished_at = ? WHERE id = 1`).run(
    succeeded ? 'succeeded' : 'failed',
    succeeded ? '更新完成，服务已恢复运行' : `更新失败，服务器已自动恢复原版本${code === null ? `（${signal || 'unknown'}）` : ''}`,
    await currentVersion(),
    new Date().toISOString(),
  );
  child = null;
}

async function startUpdate(requestId) {
  const db = await openDatabase();
  const startedAt = new Date().toISOString();
  const claimed = db.prepare(`UPDATE update_state SET state = 'running', message = '正在下载、验证并安装新版本…', current_version = ?, started_at = ?, finished_at = NULL WHERE id = 1 AND state = 'queued' AND request_id = ?`).run(await currentVersion(), startedAt, requestId);
  if (!claimed.changes) return;

  child = spawn('/usr/bin/sudo', ['-n', script], { stdio: 'inherit' });
  child.once('error', async () => finishUpdate(startedAt, false, null, 'spawn-error'));
  child.once('exit', async (code, signal) => finishUpdate(startedAt, code === 0, code, signal));
}

async function tick() {
  try {
    const db = await openDatabase();
    db.prepare('UPDATE update_state SET heartbeat_at = ?, current_version = COALESCE(current_version, ?) WHERE id = 1').run(new Date().toISOString(), await currentVersion());
    const row = db.prepare('SELECT state, request_id AS requestId FROM update_state WHERE id = 1').get();
    if (!child && row?.state === 'queued' && row.requestId) await startUpdate(row.requestId);
  } catch (error) {
    process.stderr.write(`Updater poll failed: ${error instanceof Error ? error.message : String(error)}\n`);
    database?.close();
    database = null;
  }
}

await tick();
setInterval(() => void tick(), pollIntervalMs);
process.stdout.write('Qingzhang database-queue updater started\n');

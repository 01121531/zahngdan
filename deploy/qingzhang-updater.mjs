import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const script = process.env.QINGZHANG_UPDATE_SCRIPT || '/usr/local/sbin/qingzhang-update';
const databaseDirectory = process.env.QINGZHANG_D1_DIR || '/var/lib/qingzhang/v3/d1/miniflare-D1DatabaseObject';
const versionFile = process.env.QINGZHANG_VERSION_FILE || '/opt/qingzhang/public/version.json';
const pollIntervalMs = 2_000;
let child = null;

async function currentVersion() {
  try { return JSON.parse(await readFile(versionFile, 'utf8')).version || null; }
  catch { return null; }
}

async function findDatabase() {
  const entries = await readdir(databaseDirectory);
  const filename = entries.find((entry) => entry.endsWith('.sqlite') && entry !== 'metadata.sqlite');
  if (!filename) throw new Error('Qingzhang D1 database file was not found');
  return join(databaseDirectory, filename);
}

async function withDatabase(readOnly, operation) {
  const database = new DatabaseSync(await findDatabase(), { readOnly });
  try {
    database.exec('PRAGMA busy_timeout = 5000');
    if (readOnly) database.exec('PRAGMA query_only = ON');
    return operation(database);
  } finally { database.close(); }
}

async function writeWithRetry(operation) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { return await withDatabase(false, operation); }
    catch (error) {
      lastError = error;
      if (!String(error).includes('SQLITE_BUSY') && !String(error).includes('database is locked')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function finishUpdate(succeeded, code, signal) {
  try {
    const version = await currentVersion();
    await writeWithRetry((database) => database.prepare(`UPDATE update_state SET state = ?, message = ?, current_version = ?, finished_at = ? WHERE id = 1`).run(
      succeeded ? 'succeeded' : 'failed',
      succeeded ? '更新完成，服务已恢复运行' : `更新失败，服务器已自动恢复原版本${code === null ? `（${signal || 'unknown'}）` : ''}`,
      version,
      new Date().toISOString(),
    ));
  } catch (error) { process.stderr.write(`Updater finish failed: ${error instanceof Error ? error.message : String(error)}\n`); }
  child = null;
  setTimeout(() => process.exit(succeeded ? 0 : 1), 100);
}

async function startUpdate(requestId) {
  const startedAt = new Date().toISOString(); const version = await currentVersion();
  const claimed = await writeWithRetry((database) => database.prepare(`UPDATE update_state SET state = 'running', message = '正在下载、验证并安装新版本…', current_version = ?, started_at = ?, finished_at = NULL WHERE id = 1 AND state = 'queued' AND request_id = ?`).run(version, startedAt, requestId));
  if (!claimed.changes) return;
  child = spawn('/usr/bin/sudo', ['-n', script], { stdio: 'inherit' });
  let settled = false;
  const finish = async (code, signal) => { if (settled) return; settled = true; await finishUpdate(code === 0, code, signal); };
  child.once('error', () => void finish(null, 'spawn-error'));
  child.once('exit', (code, signal) => void finish(code, signal));
}

async function tick() {
  if (child) return;
  try {
    const row = await withDatabase(true, (database) => database.prepare('SELECT state, request_id AS requestId FROM update_state WHERE id = 1').get());
    if (row?.state === 'queued' && row.requestId) await startUpdate(row.requestId);
  } catch (error) { process.stderr.write(`Updater poll failed: ${error instanceof Error ? error.message : String(error)}\n`); }
}

await writeWithRetry((database) => database.prepare(`UPDATE update_state SET state = 'failed', message = '更新器重启，上一次更新未完成', finished_at = ? WHERE id = 1 AND state = 'running'`).run(new Date().toISOString()));
await tick();
setInterval(() => void tick(), pollIntervalMs);
process.stdout.write('Qingzhang read-mostly database-queue updater started\n');

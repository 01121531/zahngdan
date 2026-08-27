import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate'; import { requireAuth } from '@/lib/auth'; import { ensureDatabase, getD1, getFiles } from '@/lib/database'; import { exportTransactions, transactionsCsv } from '@/lib/export-data'; import { safeDownloadName } from '@/lib/files'; import { jsonError } from '@/lib/http'; import { TransactionFilterError } from '@/lib/transaction-filters';
export async function GET(request: Request) {
  const unauthorized = await requireAuth(request); if (unauthorized) return unauthorized; await ensureDatabase(); let rows: Awaited<ReturnType<typeof exportTransactions>>; try { rows = await exportTransactions(new URL(request.url)); } catch (error) { if (error instanceof TransactionFilterError) return jsonError(error.message, 400); console.error('Archive export failed', error); return jsonError('导出暂时失败，请重试', 500); } const ids = new Set(rows.map((row) => row.id));
  const attachments = ids.size ? (await getD1().prepare(`SELECT transaction_id AS transactionId, object_key AS objectKey, original_name AS originalName FROM attachments WHERE deleted_at IS NULL AND transaction_id IN (${[...ids].map(() => '?').join(',')}) ORDER BY transaction_id, created_at`).bind(...ids).all<{ transactionId: string; objectKey: string; originalName: string }>()).results : [];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((error, data, final) => { if (error) { controller.error(error); return; } controller.enqueue(data); if (final) controller.close(); });
      void (async () => {
        const csvEntry = new ZipDeflate('轻账账单.csv', { level: 6 }); zip.add(csvEntry); csvEntry.push(strToU8(transactionsCsv(rows)), true);
        for (const attachment of attachments) { const transaction = rows.find((row) => row.id === attachment.transactionId); const object = await getFiles().get(attachment.objectKey); if (!object) continue; const folder = `${transaction?.occurredAt.slice(0, 10) || '未知日期'}_${safeDownloadName(transaction?.title || '账单')}_${attachment.transactionId.slice(0, 8)}`; const entry = new ZipPassThrough(`${folder}/${safeDownloadName(attachment.originalName)}`); zip.add(entry); entry.push(new Uint8Array(await object.arrayBuffer()), true); }
        zip.end();
      })().catch((error) => controller.error(error));
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`轻账备份-${new Date().toISOString().slice(0, 10)}.zip`)}`, 'cache-control': 'private, no-store' } });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export async function readJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}

export function monthBounds(month?: string | null) {
  const current = month && /^\d{4}-\d{2}$/.test(month) ? month : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  const [year, monthNumber] = current.split('-').map(Number);
  const start = new Date(`${current}-01T00:00:00+08:00`);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+08:00`);
  return { month: current, start: start.toISOString(), end: end.toISOString() };
}

export function dateRangeBounds(dateFrom?: string | null, dateTo?: string | null) {
  if (!dateFrom && !dateTo) return null;
  if (!dateFrom || !dateTo) throw new Error('开始日期和结束日期需要同时填写');
  if (!validDate(dateFrom) || !validDate(dateTo)) throw new Error('日期格式不正确');
  if (dateFrom > dateTo) throw new Error('开始日期不能晚于结束日期');
  const start = new Date(`${dateFrom}T00:00:00+08:00`);
  const end = new Date(new Date(`${dateTo}T00:00:00+08:00`).getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100);
}

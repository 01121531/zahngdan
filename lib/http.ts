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

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100);
}

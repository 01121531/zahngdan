export type Category = { id: string; type: 'expense' | 'income'; name: string; icon: string; color: string; isBuiltin: number | boolean; isHidden: number | boolean; sortOrder: number };
export type Transaction = { id: string; type: 'expense' | 'income'; amountCents: number; currency: string; title: string; categoryId: string | null; categoryName: string | null; categoryIcon: string | null; categoryColor: string | null; paymentMethod: string | null; occurredAt: string; note?: string | null; attachmentCount?: number; createdAt?: string; updatedAt?: string; deletedAt?: string | null };
export type Attachment = { id: string; originalName: string; contentType: string; sizeBytes: number; createdAt: string; deletedAt: string | null; previewObjectKey?: string | null };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init?.headers } });
  if (response.status === 401 && !url.includes('/auth/')) { window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); throw new Error('请先登录'); }
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || '操作没有完成，请稍后重试');
  return data as T;
}

export function money(cents: number, signed?: 'expense' | 'income') { const value = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100); return signed ? `${signed === 'expense' ? '-' : '+'}${value}` : value; }
export function dateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
export function inputDateTime(value = new Date()) { const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
export function fileSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

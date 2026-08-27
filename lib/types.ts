export type Category = { id: string; type: 'expense' | 'income'; name: string; icon: string; color: string; isBuiltin: number | boolean; isHidden: number | boolean; sortOrder: number };
export type Transaction = { id: string; type: 'expense' | 'income'; amountCents: number; currency: string; title: string; categoryId: string | null; categoryName: string | null; categoryIcon: string | null; categoryColor: string | null; paymentMethod: string | null; occurredAt: string; note?: string | null; attachmentCount?: number; createdAt?: string; updatedAt?: string; deletedAt?: string | null };
export type Attachment = { id: string; originalName: string; contentType: string; sizeBytes: number; createdAt: string; deletedAt: string | null; previewObjectKey?: string | null };

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public retryable = false) { super(message); }
}

type ApiRequestInit = RequestInit & { timeoutMs?: number };

export async function api<T>(url: string, init?: ApiRequestInit): Promise<T> {
  const { timeoutMs = init?.body instanceof FormData ? 120_000 : 30_000, ...requestInit } = init || {};
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...requestInit, signal: controller.signal, headers: { ...(requestInit.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...requestInit.headers } });
    if (response.status === 401 && !url.includes('/auth/')) { window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); throw new ApiError('请先登录', 401); }
    const data = await response.json().catch(() => ({})) as { error?: string; code?: string; retryable?: boolean };
    if (!response.ok) throw new ApiError(data.error || '操作没有完成，请稍后重试', response.status, data.code, data.retryable);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('连接服务器超时，请重试', 0, 'TIMEOUT', true);
    throw new ApiError('网络连接中断，请检查网络后重试', 0, 'NETWORK_ERROR', true);
  } finally { window.clearTimeout(timer); }
}

export function money(cents: number, signed?: 'expense' | 'income') { const value = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100); return signed ? `${signed === 'expense' ? '-' : '+'}${value}` : value; }
export function dateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
export function inputDateTime(value = new Date()) { const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
export function fileSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

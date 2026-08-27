'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Full-page navigation avoids Vinext RSC prefetch failures in the self-hosted Worker runtime. */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Download, FileArchive, Image as ImageIcon, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/fields';
import { PAYMENT_METHODS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { api, dateTime, money, type Category, type Transaction } from '@/lib/types';

type TimeMode = 'month' | 'all' | 'custom';
type Filters = { timeMode: TimeMode; month: string; dateFrom: string; dateTo: string; q: string; type: string; category: string; payment: string };
type TransactionPage = { transactions: Transaction[]; nextCursor: string | null; summary: { count: number; income: number; expense: number } };
const STORAGE_KEY = 'qingzhang.transaction-filters.v1';
const STORAGE_EVENT = 'qingzhang-transaction-filters';

function currentMonth() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
function initialFilters(): Filters { return { timeMode: 'month', month: currentMonth(), dateFrom: '', dateTo: '', q: '', type: '', category: '', payment: '' }; }
const defaultFiltersJson = JSON.stringify(initialFilters());
function filterSnapshot() { return localStorage.getItem(STORAGE_KEY) || defaultFiltersJson; }
function subscribeFilters(callback: () => void) { const notify = () => callback(); window.addEventListener('storage', notify); window.addEventListener(STORAGE_EVENT, notify); return () => { window.removeEventListener('storage', notify); window.removeEventListener(STORAGE_EVENT, notify); }; }
function readFilters(value: string): Filters { try { const saved = JSON.parse(value) as Partial<Filters>; return saved && ['month', 'all', 'custom'].includes(saved.timeMode || '') ? { ...initialFilters(), ...saved, timeMode: saved.timeMode as TimeMode } : initialFilters(); } catch { return initialFilters(); } }

export function TransactionsView() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState({ count: 0, income: 0, expense: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const filterJson = useSyncExternalStore(subscribeFilters, filterSnapshot, () => defaultFiltersJson);
  const filters = useMemo(() => readFilters(filterJson), [filterJson]);
  useEffect(() => { api<{ categories: Category[] }>('/api/categories').then((data) => setCategories(data.categories)).catch((reason) => setError(reason.message)); }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.timeMode === 'month' && filters.month) params.set('month', filters.month);
    if (filters.timeMode === 'custom' && filters.dateFrom && filters.dateTo) { params.set('dateFrom', filters.dateFrom); params.set('dateTo', filters.dateTo); }
    for (const key of ['q', 'type', 'category', 'payment'] as const) if (filters[key]) params.set(key, filters[key]);
    return params.toString();
  }, [filters]);

  const rangeError = filters.timeMode === 'month' && !filters.month ? '请选择月份' : filters.timeMode === 'custom' && (!filters.dateFrom || !filters.dateTo)
    ? '请选择完整的开始日期和结束日期'
    : filters.timeMode === 'custom' && filters.dateFrom > filters.dateTo ? '开始日期不能晚于结束日期' : '';

  useEffect(() => {
    if (rangeError) return;
    let active = true;
    api<TransactionPage>(`/api/transactions?${query}`)
      .then((data) => { if (active) { setRows(data.transactions); setNextCursor(data.nextCursor); setSummary(data.summary); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, rangeError, reloadKey]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true); setError('');
    try {
      const data = await api<TransactionPage>(`/api/transactions?${query}&cursor=${encodeURIComponent(nextCursor)}`);
      setRows((current) => [...current, ...data.transactions]); setNextCursor(data.nextCursor); setSummary(data.summary);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '加载失败'); }
    finally { setLoadingMore(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('这笔账单会进入回收站，可在30天内恢复。继续吗？')) return;
    try { await api(`/api/transactions/${id}`, { method: 'DELETE' }); setLoading(true); setReloadKey((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败'); }
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, [key]: value }));
    setLoading(true); setError(''); window.dispatchEvent(new Event(STORAGE_EVENT));
  };
  const visibleRows = rangeError ? [] : rows;
  const visibleSummary = rangeError ? { count: 0, income: 0, expense: 0 } : summary;
  const visibleError = rangeError || error;
  const visibleLoading = !rangeError && loading;

  return <AppShell title="账单" eyebrow="查找、筛选和导出每一笔记录" actions={<a href="/transactions/new" className={buttonClass()}>记一笔</a>}>
    <Card className="p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[160px_minmax(220px,1fr)_150px_150px_150px]"><select aria-label="时间范围" className={inputClass} value={filters.timeMode} onChange={(event) => updateFilter('timeMode', event.target.value as TimeMode)}><option value="month">按月份</option><option value="all">全部时间</option><option value="custom">自定义时间段</option></select><label className="relative"><span className="sr-only">搜索账单</span><Search className="absolute left-3.5 top-3.5 text-[var(--muted)]" size={18}/><input className={`${inputClass} pl-10`} value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} placeholder="搜索标题或备注"/></label><select aria-label="收支类型" className={inputClass} value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}><option value="">全部类型</option><option value="expense">支出</option><option value="income">收入</option></select><select aria-label="分类" className={inputClass} value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">全部分类</option>{categories.filter((item) => !item.isHidden).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="支付方式" className={inputClass} value={filters.payment} onChange={(event) => updateFilter('payment', event.target.value)}><option value="">全部方式</option>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></div>
      {filters.timeMode === 'month' ? <div className="mt-3 max-w-xs"><label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="transaction-month">选择月份</label><input id="transaction-month" className={inputClass} type="month" value={filters.month} onChange={(event) => updateFilter('month', event.target.value)}/></div> : null}
      {filters.timeMode === 'custom' ? <div className="mt-3 grid gap-3 sm:max-w-2xl sm:grid-cols-2"><label className="text-xs font-medium text-[var(--muted)]">开始日期<input aria-label="开始日期" className={`${inputClass} mt-1.5`} type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)}/></label><label className="text-xs font-medium text-[var(--muted)]">结束日期<input aria-label="结束日期" className={`${inputClass} mt-1.5`} type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)}/></label></div> : null}
    </Card>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-[var(--muted)]">筛选结果</p><p className="mt-1 font-mono text-xl font-semibold">{visibleSummary.count} 笔</p></Card><Card className="p-4"><p className="text-xs text-[var(--muted)]">收入合计</p><p className="mt-1 font-mono text-xl font-semibold text-[var(--income)]">{money(visibleSummary.income)}</p></Card><Card className="p-4"><p className="text-xs text-[var(--muted)]">支出合计</p><p className="mt-1 font-mono text-xl font-semibold">{money(visibleSummary.expense)}</p></Card></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-[var(--muted)]"><SlidersHorizontal size={17}/>当前筛选会同步应用到导出文件</div><div className="flex gap-2"><a aria-disabled={!!rangeError} onClick={(event) => { if (rangeError) event.preventDefault(); }} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), rangeError && 'pointer-events-none opacity-45')} href={`/api/export/csv?${query}`}><Download size={16}/>CSV</a><a aria-disabled={!!rangeError} onClick={(event) => { if (rangeError) event.preventDefault(); }} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), rangeError && 'pointer-events-none opacity-45')} href={`/api/export/archive?${query}`}><FileArchive size={16}/>附件包</a></div></div>
    <Card className="mt-4 overflow-hidden">{visibleError ? <div role="alert" className="border-b border-[var(--line)] bg-[var(--danger-soft)] px-5 py-3 text-sm text-[var(--danger)]">{visibleError}</div> : null}{visibleLoading ? <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">正在整理账单…</div> : visibleRows.length ? <><div className="divide-y divide-[var(--line)]">{visibleRows.map((row) => <div key={row.id} className="group flex items-center gap-3 px-4 py-4 hover:bg-[var(--hover)] sm:px-6"><a href={`/transactions/${row.id}`} className="contents"><span className="grid size-11 shrink-0 place-items-center rounded-[14px] text-sm font-semibold" style={{ color: row.categoryColor || 'var(--muted)', backgroundColor: `${row.categoryColor || '#77837e'}18` }}>{row.categoryName?.slice(0, 1) || '账'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{row.title}</span><span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">{row.categoryName || '未分类'} · {row.paymentMethod} · {dateTime(row.occurredAt)}{row.attachmentCount ? <><ImageIcon size={13}/>{row.attachmentCount}</> : null}</span></span><span className={cn('shrink-0 font-mono text-sm font-semibold', row.type === 'income' && 'text-[var(--income)]')}>{money(row.amountCents, row.type)}</span></a><Button variant="ghost" size="icon" aria-label={`删除${row.title}`} onClick={() => remove(row.id)} className="text-[var(--muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Trash2 size={17}/></Button></div>)}</div>{nextCursor ? <div className="border-t border-[var(--line)] p-4 text-center"><Button variant="secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? '正在加载…' : `加载更多（已显示 ${visibleRows.length}/${visibleSummary.count}）`}</Button></div> : null}</> : <div className="px-6 py-16 text-center"><p className="text-sm font-semibold">没有符合条件的账单</p><p className="mt-1 text-sm text-[var(--muted)]">调整筛选条件，或者记录一笔新的收支。</p></div>}</Card>
  </AppShell>;
}

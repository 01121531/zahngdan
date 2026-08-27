'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Full-page navigation avoids stalled client routing in the self-hosted Worker runtime. */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArchiveRestore, ChevronRight, CircleDollarSign, FolderTree, LayoutDashboard, Plus, ReceiptText, Settings } from 'lucide-react';
import { api } from '@/lib/types'; import { buttonClass } from '@/components/ui/button'; import { cn } from '@/lib/cn';

const primary = [
  { href: '/', label: '总览', icon: LayoutDashboard }, { href: '/transactions', label: '账单', icon: ReceiptText }, { href: '/categories', label: '分类', icon: FolderTree },
];
const secondary = [{ href: '/trash', label: '回收站', icon: ArchiveRestore }, { href: '/settings', label: '设置', icon: Settings }];

export function AppShell({ title, eyebrow, children, actions }: { title: string; eyebrow?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const pathname = usePathname(); const [ready, setReady] = useState(false);
  useEffect(() => { api<{ authenticated: boolean }>('/api/auth/session').then(({ authenticated }) => { if (!authenticated) window.location.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); else setReady(true); }).catch(() => window.location.replace('/login')); }, [pathname]);
  if (!ready) return <div className="grid min-h-dvh place-items-center bg-[var(--page)]"><div className="text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--brand)] font-bold text-white">轻</div><p className="mt-4 text-sm text-[var(--muted)]">正在打开你的账本…</p></div></div>;
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  return <div className="min-h-dvh bg-[var(--page)] text-[var(--ink)]">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:p-3">跳到主要内容</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] border-r border-[var(--line)] bg-[var(--surface)] px-5 py-7 lg:flex lg:flex-col">
      <a href="/" className="flex items-center gap-3 px-2"><span className="grid size-10 place-items-center rounded-[14px] bg-[var(--brand)] text-sm font-bold text-white shadow-[0_8px_24px_rgba(15,118,110,.22)]">轻</span><span><strong className="block text-[17px] tracking-tight">轻账</strong><small className="text-xs text-[var(--muted)]">每一笔，都清楚</small></span></a>
      <nav aria-label="主导航" className="mt-10 space-y-2">{primary.map(({ href, label, icon: Icon }) => <a key={href} href={href} aria-current={isActive(href) ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium', isActive(href) ? 'bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]')}><Icon size={19} strokeWidth={1.8} />{label}</a>)}</nav>
      <div className="mt-auto rounded-2xl border border-[var(--line)] bg-[var(--page)] p-4"><div className="flex items-center gap-2"><CircleDollarSign size={17} className="text-[var(--brand)]"/><p className="text-sm font-semibold">数据已安全保存</p></div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">账单与附件仅你登录后可见。</p></div>
      <nav aria-label="次要导航" className="mt-3 space-y-1">{secondary.map(({ href, label, icon: Icon }) => <a key={href} href={href} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]', isActive(href) && 'bg-[var(--hover)] text-[var(--ink)]')}><Icon size={18}/>{label}</a>)}</nav>
    </aside>
    <main id="main-content" className="mx-auto min-h-dvh max-w-[1480px] px-4 pb-28 pt-5 sm:px-7 lg:ml-[232px] lg:px-10 lg:pb-12 lg:pt-8">
      <header className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-[var(--muted)]">{eyebrow || new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full' }).format(new Date())}</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.035em] sm:text-[32px]">{title}</h1></div><div className="flex shrink-0 items-center gap-2">{actions || <a href="/transactions/new" className={buttonClass()}><Plus size={18}/>记一笔</a>}</div></header>
      <div className="mt-7">{children}</div>
    </main>
    <nav aria-label="移动端导航" className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-[20px] border border-[var(--line)] bg-[var(--surface-glass)] p-2 shadow-[0_18px_50px_rgba(16,24,22,.16)] backdrop-blur-xl lg:hidden">{[...primary, { href: '/settings', label: '设置', icon: Settings }].map(({ href, label, icon: Icon }) => <a key={href} href={href} aria-current={isActive(href) ? 'page' : undefined} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] font-medium', isActive(href) ? 'bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'text-[var(--muted)]')}><Icon size={19} strokeWidth={1.8}/>{label}</a>)}</nav>
  </div>;
}

export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-strong)]">{children}<ChevronRight size={16}/></a>; }

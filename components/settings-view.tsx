'use client';

import { useState } from 'react';
import { Download, FileArchive, KeyRound, LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { OnlineUpdate } from '@/components/online-update';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/fields';
import { api } from '@/lib/types';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('lightledger-theme', theme);
}

export function SettingsView() {
  const [theme, setTheme] = useState<Theme>(() => typeof window === 'undefined'
    ? 'system'
    : (localStorage.getItem('lightledger-theme') as Theme) || 'system');
  const [passwords, setPasswords] = useState({ currentPassword: '', nextPassword: '', confirm: '' });
  const [message, setMessage] = useState('');

  const changeTheme = (value: Theme) => {
    setTheme(value);
    applyTheme(value);
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (passwords.nextPassword !== passwords.confirm) {
      setMessage('两次输入的新密码不一致');
      return;
    }
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify(passwords) });
      alert('密码已修改，请使用新密码重新登录。');
      window.location.replace('/login');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '修改失败');
    }
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login');
  };

  return (
    <AppShell title="设置" eyebrow="外观、安全与数据备份">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">外观</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">选择最适合当前环境的显示方式。</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {([
              { id: 'light', label: '浅色', icon: Sun },
              { id: 'dark', label: '深色', icon: Moon },
              { id: 'system', label: '跟随系统', icon: Monitor },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => changeTheme(id)}
                aria-pressed={theme === id}
                className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${theme === id ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--hover)]'}`}
              >
                <Icon size={20} />{label}
              </button>
            ))}
          </div>
          <div className="mt-7 border-t border-[var(--line)] pt-5">
            <h3 className="font-semibold">数据备份</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">导出全部账单，或连同原始附件一起打包。</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/export/csv" className={buttonClass({ variant: 'secondary' })}><Download size={17} />导出CSV</a>
              <a href="/api/export/archive" className={buttonClass({ variant: 'secondary' })}><FileArchive size={17} />下载完整备份</a>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2"><ShieldCheck className="text-[var(--brand)]" /><h2 className="font-semibold">访问安全</h2></div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">新密码至少10位。修改后，所有设备上的旧会话都会失效。</p>
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <Field label="当前密码">
              <input type="password" autoComplete="current-password" required className={inputClass} value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} />
            </Field>
            <Field label="新密码">
              <input type="password" autoComplete="new-password" required minLength={10} className={inputClass} value={passwords.nextPassword} onChange={(event) => setPasswords({ ...passwords, nextPassword: event.target.value })} />
            </Field>
            <Field label="再次输入新密码">
              <input type="password" autoComplete="new-password" required minLength={10} className={inputClass} value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
            </Field>
            {message ? <p role="alert" className="text-sm text-[var(--danger)]">{message}</p> : null}
            <Button type="submit"><KeyRound size={17} />修改访问密码</Button>
          </form>
          <div className="mt-8 border-t border-[var(--line)] pt-5">
            <Button variant="danger" onClick={logout}><LogOut size={17} />退出登录</Button>
          </div>
        </Card>

        <OnlineUpdate />
      </div>
    </AppShell>
  );
}

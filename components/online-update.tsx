'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw, Rocket, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/types';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type VersionInfo = {
  currentVersion: string;
  latestVersion: string | null;
  publishedAt: string | null;
  summary: string | null;
  updateAvailable: boolean;
  repositoryUrl: string;
};

type UpdateStatus = {
  supported: boolean;
  state: 'idle' | 'running' | 'succeeded' | 'failed' | 'unsupported';
  message?: string;
  currentVersion?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 180;

export function OnlineUpdate() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    const next = await api<UpdateStatus>('/api/update');
    setStatus(next);
    return next;
  };

  const checkVersion = async () => {
    setChecking(true);
    setError('');
    try {
      const [nextVersion, nextStatus] = await Promise.all([
        api<VersionInfo>('/api/version'),
        loadStatus(),
      ]);
      setVersion(nextVersion);
      if (nextStatus.state === 'running') setUpdating(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '检查更新失败');
    } finally {
      setChecking(false);
    }
  };

  const pollUntilFinished = async (attemptsRemaining: number) => {
    try {
      const next = await loadStatus();
      if (next.state === 'succeeded') {
        setUpdating(false);
        window.setTimeout(() => window.location.reload(), 1_200);
        return;
      }
      if (next.state === 'failed') {
        setUpdating(false);
        setError(next.message || '更新失败，服务器已保留原版本');
        return;
      }
    } catch {
      // The application is briefly unavailable while its service restarts.
    }

    if (attemptsRemaining <= 1) {
      setUpdating(false);
      setError('更新等待超时，请稍后重新打开页面检查版本');
      return;
    }
    window.setTimeout(() => void pollUntilFinished(attemptsRemaining - 1), POLL_INTERVAL_MS);
  };

  const startUpdate = async () => {
    if (!version?.latestVersion || !window.confirm(`确认安装 v${version.latestVersion}？更新期间页面会短暂断开。`)) return;
    setUpdating(true);
    setError('');
    try {
      const next = await api<UpdateStatus>('/api/update', { method: 'POST', body: '{}' });
      setStatus(next);
      window.setTimeout(() => void pollUntilFinished(MAX_POLL_ATTEMPTS), POLL_INTERVAL_MS);
    } catch (reason) {
      setUpdating(false);
      setError(reason instanceof Error ? reason.message : '无法启动更新');
    }
  };

  const statusText = (() => {
    if (updating || status?.state === 'running') return status?.message || '正在下载、验证并安装新版本…';
    if (status?.state === 'succeeded') return status.message || '更新完成，正在刷新页面…';
    if (!version) return '正在检查当前版本…';
    if (!version.latestVersion) return `当前 v${version.currentVersion}，暂时无法连接更新源`;
    if (!version.updateAvailable) return `当前 v${version.currentVersion}，已是最新版`;
    return `当前 v${version.currentVersion}，发现 v${version.latestVersion}${version.summary ? `：${version.summary}` : ''}`;
  })();

  return (
    <Card className="p-5 sm:p-6 xl:col-span-2">
      <div className="flex items-center gap-2">
        <RefreshCw className="text-[var(--brand)]" />
        <h2 className="font-semibold">在线更新</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        自动从官方 GitHub 仓库下载新版本，验证通过后切换服务；失败时自动恢复原版本，账单和附件不会被覆盖。
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={checkVersion} disabled={checking || updating}>
          <RefreshCw size={17} className={checking ? 'animate-spin' : ''} />
          {checking ? '检查中…' : '检查更新'}
        </Button>
        {version?.updateAvailable && status?.supported ? (
          <Button onClick={startUpdate} disabled={updating}>
            <Rocket size={17} className={updating ? 'animate-pulse' : ''} />
            {updating ? '正在更新…' : `安装 v${version.latestVersion}`}
          </Button>
        ) : null}
        {version?.updateAvailable && status && !status.supported ? (
          <a href={version.repositoryUrl} target="_blank" rel="noreferrer" className={buttonClass()}>
            <ExternalLink size={17} />查看 v{version.latestVersion}
          </a>
        ) : null}
        <span aria-live="polite" className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
          {status?.state === 'succeeded' ? <CheckCircle2 size={16} className="text-[var(--brand)]" /> : null}
          {status?.state === 'failed' ? <TriangleAlert size={16} className="text-[var(--danger)]" /> : null}
          {statusText}
        </span>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {status && !status.supported ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">当前托管环境不支持自动安装；自托管服务器配置更新器后即可一键更新。</p>
      ) : null}
    </Card>
  );
}

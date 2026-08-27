'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, File as FileIcon, FileImage, LoaderCircle, Paperclip, Trash2, UploadCloud, X } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/fields';
import { MAX_ATTACHMENTS, MAX_FILE_BYTES, PAYMENT_METHODS } from '@/lib/constants';
import { createPendingFileId, createSubmissionId } from '@/lib/pending-files';
import { api, ApiError, fileSize, inputDateTime, type Attachment, type Category, type Transaction } from '@/lib/types';

type Pending = { id: string; file: File; status: 'ready' | 'uploading' | 'done' | 'error'; error?: string };
type SavePhase = 'idle' | 'saving' | 'uploading' | 'saved' | 'partial';
type Notice = { tone: 'success' | 'danger'; text: string } | null;
const accept = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';

export function TransactionForm({ transactionId }: { transactionId?: string }) {
  const editing = !!transactionId;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [requestId] = useState(createSubmissionId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(editing);
  const [phase, setPhase] = useState<SavePhase>('idle');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [notice, setNotice] = useState<Notice>(null);
  const [form, setForm] = useState({ type: 'expense' as 'expense' | 'income', amount: '', title: '', categoryId: '', paymentMethod: '微信', occurredAt: inputDateTime(), note: '' });
  const busy = phase === 'saving' || phase === 'uploading';
  const formLocked = busy || !!savedId;

  useEffect(() => {
    Promise.all([api<{ categories: Category[] }>('/api/categories'), transactionId ? api<{ transaction: Transaction; attachments: Attachment[] }>(`/api/transactions/${transactionId}`) : Promise.resolve(null)])
      .then(([categoryData, detail]) => {
        setCategories(categoryData.categories);
        if (detail) {
          const transaction = detail.transaction;
          setForm({ type: transaction.type, amount: (transaction.amountCents / 100).toFixed(2), title: transaction.title, categoryId: transaction.categoryId || '', paymentMethod: transaction.paymentMethod || '其他', occurredAt: inputDateTime(new Date(transaction.occurredAt)), note: transaction.note || '' });
          setExisting(detail.attachments.filter((item) => !item.deletedAt));
        } else {
          const first = categoryData.categories.find((item) => item.type === 'expense' && !item.isHidden);
          if (first) setForm((value) => ({ ...value, categoryId: first.id }));
        }
      })
      .catch((reason) => setNotice({ tone: 'danger', text: reason.message }))
      .finally(() => setLoading(false));
  }, [transactionId]);

  const addFiles = useCallback((incoming: File[]) => {
    if (formLocked) return;
    setNotice(null);
    setPending((current) => {
      const remaining = MAX_ATTACHMENTS - existing.length - current.length;
      if (remaining <= 0) { setNotice({ tone: 'danger', text: '每笔账单最多10个附件' }); return current; }
      const accepted = incoming.slice(0, remaining).filter((file) => {
        if (file.size > MAX_FILE_BYTES) { setNotice({ tone: 'danger', text: `${file.name} 超过10MB` }); return false; }
        return true;
      });
      return [...current, ...accepted.map((file) => ({ id: createPendingFileId(), file, status: 'ready' as const }))];
    });
  }, [existing.length, formLocked]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => { const files = [...(event.clipboardData?.files || [])]; if (files.length) addFiles(files); };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const switchType = (type: 'expense' | 'income') => {
    const first = categories.find((item) => item.type === type && !item.isHidden);
    setForm({ ...form, type, categoryId: first?.id || '' });
  };

  const uploadFile = async (item: Pending, billId: string) => {
    setPending((items) => items.map((entry) => entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry));
    try {
      const body = new FormData(); body.set('file', item.file);
      if (item.file.type === 'image/heic' || item.file.type === 'image/heif') {
        const { default: heic2any } = await import('heic2any');
        const converted = await heic2any({ blob: item.file, toType: 'image/webp', quality: 0.72 });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        body.set('preview', new File([blob], 'preview.webp', { type: 'image/webp' }));
      }
      await api(`/api/transactions/${billId}/attachments`, { method: 'POST', body, timeoutMs: 120_000 });
      setPending((items) => items.map((entry) => entry.id === item.id ? { ...entry, status: 'done' } : entry));
      return true;
    } catch (reason) {
      setPending((items) => items.map((entry) => entry.id === item.id ? { ...entry, status: 'error', error: reason instanceof Error ? reason.message : '上传失败' } : entry));
      return false;
    }
  };

  const finishSuccessfully = (billId: string) => {
    setPhase('saved'); setNotice({ tone: 'success', text: editing ? '账单修改和附件均已保存' : '账单和附件均已保存' });
    window.setTimeout(() => window.location.replace(`/transactions/${billId}?saved=1`), 700);
  };

  const uploadWaitingFiles = async (billId: string) => {
    const waiting = pending.filter((item) => item.status !== 'done');
    if (!waiting.length) { finishSuccessfully(billId); return; }
    setPhase('uploading'); setUploadProgress({ current: 0, total: waiting.length });
    let failed = 0;
    for (let index = 0; index < waiting.length; index += 1) {
      setUploadProgress({ current: index + 1, total: waiting.length });
      if (!await uploadFile(waiting[index], billId)) failed += 1;
    }
    if (failed) {
      setPhase('partial');
      setNotice({ tone: 'danger', text: `账单已保存，${failed} 个附件上传失败。可以直接重试失败附件。` });
      return;
    }
    finishSuccessfully(billId);
  };

  const saveTransaction = async () => {
    const payload = { ...form, occurredAt: new Date(form.occurredAt).toISOString() };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await api<{ id: string }>(editing ? `/api/transactions/${transactionId}` : '/api/transactions', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload), headers: editing ? undefined : { 'idempotency-key': requestId }, timeoutMs: 30_000 });
      } catch (reason) {
        if (!(reason instanceof ApiError) || !reason.retryable || attempt === 1) throw reason;
      }
    }
    throw new Error('账单没有保存成功');
  };

  const submit = async () => {
    if (!savedId && !formRef.current?.reportValidity()) return;
    setNotice(null);
    if (savedId) { await uploadWaitingFiles(savedId); return; }
    setPhase('saving');
    try {
      const result = await saveTransaction(); setSavedId(result.id);
      setNotice({ tone: 'success', text: '账单已保存，正在处理附件' });
      await uploadWaitingFiles(result.id);
    } catch (reason) {
      setPhase('idle'); setNotice({ tone: 'danger', text: `账单未保存：${reason instanceof Error ? reason.message : '请稍后重试'}` });
    }
  };

  const deleteExisting = async (id: string) => {
    if (!window.confirm('附件将进入回收站，可在30天内恢复。继续吗？')) return;
    try { await api(`/api/attachments/${id}`, { method: 'DELETE' }); setExisting((items) => items.filter((item) => item.id !== id)); }
    catch (reason) { setNotice({ tone: 'danger', text: reason instanceof Error ? reason.message : '附件删除失败' }); }
  };

  const matching = categories.filter((item) => item.type === form.type && !item.isHidden);
  const statusText = phase === 'saving' ? '正在保存账单…' : phase === 'uploading' ? `账单已保存，正在上传附件 ${uploadProgress.current}/${uploadProgress.total}` : phase === 'saved' ? '全部保存成功，正在打开账单…' : phase === 'partial' ? '账单已保存，部分附件需要重试' : '';

  return <AppShell title={editing ? '编辑账单' : '记一笔'} eyebrow={editing ? '修改账单信息和附件' : '把这一笔清楚地记下来'} actions={<a href={transactionId ? `/transactions/${transactionId}` : '/transactions'} className={buttonClass({ variant: 'secondary' })}><ArrowLeft size={17}/>返回</a>}>
    {loading ? <div className="grid min-h-[360px] place-items-center"><LoaderCircle className="animate-spin text-[var(--brand)]"/></div> : <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.7fr)]">
      <Card className="p-5 sm:p-7"><fieldset disabled={formLocked}>
        <div className="grid grid-cols-2 rounded-2xl bg-[var(--page)] p-1.5"><button type="button" onClick={() => switchType('expense')} className={`min-h-11 rounded-xl text-sm font-semibold ${form.type === 'expense' ? 'bg-[var(--surface)] shadow-sm text-[var(--expense)]' : 'text-[var(--muted)]'}`}>支出</button><button type="button" onClick={() => switchType('income')} className={`min-h-11 rounded-xl text-sm font-semibold ${form.type === 'income' ? 'bg-[var(--surface)] shadow-sm text-[var(--income)]' : 'text-[var(--muted)]'}`}>收入</button></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="金额"><div className="relative"><span className="absolute left-3.5 top-3 text-lg font-semibold text-[var(--muted)]">¥</span><input autoFocus inputMode="decimal" required className={`${inputClass} pl-9 font-mono text-lg font-semibold`} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" pattern="\d+(\.\d{1,2})?"/></div></Field><Field label="标题 / 商户"><input required maxLength={80} className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：城市超市"/></Field><Field label="分类"><select required className={inputClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">选择分类</option>{matching.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="支付方式"><select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="发生时间"><input required type="datetime-local" className={inputClass} value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}/></Field><Field label="备注" className="sm:col-span-2"><textarea rows={4} maxLength={500} className={`${inputClass} resize-y py-3`} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="可选，写下需要补充的信息"/><span className="mt-1 block text-right text-xs text-[var(--muted)]">{form.note.length}/500</span></Field></div>
      </fieldset></Card>
      <Card className="p-5 sm:p-7"><div className="flex items-center justify-between"><div><h2 className="font-semibold">票据与附件</h2><p className="mt-1 text-xs text-[var(--muted)]">最多10个，单个不超过10MB</p></div><Paperclip size={20} className="text-[var(--brand)]"/></div><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles([...event.dataTransfer.files]); }} className={`mt-5 rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--page)] p-6 text-center ${formLocked ? 'opacity-60' : ''}`}><UploadCloud className="mx-auto text-[var(--brand)]"/><p className="mt-3 text-sm font-semibold">拖放文件、粘贴截图或选择文件</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">图片、PDF、Word、Excel、CSV、TXT</p><Button type="button" variant="secondary" size="sm" className="mt-4" disabled={formLocked} onClick={() => inputRef.current?.click()}>选择文件</Button><input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(event) => addFiles([...(event.target.files || [])])}/></div>
        <div className="mt-4 space-y-2">{existing.map((item) => <FileRow key={item.id} name={item.originalName} size={item.sizeBytes} type={item.contentType} action={<Button type="button" size="icon" variant="ghost" disabled={formLocked} aria-label={`删除${item.originalName}`} onClick={() => deleteExisting(item.id)}><Trash2 size={16}/></Button>}/>)}{pending.map((item) => <FileRow key={item.id} name={item.file.name} size={item.file.size} type={item.file.type} status={item.status} error={item.error} action={item.status === 'done' ? <CheckCircle2 size={18} className="text-[var(--income)]"/> : <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`移除${item.file.name}`} onClick={() => setPending((items) => items.filter((entry) => entry.id !== item.id))}><X size={16}/></Button>}/>)}</div>
        {statusText ? <p aria-live="polite" className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--brand)]">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} {statusText}</p> : null}
        {notice ? <p role="alert" className={`mt-3 rounded-xl px-3 py-2 text-sm ${notice.tone === 'success' ? 'bg-[var(--brand-soft)] text-[var(--income)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>{notice.text}</p> : null}
        <Button type="button" disabled={busy} className="mt-6 w-full" onClick={() => void submit()}>{busy ? <><LoaderCircle size={17} className="animate-spin"/>{phase === 'saving' ? '正在保存账单' : `正在上传 ${uploadProgress.current}/${uploadProgress.total}`}</> : savedId ? pending.some((item) => item.status !== 'done') ? '重试失败附件' : '查看已保存账单' : editing ? '保存修改' : '保存账单'}</Button>
        {savedId ? <a href={`/transactions/${savedId}`} className="mt-3 flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--brand)]">查看已保存账单</a> : <p className="mt-3 text-center text-xs text-[var(--muted)]">选择附件只会加入待上传列表，点击保存账单后才会上传。</p>}
      </Card>
    </form>}
  </AppShell>;
}

function FileRow({ name, size, type, status, error, action }: { name: string; size: number; type: string; status?: Pending['status']; error?: string; action: React.ReactNode }) {
  const Icon = type.startsWith('image/') ? FileImage : FileIcon;
  return <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--page)] text-[var(--muted)]"><Icon size={17}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className={`mt-0.5 block text-xs ${status === 'error' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>{error || (status === 'uploading' ? '正在上传…' : status === 'done' ? '上传完成' : status === 'ready' ? `等待点击保存 · ${fileSize(size)}` : fileSize(size))}</span></span>{status === 'uploading' ? <LoaderCircle size={18} className="animate-spin text-[var(--brand)]"/> : action}</div>;
}

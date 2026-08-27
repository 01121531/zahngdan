import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPendingFileId } from '@/lib/pending-files';

describe('待上传附件标识', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('在浏览器不支持 randomUUID 时仍生成唯一标识', () => {
    vi.stubGlobal('crypto', {});
    const first = createPendingFileId();
    const second = createPendingFileId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^pending-\d+$/);
    expect(second).toMatch(/^pending-\d+$/);
  });
});

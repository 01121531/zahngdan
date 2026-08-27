import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('自托管导航兼容性', () => {
  it('客户端视图不使用会触发RSC预加载的next/link', () => {
    const imports = readdirSync('components')
      .filter((name) => name.endsWith('.tsx'))
      .filter((name) => readFileSync(`components/${name}`, 'utf8').includes("from 'next/link'"));
    expect(imports).toEqual([]);
  });
});

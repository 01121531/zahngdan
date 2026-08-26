import { describe, expect, it } from 'vitest'; import { amountToCents, centsToAmount, transactionSchema } from '@/lib/validation';
const valid = { type: 'expense', amount: '12.34', title: '午餐', categoryId: 'expense-food', paymentMethod: '微信', occurredAt: '2024-02-29T12:00:00.000Z', note: '' };
describe('账单金额与字段校验', () => {
  it('用整数分转换金额，避免浮点误差', () => { expect(amountToCents('0.01')).toBe(1); expect(amountToCents('123.4')).toBe(12340); expect(centsToAmount(12340)).toBe('123.40'); });
  it('接受闰日与有效账单', () => { expect(transactionSchema.safeParse(valid).success).toBe(true); });
  it.each(['0', '-1', '1.234', 'abc'])('拒绝非法金额 %s', (amount) => { expect(transactionSchema.safeParse({ ...valid, amount }).success).toBe(false); });
  it('拒绝超长标题和无效日期', () => { expect(transactionSchema.safeParse({ ...valid, title: '账'.repeat(81) }).success).toBe(false); expect(transactionSchema.safeParse({ ...valid, occurredAt: '2023-02-29T12:00:00Z' }).success).toBe(false); });
});

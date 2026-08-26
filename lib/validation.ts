import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/constants';
export const transactionSchema = z.object({ type: z.enum(['expense', 'income']), amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, '金额格式不正确').refine((value) => Number(value) > 0 && Number(value) <= 99_999_999, '金额必须大于0'), title: z.string().trim().min(1, '请填写账单标题').max(80, '标题最多80个字'), categoryId: z.string().trim().min(1, '请选择分类'), paymentMethod: z.enum(PAYMENT_METHODS), occurredAt: z.string().datetime({ offset: true, message: '日期格式不正确' }), note: z.string().trim().max(500, '备注最多500个字').optional().default('') });
export function amountToCents(amount: string) { const [whole, fraction = ''] = amount.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0')); }
export function centsToAmount(cents: number) { return (cents / 100).toFixed(2); }

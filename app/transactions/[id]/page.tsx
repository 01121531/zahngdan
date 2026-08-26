import type { Metadata } from 'next'; import { TransactionDetail } from '@/components/transaction-detail';
export const metadata: Metadata = { title: '账单详情｜轻账', description: '查看私人账单详情。', openGraph: { images: [] }, twitter: { images: [] } };
export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TransactionDetail transactionId={id}/>; }

import { TransactionForm } from '@/components/transaction-form';
export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TransactionForm transactionId={id}/>; }

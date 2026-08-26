import { cn } from '@/lib/cn';
export function Card({ className, children }: React.HTMLAttributes<HTMLDivElement>) { return <section className={cn('rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]', className)}>{children}</section>; }

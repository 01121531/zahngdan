import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '轻账｜每一笔，都清楚',
  description: '简洁、私密的个人收支与票据管理工具。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('lightledger-theme')||'system'}catch(e){}" }} />
        {children}
      </body>
    </html>
  );
}

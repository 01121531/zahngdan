import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://qingzhang-personal-ledger.liheyangedu.chatgpt.site'),
  title: '轻账｜每一笔，都清楚',
  description: '简洁、私密的个人收支与票据管理工具。',
  openGraph: {
    title: '轻账｜每一笔，都清楚',
    description: '简洁、私密的个人收支与票据管理工具。',
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: '轻账：每一笔，都清楚',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '轻账｜每一笔，都清楚',
    description: '简洁、私密的个人收支与票据管理工具。',
    images: ['/og.png'],
  },
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

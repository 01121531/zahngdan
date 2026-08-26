import type { Metadata } from 'next'; import { LoginView } from '@/components/login-view';
export const metadata: Metadata = { title: '登录｜轻账', description: '登录你的私人轻账账本。', openGraph: { images: [] }, twitter: { images: [] } };
export default function LoginPage() { return <LoginView/>; }

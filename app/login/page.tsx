import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { code?: string; next?: string };
}) {
  const code = searchParams.code;

  if (code) {
    const next = searchParams.next;
    const safeNext = next?.startsWith('/') ? next : '/';
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(safeNext)}`);
  }

  return <LoginClient />;
}

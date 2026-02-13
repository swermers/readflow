import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { code?: string; next?: string; message?: string };
}) {
  if (searchParams.code) {
    const safeNext = searchParams.next?.startsWith('/') ? searchParams.next : '/';
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}&next=${encodeURIComponent(safeNext)}`);
  }

  return <LoginClient message={searchParams.message} />;
}

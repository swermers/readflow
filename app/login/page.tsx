import LoginClient from './LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { code?: string; next?: string; message?: string };
}) {
  return (
    <LoginClient
      code={searchParams.code}
      next={searchParams.next}
      message={searchParams.message}
    />
  );
}

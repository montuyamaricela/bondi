import { headers } from 'next/headers';
import { LoginForm } from '@/app/components/features/auth/components/LoginForm';
import { getServerSession } from '@/lib/session';
import { safeCallbackUrl } from '@/lib/auth-navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(await headers());
  return (
    <div className="container mx-auto">
      <LoginForm
        key={session?.user.id ?? 'anonymous'}
        callbackUrl={safeCallbackUrl(params.callbackUrl)}
        authenticatedUserId={session?.user.id}
      />
    </div>
  );
}

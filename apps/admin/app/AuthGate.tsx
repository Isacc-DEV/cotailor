'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { clearToken, getToken } from '@/lib/auth';
import AdminShell from './AdminShell';

// Verifies an admin session against the server (AdminGuard is the real gate; this
// just keeps non-admins out of the shell). The /signin route is never gated.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const isSignin = pathname === '/signin';

  useEffect(() => {
    if (isSignin) return;
    if (!getToken()) {
      router.replace('/signin');
      return;
    }
    let stale = false;
    api.auth
      .me()
      .then((me) => {
        if (stale) return;
        if (me.role === 'admin') {
          setOk(true);
        } else {
          clearToken();
          router.replace('/signin');
        }
      })
      .catch(() => {
        if (!stale) router.replace('/signin');
      });
    return () => {
      stale = true;
    };
  }, [isSignin, router]);

  if (isSignin) return <>{children}</>;
  if (!ok) return <div className="center-msg">Checking access…</div>;
  return <AdminShell>{children}</AdminShell>;
}

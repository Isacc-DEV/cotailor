'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_CHANGED_EVENT, clearAuth, getToken } from '@/lib/auth';
import { api } from '@/lib/api-client';

const PUBLIC_PATHS = ['/', '/auth/signin', '/auth/signup'];

// Client-side route protection: protected pages render nothing until a token
// exists, and the token is verified against /auth/me in the background so an
// expired one bounces back to signin instead of failing on the first API call.
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const isPublic = PUBLIC_PATHS.includes(pathname ?? '/');

  useEffect(() => {
    if (isPublic) {
      setChecked(true);
      return;
    }
    const check = () => {
      if (!getToken()) {
        setChecked(false);
        router.replace('/auth/signin');
        return;
      }
      setChecked(true);
      api.auth.me().catch(() => {
        clearAuth();
        router.replace('/auth/signin');
      });
    };
    check();
    window.addEventListener(AUTH_CHANGED_EVENT, check);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, check);
  }, [pathname, isPublic, router]);

  if (!isPublic && !checked) return null;
  return <>{children}</>;
}

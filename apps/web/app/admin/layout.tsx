'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Spinner } from '@/app/components/ui';
import './admin.css';

// Access is verified against the server (/auth/me), not localStorage — the
// stored user is display-only. The API's AdminGuard is the real gate; this
// just keeps non-admins from seeing a shell full of failed requests.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let stale = false;
    api.auth
      .me()
      .then((me) => {
        if (stale) return;
        if (me.role === 'admin') setAllowed(true);
        else router.replace('/');
      })
      .catch(() => {
        if (!stale) router.replace('/auth/signin');
      });
    return () => {
      stale = true;
    };
  }, [router]);

  if (allowed !== true) {
    return <Spinner text="Checking access..." />;
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', exact: true },
    { href: '/admin/users', label: 'Users', exact: false },
  ];

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="admin-nav-title">Manage</div>
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <button
              key={item.href}
              className={`admin-nav-link ${active ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </button>
          );
        })}
        <div className="admin-nav-soon" title="Coming soon">
          Resume Styles <span className="soon-badge">soon</span>
        </div>
        <div className="admin-nav-soon" title="Coming soon">
          Settings <span className="soon-badge">soon</span>
        </div>
      </nav>
      <main className="admin-content">{children}</main>
    </div>
  );
}

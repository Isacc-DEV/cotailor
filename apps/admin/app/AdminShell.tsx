'use client';

import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Dashboard', exact: true },
  { href: '/taxonomy', label: 'Taxonomy' },
  { href: '/certifications', label: 'Certifications' },
  { href: '/styles', label: 'Resume Styles' },
  { href: '/users', label: 'Users' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const signOut = () => {
    clearToken();
    router.replace('/signin');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-nav" aria-label="Admin navigation">
        <div className="admin-nav-content">
          <div className="admin-nav-section">
            <div className="admin-nav-title">Manage</div>
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  className={`admin-nav-link ${active ? 'active' : ''}`}
                  onClick={() => router.push(item.href)}
                  aria-current={active ? 'page' : undefined}
                  type="button"
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button className="admin-nav-link" onClick={signOut} type="button">
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

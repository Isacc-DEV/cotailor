'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button, Spinner } from '@/app/components/ui';
import { formatRelativeTime } from '@/lib/format-time';

type UserList = Awaited<ReturnType<typeof api.admin.users.list>>;

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams?.get('status');
  const [data, setData] = useState<UserList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState(
    initialStatus === 'pending' || initialStatus === 'active' || initialStatus === 'suspended' ? initialStatus : '',
  );
  const [page, setPage] = useState(1);

  // Debounced fetch: typing in search doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      api.admin.users
        .list({
          search: search || undefined,
          role: (role || undefined) as 'user' | 'admin' | undefined,
          status: (status || undefined) as 'pending' | 'active' | 'suspended' | undefined,
          page,
          pageSize: PAGE_SIZE,
        })
        .then(setData)
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load users'));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, role, status, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1>Users</h1>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="admin">Admins</option>
          <option value="user">Users</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending approval</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {!data ? (
        <Spinner text="Loading users..." />
      ) : data.users.length === 0 ? (
        <div className="admin-empty">No users match.</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Profiles</th>
                  <th>Sessions</th>
                  <th>Last activity</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="clickable" onClick={() => router.push(`/admin/users/${u.id}`)}>
                    <td>
                      <div>{u.email}</div>
                      {u.name && <div className="admin-muted">{u.name}</div>}
                    </td>
                    <td>
                      <span className={`role-badge ${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.status}`}>{u.status}</span>
                    </td>
                    <td>{u.profileCount}</td>
                    <td>{u.sessionCount}</td>
                    <td className="admin-muted">
                      {u.lastActivityAt ? formatRelativeTime(u.lastActivityAt) : '—'}
                    </td>
                    <td className="admin-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </Button>
            <span>
              Page {data.page} of {totalPages} ({data.total} user{data.total === 1 ? '' : 's'})
            </span>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

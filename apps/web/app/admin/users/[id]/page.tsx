'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Spinner } from '@/app/components/ui';
import { getStoredUser } from '@/lib/auth';
import { formatRelativeTime } from '@/lib/format-time';

const EVENT_LABELS: Record<string, string> = {
  'admin.user.verify': 'Approved',
  'admin.user.suspend': 'Suspended',
  'admin.user.reactivate': 'Reactivated',
  'admin.user.role_change': 'Role changed',
};

const ROLE_LABELS = {
  admin: 'Admin',
  user: 'User',
} as const;

export default function AdminUserDetail() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const self = getStoredUser();
  const isSelf = self?.id === user?.id;

  useEffect(() => {
    if (!id) return;
    api.admin.users
      .get(id)
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load user'));
  }, [id]);

  if (error && !user) return <div className="admin-error">{error}</div>;
  if (!user) return <Spinner text="Loading user..." />;

  const sessionEntries = Object.entries(user.sessionsByState ?? {}) as Array<[string, number]>;
  const totalSessions = sessionEntries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="admin-detail-page">
      <button className="admin-back-link" onClick={() => router.push('/admin/users')} type="button">
        <span className="admin-back-icon" aria-hidden="true" />
        <span>Users</span>
      </button>

      <div className="admin-detail-header" style={{ marginTop: '1rem' }}>
        <div className="admin-detail-identity">
          <span className="email">{user.email}</span>
          <span className="admin-muted">
            {user.name || 'No name'} · joined {new Date(user.createdAt).toLocaleDateString()}
            {isSelf ? ' · this is you' : ''}
          </span>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-kv">
        <div className="kv-item">
          <div className="kv-label">Role</div>
          <div className="kv-value">
            <span className={`role-badge role-badge-list ${user.role}`}>
              <span className="role-badge-icon" aria-hidden="true" />
              <span className="role-badge-label">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}</span>
            </span>
          </div>
        </div>
        <div className="kv-item">
          <div className="kv-label">Status</div>
          <div className="kv-value">
            <span className={`status-badge ${user.status}`}>
              {user.status === 'suspended'
                ? `suspended ${formatRelativeTime(user.suspendedAt)}`
                : user.status === 'pending'
                  ? 'pending approval'
                  : 'active'}
            </span>
          </div>
        </div>
        <div className="kv-item">
          <div className="kv-label">Profiles</div>
          <div className="kv-value">{user.profiles?.length ?? 0}</div>
        </div>
        <div className="kv-item">
          <div className="kv-label">Sessions</div>
          <div className="kv-value">{totalSessions}</div>
        </div>
      </div>

      <div className="admin-section-title">Profiles</div>
      {(user.profiles?.length ?? 0) === 0 ? (
        <div className="admin-empty">No profiles.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {user.profiles.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td className="admin-muted">{formatRelativeTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sessionEntries.length > 0 && (
        <>
          <div className="admin-section-title">Sessions by state</div>
          <div className="admin-kv">
            {sessionEntries.map(([state, count]) => (
              <div className="kv-item" key={state}>
                <div className="kv-label">{state.replace(/_/g, ' ').toLowerCase()}</div>
                <div className="kv-value">{count}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="admin-section-title">Account history</div>
      {(user.recentEvents?.length ?? 0) === 0 ? (
        <div className="admin-empty">No admin actions on this account.</div>
      ) : (
        <ul className="admin-event-list">
          {user.recentEvents.map((e: any) => (
            <li key={e.id}>
              <span>
                {EVENT_LABELS[e.eventType] ?? e.eventType}
                {e.eventType === 'admin.user.role_change' && e.payload?.to ? ` to ${e.payload.to}` : ''}
                {e.payload?.actorEmail ? (
                  <span className="admin-muted"> — by {e.payload.actorEmail}</span>
                ) : null}
              </span>
              <span className="admin-muted">{formatRelativeTime(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

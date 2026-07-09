'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Spinner } from '@/app/components/ui';
import { formatRelativeTime } from '@/lib/format-time';

type Stats = Awaited<ReturnType<typeof api.admin.stats>>;

const EVENT_LABELS: Record<string, string> = {
  'admin.user.verify': 'approved',
  'admin.user.suspend': 'suspended',
  'admin.user.reactivate': 'reactivated',
  'admin.user.role_change': 'role changed',
  'admin.style.create': 'created a resume style',
  'admin.style.update': 'updated a resume style',
  'admin.style.delete': 'deleted a resume style',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load stats'));
  }, []);

  if (error) return <div className="admin-error">{error}</div>;
  if (!stats) return <Spinner text="Loading dashboard..." />;

  const finished = stats.sessions.byState['FINAL_READY'] ?? 0;

  return (
    <div>
      <h1>Dashboard</h1>

      {stats.users.pending > 0 && (
        <div className="admin-pending-banner">
          <strong>
            {stats.users.pending} account{stats.users.pending === 1 ? '' : 's'}
          </strong>{' '}
          waiting for approval —{' '}
          <a href="/users?status=pending">review now</a>
        </div>
      )}

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-icon users-icon" aria-hidden="true" />
          <div className="admin-stat-value">{stats.users.total}</div>
          <div className="admin-stat-label">Users ({stats.users.admins} admin{stats.users.admins === 1 ? '' : 's'})</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon pending-icon" aria-hidden="true" />
          <div className="admin-stat-value">{stats.users.pending}</div>
          <div className="admin-stat-label">Pending approval</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon suspended-icon" aria-hidden="true" />
          <div className="admin-stat-value">{stats.users.suspended}</div>
          <div className="admin-stat-label">Suspended</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon profiles-icon" aria-hidden="true" />
          <div className="admin-stat-value">{stats.profiles.total}</div>
          <div className="admin-stat-label">Profiles</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon sessions-icon" aria-hidden="true" />
          <div className="admin-stat-value">{stats.sessions.total}</div>
          <div className="admin-stat-label">Sessions ({finished} finished)</div>
        </div>
      </div>

      <div className="admin-section-title">Recent admin activity</div>
      {stats.recentAdminActivity.length === 0 ? (
        <div className="admin-empty">No admin actions yet.</div>
      ) : (
        <ul className="admin-event-list">
          {stats.recentAdminActivity.map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.user?.email ?? 'unknown user'}</strong>{' '}
                {EVENT_LABELS[e.eventType] ?? e.eventType}
                {e.eventType === 'admin.user.role_change' && e.payload?.to ? ` to ${e.payload.to}` : ''}
                {e.eventType.startsWith('admin.style.') && e.payload?.key ? ` (${e.payload.key})` : ''}
                {e.payload?.actorEmail && e.payload.actorEmail !== e.user?.email ? (
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

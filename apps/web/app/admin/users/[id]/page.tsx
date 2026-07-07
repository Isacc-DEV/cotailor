'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button, Spinner } from '@/app/components/ui';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import { getStoredUser } from '@/lib/auth';
import { formatRelativeTime } from '@/lib/format-time';

const EVENT_LABELS: Record<string, string> = {
  'admin.user.verify': 'Approved',
  'admin.user.suspend': 'Suspended',
  'admin.user.reactivate': 'Reactivated',
  'admin.user.role_change': 'Role changed',
};

type PendingAction = 'approve' | 'suspend' | 'reactivate' | 'promote' | 'demote' | null;

export default function AdminUserDetail() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const self = getStoredUser();
  const isSelf = self?.id === user?.id;

  useEffect(() => {
    if (!id) return;
    api.admin.users
      .get(id)
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load user'));
  }, [id]);

  const applyAction = async (action: Exclude<PendingAction, null>) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const patch =
        action === 'suspend'
          ? { status: 'suspended' as const }
          : action === 'approve' || action === 'reactivate'
            ? { status: 'active' as const }
            : action === 'promote'
              ? { role: 'admin' as const }
              : { role: 'user' as const };
      const updated = await api.admin.users.update(id, patch);
      setUser(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  if (error && !user) return <div className="admin-error">{error}</div>;
  if (!user) return <Spinner text="Loading user..." />;

  const sessionEntries = Object.entries(user.sessionsByState ?? {}) as Array<[string, number]>;
  const totalSessions = sessionEntries.reduce((sum, [, n]) => sum + n, 0);

  const confirmCopy: Record<Exclude<PendingAction, null>, { title: string; message: string; confirm: string }> = {
    approve: {
      title: 'Approve account?',
      message: 'The account becomes active and the user can sign in immediately.',
      confirm: 'Approve',
    },
    suspend: {
      title: 'Suspend user?',
      message: 'They will be signed out and unable to sign in until reactivated. Their data is kept.',
      confirm: 'Suspend',
    },
    reactivate: {
      title: 'Reactivate user?',
      message: 'They will be able to sign in again immediately.',
      confirm: 'Reactivate',
    },
    promote: {
      title: 'Make admin?',
      message: 'They gain full access to the Manage area: users, and future style/settings management.',
      confirm: 'Make admin',
    },
    demote: {
      title: 'Remove admin access?',
      message: 'They become a regular user and lose access to the Manage area immediately.',
      confirm: 'Remove admin',
    },
  };

  return (
    <div>
      <Button variant="secondary" onClick={() => router.push('/admin/users')}>
        ← Back to users
      </Button>

      <div className="admin-detail-header" style={{ marginTop: '1rem' }}>
        <div className="admin-detail-identity">
          <span className="email">{user.email}</span>
          <span className="admin-muted">
            {user.name || 'No name'} · joined {new Date(user.createdAt).toLocaleDateString()}
            {isSelf ? ' · this is you' : ''}
          </span>
        </div>
        <div className="admin-detail-actions">
          {user.status === 'active' &&
            (user.role === 'user' ? (
              <Button variant="secondary" disabled={busy} onClick={() => setPending('promote')}>
                Make admin
              </Button>
            ) : (
              <Button variant="secondary" disabled={busy || isSelf} onClick={() => setPending('demote')}>
                Remove admin
              </Button>
            ))}
          {user.status === 'pending' && (
            <Button variant="primary" disabled={busy} onClick={() => setPending('approve')}>
              Approve
            </Button>
          )}
          {user.status === 'suspended' ? (
            <Button variant="primary" disabled={busy} onClick={() => setPending('reactivate')}>
              Reactivate
            </Button>
          ) : (
            <Button variant="danger" disabled={busy || isSelf} onClick={() => setPending('suspend')}>
              {user.status === 'pending' ? 'Reject' : 'Suspend'}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-kv">
        <div className="kv-item">
          <div className="kv-label">Role</div>
          <div className="kv-value">
            <span className={`role-badge ${user.role}`}>{user.role}</span>
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

      <ConfirmDialog
        isOpen={pending !== null}
        title={pending ? confirmCopy[pending].title : ''}
        message={pending ? confirmCopy[pending].message : ''}
        itemName={user.email}
        confirmText={pending ? confirmCopy[pending].confirm : 'Confirm'}
        onConfirm={() => pending && applyAction(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

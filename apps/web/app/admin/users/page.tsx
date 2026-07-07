'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Spinner } from '@/app/components/ui';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import { getStoredUser } from '@/lib/auth';
import { formatRelativeTime } from '@/lib/format-time';

type UserList = Awaited<ReturnType<typeof api.admin.users.list>>;
type UserRow = UserList['users'][number];
type UserAction = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'promote' | 'demote';
type PendingAction = { action: UserAction; user: UserRow } | null;

const PAGE_SIZE = 20;

const roleLabels = {
  admin: 'Admin',
  user: 'User',
} as const;

const statusLabels = {
  active: 'Approved',
  pending: 'Pending',
  suspended: 'Suspended',
} as const;

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
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const self = getStoredUser();

  const loadUsers = useCallback(async () => {
    const users = await api.admin.users.list({
      search: search || undefined,
      role: (role || undefined) as 'user' | 'admin' | undefined,
      status: (status || undefined) as 'pending' | 'active' | 'suspended' | undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    setData(users);
  }, [search, role, status, page]);

  // Debounced fetch: typing in search doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load users'));
    }, 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const confirmCopy: Record<UserAction, { title: string; message: string; confirm: string; dangerous?: boolean }> = {
    approve: {
      title: 'Approve account?',
      message: 'The account becomes active and the user can sign in immediately.',
      confirm: 'Approve',
      dangerous: false,
    },
    reject: {
      title: 'Reject account?',
      message: 'The account will be suspended and the user will not be able to sign in.',
      confirm: 'Reject',
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
      dangerous: false,
    },
    promote: {
      title: 'Make admin?',
      message: 'They gain full access to the Manage area.',
      confirm: 'Make admin',
      dangerous: false,
    },
    demote: {
      title: 'Remove admin access?',
      message: 'They become a regular user and lose access to the Manage area immediately.',
      confirm: 'Remove admin',
    },
  };

  const applyAction = async () => {
    if (!pendingAction) return;

    setBusyUserId(pendingAction.user.id);
    setError(null);
    try {
      const patch =
        pendingAction.action === 'reject' || pendingAction.action === 'suspend'
          ? { status: 'suspended' as const }
          : pendingAction.action === 'approve' || pendingAction.action === 'reactivate'
            ? { status: 'active' as const }
            : pendingAction.action === 'promote'
              ? { role: 'admin' as const }
              : { role: 'user' as const };

      await api.admin.users.update(pendingAction.user.id, patch);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyUserId(null);
      setPendingAction(null);
    }
  };

  const openAction = (action: UserAction, user: UserRow) => {
    setPendingAction({ action, user });
  };

  const renderActions = (user: UserRow) => {
    const isSelf = self?.id === user.id;
    const busy = busyUserId === user.id;

    return (
      <div className="admin-row-actions" onClick={(e) => e.stopPropagation()}>
        {user.status === 'active' &&
          (user.role === 'user' ? (
            <button
              className="admin-action-btn admin-action-promote"
              aria-label="Make admin"
              disabled={busy}
              onClick={() => openAction('promote', user)}
              title="Make admin"
              type="button"
            >
              <span className="admin-action-icon" aria-hidden="true" />
            </button>
          ) : (
            <button
              className="admin-action-btn admin-action-demote"
              aria-label={isSelf ? 'You cannot remove your own admin access' : 'Remove admin'}
              disabled={busy || isSelf}
              onClick={() => openAction('demote', user)}
              title={isSelf ? 'You cannot remove your own admin access' : 'Remove admin'}
              type="button"
            >
              <span className="admin-action-icon" aria-hidden="true" />
            </button>
          ))}

        {user.status === 'pending' && (
          <button
            className="admin-action-btn admin-action-approve"
            aria-label="Approve"
            disabled={busy}
            onClick={() => openAction('approve', user)}
            title="Approve"
            type="button"
          >
            <span className="admin-action-icon" aria-hidden="true" />
          </button>
        )}

        {user.status === 'suspended' ? (
          <button
            className="admin-action-btn admin-action-reactivate"
            aria-label="Reactivate"
            disabled={busy}
            onClick={() => openAction('reactivate', user)}
            title="Reactivate"
            type="button"
          >
            <span className="admin-action-icon" aria-hidden="true" />
          </button>
        ) : (
          <button
            className="admin-action-btn admin-action-danger"
            aria-label={isSelf ? 'You cannot suspend your own account' : user.status === 'pending' ? 'Reject' : 'Suspend'}
            disabled={busy || isSelf}
            onClick={() => openAction(user.status === 'pending' ? 'reject' : 'suspend', user)}
            title={isSelf ? 'You cannot suspend your own account' : user.status === 'pending' ? 'Reject' : 'Suspend'}
            type="button"
          >
            <span className="admin-action-icon" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  const pendingCopy = pendingAction ? confirmCopy[pendingAction.action] : null;

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const roleLabel = roleLabels[u.role];
                  return (
                    <tr key={u.id} className="clickable" onClick={() => router.push(`/admin/users/${u.id}`)}>
                      <td>
                        <div>{u.email}</div>
                        {u.name && <div className="admin-muted">{u.name}</div>}
                      </td>
                      <td>
                        <span className={`role-badge role-badge-list ${u.role}`}>
                          <span className="role-badge-icon" aria-hidden="true" />
                          <span className="role-badge-label">{roleLabel}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${u.status}`}>{statusLabels[u.status]}</span>
                      </td>
                      <td>{u.profileCount}</td>
                      <td>{u.sessionCount}</td>
                      <td className="admin-muted">
                        {u.lastActivityAt ? formatRelativeTime(u.lastActivityAt) : '—'}
                      </td>
                      <td className="admin-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>{renderActions(u)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="admin-pager" aria-label="Users pagination">
            <button
              className="admin-pager-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              <span className="admin-pager-icon prev" aria-hidden="true" />
              <span>Previous</span>
            </button>

            <div className="admin-pager-status" aria-live="polite">
              <span>
                Page {data.page} of {totalPages}
              </span>
              <span className="admin-pager-total">
                {data.total} user{data.total === 1 ? '' : 's'}
              </span>
            </div>

            <button
              className="admin-pager-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              <span>Next</span>
              <span className="admin-pager-icon next" aria-hidden="true" />
            </button>
          </nav>
        </>
      )}

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={pendingCopy?.title ?? ''}
        message={pendingCopy?.message}
        itemName={pendingAction?.user.email}
        confirmText={pendingCopy?.confirm ?? 'Confirm'}
        onConfirm={applyAction}
        onCancel={() => setPendingAction(null)}
        isDangerous={pendingCopy?.dangerous ?? true}
      />
    </div>
  );
}

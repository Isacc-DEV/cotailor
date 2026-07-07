// Single source of truth for client-side auth state (token + user in localStorage).
// Components react to changes via AUTH_CHANGED_EVENT instead of re-reading storage.

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role?: 'user' | 'admin';
  theme?: 'light' | 'dark' | 'system';
  aiProviderMode?: 'cotailor' | 'own_keys';
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';
export const AUTH_CHANGED_EVENT = 'cotailor:auth-changed';

function emitChange() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitChange();
}

// Merge a partial update into the stored user (e.g. after editing name/theme in
// Settings) so the sidebar and other AUTH_CHANGED_EVENT listeners re-render.
export function updateStoredUser(patch: Partial<AuthUser>) {
  const current = getStoredUser();
  if (!current) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...patch }));
  emitChange();
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitChange();
}

// Admin-app auth state. This app runs on its own origin (port 3002), so it keeps
// its own token + user in localStorage — admins sign in here separately.

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
}

const TOKEN_KEY = 'admin_auth_token';
const USER_KEY = 'admin_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

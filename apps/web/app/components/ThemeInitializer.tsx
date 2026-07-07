'use client';

import { useEffect } from 'react';
import { AUTH_CHANGED_EVENT, getStoredUser } from '@/lib/auth';
import { applyTheme, getStoredThemePref, type ThemePref } from '@/lib/theme';

// Keeps the applied theme in sync with (a) the signed-in user's saved
// preference, (b) sign-in/out events, and (c) live OS changes while on
// 'system'. The pre-paint script in the layout does the initial apply; this
// reconciles once React hydrates and thereafter.
export function ThemeInitializer() {
  useEffect(() => {
    const sync = () => {
      // A signed-in user's saved theme wins; signed-out visitors fall back to
      // whatever they last chose locally.
      const user = getStoredUser();
      const pref: ThemePref = (user?.theme as ThemePref) ?? getStoredThemePref();
      applyTheme(pref);
    };
    sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getStoredThemePref() === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onSystemChange);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      mq.removeEventListener('change', onSystemChange);
    };
  }, []);

  return null;
}

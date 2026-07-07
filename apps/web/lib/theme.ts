// Theme preference handling. The concrete theme applied to the DOM is always
// 'light' or 'dark' (set as data-theme on <html>); 'system' is a *preference*
// that resolves to one of those via prefers-color-scheme.

export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_KEY = 'theme_pref';

// Inline, dependency-free script injected before first paint to set data-theme
// from the stored preference — avoids a flash of the wrong theme on load. Kept
// in sync with resolveTheme() below; must stay pure ES5-ish (runs raw).
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export function getStoredThemePref(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function storeThemePref(pref: ThemePref) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, pref);
}

// Apply a preference to the document immediately (and persist it). Call this on
// every theme change so the UI updates without a reload.
export function applyTheme(pref: ThemePref) {
  if (typeof document === 'undefined') return;
  storeThemePref(pref);
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

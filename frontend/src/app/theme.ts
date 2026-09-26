import { useEffect, useState } from 'react';
import { SETTINGS, useSetting } from '../store';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Mirror the stored theme onto <html data-theme>; "system" leaves it to prefers-color-scheme. */
export function useApplyTheme(): void {
  const theme = useSetting<ThemeChoice>(SETTINGS.theme, 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme]);
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The theme actually shown: the stored choice, or the system preference for "system". */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useSetting<ThemeChoice>(SETTINGS.theme, 'system') ?? 'system';
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.(DARK_QUERY).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

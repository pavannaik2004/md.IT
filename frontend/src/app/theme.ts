import { useEffect } from 'react';
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

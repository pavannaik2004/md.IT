import { SETTINGS, useSettingState } from '../store';
import { MenuButton, type MenuItem } from '../ui';
import type { ThemeChoice } from './theme';

export function ThemeMenu() {
  const [theme, setTheme] = useSettingState<ThemeChoice>(SETTINGS.theme, 'system');
  const item = (value: ThemeChoice, label: string): MenuItem => ({
    label,
    icon: theme === value ? 'check' : undefined,
    onSelect: () => setTheme(value),
  });
  return (
    <MenuButton
      icon="sliders"
      label="Display"
      items={[item('system', 'Match system theme'), item('light', 'Light theme'), item('dark', 'Dark theme')]}
    />
  );
}

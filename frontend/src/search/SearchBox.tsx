import { Input } from '../ui';

export const SEARCH_INPUT_ID = 'project-search';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SEARCH_SHORTCUT = isMac ? '⌘ Shift F' : 'Ctrl Shift F';

export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="search-box">
      <Input
        id={SEARCH_INPUT_ID}
        type="search"
        icon="search"
        placeholder="Search project"
        aria-label="Search project"
        shortcut={value ? undefined : SEARCH_SHORTCUT}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
      />
    </div>
  );
}

import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div className="md-seg" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={cx('md-seg-item', on && 'is-on')}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <Icon name={option.icon} />}
            {option.label && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

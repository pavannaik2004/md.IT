import { useId, type CSSProperties } from 'react';

export interface RangeFieldProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export function RangeField({ label, min, max, step = 1, value, unit = '', format, onChange }: RangeFieldProps) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const text = format ? format(value) : `${value}${unit}`;
  return (
    <div className="md-range">
      <div className="md-range-head">
        <label htmlFor={id} className="md-field-label">
          {label}
        </label>
        <output htmlFor={id} className="md-range-value">
          {text}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(event) => onChange(parseFloat(event.currentTarget.value))}
      />
    </div>
  );
}

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RangeField } from './RangeField';

describe('RangeField', () => {
  it('labels the slider, shows the formatted value and reports changes as numbers', () => {
    const onChange = vi.fn();
    render(<RangeField label="Line height" min={1.2} max={2.2} step={0.05} value={1.65} format={(v) => v.toFixed(2)} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Line height' });
    expect(slider).toHaveValue('1.65');
    expect(screen.getByText('1.65')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '1.8' } });
    expect(onChange).toHaveBeenCalledWith(1.8);
  });

  it('fills the track up to the value and uses the unit without a formatter', () => {
    render(<RangeField label="Padding" min={0} max={96} step={4} value={48} unit="px" onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Padding' }).style.getPropertyValue('--pct')).toBe('50%');
    expect(screen.getByText('48px')).toBeInTheDocument();
  });
});

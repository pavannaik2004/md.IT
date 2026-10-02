import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RENDERING, type RenderingSettings } from './rendering';
import { SettingsPanel } from './SettingsPanel';

function setup(value: RenderingSettings = DEFAULT_RENDERING) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(<SettingsPanel value={value} onChange={onChange} onReset={onReset} />);
  return { onChange, onReset };
}

describe('SettingsPanel', () => {
  it('changes the font', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    expect(screen.getByRole('radio', { name: 'Serif' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Mono' }));
    expect(onChange).toHaveBeenCalledWith({ font: 'mono' });
  });

  it('changes each number', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByRole('slider', { name: 'Letter spacing' }), { target: { value: '0.02' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Line height' }), { target: { value: '1.8' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Margin' }), { target: { value: '16' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Padding' }), { target: { value: '32' } });
    expect(onChange.mock.calls).toEqual([[{ letterSpacing: 0.02 }], [{ lineHeight: 1.8 }], [{ margin: 16 }], [{ padding: 32 }]]);
  });

  it('shows values with their units', () => {
    setup({ ...DEFAULT_RENDERING, letterSpacing: 0.02 });
    expect(screen.getByText('0.02em')).toBeInTheDocument();
    expect(screen.getByText('1.65')).toBeInTheDocument();
    expect(screen.getByText('0px')).toBeInTheDocument();
    expect(screen.getByText('48px')).toBeInTheDocument();
  });

  it('can’t reset when nothing changed', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
  });

  it('resets when something changed', async () => {
    const user = userEvent.setup();
    const { onReset } = setup({ ...DEFAULT_RENDERING, padding: 16 });
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

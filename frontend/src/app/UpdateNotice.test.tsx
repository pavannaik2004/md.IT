import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateNotice } from './UpdateNotice';

describe('UpdateNotice', () => {
  it('offers a reload once a new version is waiting', async () => {
    const updateSW = vi.fn(async () => {});
    let onNeedRefresh: (() => void) | undefined;
    const register = vi.fn((options: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = options.onNeedRefresh;
      return updateSW;
    });
    render(<UpdateNotice enabled register={register} />);
    expect(screen.queryByText('A new version of md.IT is ready.')).toBeNull();
    act(() => onNeedRefresh!());
    expect(screen.getByText('A new version of md.IT is ready.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('registers nothing when disabled (development and tests)', () => {
    const register = vi.fn();
    render(<UpdateNotice enabled={false} register={register} />);
    expect(register).not.toHaveBeenCalled();
  });
});

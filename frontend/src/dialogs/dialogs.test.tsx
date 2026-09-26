import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../store';
import { ConfirmDialog, TextFieldDialog } from './index';

describe('TextFieldDialog', () => {
  it('submits the value with Enter and closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<TextFieldDialog title="New project" label="Name" submitLabel="Create project" onSubmit={onSubmit} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Name'), 'OS{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('OS');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a store error under the field and stays open', async () => {
    const onClose = vi.fn();
    render(
      <TextFieldDialog
        title="New project"
        label="Name"
        submitLabel="Create project"
        onSubmit={() => Promise.reject(new ValidationError('Name can’t be empty.'))}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name can’t be empty.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('focuses Cancel first and confirms on request', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ConfirmDialog title="Delete document" message="Delete “A.md”? This can’t be undone." confirmLabel="Delete document" onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });
});

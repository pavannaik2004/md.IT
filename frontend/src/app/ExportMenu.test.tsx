import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExportMenu } from './ExportMenu';

describe('ExportMenu', () => {
  it('offers document exports only when a document is ready', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportMenu canExportDocument={false} onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    for (const name of ['Export Markdown', 'Export HTML', 'Export PDF']) expect(screen.getByRole('menuitem', { name })).toBeDisabled();
    await user.click(screen.getByRole('menuitem', { name: 'Export project (.zip)' }));
    expect(onExport).toHaveBeenCalledWith('zip');
  });

  it('reports the chosen document export', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportMenu canExportDocument onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export HTML' }));
    expect(onExport).toHaveBeenCalledWith('html');
  });
});

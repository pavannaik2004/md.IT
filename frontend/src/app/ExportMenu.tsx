import type { DocumentExportKind } from '../export';
import { MenuButton, type MenuItem } from '../ui';

export type ExportKind = DocumentExportKind | 'zip';

export function ExportMenu({ canExportDocument, onExport }: { canExportDocument: boolean; onExport: (kind: ExportKind) => void }) {
  const documentItem = (label: string, kind: DocumentExportKind): MenuItem => ({ label, disabled: !canExportDocument, onSelect: () => onExport(kind) });
  return (
    <MenuButton
      icon="download"
      label="Export"
      items={[
        documentItem('Export Markdown', 'markdown'),
        documentItem('Export HTML', 'html'),
        documentItem('Export PDF', 'pdf'),
        'separator',
        { label: 'Export project (.zip)', onSelect: () => onExport('zip') },
      ]}
    />
  );
}

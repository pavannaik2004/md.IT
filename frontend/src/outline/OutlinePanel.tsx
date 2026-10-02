import type { OutlineHeading } from '../renderer';
import { EmptyState } from '../ui';

export interface OutlinePanelProps {
  /** null = no document open. */
  headings: readonly OutlineHeading[] | null;
  onSelect: (line: number) => void;
}

export function OutlinePanel({ headings, onSelect }: OutlinePanelProps) {
  if (headings === null) {
    return (
      <EmptyState icon="file" title="No document open">
        Open a document to see its outline.
      </EmptyState>
    );
  }
  if (headings.length === 0) {
    return (
      <EmptyState icon="info" title="No headings yet">
        Headings you write appear here.
      </EmptyState>
    );
  }
  const top = Math.min(...headings.map((h) => h.level));
  return (
    <nav aria-label="Outline">
      <ul className="outline-list">
        {headings.map((heading) => (
          <li key={heading.line}>
            <button
              type="button"
              className="outline-item"
              style={{ paddingLeft: `${8 + (heading.level - top) * 12}px` }}
              onClick={() => onSelect(heading.line)}
            >
              {heading.text || 'Untitled heading'}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

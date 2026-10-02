import type { DocumentStats } from '../renderer';
import { EmptyState } from '../ui';

const ROWS: ReadonlyArray<[string, (stats: DocumentStats) => string]> = [
  ['Words', (s) => s.words.toLocaleString()],
  ['Characters', (s) => s.characters.toLocaleString()],
  ['Reading time', (s) => (s.readingMinutes === 0 ? 'Under a minute' : `${s.readingMinutes.toLocaleString()} min`)],
  ['Headings', (s) => s.headings.toLocaleString()],
  ['Code blocks', (s) => s.codeBlocks.toLocaleString()],
  ['Diagrams', (s) => s.diagrams.toLocaleString()],
  ['Math', (s) => s.math.toLocaleString()],
  ['Images', (s) => s.images.toLocaleString()],
  ['Links', (s) => s.links.toLocaleString()],
];

export function StatsPanel({ stats }: { stats: DocumentStats | null }) {
  if (stats === null) {
    return (
      <EmptyState icon="file" title="No document open">
        Open a document to see its outline.
      </EmptyState>
    );
  }
  return (
    <dl className="stats-list">
      {ROWS.map(([label, value]) => (
        <div key={label} className="stats-row">
          <dt>{label}</dt>
          <dd>{value(stats)}</dd>
        </div>
      ))}
    </dl>
  );
}

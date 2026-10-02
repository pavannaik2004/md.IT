import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { plural } from '../lib/text';
import { useDocuments, useFolders, useImages } from '../store';
import { Icon, type IconName } from '../ui';
import { searchProject, type NameResult, type Range } from './search';

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchResultsProps {
  projectId: string;
  query: string;
  onOpenDocument: (docId: string, match?: SearchMatch) => void;
  onReveal: (id: string) => void;
}

const DELAY = 120;
const ICON: Record<NameResult['kind'], IconName> = { folder: 'folder', document: 'file', image: 'image' };

function Highlighted({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={i} className="md-mark">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

const parentPath = (path: string, name: string) => (path.length > name.length ? path.slice(0, path.length - name.length - 1) : '');

export function SearchResults({ projectId, query, onOpenDocument, onReveal }: SearchResultsProps) {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const images = useImages(projectId);
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query), DELAY);
    return () => window.clearTimeout(timer);
  }, [query]);
  const results = useMemo(
    () => (folders && documents && images ? searchProject(settled, { folders, documents, images }) : null),
    [settled, folders, documents, images],
  );
  if (!results) return null;

  return (
    <div className="search-results">
      <p className="search-summary" role="status">
        {results.length === 0 ? `No matches for “${settled.trim()}”` : plural(results.length, 'result')}
      </p>
      <ul className="search-list">
        {results.map((result) => (
          <li key={`${result.kind}:${result.id}`}>
            {result.kind === 'content' ? (
              <>
                <button type="button" className="search-row" onClick={() => onOpenDocument(result.id)}>
                  <Icon name="file" />
                  <span className="search-name">{result.name}</span>
                  <span className="search-path">{parentPath(result.path, result.name)}</span>
                </button>
                <ul className="search-snippets">
                  {result.snippets.map((snippet) => (
                    <li key={snippet.from}>
                      <button
                        type="button"
                        className="search-snippet"
                        onClick={() => onOpenDocument(result.id, { from: snippet.from, to: snippet.to })}
                      >
                        <span className="search-line">Line {snippet.line + 1}</span>
                        <span className="search-text">
                          <Highlighted text={snippet.text} ranges={snippet.ranges} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <button
                type="button"
                className="search-row"
                onClick={() => (result.kind === 'document' ? onOpenDocument(result.id) : onReveal(result.id))}
              >
                <Icon name={ICON[result.kind]} />
                <span className="search-name">
                  <Highlighted text={result.name} ranges={result.ranges} />
                </span>
                <span className="search-path">{parentPath(result.path, result.name)}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

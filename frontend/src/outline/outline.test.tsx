import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OutlinePanel } from './OutlinePanel';
import { StatsPanel } from './StatsPanel';

describe('OutlinePanel', () => {
  it('lists headings indented below the shallowest level and reports clicks', async () => {
    const onSelect = vi.fn();
    render(<OutlinePanel headings={[{ level: 2, text: 'Setup', line: 3 }, { level: 3, text: 'Install', line: 7 }]} onSelect={onSelect} />);
    expect(screen.getByRole('navigation', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setup' }).style.paddingLeft).toBe('8px');
    expect(screen.getByRole('button', { name: 'Install' }).style.paddingLeft).toBe('20px');
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('names an empty heading', () => {
    render(<OutlinePanel headings={[{ level: 1, text: '', line: 0 }]} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Untitled heading' })).toBeInTheDocument();
  });

  it('says when no document is open', () => {
    render(<OutlinePanel headings={null} onSelect={vi.fn()} />);
    expect(screen.getByText('No document open')).toBeInTheDocument();
    expect(screen.getByText('Open a document to see its outline.')).toBeInTheDocument();
  });

  it('says when there are no headings', () => {
    render(<OutlinePanel headings={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('No headings yet')).toBeInTheDocument();
    expect(screen.getByText('Headings you write appear here.')).toBeInTheDocument();
  });
});

describe('StatsPanel', () => {
  const stats = { words: 1234, characters: 5678, headings: 3, codeBlocks: 2, diagrams: 1, math: 4, images: 5, links: 6, readingMinutes: 6 };
  const value = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

  it('shows every statistic', () => {
    render(<StatsPanel stats={stats} />);
    expect(value('Words')).toBe((1234).toLocaleString());
    expect(value('Characters')).toBe((5678).toLocaleString());
    expect(value('Reading time')).toBe('6 min');
    expect(value('Headings')).toBe('3');
    expect(value('Code blocks')).toBe('2');
    expect(value('Diagrams')).toBe('1');
    expect(value('Math')).toBe('4');
    expect(value('Images')).toBe('5');
    expect(value('Links')).toBe('6');
  });

  it('says “Under a minute” when there are no words', () => {
    render(<StatsPanel stats={{ ...stats, words: 0, readingMinutes: 0 }} />);
    expect(value('Reading time')).toBe('Under a minute');
  });

  it('says when no document is open', () => {
    render(<StatsPanel stats={null} />);
    expect(screen.getByText('No document open')).toBeInTheDocument();
  });
});

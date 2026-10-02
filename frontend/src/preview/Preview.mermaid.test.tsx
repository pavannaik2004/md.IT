import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderDiagrams } from './mermaid';
import { Preview } from './Preview';

vi.mock('./mermaid', () => ({ renderDiagrams: vi.fn(() => Promise.resolve()) }));

describe('Preview diagrams', () => {
  it('renders diagrams after each change and when the theme changes', () => {
    const html = '<div class="md-mermaid" data-source="graph%20A"></div>';
    const props = { onOpenDocument: vi.fn(), onNotice: vi.fn() };
    const { rerender } = render(<Preview html={html} theme="light" {...props} />);
    expect(renderDiagrams).toHaveBeenCalledTimes(1);
    expect(vi.mocked(renderDiagrams).mock.calls[0]![1]).toBe('light');
    rerender(<Preview html={html} theme="dark" {...props} />);
    expect(renderDiagrams).toHaveBeenCalledTimes(2);
    rerender(<Preview html={`${html}<p>more</p>`} theme="dark" {...props} />);
    expect(renderDiagrams).toHaveBeenCalledTimes(3);
  });
});

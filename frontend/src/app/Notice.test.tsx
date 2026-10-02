import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('announces the message and can be dismissed', () => {
    const onDismiss = vi.fn();
    render(<Notice notice={{ id: 1, text: 'Hello there.' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('Hello there.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('dismisses itself after 5 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Notice notice={{ id: 1, text: 'Hello.' }} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(4999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('keeps an empty live region when there is nothing to say', () => {
    render(<Notice notice={null} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

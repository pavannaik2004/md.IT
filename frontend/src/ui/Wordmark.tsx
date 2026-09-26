import { cx } from './cx';

export function Wordmark({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <span className={cx('md-wordmark', size === 'lg' && 'md-wordmark-lg', className)} aria-label="md.IT" role="img">
      md<span className="md-wordmark-dot">.</span>IT
    </span>
  );
}

import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface ProseProps extends HTMLAttributes<HTMLElement> {
  /** Already-sanitized HTML from the renderer. */
  html?: string;
}

export function Prose({ html, className, children, ...rest }: ProseProps) {
  if (html !== undefined) {
    return <article {...rest} className={cx('md-prose', className)} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <article {...rest} className={cx('md-prose', className)}>
      {children}
    </article>
  );
}

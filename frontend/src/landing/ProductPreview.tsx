import { useMemo } from 'react';
import { render } from '../renderer';
import { Prose, SaveStatus, SegmentedControl, TreeItem, Wordmark } from '../ui';

const SOURCE = `## Round-robin

Each process gets a fixed **time quantum** before it is preempted. The average wait is $\\bar{w} = \\frac{1}{n}\\sum w_i$.

\`\`\`python
def run(queue, quantum=10):
    task = queue.pop(0)
    task.run(quantum)
\`\`\`
`;

/** The editor pane's text, split into the editor theme's roles: markup characters faint, headings strong. */
type Part = [text: string, role?: 'mark' | 'heading' | 'strong' | 'code'];
const EDITOR_LINES: Part[][] = [
  [['## ', 'mark'], ['Round-robin', 'heading']],
  [],
  [['Each process gets a fixed '], ['**', 'mark'], ['time quantum', 'strong'], ['**', 'mark'], [' before it is']],
  [['preempted. The average wait is '], ['$\\bar{w} = \\frac{1}{n}\\sum w_i$', 'code'], ['.']],
  [],
  [['```', 'mark'], ['python', 'mark']],
  [['def run(queue, quantum=10):', 'code']],
  [['    task = queue.pop(0)', 'code']],
  [['    task.run(quantum)', 'code']],
  [['```', 'mark']],
];

const VIEW = [
  { value: 'split', label: 'Split', icon: 'columns' },
  { value: 'editor', label: 'Editor', icon: 'pencil' },
  { value: 'preview', label: 'Preview', icon: 'eye' },
] as const;

const inert = { inert: '' } as Record<string, string>;

/** A still picture of the workspace, made of the real components. Decorative: hidden from assistive tech, not focusable. */
export function ProductPreview() {
  const html = useMemo(() => render(SOURCE), []);
  return (
    <div className="landing-frame" aria-hidden="true" {...inert}>
      <div className="landing-frame-bar">
        <div className="landing-frame-crumbs">
          <Wordmark />
          <span className="ws-crumb-sep">/</span>
          <span className="ws-project">OS notes</span>
          <span className="ws-crumb-sep">/</span>
          <span className="ws-document">Scheduling.md</span>
        </div>
        <SegmentedControl label="View" value="split" onChange={() => {}} options={VIEW} />
        <div className="landing-frame-status">
          <SaveStatus state="saved" />
        </div>
      </div>
      <div className="landing-frame-body">
        <div className="landing-frame-tree" role="tree">
          <TreeItem kind="folder" name="Lectures" open />
          <TreeItem kind="file" name="Processes.md" depth={1} />
          <TreeItem kind="file" name="Scheduling.md" depth={1} active dirty />
          <TreeItem kind="file" name="Memory.md" depth={1} />
          <TreeItem kind="folder" name="images" depth={1} />
          <TreeItem kind="file" name="Exam prep.md" />
        </div>
        <pre className="landing-frame-editor">
          {EDITOR_LINES.map((line, i) => (
            <span key={i} className="landing-editor-line">
              {line.map(([text, role], j) => (
                <span key={j} className={role ? `landing-tok-${role}` : undefined}>
                  {text}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </pre>
        <div className="landing-frame-preview">
          <Prose html={html} />
        </div>
      </div>
    </div>
  );
}

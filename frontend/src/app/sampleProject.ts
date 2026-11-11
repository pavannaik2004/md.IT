import { importProject, listDocuments, type ProjectImportData } from '../store';
import diagramSvg from './sample/diagram.svg?raw';

const START_HERE = `# Welcome to md.IT

md.IT is a calm place to write technical documents. Markdown on the left, the rendered document on the right, your files beside them.

## Where your work lives

- **In this browser.** Every keystroke is saved here automatically. Nothing leaves your computer until you ask.
- **In the cloud, when you want.** Sign in and choose **Save version** to keep a numbered copy you can open on another browser.

> Browsers can clear stored data when space runs low. Export a .zip or save a version for anything you can’t lose.

## Look around

1. Open [Writing](Guides/Writing.md) for headings, lists, tables and highlights.
2. Open [Code and math](Guides/Code%20and%20math.md) for code blocks, formulas and diagrams.
3. Open [Images](Guides/Images.md) to see sizing and alignment.

## Useful keys

| Action | Keys |
| --- | --- |
| Save now | Ctrl+S |
| Find and replace | Ctrl+F, Ctrl+H |
| Show or hide the file tree | Ctrl+\\ |
| All shortcuts | F1 |

Delete this project whenever you like. Your own projects are not affected.
`;

const WRITING = `# Writing

Headings, paragraphs and lists render the way you would expect. Use **bold** for terms, *italics* for emphasis and \`inline code\` for names.

## Lists

- Plain bullets
- With a nested level
  - like this one
- [x] Task lists work too
- [ ] Tick them in the editor

## Tables

| Scheduler | Preemptive | Typical quantum |
| --- | --- | --- |
| Round-robin | Yes | 10–100 ms |
| FIFO | No | — |
| Shortest job first | Optional | — |

## Highlights

Wrap text in two equals signs to ==mark it==. Search matches use the same colour.

## Quotes

> Make it work, make it right, make it fast.
`;

const CODE_AND_MATH = `# Code and math

## Code blocks

Fenced blocks get a language label and a copy button.

\`\`\`python
def round_robin(queue, quantum=10):
    while queue:
        task = queue.pop(0)
        task.run(quantum)
        if not task.done:
            queue.append(task)
\`\`\`

\`\`\`ts
export function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
\`\`\`

## Math

Inline math sits in a sentence: the average wait is $\\bar{w} = \\frac{1}{n}\\sum_{i=1}^{n} w_i$.

Block math gets its own line:

$$
T_{\\text{turnaround}} = T_{\\text{completion}} - T_{\\text{arrival}}
$$

## Diagrams

\`\`\`mermaid
flowchart LR
  New --> Ready
  Ready --> Running
  Running -->|quantum ends| Ready
  Running --> Waiting
  Waiting --> Ready
  Running --> Done
\`\`\`
`;

const IMAGES = `# Images

Drop or paste an image into the editor and md.IT stores it in an \`images\` folder next to the document.

Add \`{width=… align=…}\` after an image to size and place it.

![Pipeline](images/pipeline.svg){width=60% align=center}

Left, at 240 pixels:

![Pipeline](images/pipeline.svg){width=240 align=left}

Right, at 240 pixels:

![Pipeline](images/pipeline.svg){width=240 align=right}
`;

export const SAMPLE_PROJECT_NAME = 'Welcome to md.IT';

export function sampleProjectData(): ProjectImportData {
  return {
    name: SAMPLE_PROJECT_NAME,
    description: 'A short tour: writing, code, math, diagrams and images.',
    folders: [['Guides'], ['Guides', 'images']],
    documents: [
      { folder: [], title: 'Start here.md', content: START_HERE },
      { folder: ['Guides'], title: 'Writing.md', content: WRITING },
      { folder: ['Guides'], title: 'Code and math.md', content: CODE_AND_MATH },
      { folder: ['Guides'], title: 'Images.md', content: IMAGES },
    ],
    images: [
      { folder: ['Guides', 'images'], name: 'pipeline.svg', contentType: 'image/svg+xml', bytes: new TextEncoder().encode(diagramSvg).buffer as ArrayBuffer },
    ],
  };
}

/** Creates the sample project in this browser, all of it or nothing, and returns where to open it. */
export async function createSampleProject(): Promise<{ projectId: string; startDocId: string | null }> {
  const project = await importProject(sampleProjectData());
  const start = (await listDocuments(project.id)).find((d) => d.folderId === null && d.title === 'Start here.md');
  return { projectId: project.id, startDocId: start?.id ?? null };
}

/** The address that opens a newly created sample project at its first document. */
export function samplePath({ projectId, startDocId }: { projectId: string; startDocId: string | null }): string {
  return startDocId ? `/p/${projectId}/d/${startDocId}` : `/p/${projectId}`;
}

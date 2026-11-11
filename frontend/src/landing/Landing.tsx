import 'katex/dist/katex.min.css';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AccountMenu } from '../app/AccountMenu';
import { createSampleProject, samplePath } from '../app/sampleProject';
import { useResolvedTheme } from '../app/theme';
import { ThemeMenu } from '../app/ThemeMenu';
import { Preview } from '../preview';
import { render } from '../renderer';
import { SETTINGS, setSetting, useProjectSummaries, userMessage } from '../store';
import { Button, Callout, Menu, SaveStatus, VersionItem, Wordmark } from '../ui';
import { CoverArt } from './CoverArt';
import { ProductPreview } from './ProductPreview';
import { useNearViewport } from './useNearViewport';
import './landing.css';

const RENDERING_SAMPLE = `\`\`\`mermaid
flowchart LR
  Ready --> Running
  Running -->|quantum ends| Ready
  Running --> Done
\`\`\`

Turnaround time is $T = T_{\\text{done}} - T_{\\text{arrival}}$, and ==every term is searchable==.
`;

const inert = { inert: '' } as Record<string, string>;

function Feature({ id, title, children, vignette }: { id: string; title: string; children: ReactNode; vignette: ReactNode }) {
  return (
    <section className="landing-feature" aria-labelledby={id}>
      <div className="landing-feature-words">
        <h2 id={id}>{title}</h2>
        {children}
      </div>
      <div className="landing-vignette" aria-hidden="true" {...inert}>
        {vignette}
      </div>
    </section>
  );
}

/** The landing page (P-100): what md.IT is, shown to a new visitor at `/` and to anyone at `/welcome`. */
export function Landing() {
  const navigate = useNavigate();
  const projects = useProjectSummaries();
  const theme = useResolvedTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderingHtml = useMemo(() => render(RENDERING_SAMPLE), []);
  const [renderRef, renderNear] = useNearViewport<HTMLDivElement>();
  const hasProjects = (projects?.length ?? 0) > 0;

  const enter = async (path: string, state?: unknown) => {
    await setSetting(SETTINGS.welcomed, true);
    navigate(path, { state });
  };
  const startWriting = () => void enter('/projects', { create: true });
  const openWorkspace = () => void enter('/projects');
  const trySample = async () => {
    setBusy(true);
    setError(null);
    try {
      await enter(samplePath(await createSampleProject()));
    } catch (err) {
      setError(`Couldn’t create the sample project: ${userMessage(err)}`);
      setBusy(false);
    }
  };

  const actions = (
    <div className="landing-actions">
      <Button variant="primary" icon="plus" onClick={startWriting}>
        Start writing
      </Button>
      <Button disabled={busy} onClick={() => void trySample()}>
        {busy ? 'Creating the sample…' : 'Try a sample project'}
      </Button>
    </div>
  );

  return (
    <div className="landing">
      <header className="app-toolbar landing-bar">
        <Wordmark />
        <span className="app-toolbar-spacer" />
        <AccountMenu />
        <ThemeMenu />
        <Button variant="primary" size="sm" onClick={openWorkspace}>
          {hasProjects ? 'Your projects' : 'Open workspace'}
        </Button>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-words">
            <h1 id="landing-title" className="landing-name" aria-label="md.IT">
              md<span className="landing-name-dot">.</span>IT
            </h1>
            <p className="landing-tagline">A calm place to write technical documents.</p>
            <p className="landing-lede">
              Markdown on one side, a properly typeset document on the other, your files beside them. Everything stays in this
              browser and keeps working offline. No account needed to start.
            </p>
            {actions}
            {error && <Callout tone="danger">{error}</Callout>}
          </div>
          <CoverArt className="landing-art" />
        </section>

        <div className="landing-shot">
          <ProductPreview />
        </div>

        <div className="landing-features">
          <Feature
            id="feature-local"
            title="Your work stays in this browser"
            vignette={
              <div className="landing-panel landing-saves">
                <div className="landing-save-row">
                  <span className="landing-save-when">Typing</span>
                  <SaveStatus state="saving" />
                </div>
                <div className="landing-save-row">
                  <span className="landing-save-when">A moment later</span>
                  <SaveStatus state="saved" />
                </div>
                <div className="landing-save-row">
                  <span className="landing-save-when">On a train, offline</span>
                  <SaveStatus state="saved" />
                </div>
              </div>
            }
          >
            <p>
              Every change is saved where you type it, as you type it. There is nothing to upload and nothing to sign up for, and
              the whole app keeps working without a connection.
            </p>
            <p>Folders, documents and images live together in a project, the way they would on disk.</p>
          </Feature>

          <Feature
            id="feature-render"
            title="Code, math and diagrams render as you write"
            vignette={
              <div ref={renderRef} className="landing-panel landing-render">
                {/* Mermaid is a large lazy chunk: load it only when this part of the page is about to be seen. */}
                {renderNear && <Preview html={renderingHtml} theme={theme} onOpenDocument={() => {}} onNotice={() => {}} />}
              </div>
            }
          >
            <p>
              Fenced code gets syntax colours, a language label and a copy button. Formulas are typeset with KaTeX. A few lines
              of Mermaid become a diagram.
            </p>
            <p>The preview uses a reading typeface, and you can tune its font, spacing and margins.</p>
          </Feature>

          <Feature
            id="feature-versions"
            title="Save versions to the cloud when it matters"
            vignette={
              <div className="landing-panel landing-versions">
                <VersionItem number={4} message="Added the round-robin example" time="2 minutes ago" current />
                <VersionItem number={3} message="Exam questions" time="Yesterday" />
                <VersionItem number={2} time="Mon 14:20" />
                <Callout tone="warning" title="A newer version exists">
                  Load it, or save yours as a copy.
                </Callout>
              </div>
            }
          >
            <p>
              Sign in with GitHub or Google and save a numbered version of any document. Open it on another browser, look back
              through its history, and restore an earlier one.
            </p>
            <p>If two browsers change the same document, md.IT asks which one to keep. Nothing is overwritten silently.</p>
          </Feature>

          <Feature
            id="feature-export"
            title="Take it anywhere"
            vignette={
              <Menu
                className="landing-menu"
                items={[
                  { label: 'Export Markdown', icon: 'download' },
                  { label: 'Export HTML', icon: 'download' },
                  { label: 'Export PDF', icon: 'download' },
                  'separator',
                  { label: 'Export project (.zip)', icon: 'download' },
                ]}
              />
            }
          >
            <p>
              Export a document as Markdown, as one self-contained HTML file, or as a PDF. Export a whole project as a .zip, and
              import it again on any browser.
            </p>
          </Feature>
        </div>

        <section className="landing-close" aria-labelledby="landing-close-title">
          <h2 id="landing-close-title">Start with a blank page, or with the tour.</h2>
          {actions}
        </section>
      </main>

      <footer className="landing-foot">
        <div className="landing-foot-inner">
          <Wordmark />
          <span>Works offline. No account needed to start.</span>
        </div>
      </footer>
    </div>
  );
}

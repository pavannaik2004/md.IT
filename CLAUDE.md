# CLAUDE.md

## Source of truth

`context.md` is the single source of truth for md.IT progress. `decisions.md` is the record of every decision and why it was made. They are more current than this file, the README, specs or plans, and more current than anything remembered from an earlier session.

## Before doing anything

1. Read `context.md` in full: **Current state** (phase, branch, next step, deferred minors), **Phase checklist** and the **Log**.
2. Read `decisions.md`, at least the recent entries and any that touch the area you are about to change. Do not reopen a recorded decision unless the user asks to. To change one, add a new entry that supersedes it.
3. Check that the git branch and `git log` match what **Current state** says. If they don't, tell the user before starting work.

## After doing anything

Update `context.md` after every piece of work, not at the end of the session: a task finished, a commit, a review, a bug found or fixed, a user approval or choice, a push/PR/merge, a failed attempt or a blocker.

- **Log:** append one line, newest last, in the existing format:
  `- YYYY-MM-DD — what happened (files / commits / test count)`
  Use the real date. Record what happened, including failures and anything skipped, not what was planned. Reference decision IDs when the event produced decisions (e.g. `(decisions P-030…P-032)`).
- **Current state:** keep phase, branch, next step and the deferred-minors lists accurate. Fix any of them that the work made wrong.
- **Phase checklist:** update a phase's status when it changes, e.g. `Built — PR pending` or `Done — merged YYYY-MM-DD (PR #n)`.

## Logging decisions

Append every decision to the table in `decisions.md`, newest last: technical choices, library or version picks, deviations from the PRD or the design system, conventions, and choices the user makes when given options.

- Columns: `| ID | Date | Decision | Why | Alternatives considered |`
- Project decisions use the next free `P-NNN`. PRD open decisions keep their PRD IDs (`D1`–`D8`).
- A changed decision gets a new entry that names the one it supersedes. Never edit or delete old entries.

## Commits

Update `context.md` (and `decisions.md` when needed) in the same commit as the work it describes, or in a `docs:` commit right after it. Never leave the files describing a state the repo is no longer in.

## Key references

- PRD: `PRD_v3_Technical_Markdown_Workspace (1).md`
- Design system and remote: see **Key references** in `context.md`
- Frontend: `frontend/` (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`)

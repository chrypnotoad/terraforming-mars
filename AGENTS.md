# Terraforming Mars Legacy project instructions

## Shared project context

- Read `PROJECT_STATE.md` and `backlog.md` before starting work.
- Treat `PROJECT_STATE.md` as the current handoff: update it when the working
  state, blockers, running services, or next action changes.
- Update `backlog.md` when a task is completed, split into smaller work, or
  newly discovered.
- Keep both files concise and committed so they remain available to Codex
  tasks started from other devices or hosts.

## Scope and architecture

- The Legacy of Mars work is an opt-in mode layered onto ordinary Terraforming
  Mars games. Do not rewrite or change normal-game behavior without a specific
  reason and regression coverage.
- A normal `Game` remains one mission. Durable data that survives between
  missions belongs in the campaign persistence layer.
- Do not invent mission boards, briefings, cards, corporations,
  developments, milestones, awards, or rules that are not supported by
  official source material. Keep unavailable mission content explicitly
  gated or disabled.

## Verification

- For server or shared TypeScript changes, run the focused tests first, then
  `npm run build:server` and `npm run lint:server` as appropriate.
- For client or Vue changes, run the focused component tests, then
  `npm run lint:client` and the relevant build command.
- For persistence or API changes, cover isolation, save/reload, validation,
  and missing-record behavior.
- In the final handoff, record the commands that were actually run and any
  visual/browser verification that could not be performed.

## Handoff discipline

- Before ending a task, summarize completed work, tests, blockers, and the
  single best next action in `PROJECT_STATE.md`.
- Do not claim a service is live or a test passes unless it was verified in
  the current task or clearly recorded as historical information.
- Preserve unrelated user changes in the working tree. Ask before destructive
  operations or broad resets.

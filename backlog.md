# Legacy of Mars backlog

This is the shared project backlog. Keep items small enough to verify and
update the status as work moves between devices or Codex tasks.

## Now

- [x] Review the complete uncommitted diff and separate project-management
  files from the Legacy implementation changes.
- [x] Re-run focused campaign database, API, and client component tests.
- [x] Re-run the relevant server/client build and lint checks.
- [x] Commit and push the verified foundation to `origin` on
  `agent/legacy-campaign-foundation` (`7b72e4ae0`).

## Next

- [ ] Verify which official Mission 1 materials are available and record their
  source URLs/files in the assessment.
- [ ] Define the Mission 1 data manifest: board, briefing, global parameters,
  milestones, awards, corporations, developments, cards, and Innovation data.
- [ ] Implement the shared Legacy rules behind the `legacyOfMars` flag:
  workers, population, glacier melting, Innovation, title scoring, saved-card
  transfer, catch-up bonuses, and mission transitions.
- [ ] Build the Mission 1 vertical slice only from verified official data.
- [ ] Add save/reload, absent-player, rejoin, and end-of-mission campaign
  playtest coverage.

## Later

- [ ] **2027-03-01:** Recheck the Gamefound campaign and publisher updates for
  delivery timing, official rules, and usable Mission 1 material. The current
  estimated fulfillment date is May 2027 and may change.
- [ ] After fulfillment begins, inventory the official Mission 1 components
  and update `docs/legacy-of-mars-assessment.md` before resuming implementation.

- [ ] Add missions 2–4 one at a time as official data becomes available.
- [ ] Add missions 5–7 only when official material is available.
- [x] Replace the temporary Cloudflare Quick Tunnel with a named tunnel and
  stable domain (`https://mars.chrypnotoad.com`, 2026-08-09).
- [ ] Add a backup and restore procedure for the campaign SQLite database.
- [ ] Reassess whether a hosted container or Sites/D1 port is worthwhile after
  the local campaign mode is stable.

## Decisions and constraints

- Preserve ordinary Terraforming Mars behavior; Legacy is a new opt-in mode.
- Do not invent missing mission content.
- Keep campaign state durable and independent of individual game URLs.
- Treat the repository files, not a previous chat transcript or generated
  memory, as the authoritative project handoff.

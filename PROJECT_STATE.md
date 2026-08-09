# Project State

Updated: 2026-08-09

## Repository

- Working directory: `/Users/chris/Developer/mars legacy/terraforming-mars-legacy`
- Branch: `agent/legacy-campaign-foundation`
- Remotes: `origin` is `chrypnotoad/terraforming-mars`; `upstream` is the
  original `terraforming-mars/terraforming-mars` repository.
- The current Legacy foundation and project-management files are published on
  `origin/agent/legacy-campaign-foundation`. Do not discard later worktree
  changes without reviewing them first.

## Current state

The repository contains an opt-in Legacy campaign foundation layered onto the
ordinary Terraforming Mars application. It supports multiple named campaigns,
stable campaign-player identities, persistent rosters and campaign fields,
campaign history storage, campaign APIs, a campaign picker, and a seven-mission
progress dashboard at `/legacy`.

Mission launching is intentionally disabled. The official Mission 1 board,
briefing, cards, corporations, developments, milestones, awards, and complete
rules data are still required before claiming a playable, rules-accurate
mission. Gamefound currently lists estimated fulfillment as May 2027:
https://gamefound.com/en/projects/stronghold-games/terraforming-mars-the-legacy-of--mars

## Last completed work

- Added `LegacyCampaign` shared types and database support for SQLite,
  PostgreSQL, filesystem, metrics, and in-memory test adapters.
- Added campaign routes and exact application paths for create, list, and read.
- Added Legacy campaign UI and the opt-in `legacyOfMars` game option plumbing.
- Added database, route, and client component regression tests.
- Added the implementation assessment at
  `docs/legacy-of-mars-assessment.md`.
- Added the May 2027 estimated fulfillment date to the Legacy UI, linked the
  Gamefound campaign, and scheduled a March 2027 source review in `backlog.md`.
- Moved the Legacy entry under New Game so the root page retains its original
  celestial artwork sequence. The root New Game tile now says `Standard &
  Legacy`; `/new-game` presents Standard and Legacy game-type cards, with the
  latter linking to the campaign manager and showing `Coming soon ~May 2027`.
- The Legacy campaign page's back link returns to `/new-game`.
- Global LESS requires `npm run make:css` in addition to the client JavaScript
  build.

## Verification status

The following checks passed for the current changes:

- Focused database/API tests: 6 passing.
- Legacy campaign component test: 1 passing.
- Start Screen and Create Game component tests: 7 passing together.
- `npm run build:server`.
- `npm run build:client` (Webpack emitted only existing asset-size warnings).
- `npm run make:css`.
- `npm run lint:server`.
- `npm run lint:client`.
- `npm run lint:css`.

A visual browser click-through was not completed because the in-app preview
browser was unavailable. The public root returned HTTP 200, and its served
JavaScript and CSS were verified to contain the new subtitle text and layout.

## Runtime and hosting notes

- Historical local URL: `http://localhost:8080/legacy`.
- Current temporary public URL (verified 2026-08-09):
  `https://preferences-kept-integral-priced.trycloudflare.com/legacy`.
- The public URL is a Cloudflare Quick Tunnel and may no longer work or may
  change after a restart. Verify it before sharing it.
- The Mac mini is the intended always-on host. A named Cloudflare Tunnel and a
  stable domain remain a later hosting task.
- The production Node server caches compressed frontend bundles in memory.
  After rebuilding the client, restart the app LaunchAgent before public QA.
  Restarting only the app preserves the current Quick Tunnel URL.

## Current blockers

- Official Legacy mission-specific content is incomplete/unavailable in the
  repository.
- Later work should be committed and pushed so other checkouts can recover it
  from Git.

## Next recommended action

1. Recheck the Gamefound campaign and publisher updates on 2027-03-01.
2. Obtain official Mission 1 material, then implement a vertical slice behind
   the Legacy mode flag.

## Source of truth

- Prioritized work: `backlog.md`
- Durable Codex instructions: `AGENTS.md`
- Architecture and source-data assessment:
  `docs/legacy-of-mars-assessment.md`

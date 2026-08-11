# Project State

Updated: 2026-08-10

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
- Replaced the temporary Cloudflare Quick Tunnel with the remotely managed
  `terraforming-mars-legacy` tunnel at `https://mars.chrypnotoad.com`,
  without changing the application service or application code.
- Made game-retention warnings follow `MAX_GAME_DAYS`: without a positive
  value, unfinished games are retained indefinitely and no warning is shown.
  SQLite and PostgreSQL now use the same policy.
- Hardened the private-server defaults: completed games compress after 30
  days, game creation is limited to 20/hour and 50/day, and server/stat IDs are
  persisted in the owner-readable application LaunchAgent.
- Added an integrity-checked SQLite backup command, an owner LaunchAgent that
  runs daily at 03:15 local time, seven-daily/four-weekly rotation, regression
  coverage, and `docs/sqlite-backups.md` restore instructions.
- Added the first optional-profile vertical slice without gating gameplay:
  durable Discord-linked profiles, browser-resized custom avatars, player-link
  claiming, per-game nickname aliases, participant-level results, and a
  `/profile` dashboard for wins, scores, corporations, aliases, and history.
- Hardened the dormant Discord OAuth flow with an identify-only server-side
  start route, short-lived CSRF state validation, secure cookies, a 30-day
  session default, and claim continuation across login. No bot, guild scope,
  or Discord-server installation is used.
- Added a scoped backlog item for a `Post to Discord` action on the existing
  game page. The planned minimum is a guild-installed bot restricted to one
  configured channel with view/send/embed permissions; it does not change the
  current shared game URL or require invited players to sign in.
- Integrated optional profiles into ordinary game creation without assuming
  that the signed-in creator is playing. Each player-name field now offers an
  authenticated profile autocomplete with the current user first, selected
  avatars, editable game nicknames, duplicate prevention, and account-free
  manual names as the unchanged fallback.
- Added an optional preferred player color to profiles. Profile selection uses
  it when available, resolves conflicts in player order using the existing
  color sequence, and still allows a manual per-game override. Selected
  profiles are claimed for their generated participants when the game is
  created; profile IDs are not retained in local/downloaded game settings.
- Added profile/result persistence across SQLite, PostgreSQL, filesystem, and
  in-memory adapters. The SQLite migration and avatar data remain covered by
  the existing whole-database backups.
- Added safe per-game profile unlinking, head-to-head win/loss/tie aggregation,
  linked Legacy campaign history, and optional profile selection when creating
  a campaign roster. Removing a claim never deletes or changes the game.
- Implemented the minimum one-channel Discord bot flow: a signed-in profile can
  post a rich game invitation from `/game`, with a link button, same-origin
  protection, per-user rate limiting, 30-second duplicate suppression, and no
  Gateway or message-reading access. The UI remains hidden until the bot token
  and channel ID are configured.

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
- Retention/SQLite/backup tests: 25 passing.
- Purge warning component tests: 2 passing.
- Full server suite: 7,140 passing.
- Profile/database/API/OAuth focused tests: 9 passing.
- Full server suite after profiles: 7,149 passing.
- Full client suite after profiles: 442 passing.
- Profile-creation focused server tests: 18 passing.
- Profile/create-game focused client tests: 13 passing.
- Full server suite after creation integration: 7,152 passing.
- Full client suite after creation integration: 445 passing.
- Server/client lint, CSS lint, server build, production client build, and
  global CSS generation passed; Webpack emitted only its existing size warnings.
- Production client build completed with only the existing bundle-size
  warnings; server/client lint and server build passed.
- Profile/head-to-head/campaign/unclaim and Discord route tests: 15 passing.
- Profile, campaign, and game-home client tests: 4 passing.
- Full server suite after these changes: 7,160 passing.
- Full client suite after these changes: 446 passing.
- Server/client lint and production server/client builds passed after the new
  work; Webpack emitted only its existing bundle-size warnings.
- `npm run build:server` and `npm run lint:server` after the retention and
  backup changes.
- Live backup validation (2026-08-09): `PRAGMA integrity_check` returned `ok`;
  the restored test copy matched the live database's 0 games and 1 campaign.
- Named-tunnel validation (2026-08-09): Cloudflare reports the tunnel healthy;
  public DNS resolves; HTTPS `/` and `/new-game` return HTTP 200; and the
  public and local `/new-game` documents match byte-for-byte.

A visual browser click-through was not completed because the in-app preview
browser was unavailable. The public root returned HTTP 200, and its served
JavaScript and CSS were verified to contain the new subtitle text and layout.

## Runtime and hosting notes

- Historical local URL: `http://localhost:8080/legacy`.
- Stable public URL (verified 2026-08-09):
  `https://mars.chrypnotoad.com/new-game`.
- The Mac mini is the intended always-on host. The remotely managed Cloudflare
  Tunnel `terraforming-mars-legacy` routes `mars.chrypnotoad.com` to
  `http://127.0.0.1:8080` through a proxied CNAME.
- The existing
  `com.chrypnotoad.terraforming-mars-legacy-tunnel` user LaunchAgent now runs
  the named tunnel using an owner-only token and wrapper outside the repository.
  Its prior Quick Tunnel plist is preserved at
  `/Users/chris/Library/Application Support/Terraforming Mars Legacy/rollback/com.chrypnotoad.terraforming-mars-legacy-tunnel.quick-tunnel.plist`.
- The production Node server caches compressed frontend bundles in memory.
  After rebuilding the client, restart the app LaunchAgent before public QA.
  Restarting only the app preserves the stable tunnel hostname.
- Runtime `.env` intentionally omits `MAX_GAME_DAYS`, sets
  `COMPRESS_COMPLETED_GAMES_DAYS=30`, and limits game creation to 20/hour plus
  50/day. It is ignored by Git and owner-readable.
- `com.chrypnotoad.terraforming-mars-legacy-backup` runs the compiled SQLite
  backup tool at 03:15 daily and at load. Backups live outside the repository
  under `~/Library/Application Support/Terraforming Mars Legacy/backups`.
- A pre-settings application plist is preserved under the same support
  directory's `rollback` folder. The current application and backup agents are
  loaded, and local/public routes returned HTTP 200 after deployment.
- The optional-profile code is deployed. Public `/profile` returns HTTP 200,
  anonymous `/api/profile` returns 403 as intended, and the live SQLite schema
  contains `player_profile`, `player_claim`, and participant-result timestamp
  support. Discord credentials are configured privately; the live OAuth start
  route returns 302 with the correct client ID, exact HTTPS callback,
  identify-only scope, random state, and secure HTTP-only state cookie.
  A real Discord authorization completed successfully on 2026-08-09; one
  profile, custom avatar, and active session were confirmed in SQLite without
  exposing their contents.
- Profile/OAuth setup and storage details are in `docs/player-profiles.md`.
- The profile-aware New Game build was deployed on 2026-08-10. Public
  `/new-game` returns HTTP 200, anonymous `/api/profiles` returns 403 as
  intended, and the served production bundles contain the autocomplete and
  preferred-color UI. Authenticated visual interaction still needs human QA.
- Replaced the autocomplete's truncated preferred-color text with a thick
  color-coded ring around profile avatars and initials, including the selected
  player avatar. Focused client tests and client/CSS lint passed; production
  client/CSS builds were redeployed and the four affected Cloudflare cache
  entries were purged successfully.
- Live Discord posting is waiting for the bot token plus test guild/channel IDs
  to be added to the ignored `.env` and for the bot to be installed in that
  test server.

## Current blockers

- Official Legacy mission-specific content is incomplete/unavailable in the
  repository.
- Discord settings and the production client have been rebuilt. Human OAuth,
  profile editing, and custom avatar upload are verified. The post-login backup
  passed integrity validation and contains the same profile count as the live
  database. Creation-time profile claims are covered by automated tests but
  still need verification in a real game.

## Next recommended action

1. Visually verify profile autocomplete, avatars, preferred-color conflicts,
   guest names, and spectator-host creation on the deployed New Game page.
2. Create the next real game using selected profiles and confirm its completed
   results appear in My Profile.
3. Configure/install the minimal Discord bot in the test server, restart the
   app, and verify one real invitation plus duplicate/error feedback.
4. Decide how account-level Discord unlink should work before adding it:
   Discord is currently the only login/recovery method. Per-game unlinking is
   already safe and implemented.
5. Recheck the Gamefound campaign and publisher updates on 2027-03-01.

## Source of truth

- Prioritized work: `backlog.md`
- Durable Codex instructions: `AGENTS.md`
- Architecture and source-data assessment:
  `docs/legacy-of-mars-assessment.md`

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

- [ ] **Post game invitations to Discord from the game page.** Preserve the
  current flow and shared `/game?id=...` URL: after creating a game, the host
  can click `Post to Discord` instead of copying and pasting the URL manually.
  Keep `Copy game link` available for account-free play and as a fallback.
  - Use the existing Discord application as a guild-installed bot; a server
    administrator performs the one-time installation.
  - Request only `View Channel`, `Send Messages`, and `Embed Links` in one
    designated game channel. No message-reading, member-list, moderation,
    presence, or privileged gateway permissions.
  - Store the bot token as a server secret and configure one guild/channel ID
    initially; channel-selection UI and multi-server support are out of scope.
  - Add an authenticated, CSRF-protected, rate-limited server endpoint that
    validates the game exists before the bot posts. Require a linked Discord
    profile to use the button; invited players still need no account.
  - Post a minimal rich invitation containing the game summary, creator when
    available, and an `Open Game` link button pointing to the existing game URL.
    Do not add a new lobby, join token, or seat-claim flow.
  - Show clear posted/error feedback without navigating away, prevent rapid
    duplicate posts, and retain a manual retry/copy-link path.
  - Test authorization, CSRF, rate limiting, missing games, Discord API
    failures, duplicate suppression, and the unchanged copy/paste flow.
- [ ] **Optional player profiles and lifetime statistics (implementation in
  progress; Discord credentials and live OAuth QA remain).** Preserve the
  account-free flow: hosts can still enter arbitrary player names and share
  player links, and nobody must sign in to play.
  - [x] Add durable profiles with a preferred name, optional Discord identity,
    custom avatar, Discord-avatar fallback, and per-game nickname history.
  - [x] Let a signed-in player claim their seat/result from their existing player
    link; keep unclaimed participants as guests and support later alias merging.
  - [x] Integrate profiles into game creation without assuming the creator is a
    player: add an authenticated profile autocomplete to every player name,
    prioritize the current user as `You`, show selected avatars, retain editable
    per-game nicknames, and link selected profiles to the created participants.
  - [x] Add an optional preferred player color to profiles. Apply it when a
    profile is selected, let earlier players keep conflicts, and fall back to
    the existing first-available color order. Manual colors remain per-game.
  - [ ] Add a `My Profile` page with game history, campaigns, wins, win rate,
    average/high score, corporation usage/results, head-to-head records, and a
    playful nickname history.
    The profile, history, win/score, corporation, and alias views are complete;
    campaign and head-to-head views remain.
  - [x] Record participant-level completed-game results with nullable profile ID,
    exact game nickname, corporation, score, rank/tie outcome, generation, and
    relevant game options. Do not rely on the current score-only result rows.
  - [x] Process custom avatars to a small safe format/size and store them with data
    covered by the SQLite backup and restore procedure.
  - [ ] Finish and harden optional Discord OAuth using only the `identify` scope:
    exact HTTPS redirect URI, CSRF `state` validation, secure cookies, sensible
    session expiry, logout/unlink support, and no bot or Discord-server install.
    The identify-only flow, credentials, state validation, secure cookies,
    failure-path tests, and a live OAuth round trip are complete; unlink remains.
  - Link Legacy campaign participants to profiles optionally while preserving
    campaign-specific names and account-free campaigns.
  - [ ] Add migrations plus tests for profile isolation, claims, aliases, result
    capture, ties, guest play, avatar validation, OAuth failure, and save/reload.
    Core migration, persistence, claim, guest, avatar, aggregation, OAuth
    failure, profile-directory, creation-association, and preferred-color
    coverage is complete; add explicit tie and full browser-flow tests.
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
- [x] Make the purge warning reflect `MAX_GAME_DAYS`; retain games indefinitely
  and hide the warning when no positive retention period is configured.
- [x] Configure private-server quotas, completed-game compression, and
  persistent server/stat identifiers on the Mac mini.
- [x] Add daily integrity-checked SQLite backups, seven-daily/four-weekly
  rotation, a tested restore procedure, and a scheduled LaunchAgent.
- [ ] Reassess whether a hosted container or Sites/D1 port is worthwhile after
  the local campaign mode is stable.

## Decisions and constraints

- Preserve ordinary Terraforming Mars behavior; Legacy is a new opt-in mode.
- Do not invent missing mission content.
- Keep campaign state durable and independent of individual game URLs.
- Treat the repository files, not a previous chat transcript or generated
  memory, as the authoritative project handoff.

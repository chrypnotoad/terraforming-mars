# The Legacy of Mars implementation assessment

## Decision

Implement The Legacy of Mars as an opt-in campaign mode, not as a replacement
for ordinary Terraforming Mars games. A normal `Game` should remain the unit of
play for one mission; a new, durable campaign record should own the information
that survives between missions.

This keeps all existing games and expansions behaviorally unchanged. The mode
should be unavailable unless a game is created from a Legacy campaign.

## What the supplied rulebook establishes

- The campaign has seven missions, with a shorter first part containing
  missions 1-4.
- A mission is a mostly familiar Terraforming Mars game with different global
  parameter starts/goals, a mission board, mission-specific cards, milestones,
  awards, and briefing rules.
- Campaign state includes a player's chosen corporation, one permanent
  development per mission, up to two saved hand cards, mission titles, title
  points, and the prior mission result.
- Mission rankings grant Governor, Administrator, or Prefect title points and
  the next mission's catch-up M€ bonus.
- New generic systems include workers, population placed on cities or special
  tiles, glacier/ocean state and melting, an Innovation action, and a larger
  research draft from generation 7 onward.
- Players can leave and rejoin the campaign. This requires a stable campaign
  player identity that is independent of an individual game's player URL.

## What is sufficient now

We have enough information to design and build the mode's foundation without
changing normal games:

1. A `LegacyCampaign` persistence model, campaign lobby, and mission history.
2. A `legacyOfMars` option that gates all Legacy-only rules and UI.
3. Generic worker production, population placement, Innovation state, title
   scoring, saved-card transfer, and catch-up bonus infrastructure.
4. Mission data types for board spaces, global parameters, milestones, awards,
   project-card eligibility, corporations, developments, and briefing rules.
5. An end-of-mission flow that saves campaign state and creates the next mission
   only when the group is ready.

## Information still required for a faithful playable campaign

The general rulebook is intentionally not a complete data source. Before
implementing a real mission, obtain the official material for that mission:

- Each mission board's complete hex layout, reserved spaces, bonuses, global
  tracks, starting values, and mission-specific standard projects.
- Each mission briefing, including setup changes, special rules, and solo rules.
- The complete text, costs, tags, requirements, effects, mission index, and
  visual assets for every project, corporation side, development, and Innovation
  card included in the mode.
- Exact milestone and award definitions for every mission.
- The campaign sheet's final-score rule and any mission unlock or reset rules.
- Missions 5-7 material when it is officially available. The current public
  campaign scope is missions 1-4, so the first implementation should target
  Mission 1 and treat later missions as separately supplied content.

Without this material, we could build a campaign shell but not honestly claim a
complete or rules-accurate Legacy mode. Placeholder cards or inferred mission
data should not ship.

## Fit with the existing codebase

The repository already supports optional modules, which is the right seam for
this work:

| Existing seam | Legacy use |
| --- | --- |
| `src/server/game/GameOptions.ts` and `src/common/game/NewGameConfig.ts` | Add a mode flag and a campaign/mission reference. |
| `src/server/GameCards.ts` | Register a Legacy card manifest and filter cards by mission. |
| `src/server/boards/*` and `GameSetup` | Add one data-backed board per mission. |
| `src/server/Player.ts`, `Stock`, and `Production` | Add workers and their production, then expose them in serialization and the player UI. |
| `src/common/TileType.ts`, board spaces, and tile UI | Model population capacity/markers and glacier versus water oceans. |
| `Game` end-game flow and database layer | Commit mission results to `LegacyCampaign` and prepare the next mission. |
| Create-game and game-end Vue components | Add campaign setup, mission briefing, progress, and campaign-score views. |

There is no existing Legacy implementation in the upstream repository. The
existing `Vastitas Borealis` board is a useful example of a custom board, but it
is not sufficient evidence that it is the Legacy Mission 1 board.

## Recommended delivery order

1. **Campaign foundation** - schema, APIs, stable campaign player identities,
   campaign lobby, and a non-playable Mission 1 feature flag.
2. **Shared Legacy rules** - workers, population, glacier melting, Innovation,
   global-parameter configuration, and end-of-mission transition.
3. **Mission 1 vertical slice** - official board, briefing, cards, corporations,
   developments, milestones, awards, UI, and automated rules tests.
4. **Campaign playtest** - complete Mission 1, save/reload, absent/rejoining
   player, and campaign-history scenarios.
5. **Missions 2-4** - add data and rules one mission at a time.
6. **Missions 5-7** - add only after official material is available.

## Current implementation

The campaign-foundation slice now includes:

- Multiple named campaigns stored independently in every supported database.
- Stable campaign-player IDs and persistent roster, title-point, saved-card,
  development, linked-game, and mission-history fields.
- A campaign picker and creation screen at `/legacy`.
- A campaign dashboard with seven-mission progress and a deliberately disabled
  Mission 1 launch control until official mission material is available.

The campaign APIs currently support create, list, and read. Mutation of campaign
results remains a server-side persistence capability until a real mission can
produce validated results.

## Deferred hosting task

The Mac is currently exposed through a temporary Cloudflare Quick Tunnel. Before
sharing it as the long-term campaign address, create a named Cloudflare Tunnel:

- Sign in to a Cloudflare account.
- Add a domain to Cloudflare DNS.
- Create a named tunnel for this Mac and route a stable hostname to the local
  game server.
- Replace the Quick Tunnel launch agent with the named-tunnel token and verify
  that the public URL survives a Mac restart.

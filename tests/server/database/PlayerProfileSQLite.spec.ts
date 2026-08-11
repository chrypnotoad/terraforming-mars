import {expect} from 'chai';
import {GameOptions} from '../../../src/server/game/GameOptions';
import {IN_MEMORY_SQLITE_PATH, SQLite} from '../../../src/server/database/SQLite';
import {PLAYER_PROFILE_SCHEMA_VERSION, PlayerProfile} from '../../../src/common/profile/PlayerProfile';

describe('SQLite player profiles', () => {
  it('persists profiles, claims, avatars, and participant results', async () => {
    const database = new SQLite(IN_MEMORY_SQLITE_PATH, true);
    await database.initialize();
    const profile: PlayerProfile = {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      id: 'u123',
      discordId: 'discord-123',
      displayName: 'Rick',
      discordUsername: 'rick',
      customAvatarDataUrl: 'data:image/png;base64,avatar',
      aliases: ['Rock'],
      createdAt: '2026-08-09T12:00:00Z',
      updatedAt: '2026-08-09T12:00:00Z',
    };
    await database.createPlayerProfile(profile);
    await database.claimPlayer({participantId: 'p-rick', gameId: 'g-one', profileId: profile.id, claimedAt: '2026-08-09T12:00:00Z'});
    database.saveGameResults('g-one', 1, 9, {} as GameOptions, [
      {participantId: 'p-rick', playerName: 'Rock', corporation: 'Credicor', playerScore: 99, rank: 1},
    ]);

    expect(await database.getPlayerProfileByDiscordId('discord-123')).deep.eq(profile);
    expect(await database.getPlayerClaim('p-rick')).deep.include({profileId: profile.id, gameId: 'g-one'});
    expect(await database.listPlayerClaims(profile.id)).length(1);
    const results = await database.listCompletedGameResults();
    expect(results).length(1);
    expect(results[0].scores[0]).deep.include({participantId: 'p-rick', playerName: 'Rock', rank: 1});
  });
});

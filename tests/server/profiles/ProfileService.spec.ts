import {expect} from 'chai';
import {GameOptions} from '../../../src/server/game/GameOptions';
import {ProfileService} from '../../../src/server/profiles/ProfileService';
import {DiscordUser} from '../../../src/server/server/auth/discord';
import {InMemoryDatabase} from '../../testing/InMemoryDatabase';
import {LEGACY_CAMPAIGN_SCHEMA_VERSION, LegacyCampaign} from '../../../src/common/legacy/LegacyCampaign';

describe('ProfileService', () => {
  const user: DiscordUser = {
    id: 'discord-123',
    username: 'rick-account',
    global_name: 'Rick',
    discriminator: '0',
    avatar: 'avatar-hash',
  };

  it('creates one durable profile per Discord identity without overwriting its preferred name', async () => {
    const database = new InMemoryDatabase();
    const service = new ProfileService(database);
    const profile = await service.getOrCreate(user, new Date('2026-08-09T12:00:00Z'));
    profile.displayName = 'Richard';
    await database.savePlayerProfile(profile);

    const reloaded = await service.getOrCreate({...user, username: 'new-discord-name'}, new Date('2026-08-10T12:00:00Z'));
    expect(reloaded.id).eq(profile.id);
    expect(reloaded.displayName).eq('Richard');
    expect(reloaded.discordUsername).eq('new-discord-name');
    expect(reloaded.discordAvatarUrl).contains('/discord-123/avatar-hash.png');
  });

  it('rolls claimed nicknames, corporations, wins, and scores into profile statistics', async () => {
    const database = new InMemoryDatabase();
    const service = new ProfileService(database);
    const profile = await service.getOrCreate(user);
    await database.claimPlayer({participantId: 'p-rick', gameId: 'g-one', profileId: profile.id, claimedAt: '2026-08-09T12:00:00Z'});
    database.saveGameResults('g-one', 2, 10, {} as GameOptions, [
      {participantId: 'p-rick', playerName: 'Rock', corporation: 'Credicor', playerScore: 101, rank: 1},
      {participantId: 'p-other', playerName: 'Morty', corporation: 'Helion', playerScore: 90, rank: 2},
    ]);

    const response = await service.getResponse(profile);
    expect(response.stats.gamesPlayed).eq(1);
    expect(response.stats.wins).eq(1);
    expect(response.stats.averageScore).eq(101);
    expect(response.stats.favoriteCorporation).eq('Credicor');
    expect(response.stats.aliases).deep.eq(['Rock']);
  });

  it('tracks ties head to head and linked campaign history', async () => {
    const database = new InMemoryDatabase();
    const service = new ProfileService(database);
    const profile = await service.getOrCreate(user);
    const opponent = await service.getOrCreate({...user, id: 'discord-456', username: 'morty-account', global_name: 'Morty'});
    await database.claimPlayer({participantId: 'p-rick', gameId: 'g-tie', profileId: profile.id, claimedAt: '2026-08-09T12:00:00Z'});
    await database.claimPlayer({participantId: 'p-morty', gameId: 'g-tie', profileId: opponent.id, claimedAt: '2026-08-09T12:00:00Z'});
    database.saveGameResults('g-tie', 2, 9, {} as GameOptions, [
      {participantId: 'p-rick', playerName: 'Rick', corporation: 'Credicor', playerScore: 100, rank: 1},
      {participantId: 'p-morty', playerName: 'Morty', corporation: 'Helion', playerScore: 100, rank: 1},
    ]);
    await database.createLegacyCampaign({
      schemaVersion: LEGACY_CAMPAIGN_SCHEMA_VERSION,
      id: 'c1',
      name: 'Friday Crew',
      status: 'planning',
      currentMission: 1,
      players: [{id: 'lp1', name: 'Rock', profileId: profile.id, titlePoints: 0, nextMissionBonusMegacredits: 0, savedCards: [], developments: []}],
      linkedGameIds: [],
      missionHistory: [],
      createdAt: '2026-08-09T12:00:00Z',
      updatedAt: '2026-08-09T12:00:00Z',
    } as LegacyCampaign);

    const stats = await service.getStats(profile);
    expect(stats.headToHead).deep.include({
      profileId: opponent.id,
      displayName: 'Morty',
      avatarUrl: opponent.discordAvatarUrl,
      games: 1,
      wins: 0,
      losses: 0,
      ties: 1,
    });
    expect(stats.campaigns).deep.include({
      id: 'c1', name: 'Friday Crew', status: 'planning', currentMission: 1, completedMissions: 0, playerName: 'Rock',
    });
  });
});

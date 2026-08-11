import {expect} from 'chai';
import {PLAYER_PROFILE_SCHEMA_VERSION, PlayerProfile} from '../../../src/common/profile/PlayerProfile';
import {DiscordGameCardSnapshot, IDiscordGameCardRenderer} from '../../../src/server/discord/DiscordGameCard';
import {DiscordGamePostService} from '../../../src/server/discord/DiscordGamePostService';
import {DiscordInviteResult, IDiscordInviteClient} from '../../../src/server/discord/DiscordInviteClient';
import {testGame} from '../../TestGame';
import {InMemoryDatabase} from '../../testing/InMemoryDatabase';

class FakeClient implements IDiscordInviteClient {
  posts = 0;
  updates = 0;
  failUpdates = false;

  async postGame(): Promise<DiscordInviteResult> {
    this.posts++;
    return {messageId: 'message-1'};
  }

  async updateGame(): Promise<void> {
    this.updates++;
    if (this.failUpdates) {
      throw new Error('temporary Discord outage');
    }
  }
}

class FakeRenderer implements IDiscordGameCardRenderer {
  async render(_snapshot: DiscordGameCardSnapshot): Promise<Buffer> {
    return Buffer.from('png');
  }
}

const profile: PlayerProfile = {
  schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
  id: 'u1',
  discordId: 'discord-1',
  discordUsername: 'chris',
  displayName: 'Chris',
  aliases: [],
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

describe('DiscordGamePostService', () => {
  it('persists one message and automatically updates it when visible game state changes', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeClient();
    let now = Date.parse('2026-08-10T00:00:00.000Z');
    const service = new DiscordGamePostService(database, client, new FakeRenderer(), 'channel-1', 'guild-1', 'https://mars.example', () => now, true);
    const [game] = testGame(2);
    await database.createPlayerProfile(profile);

    const created = await service.postOrRefresh(game, profile);
    expect(created.created).eq(true);
    expect(client.posts).eq(1);

    now += 20_000;
    game.generation++;
    await service.sync(game);

    expect(client.updates).eq(1);
    const persisted = await database.getDiscordGamePost(game.id);
    expect(persisted?.messageId).eq('message-1');
    expect(persisted?.retryCount).eq(0);
  });

  it('records a retry without allowing a Discord outage to escape the background sync', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeClient();
    let now = Date.parse('2026-08-10T00:00:00.000Z');
    const service = new DiscordGamePostService(database, client, new FakeRenderer(), 'channel-1', 'guild-1', 'https://mars.example', () => now, true);
    const [game] = testGame(2);
    await database.createPlayerProfile(profile);
    await service.postOrRefresh(game, profile);

    now += 20_000;
    game.generation++;
    client.failUpdates = true;
    await service.sync(game);

    const persisted = await database.getDiscordGamePost(game.id);
    expect(persisted?.retryCount).eq(1);
    expect(persisted?.lastError).eq('temporary Discord outage');
    expect(persisted?.nextRetryAt).eq('2026-08-10T00:00:25.000Z');
  });
});

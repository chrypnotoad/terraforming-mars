import {expect} from 'chai';
import {DiscordGameCardSnapshot, IDiscordGameCardRenderer} from '../../src/server/discord/DiscordGameCard';
import {DiscordGamePostService} from '../../src/server/discord/DiscordGamePostService';
import {DiscordInviteResult, IDiscordInviteClient} from '../../src/server/discord/DiscordInviteClient';
import {ApiDiscordInvite} from '../../src/server/routes/ApiDiscordInvite';
import {testGame} from '../TestGame';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {FakeGameLoader} from './FakeGameLoader';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

class FakeDiscordInviteClient implements IDiscordInviteClient {
  public posts: Array<{channelId: string; snapshot: DiscordGameCardSnapshot; gameUrl: string}> = [];
  public updates: Array<{channelId: string; messageId: string; snapshot: DiscordGameCardSnapshot; gameUrl: string}> = [];
  public error?: Error;

  async postGame(channelId: string, snapshot: DiscordGameCardSnapshot, gameUrl: string): Promise<DiscordInviteResult> {
    if (this.error !== undefined) {
      throw this.error;
    }
    this.posts.push({channelId, snapshot, gameUrl});
    return {messageId: 'message-1'};
  }

  async updateGame(channelId: string, messageId: string, snapshot: DiscordGameCardSnapshot, gameUrl: string): Promise<void> {
    if (this.error !== undefined) {
      throw this.error;
    }
    this.updates.push({channelId, messageId, snapshot, gameUrl});
  }
}

class FakeDiscordGameCardRenderer implements IDiscordGameCardRenderer {
  public async render(): Promise<Buffer> {
    return Buffer.from('png');
  }
}

function newHandler(database: InMemoryDatabase, client: FakeDiscordInviteClient): ApiDiscordInvite {
  const service = new DiscordGamePostService(
    database,
    client,
    new FakeDiscordGameCardRenderer(),
    'channel-1',
    'guild-1',
    'https://mars.example',
    Date.now,
    true,
  );
  return new ApiDiscordInvite(database, service);
}

async function post(handler: ApiDiscordInvite, scaffolding: RouteTestScaffolding, gameId: string): Promise<MockResponse> {
  const request = new MockRequest();
  request.method = 'POST';
  request.headers.origin = scaffolding.ctx.url.origin;
  const response = new MockResponse();
  const promise = handler.post(request, response, scaffolding.ctx);
  request.emitter.emit('data', JSON.stringify({gameId}));
  request.emitter.emit('end');
  await promise;
  return response;
}

describe('ApiDiscordInvite', () => {
  it('posts an authenticated game to the configured channel', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    const handler = newHandler(database, client);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;
    scaffolding.ctx.url = new URL('https://mars.example/api/discord/invite');

    const response = await post(handler, scaffolding, game.id);

    expect(response.statusCode).eq(200);
    expect(client.posts).length(1);
    expect(client.posts[0]).include({channelId: 'channel-1'});
    expect(client.posts[0]?.snapshot.postedBy).eq('Rick');
    expect(client.posts[0]?.gameUrl).eq(`https://mars.example/game?id=${game.id}`);
    expect(JSON.parse(response.content)).deep.include({created: true, messageUrl: 'https://discord.com/channels/guild-1/channel-1/message-1'});
  });

  it('requires a signed-in profile', async () => {
    const database = new InMemoryDatabase();
    const handler = newHandler(database, new FakeDiscordInviteClient());
    const scaffolding = new RouteTestScaffolding();
    const request = new MockRequest();
    request.method = 'POST';
    const response = new MockResponse();

    await handler.post(request, response, scaffolding.ctx);

    expect(response.statusCode).eq(403);
  });

  it('rejects cross-origin posts', async () => {
    const database = new InMemoryDatabase();
    const handler = newHandler(database, new FakeDiscordInviteClient());
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const request = new MockRequest();
    request.method = 'POST';
    request.headers.origin = 'https://evil.example';
    const response = new MockResponse();

    await handler.post(request, response, scaffolding.ctx);

    expect(response.statusCode).eq(403);
  });

  it('refreshes one existing Discord message instead of posting duplicates', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    const handler = newHandler(database, client);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;

    expect((await post(handler, scaffolding, game.id)).statusCode).eq(200);
    const response = await post(handler, scaffolding, game.id);

    expect(response.statusCode).eq(200);
    expect(JSON.parse(response.content).created).eq(false);
    expect(client.posts).length(1);
    expect(client.updates).length(1);
    expect(client.updates[0]).include({channelId: 'channel-1', messageId: 'message-1'});
  });

  it('limits excessive manual refreshes without blocking quick corrections', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    const handler = newHandler(database, client);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;

    for (let index = 0; index < 5; index++) {
      expect((await post(handler, scaffolding, game.id)).statusCode).eq(200);
    }
    expect((await post(handler, scaffolding, game.id)).statusCode).eq(429);
  });

  it('rejects a missing game before contacting Discord', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    const handler = newHandler(database, client);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};

    const response = await post(handler, scaffolding, 'g123');

    expect(response.statusCode).eq(404);
    expect(client.posts).length(0);
  });

  it('does not persist a failed Discord API call', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    client.error = new Error('Discord unavailable');
    const handler = newHandler(database, client);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;

    const response = await post(handler, scaffolding, game.id);

    expect(response.statusCode).eq(500);
    expect(await database.getDiscordGamePost(game.id)).eq(undefined);
  });
});

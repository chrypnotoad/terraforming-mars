import {expect} from 'chai';
import {SimpleGameModel} from '../../src/common/models/SimpleGameModel';
import {ApiDiscordInvite} from '../../src/server/routes/ApiDiscordInvite';
import {DiscordInviteResult, IDiscordInviteClient} from '../../src/server/discord/DiscordInviteClient';
import {testGame} from '../TestGame';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {FakeGameLoader} from './FakeGameLoader';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

class FakeDiscordInviteClient implements IDiscordInviteClient {
  public calls: Array<{channelId: string; game: SimpleGameModel; gameUrl: string; postedBy: string}> = [];
  public error?: Error;

  async postGame(channelId: string, game: SimpleGameModel, gameUrl: string, postedBy: string): Promise<DiscordInviteResult> {
    if (this.error !== undefined) {
      throw this.error;
    }
    this.calls.push({channelId, game, gameUrl, postedBy});
    return {messageId: 'message-1'};
  }
}

describe('ApiDiscordInvite', () => {
  it('posts an authenticated game to the one configured channel', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    const handler = new ApiDiscordInvite(database, client, 'channel-1', 'guild-1', true);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;
    scaffolding.ctx.url = new URL(`https://mars.example/api/discord/invite`);
    const request = new MockRequest();
    request.method = 'POST';
    request.headers.origin = 'https://mars.example';
    const response = new MockResponse();

    const promise = handler.post(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({gameId: game.id}));
    request.emitter.emit('end');
    await promise;

    expect(response.statusCode).eq(200);
    expect(client.calls).length(1);
    expect(client.calls[0]).include({channelId: 'channel-1', postedBy: 'Rick'});
    expect(client.calls[0]!.gameUrl).eq(`https://mars.example/game?id=${game.id}`);
    expect(JSON.parse(response.content).messageUrl).eq('https://discord.com/channels/guild-1/channel-1/message-1');
  });

  it('requires a signed-in profile', async () => {
    const handler = new ApiDiscordInvite(new InMemoryDatabase(), new FakeDiscordInviteClient(), 'channel-1', '', true);
    const scaffolding = new RouteTestScaffolding();
    const request = new MockRequest();
    request.method = 'POST';
    const response = new MockResponse();

    await handler.post(request, response, scaffolding.ctx);

    expect(response.statusCode).eq(403);
  });

  it('rejects cross-origin posts', async () => {
    const handler = new ApiDiscordInvite(new InMemoryDatabase(), new FakeDiscordInviteClient(), 'channel-1', '', true);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const request = new MockRequest();
    request.method = 'POST';
    request.headers.origin = 'https://evil.example';
    const response = new MockResponse();

    await handler.post(request, response, scaffolding.ctx);

    expect(response.statusCode).eq(403);
  });

  it('suppresses rapid duplicate game posts', async () => {
    const database = new InMemoryDatabase();
    const client = new FakeDiscordInviteClient();
    const handler = new ApiDiscordInvite(database, client, 'channel-1', '', true);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;
    const post = async () => {
      const request = new MockRequest();
      request.method = 'POST';
      request.headers.origin = scaffolding.ctx.url.origin;
      const response = new MockResponse();
      const promise = handler.post(request, response, scaffolding.ctx);
      request.emitter.emit('data', JSON.stringify({gameId: game.id}));
      request.emitter.emit('end');
      await promise;
      return response;
    };

    expect((await post()).statusCode).eq(200);
    expect((await post()).statusCode).eq(429);
    expect(client.calls).length(1);
  });

  it('rejects a missing game before contacting Discord', async () => {
    const client = new FakeDiscordInviteClient();
    const handler = new ApiDiscordInvite(new InMemoryDatabase(), client, 'channel-1', '', true);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const request = new MockRequest();
    request.method = 'POST';
    request.headers.origin = scaffolding.ctx.url.origin;
    const response = new MockResponse();
    const promise = handler.post(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({gameId: 'g123'}));
    request.emitter.emit('end');
    await promise;

    expect(response.statusCode).eq(404);
    expect(client.calls).length(0);
  });

  it('does not record a failed Discord API call as posted', async () => {
    const client = new FakeDiscordInviteClient();
    client.error = new Error('Discord unavailable');
    const handler = new ApiDiscordInvite(new InMemoryDatabase(), client, 'channel-1', '', true);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game] = testGame(2);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;
    const request = new MockRequest();
    request.method = 'POST';
    request.headers.origin = scaffolding.ctx.url.origin;
    const response = new MockResponse();
    const promise = handler.post(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({gameId: game.id}));
    request.emitter.emit('end');
    await promise;

    expect(response.statusCode).eq(500);
  });
});

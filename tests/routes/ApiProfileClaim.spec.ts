import {expect} from 'chai';
import {ApiProfileClaim} from '../../src/server/routes/ApiProfileClaim';
import {testGame} from '../TestGame';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {FakeGameLoader} from './FakeGameLoader';
import {ProfileService} from '../../src/server/profiles/ProfileService';

describe('ApiProfileClaim', () => {
  it('claims the bearer player link without changing anonymous game access', async () => {
    const database = new InMemoryDatabase();
    const handler = new ApiProfileClaim(database);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game, player] = testGame(1);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;

    const request = new MockRequest();
    request.method = 'POST';
    const response = new MockResponse();
    const promise = handler.post(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({participantId: player.id}));
    request.emitter.emit('end');
    await promise;

    const profile = await database.getPlayerProfileByDiscordId('discord-1');
    expect(profile).not.eq(undefined);
    expect(await database.getPlayerClaim(player.id)).deep.include({profileId: profile!.id, gameId: game.id});
    expect(player.user).eq(undefined);
  });

  it('lets the owning profile remove a claim without deleting the game', async () => {
    const database = new InMemoryDatabase();
    const handler = new ApiProfileClaim(database);
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const [game, player] = testGame(1);
    const gameLoader = new FakeGameLoader();
    await gameLoader.add(game);
    scaffolding.ctx.gameLoader = gameLoader;
    const profile = await new ProfileService(database).getOrCreate(scaffolding.ctx.user);
    await database.claimPlayer({participantId: player.id, gameId: game.id, profileId: profile.id, claimedAt: '2026-08-09T12:00:00Z'});

    const request = new MockRequest();
    request.method = 'POST';
    const response = new MockResponse();
    const promise = handler.post(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({participantId: player.id, action: 'unclaim'}));
    request.emitter.emit('end');
    await promise;

    expect(response.statusCode).eq(200);
    expect(await database.getPlayerClaim(player.id)).eq(undefined);
    expect(await gameLoader.getGame(game.id)).eq(game);
  });
});

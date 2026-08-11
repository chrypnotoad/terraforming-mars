import {expect} from 'chai';
import {statusCode} from '../../src/common/http/statusCode';
import {PLAYER_PROFILE_SCHEMA_VERSION, PlayerProfile} from '../../src/common/profile/PlayerProfile';
import {ApiProfiles} from '../../src/server/routes/ApiProfiles';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiProfiles', () => {
  it('requires a signed-in user', async () => {
    const response = new MockResponse();
    const scaffolding = new RouteTestScaffolding();
    await new ApiProfiles(new InMemoryDatabase()).get(scaffolding.req, response, scaffolding.ctx);
    expect(response.statusCode).eq(statusCode.forbidden);
  });

  it('returns sanitized profiles with the current user first', async () => {
    const database = new InMemoryDatabase();
    const now = '2026-08-10T12:00:00.000Z';
    const profiles: Array<PlayerProfile> = [
      {schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION, id: 'u2', discordId: 'discord-2', displayName: 'Beth', discordUsername: 'beth', aliases: [], createdAt: now, updatedAt: now},
      {schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION, id: 'u1', discordId: 'discord-1', displayName: 'Rick', discordUsername: 'rick', customAvatarDataUrl: 'data:image/png;base64,avatar', preferredColor: 'blue', aliases: [], createdAt: now, updatedAt: now},
    ];
    await Promise.all(profiles.map((profile) => database.createPlayerProfile(profile)));
    const response = new MockResponse();
    const scaffolding = new RouteTestScaffolding();
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', discriminator: '0'};

    await new ApiProfiles(database).get(scaffolding.req, response, scaffolding.ctx);

    const body = JSON.parse(response.content);
    expect(body[0]).deep.include({id: 'u1', displayName: 'Rick', preferredColor: 'blue', isCurrentUser: true});
    expect(body[0]).not.have.property('discordId');
    expect(body[1].isCurrentUser).eq(false);
  });
});

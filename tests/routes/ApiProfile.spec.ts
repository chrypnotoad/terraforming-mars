import {expect} from 'chai';
import {statusCode} from '../../src/common/http/statusCode';
import {ApiProfile} from '../../src/server/routes/ApiProfile';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiProfile', () => {
  let database: InMemoryDatabase;
  let handler: ApiProfile;
  let scaffolding: RouteTestScaffolding;

  beforeEach(() => {
    database = new InMemoryDatabase();
    handler = new ApiProfile(database);
    scaffolding = new RouteTestScaffolding();
  });

  it('keeps profiles optional', async () => {
    const response = new MockResponse();
    await handler.get(scaffolding.req, response, scaffolding.ctx);
    expect(response.statusCode).eq(statusCode.forbidden);
  });

  it('creates and updates the signed-in profile', async () => {
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', global_name: 'Rick', discriminator: '0'};
    const getResponse = new MockResponse();
    await handler.get(scaffolding.req, getResponse, scaffolding.ctx);
    expect(JSON.parse(getResponse.content).profile.displayName).eq('Rick');

    const request = new MockRequest();
    request.method = 'PUT';
    const response = new MockResponse();
    const promise = handler.put(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({displayName: 'Rock', preferredColor: 'blue'}));
    request.emitter.emit('end');
    await promise;
    expect(JSON.parse(response.content).profile.displayName).eq('Rock');
    expect(JSON.parse(response.content).profile.preferredColor).eq('blue');
  });

  it('rejects an avatar whose contents do not match its type', async () => {
    scaffolding.ctx.user = {id: 'discord-1', username: 'rick', discriminator: '0'};
    const request = new MockRequest();
    request.method = 'PUT';
    const response = new MockResponse();
    const promise = handler.put(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify({customAvatarDataUrl: 'data:image/png;base64,dG9hc3Q='}));
    request.emitter.emit('end');
    await promise;
    expect(response.statusCode).eq(statusCode.badRequest);
    expect(response.content).contains('contents do not match');
  });
});

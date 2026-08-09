import {expect} from 'chai';
import {LegacyCampaign} from '../../src/common/legacy/LegacyCampaign';
import {statusCode} from '../../src/common/http/statusCode';
import {ApiLegacyCampaigns} from '../../src/server/routes/ApiLegacyCampaigns';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiLegacyCampaigns', () => {
  let database: InMemoryDatabase;
  let handler: ApiLegacyCampaigns;
  let scaffolding: RouteTestScaffolding;

  beforeEach(() => {
    database = new InMemoryDatabase();
    handler = new ApiLegacyCampaigns(database);
    scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/api/legacy-campaigns';
  });

  async function post(body: unknown): Promise<MockResponse> {
    const request = new MockRequest();
    request.method = 'POST';
    const response = new MockResponse();
    const promise = handler.post(request, response, scaffolding.ctx);
    request.emitter.emit('data', JSON.stringify(body));
    request.emitter.emit('end');
    await promise;
    return response;
  }

  it('returns an empty campaign picker', async () => {
    const response = new MockResponse();
    await handler.get(scaffolding.req, response, scaffolding.ctx);
    expect(JSON.parse(response.content)).deep.eq({campaigns: []});
  });

  it('creates and retrieves an independent campaign', async () => {
    const response = await post({
      name: 'Friday Night Mars',
      players: [{name: ' Chris '}, {name: 'Taylor'}],
    });

    expect(response.statusCode).eq(201);
    const campaign = JSON.parse(response.content) as LegacyCampaign;
    expect(campaign.name).eq('Friday Night Mars');
    expect(campaign.players.map((player) => player.name)).deep.eq(['Chris', 'Taylor']);
    expect(campaign.currentMission).eq(1);
    expect(campaign.missionHistory).deep.eq([]);

    scaffolding.url = `/api/legacy-campaigns?id=${campaign.id}`;
    const getResponse = new MockResponse();
    await handler.get(scaffolding.req, getResponse, scaffolding.ctx);
    expect(JSON.parse(getResponse.content)).deep.eq(campaign);
  });

  it('rejects duplicate player names', async () => {
    const response = await post({
      name: 'Friday Night Mars',
      players: [{name: 'Chris'}, {name: 'chris'}],
    });
    expect(response.statusCode).eq(statusCode.badRequest);
    expect(response.content).contains('Player names must be unique');
  });

  it('returns not found for a missing campaign', async () => {
    scaffolding.url = '/api/legacy-campaigns?id=c123';
    const response = new MockResponse();
    await handler.get(scaffolding.req, response, scaffolding.ctx);
    expect(response.statusCode).eq(statusCode.notFound);
  });
});

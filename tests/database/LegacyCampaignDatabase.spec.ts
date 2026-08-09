import {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {use} from 'chai';
import {LEGACY_CAMPAIGN_SCHEMA_VERSION, LegacyCampaign, LegacyCampaignId, LegacyCampaignPlayerId} from '../../src/common/legacy/LegacyCampaign';
import {IN_MEMORY_SQLITE_PATH, SQLite} from '../../src/server/database/SQLite';

use(chaiAsPromised);

function newCampaign(id: LegacyCampaignId, name: string, updatedAt: string): LegacyCampaign {
  return {
    schemaVersion: LEGACY_CAMPAIGN_SCHEMA_VERSION,
    id,
    name,
    status: 'planning',
    currentMission: 1,
    players: [{
      id: 'lp1' as LegacyCampaignPlayerId,
      name: 'Chris',
      titlePoints: 0,
      nextMissionBonusMegacredits: 0,
      savedCards: [],
      developments: [],
    }],
    linkedGameIds: [],
    missionHistory: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('LegacyCampaign database', () => {
  let database: SQLite;

  beforeEach(async () => {
    database = new SQLite(IN_MEMORY_SQLITE_PATH, true);
    await database.initialize();
  });

  it('creates, retrieves, lists, and updates campaigns', async () => {
    const first = newCampaign('c1', 'Friday crew', '2026-01-01T00:00:00.000Z');
    const second = newCampaign('c2', 'Sunday crew', '2026-02-01T00:00:00.000Z');
    await database.createLegacyCampaign(first);
    await database.createLegacyCampaign(second);

    expect(await database.getLegacyCampaign(first.id)).deep.eq(first);
    expect((await database.listLegacyCampaigns()).map((campaign) => campaign.id)).deep.eq([second.id, first.id]);

    first.players[0].titlePoints = 3;
    first.updatedAt = '2026-03-01T00:00:00.000Z';
    await database.saveLegacyCampaign(first);
    expect((await database.getLegacyCampaign(first.id))?.players[0].titlePoints).eq(3);
  });

  it('does not silently create a campaign while saving', async () => {
    const missing = newCampaign('c3', 'Missing crew', '2026-01-01T00:00:00.000Z');
    await expect(database.saveLegacyCampaign(missing)).to.be.rejectedWith('not found');
  });
});

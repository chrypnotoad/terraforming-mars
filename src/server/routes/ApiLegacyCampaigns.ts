import {CreateLegacyCampaignRequest, isLegacyCampaignId, isLegacyCampaignPlayerId, LEGACY_CAMPAIGN_SCHEMA_VERSION, LegacyCampaign, LegacyCampaignPlayer, legacyCampaignToSummary} from '../../common/legacy/LegacyCampaign';
import {safeCast} from '../../common/Types';
import {isPlayerProfileId} from '../../common/profile/PlayerProfile';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {Request} from '../Request';
import {Response} from '../Response';
import * as responses from '../server/responses';
import {generateRandomId} from '../utils/server-ids';
import {Handler} from './Handler';
import {Context} from './IHandler';

const MAX_BODY_LENGTH = 16_384;
const MAX_CAMPAIGN_NAME_LENGTH = 80;
const MAX_PLAYER_NAME_LENGTH = 40;
const MAX_PLAYERS = 5;

class InvalidCampaignRequestError extends Error {}

function parseCreateRequest(value: unknown): CreateLegacyCampaignRequest {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidCampaignRequestError('Campaign details are required');
  }
  const request = value as Partial<CreateLegacyCampaignRequest>;
  if (typeof request.name !== 'string') {
    throw new InvalidCampaignRequestError('Campaign name is required');
  }
  const name = request.name.trim();
  if (name.length === 0 || name.length > MAX_CAMPAIGN_NAME_LENGTH) {
    throw new InvalidCampaignRequestError(`Campaign name must be between 1 and ${MAX_CAMPAIGN_NAME_LENGTH} characters`);
  }
  if (!Array.isArray(request.players) || request.players.length === 0 || request.players.length > MAX_PLAYERS) {
    throw new InvalidCampaignRequestError(`Campaigns must have between 1 and ${MAX_PLAYERS} players`);
  }

  const players = request.players.map((player) => {
    if (typeof player !== 'object' || player === null || typeof player.name !== 'string') {
      throw new InvalidCampaignRequestError('Every player needs a name');
    }
    const playerName = player.name.trim();
    if (playerName.length === 0 || playerName.length > MAX_PLAYER_NAME_LENGTH) {
      throw new InvalidCampaignRequestError(`Player names must be between 1 and ${MAX_PLAYER_NAME_LENGTH} characters`);
    }
    if (player.profileId !== undefined && !isPlayerProfileId(player.profileId)) {
      throw new InvalidCampaignRequestError('Invalid player profile');
    }
    return {name: playerName, profileId: player.profileId};
  });

  const normalizedNames = new Set(players.map((player) => player.name.toLocaleLowerCase()));
  if (normalizedNames.size !== players.length) {
    throw new InvalidCampaignRequestError('Player names must be unique within a campaign');
  }
  return {name, players};
}

export class ApiLegacyCampaigns extends Handler {
  public static readonly INSTANCE = new ApiLegacyCampaigns();

  public constructor(private database: IDatabase = Database.getInstance()) {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (id === null) {
      const campaigns = await this.database.listLegacyCampaigns();
      responses.writeJson(res, ctx, {campaigns: campaigns.map(legacyCampaignToSummary)});
      return;
    }
    if (!isLegacyCampaignId(id)) {
      responses.badRequest(req, res, 'Invalid legacy campaign id');
      return;
    }
    const campaign = await this.database.getLegacyCampaign(id);
    if (campaign === undefined) {
      responses.notFound(req, res, 'Legacy campaign not found');
      return;
    }
    responses.writeJson(res, ctx, campaign);
  }

  public override post(req: Request, res: Response, ctx: Context): Promise<void> {
    return new Promise((resolve) => {
      let body = '';
      let bodyTooLarge = false;
      req.on('data', (data) => {
        if (bodyTooLarge) {
          return;
        }
        body += data.toString();
        bodyTooLarge = body.length > MAX_BODY_LENGTH;
      });
      req.once('end', async () => {
        try {
          if (bodyTooLarge) {
            responses.badRequest(req, res, 'Campaign details are too large');
            return;
          }
          const request = parseCreateRequest(JSON.parse(body));
          const linkedProfileIds = request.players.flatMap((player) => player.profileId === undefined ? [] : [player.profileId]);
          if (new Set(linkedProfileIds).size !== linkedProfileIds.length) {
            throw new InvalidCampaignRequestError('A profile can only appear once in a campaign');
          }
          if (linkedProfileIds.length > 0 && ctx.user === undefined) {
            responses.notAuthorized(req, res);
            return;
          }
          for (const profileId of linkedProfileIds) {
            if (await this.database.getPlayerProfile(profileId) === undefined) {
              throw new InvalidCampaignRequestError('A selected player profile no longer exists');
            }
          }
          const now = new Date(ctx.clock.now()).toISOString();
          const players: Array<LegacyCampaignPlayer> = request.players.map((player) => ({
            id: safeCast(generateRandomId('lp'), isLegacyCampaignPlayerId),
            name: player.name,
            profileId: player.profileId,
            titlePoints: 0,
            nextMissionBonusMegacredits: 0,
            savedCards: [],
            developments: [],
          }));
          const campaign: LegacyCampaign = {
            schemaVersion: LEGACY_CAMPAIGN_SCHEMA_VERSION,
            id: safeCast(generateRandomId('c'), isLegacyCampaignId),
            name: request.name,
            status: 'planning',
            currentMission: 1,
            players,
            linkedGameIds: [],
            missionHistory: [],
            createdAt: now,
            updatedAt: now,
          };
          await this.database.createLegacyCampaign(campaign);
          res.statusCode = 201;
          responses.writeJson(res, ctx, campaign);
        } catch (error) {
          if (error instanceof SyntaxError || error instanceof InvalidCampaignRequestError) {
            responses.badRequest(req, res, error instanceof Error ? error.message : 'Invalid campaign details');
          } else {
            responses.internalServerError(req, res, error);
          }
        } finally {
          resolve();
        }
      });
    });
  }
}

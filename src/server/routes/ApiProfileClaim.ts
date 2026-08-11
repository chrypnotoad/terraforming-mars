import {isPlayerId} from '../../common/Types';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {ProfileService} from '../profiles/ProfileService';
import {Request} from '../Request';
import {Response} from '../Response';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {readJsonRequest, RequestBodyError} from './RequestBody';

export class ApiProfileClaim extends Handler {
  public static readonly INSTANCE = new ApiProfileClaim();
  private readonly profileService: ProfileService;

  public constructor(private database: IDatabase = Database.getInstance()) {
    super();
    this.profileService = new ProfileService(database);
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    if (ctx.user === undefined) {
      responses.notAuthorized(req, res);
      return;
    }
    try {
      const body = await readJsonRequest(req, 4096) as {participantId?: unknown};
      if (!isPlayerId(body.participantId)) {
        throw new RequestBodyError('A valid player ID is required');
      }
      const game = await ctx.gameLoader.getGame(body.participantId);
      if (game === undefined) {
        responses.notFound(req, res, 'Game not found');
        return;
      }
      const player = game.getPlayerById(body.participantId);
      const profile = await this.profileService.getOrCreate(ctx.user, new Date(ctx.clock.now()));
      await this.database.claimPlayer({
        participantId: player.id,
        gameId: game.id,
        profileId: profile.id,
        claimedAt: new Date(ctx.clock.now()).toISOString(),
      });
      if (player.name !== profile.displayName && !profile.aliases.includes(player.name)) {
        profile.aliases = [...profile.aliases, player.name];
        profile.updatedAt = new Date(ctx.clock.now()).toISOString();
        await this.database.savePlayerProfile(profile);
      }
      responses.writeJson(res, ctx, await this.profileService.getResponse(profile));
    } catch (error) {
      if (error instanceof RequestBodyError) {
        responses.badRequest(req, res, error.message);
        return;
      }
      if (error instanceof Error && error.message.includes('already been claimed')) {
        responses.unprocessableEntity(req, res, error.message);
        return;
      }
      throw error;
    }
  }
}

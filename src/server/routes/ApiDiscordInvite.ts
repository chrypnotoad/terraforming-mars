import {isGameId} from '../../common/Types';
import {ProfileService} from '../profiles/ProfileService';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {DiscordGamePostService} from '../discord/DiscordGamePostService';
import {Request} from '../Request';
import {Response} from '../Response';
import * as responses from '../server/responses';
import {Context} from './IHandler';
import {Handler} from './Handler';
import {readJsonRequest, RequestBodyError} from './RequestBody';

const POST_WINDOW_MS = 60_000;
const POSTS_PER_WINDOW = 5;

export class ApiDiscordInvite extends Handler {
  public static readonly INSTANCE = new ApiDiscordInvite();
  private readonly postsByUser = new Map<string, Array<number>>();

  public constructor(
    private readonly database: IDatabase = Database.getInstance(),
    private readonly postService: DiscordGamePostService = DiscordGamePostService.INSTANCE,
  ) {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    if (ctx.user === undefined) {
      responses.notAuthorized(req, res);
      return;
    }
    if (!this.postService.isConfigured()) {
      responses.unprocessableEntity(req, res, 'Discord posting is not configured');
      return;
    }
    const origin = req.headers.origin;
    if (origin !== ctx.url.origin) {
      responses.notAuthorized(req, res);
      return;
    }
    try {
      const body = await readJsonRequest(req, 4096) as {gameId?: unknown};
      if (typeof body.gameId !== 'string' || !isGameId(body.gameId)) {
        throw new RequestBodyError('A valid game ID is required');
      }
      const game = await ctx.gameLoader.getGame(body.gameId);
      if (game === undefined) {
        responses.notFound(req, res, 'Game not found');
        return;
      }
      const now = ctx.clock.now();
      const recentPosts = (this.postsByUser.get(ctx.user.id) ?? []).filter((timestamp) => timestamp > now - POST_WINDOW_MS);
      if (recentPosts.length >= POSTS_PER_WINDOW) {
        responses.quotaExceeded(req, res);
        return;
      }
      const profile = await new ProfileService(this.database).getOrCreate(ctx.user, new Date(now));
      const result = await this.postService.postOrRefresh(game, profile);
      recentPosts.push(now);
      this.postsByUser.set(ctx.user.id, recentPosts);
      responses.writeJson(res, ctx, {
        posted: true,
        created: result.created,
        messageUrl: result.messageUrl,
      });
    } catch (error) {
      if (error instanceof RequestBodyError) {
        responses.badRequest(req, res, error.message);
        return;
      }
      responses.internalServerError(req, res, error);
    }
  }
}

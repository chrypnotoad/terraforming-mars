import {isGameId} from '../../common/Types';
import {ProfileService} from '../profiles/ProfileService';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {DiscordInviteClient, IDiscordInviteClient} from '../discord/DiscordInviteClient';
import {Request} from '../Request';
import {Response} from '../Response';
import * as responses from '../server/responses';
import {Context} from './IHandler';
import {Handler} from './Handler';
import {readJsonRequest, RequestBodyError} from './RequestBody';
import {Server} from '../models/ServerModel';

const POST_WINDOW_MS = 60_000;
const POSTS_PER_WINDOW = 5;
const DUPLICATE_WINDOW_MS = 30_000;

export class ApiDiscordInvite extends Handler {
  public static readonly INSTANCE = new ApiDiscordInvite();
  private readonly postsByUser = new Map<string, Array<number>>();
  private readonly lastPostByGame = new Map<string, number>();

  public constructor(
    private readonly database: IDatabase = Database.getInstance(),
    private readonly client: IDiscordInviteClient = new DiscordInviteClient(process.env.DISCORD_BOT_TOKEN ?? ''),
    private readonly channelId: string = process.env.DISCORD_INVITE_CHANNEL_ID ?? '',
    private readonly guildId: string = process.env.DISCORD_INVITE_GUILD_ID ?? '',
    private readonly configured: boolean = Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_INVITE_CHANNEL_ID),
  ) {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    if (ctx.user === undefined) {
      responses.notAuthorized(req, res);
      return;
    }
    if (!this.configured || this.channelId.length === 0) {
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
      const lastGamePost = this.lastPostByGame.get(game.id);
      if (recentPosts.length >= POSTS_PER_WINDOW || lastGamePost !== undefined && lastGamePost > now - DUPLICATE_WINDOW_MS) {
        responses.quotaExceeded(req, res);
        return;
      }
      const profile = await new ProfileService(this.database).getOrCreate(ctx.user, new Date(now));
      const gameUrl = new URL(`/game?id=${encodeURIComponent(game.id)}`, ctx.url.origin).toString();
      const result = await this.client.postGame(this.channelId, Server.getSimpleGameModel(game), gameUrl, profile.displayName);
      recentPosts.push(now);
      this.postsByUser.set(ctx.user.id, recentPosts);
      this.lastPostByGame.set(game.id, now);
      responses.writeJson(res, ctx, {
        posted: true,
        messageUrl: this.guildId.length === 0 ? undefined : `https://discord.com/channels/${this.guildId}/${this.channelId}/${result.messageId}`,
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

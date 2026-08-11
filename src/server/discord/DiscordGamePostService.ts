import {DISCORD_GAME_POST_SCHEMA_VERSION, DiscordGamePost} from '../../common/discord/DiscordGamePost';
import {GameId} from '../../common/Types';
import {PlayerProfile} from '../../common/profile/PlayerProfile';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {IGame} from '../IGame';
import {DiscordGameCardRenderer, IDiscordGameCardRenderer, buildDiscordGameCardSnapshot, discordGameCardSnapshotHash} from './DiscordGameCard';
import {DiscordInviteClient, DiscordInviteError, IDiscordInviteClient} from './DiscordInviteClient';

const UPDATE_DEBOUNCE_MS = 5_000;
const MIN_UPDATE_INTERVAL_MS = 15_000;
const MAX_RETRY_MS = 5 * 60_000;

export class DiscordGamePostService {
  public static readonly INSTANCE = new DiscordGamePostService();

  private readonly timers = new Map<GameId, ReturnType<typeof setTimeout>>();
  private readonly syncing = new Set<GameId>();

  public constructor(
    private readonly database: IDatabase = Database.getInstance(),
    private readonly client: IDiscordInviteClient = new DiscordInviteClient(process.env.DISCORD_BOT_TOKEN ?? ''),
    private readonly renderer: IDiscordGameCardRenderer = new DiscordGameCardRenderer(),
    private readonly channelId: string = process.env.DISCORD_INVITE_CHANNEL_ID ?? '',
    private readonly guildId: string = process.env.DISCORD_INVITE_GUILD_ID ?? '',
    private readonly rootUrl: string = process.env.URL_ROOT ?? 'http://localhost:8080',
    private readonly now: () => number = Date.now,
    private readonly configured: boolean = Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_INVITE_CHANNEL_ID),
  ) {}

  public isConfigured(): boolean {
    return this.configured && this.channelId.length > 0;
  }

  public async postOrRefresh(game: IGame, profile: PlayerProfile): Promise<{post: DiscordGamePost; messageUrl?: string; created: boolean}> {
    const snapshot = await buildDiscordGameCardSnapshot(game, this.database, profile.displayName, profile.customAvatarDataUrl ?? profile.discordAvatarUrl);
    const hash = discordGameCardSnapshotHash(snapshot);
    const image = await this.renderer.render(snapshot);
    const gameUrl = this.gameUrl(game.id);
    const existing = await this.database.getDiscordGamePost(game.id);
    const timestamp = new Date(this.now()).toISOString();
    let post: DiscordGamePost;
    let created = false;
    if (existing === undefined) {
      const result = await this.client.postGame(this.channelId, snapshot, gameUrl, image);
      post = {
        schemaVersion: DISCORD_GAME_POST_SCHEMA_VERSION,
        gameId: game.id,
        guildId: this.guildId || undefined,
        channelId: this.channelId,
        messageId: result.messageId,
        postedByProfileId: profile.id,
        postedByName: profile.displayName,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastSnapshotHash: hash,
        lastSyncedAt: timestamp,
        retryCount: 0,
      };
      created = true;
    } else {
      try {
        await this.client.updateGame(existing.channelId, existing.messageId, snapshot, gameUrl, image);
        post = {...existing, postedByName: profile.displayName, updatedAt: timestamp, lastSnapshotHash: hash, lastSyncedAt: timestamp, retryCount: 0};
      } catch (error) {
        if (!(error instanceof DiscordInviteError) || error.status !== 404) {
          throw error;
        }
        const result = await this.client.postGame(this.channelId, snapshot, gameUrl, image);
        post = {...existing, guildId: this.guildId || existing.guildId, channelId: this.channelId, messageId: result.messageId, postedByName: profile.displayName, updatedAt: timestamp, lastSnapshotHash: hash, lastSyncedAt: timestamp, retryCount: 0};
        created = true;
      }
      delete post.lastError;
      delete post.nextRetryAt;
    }
    await this.database.saveDiscordGamePost(post);
    return {post, messageUrl: this.messageUrl(post), created};
  }

  /** Coalesces frequent game saves and updates Discord only for visible state changes. */
  public schedule(game: IGame, delay: number = UPDATE_DEBOUNCE_MS): void {
    if (!this.isConfigured()) {
      return;
    }
    const existing = this.timers.get(game.id);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(game.id);
      void this.sync(game);
    }, delay);
    timer.unref?.();
    this.timers.set(game.id, timer);
  }

  public async sync(game: IGame): Promise<void> {
    if (this.syncing.has(game.id)) {
      this.schedule(game);
      return;
    }
    this.syncing.add(game.id);
    let post: DiscordGamePost | undefined;
    try {
      post = await this.database.getDiscordGamePost(game.id);
      if (post === undefined) {
        return;
      }
      const elapsed = this.now() - Date.parse(post.lastSyncedAt);
      if (elapsed < MIN_UPDATE_INTERVAL_MS) {
        this.schedule(game, MIN_UPDATE_INTERVAL_MS - elapsed);
        return;
      }
      const profile = await this.database.getPlayerProfile(post.postedByProfileId);
      const snapshot = await buildDiscordGameCardSnapshot(game, this.database, post.postedByName, profile?.customAvatarDataUrl ?? profile?.discordAvatarUrl);
      const hash = discordGameCardSnapshotHash(snapshot);
      if (hash === post.lastSnapshotHash) {
        return;
      }
      const image = await this.renderer.render(snapshot);
      try {
        await this.client.updateGame(post.channelId, post.messageId, snapshot, this.gameUrl(game.id), image);
      } catch (error) {
        if (!(error instanceof DiscordInviteError) || error.status !== 404) {
          throw error;
        }
        const recreated = await this.client.postGame(this.channelId, snapshot, this.gameUrl(game.id), image);
        post = {...post, guildId: this.guildId || post.guildId, channelId: this.channelId, messageId: recreated.messageId};
      }
      const timestamp = new Date(this.now()).toISOString();
      const updated: DiscordGamePost = {...post, updatedAt: timestamp, lastSyncedAt: timestamp, lastSnapshotHash: hash, retryCount: 0};
      delete updated.lastError;
      delete updated.nextRetryAt;
      await this.database.saveDiscordGamePost(updated);
    } catch (error) {
      if (post === undefined) {
        console.error(`Unable to load Discord post for ${game.id}`, error);
        return;
      }
      const retryCount = post.retryCount + 1;
      const retryDelay = Math.min(MAX_RETRY_MS, 5_000 * 2 ** Math.min(retryCount - 1, 6));
      const failed: DiscordGamePost = {
        ...post,
        updatedAt: new Date(this.now()).toISOString(),
        retryCount,
        lastError: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        nextRetryAt: new Date(this.now() + retryDelay).toISOString(),
      };
      await this.database.saveDiscordGamePost(failed);
      this.schedule(game, retryDelay);
    } finally {
      this.syncing.delete(game.id);
    }
  }

  private gameUrl(gameId: GameId): string {
    return new URL(`/game?id=${encodeURIComponent(gameId)}`, this.rootUrl).toString();
  }

  private messageUrl(post: DiscordGamePost): string | undefined {
    return post.guildId === undefined ? undefined : `https://discord.com/channels/${post.guildId}/${post.channelId}/${post.messageId}`;
  }
}

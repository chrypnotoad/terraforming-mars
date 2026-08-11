import {GameId} from '../Types';
import {PlayerProfileId} from '../profile/PlayerProfile';

export const DISCORD_GAME_POST_SCHEMA_VERSION = 1;

/** Durable link between a game and the single Discord card that represents it. */
export interface DiscordGamePost {
  schemaVersion: typeof DISCORD_GAME_POST_SCHEMA_VERSION;
  gameId: GameId;
  guildId?: string;
  channelId: string;
  messageId: string;
  postedByProfileId: PlayerProfileId;
  postedByName: string;
  createdAt: string;
  updatedAt: string;
  lastSnapshotHash: string;
  lastSyncedAt: string;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: string;
}

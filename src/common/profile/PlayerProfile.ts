import {Color} from '../Color';
import {GameId, ParticipantId} from '../Types';

export type PlayerProfileId = `u${string}`;

export const PLAYER_PROFILE_SCHEMA_VERSION = 1;

export interface PlayerProfile {
  schemaVersion: typeof PLAYER_PROFILE_SCHEMA_VERSION;
  id: PlayerProfileId;
  discordId: string;
  displayName: string;
  discordUsername: string;
  discordAvatarUrl?: string;
  customAvatarDataUrl?: string;
  preferredColor?: Color;
  aliases: Array<string>;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerClaim {
  participantId: ParticipantId;
  gameId: GameId;
  profileId: PlayerProfileId;
  claimedAt: string;
}

export interface CompletedPlayerResult {
  participantId?: ParticipantId;
  playerName?: string;
  megaCredits?: number;
  corporation: string;
  playerScore: number;
  rank?: number;
}

export interface CompletedGameResult {
  gameId: GameId;
  generations: number;
  completedAt: string;
  gameOptions: unknown;
  scores: Array<CompletedPlayerResult>;
}

export interface ProfileGameResult extends CompletedPlayerResult {
  gameId: GameId;
  generations: number;
  completedAt: string;
  won: boolean;
}

export interface PlayerProfileStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  averageScore: number;
  highScore?: number;
  favoriteCorporation?: string;
  corporationCounts: Array<{corporation: string; games: number; wins: number}>;
  aliases: Array<string>;
  games: Array<ProfileGameResult>;
}

export interface PlayerProfileResponse {
  profile: PlayerProfile;
  stats: PlayerProfileStats;
}

export interface PlayerProfileSummary {
  id: PlayerProfileId;
  displayName: string;
  discordUsername: string;
  avatarUrl?: string;
  preferredColor?: Color;
  isCurrentUser: boolean;
}

export function isPlayerProfileId(value: unknown): value is PlayerProfileId {
  return typeof value === 'string' && /^u[0-9a-f]{1,12}$/.test(value);
}

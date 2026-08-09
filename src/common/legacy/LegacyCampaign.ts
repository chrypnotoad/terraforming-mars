import {GameId} from '../Types';

export type LegacyCampaignId = `c${string}`;
export type LegacyCampaignPlayerId = `lp${string}`;
export type LegacyCampaignStatus = 'planning' | 'active' | 'completed';

export const LEGACY_CAMPAIGN_SCHEMA_VERSION = 1;
export const LEGACY_CAMPAIGN_MISSION_COUNT = 7;

export interface LegacyCampaignPlayer {
  id: LegacyCampaignPlayerId;
  name: string;
  corporation?: string;
  titlePoints: number;
  nextMissionBonusMegacredits: number;
  savedCards: Array<string>;
  developments: Array<{mission: number, name: string}>;
}

export interface LegacyMissionPlayerResult {
  playerId: LegacyCampaignPlayerId;
  rank?: number;
  score?: number;
  title?: string;
  titlePointsAwarded: number;
  catchUpMegacredits: number;
}

export interface LegacyMissionRecord {
  mission: number;
  gameId: GameId;
  completedAt: string;
  playerResults: Array<LegacyMissionPlayerResult>;
}

/**
 * State that survives between individual Legacy of Mars games.
 *
 * Mission-specific rules belong to the linked Game. This record only owns the
 * campaign state that has to remain available after that game is complete.
 */
export interface LegacyCampaign {
  schemaVersion: typeof LEGACY_CAMPAIGN_SCHEMA_VERSION;
  id: LegacyCampaignId;
  name: string;
  status: LegacyCampaignStatus;
  currentMission: number;
  activeGameId?: GameId;
  players: Array<LegacyCampaignPlayer>;
  linkedGameIds: Array<GameId>;
  missionHistory: Array<LegacyMissionRecord>;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyCampaignSummary {
  id: LegacyCampaignId;
  name: string;
  status: LegacyCampaignStatus;
  currentMission: number;
  playerNames: Array<string>;
  completedMissions: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLegacyCampaignRequest {
  name: string;
  players: Array<{name: string}>;
}

export function isLegacyCampaignId(value: unknown): value is LegacyCampaignId {
  return typeof value === 'string' && /^c[0-9a-f]{1,12}$/.test(value);
}

export function isLegacyCampaignPlayerId(value: unknown): value is LegacyCampaignPlayerId {
  return typeof value === 'string' && /^lp[0-9a-f]{1,12}$/.test(value);
}

export function legacyCampaignToSummary(campaign: LegacyCampaign): LegacyCampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    currentMission: campaign.currentMission,
    playerNames: campaign.players.map((player) => player.name),
    completedMissions: campaign.missionHistory.length,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

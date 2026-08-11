import {PlayerId, safeCast} from '../../common/Types';
import {
  isPlayerProfileId,
  PLAYER_PROFILE_SCHEMA_VERSION,
  PlayerProfile,
  PlayerProfileResponse,
  PlayerProfileStats,
} from '../../common/profile/PlayerProfile';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {DiscordUser} from '../server/auth/discord';
import {generateRandomId} from '../utils/server-ids';

export const MAX_PROFILE_NAME_LENGTH = 40;
export const MAX_AVATAR_DATA_URL_LENGTH = 700_000;

function discordAvatarUrl(user: DiscordUser): string | undefined {
  if (user.avatar === undefined) {
    return undefined;
  }
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=256`;
}

export class ProfileService {
  public constructor(private database: IDatabase = Database.getInstance()) {}

  public async getOrCreate(user: DiscordUser, now: Date = new Date()): Promise<PlayerProfile> {
    const existing = await this.database.getPlayerProfileByDiscordId(user.id);
    if (existing !== undefined) {
      const updated: PlayerProfile = {
        ...existing,
        discordUsername: user.username,
        discordAvatarUrl: discordAvatarUrl(user),
        updatedAt: now.toISOString(),
      };
      await this.database.savePlayerProfile(updated);
      return updated;
    }

    const displayName = user.global_name?.trim() || user.username.trim() || 'Mars player';
    const timestamp = now.toISOString();
    const profile: PlayerProfile = {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      id: safeCast(generateRandomId('u'), isPlayerProfileId),
      discordId: user.id,
      displayName: displayName.slice(0, MAX_PROFILE_NAME_LENGTH),
      discordUsername: user.username,
      discordAvatarUrl: discordAvatarUrl(user),
      aliases: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.database.createPlayerProfile(profile);
    return profile;
  }

  public async getResponse(profile: PlayerProfile): Promise<PlayerProfileResponse> {
    return {profile, stats: await this.getStats(profile)};
  }

  public async getStats(profile: PlayerProfile): Promise<PlayerProfileStats> {
    const claims = await this.database.listPlayerClaims(profile.id);
    const participantIds = new Set<PlayerId>(claims.map((claim) => claim.participantId as PlayerId));
    const results = await this.database.listCompletedGameResults();
    const games = results.flatMap((game) => game.scores
      .filter((score) => score.participantId !== undefined && participantIds.has(score.participantId as PlayerId))
      .map((score) => ({
        ...score,
        corporation: String(score.corporation),
        gameId: game.gameId,
        generations: game.generations,
        completedAt: game.completedAt,
        won: score.rank === 1,
      })));

    const corporationMap = new Map<string, {corporation: string; games: number; wins: number}>();
    for (const game of games) {
      const corporation = game.corporation || 'Unknown corporation';
      const row = corporationMap.get(corporation) ?? {corporation, games: 0, wins: 0};
      row.games++;
      if (game.won) {
        row.wins++;
      }
      corporationMap.set(corporation, row);
    }
    const corporationCounts = [...corporationMap.values()].sort((a, b) => b.games - a.games || a.corporation.localeCompare(b.corporation));
    const aliases = new Set(profile.aliases);
    games.forEach((game) => {
      if (game.playerName !== undefined && game.playerName !== profile.displayName) {
        aliases.add(game.playerName);
      }
    });
    const wins = games.filter((game) => game.won).length;
    const totalScore = games.reduce((sum, game) => sum + game.playerScore, 0);
    const currentResultsByGame = new Map(games.map((game) => [game.gameId, game]));
    const headToHeadMap = new Map<string, {
      profileId: PlayerProfile['id'];
      displayName: string;
      avatarUrl?: string;
      games: number;
      wins: number;
      losses: number;
      ties: number;
    }>();
    for (const result of results) {
      const currentResult = currentResultsByGame.get(result.gameId);
      if (currentResult === undefined) {
        continue;
      }
      for (const opponentResult of result.scores) {
        if (opponentResult.participantId === undefined || participantIds.has(opponentResult.participantId as PlayerId)) {
          continue;
        }
        const claim = await this.database.getPlayerClaim(opponentResult.participantId);
        if (claim === undefined || claim.profileId === profile.id) {
          continue;
        }
        const opponent = await this.database.getPlayerProfile(claim.profileId);
        if (opponent === undefined) {
          continue;
        }
        const row = headToHeadMap.get(opponent.id) ?? {
          profileId: opponent.id,
          displayName: opponent.displayName,
          avatarUrl: opponent.customAvatarDataUrl ?? opponent.discordAvatarUrl,
          games: 0,
          wins: 0,
          losses: 0,
          ties: 0,
        };
        row.games++;
        const comparison = compareResults(currentResult, opponentResult);
        if (comparison < 0) {
          row.wins++;
        } else if (comparison > 0) {
          row.losses++;
        } else {
          row.ties++;
        }
        headToHeadMap.set(opponent.id, row);
      }
    }
    const campaigns = (await this.database.listLegacyCampaigns())
      .flatMap((campaign) => campaign.players
        .filter((player) => player.profileId === profile.id)
        .map((player) => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          currentMission: campaign.currentMission,
          completedMissions: campaign.missionHistory.length,
          playerName: player.name,
        })))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      gamesPlayed: games.length,
      wins,
      winRate: games.length === 0 ? 0 : wins / games.length,
      averageScore: games.length === 0 ? 0 : totalScore / games.length,
      highScore: games.length === 0 ? undefined : Math.max(...games.map((game) => game.playerScore)),
      favoriteCorporation: corporationCounts[0]?.corporation,
      corporationCounts,
      aliases: [...aliases].sort((a, b) => a.localeCompare(b)),
      games: games.sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
      headToHead: [...headToHeadMap.values()].sort((a, b) => b.games - a.games || a.displayName.localeCompare(b.displayName)),
      campaigns,
    };
  }
}

function compareResults(current: {rank?: number; playerScore: number}, opponent: {rank?: number; playerScore: number}): number {
  if (current.rank !== undefined && opponent.rank !== undefined) {
    return current.rank - opponent.rank;
  }
  return opponent.playerScore - current.playerScore;
}

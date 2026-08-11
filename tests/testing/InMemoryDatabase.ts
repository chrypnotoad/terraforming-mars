import {IGame, Score} from '../../src/server/IGame';
import {GameOptions} from '../../src/server/game/GameOptions';
import {SerializedGame} from '../../src/server/SerializedGame';
import {GameIdLedger, IDatabase} from '../../src/server/database/IDatabase';
import {GameId, ParticipantId} from '../../src/common/Types';
import {Session, SessionId} from '../../src/server/auth/Session';
import {Clock} from '../../src/common/Timer';
import {LegacyCampaign, LegacyCampaignId} from '../../src/common/legacy/LegacyCampaign';
import {CompletedGameResult, PlayerClaim, PlayerProfile, PlayerProfileId} from '../../src/common/profile/PlayerProfile';
import {DiscordGamePost} from '../../src/common/discord/DiscordGamePost';

export class InMemoryDatabase implements IDatabase {
  public games: Map<GameId, Array<SerializedGame | undefined>> = new Map();
  protected completedGames: Map<GameId, Date> = new Map();
  protected sessions: Map<SessionId, Session> = new Map();
  protected legacyCampaigns: Map<LegacyCampaignId, LegacyCampaign> = new Map();
  protected playerProfiles: Map<PlayerProfileId, PlayerProfile> = new Map();
  protected playerClaims: Map<ParticipantId, PlayerClaim> = new Map();
  protected discordGamePosts: Map<GameId, DiscordGamePost> = new Map();
  protected gameResults: Array<CompletedGameResult> = [];
  private clock: Clock;

  constructor(clock: Clock = new Clock()) {
    this.clock = clock;
  }
  initialize(): Promise<unknown> {
    return Promise.resolve();
  }

  async getGame(gameId: GameId): Promise<SerializedGame> {
    const row = this.games.get(gameId);
    if (row === undefined || row.length === 0) {
      throw new Error('not found');
    } else {
      const game = row[row.length -1];
      return game!;
    }
  }
  async getGameId(id: ParticipantId): Promise<GameId> {
    // Direct copy of LocalFilesystem. :D
    const participants = await this.getParticipants();
    for (const entry of participants) {
      if (entry.participantIds.includes(id)) {
        return entry.gameId;
      }
    }
    throw new Error(`participant id ${id} not found`);
  }
  getSaveIds(gameId: GameId): Promise<number[]> {
    const row = this.games.get(gameId);
    if (row === undefined || row.length === 0) {
      return Promise.reject(new Error('not found'));
    } else {
      const result = row!.map((value, idx) => value !== undefined ? idx : undefined);
      return Promise.resolve(result.filter((result) => result !== undefined));
    }
  }
  getGameVersion(gameId: GameId, saveId: number): Promise<SerializedGame> {
    const row = this.games.get(gameId);
    if (row === undefined || row.length === 0) {
      return Promise.reject(new Error(`Game ${gameId} not found`));
    }
    const serializedGame = row[saveId];
    if (serializedGame === undefined) {
      return Promise.reject(new Error(`Game ${gameId} not found`));
    }
    return Promise.resolve(serializedGame);
  }
  getGameIds(): Promise<GameId[]> {
    return Promise.resolve(Array.from(this.games.keys()));
  }
  async getPlayerCount(gameId: GameId): Promise<number> {
    const game = await this.getGame(gameId);
    return game.players.length;
  }
  saveGame(game: IGame): Promise<void> {
    const gameId = game.id;
    const row = this.games.get(gameId) || [];
    this.games.set(gameId, row);
    while (row.length <= game.lastSaveId) {
      row.push(undefined);
    }
    row[game.lastSaveId] = game.serialize();
    game.lastSaveId++;
    return Promise.resolve();
  }
  saveGameResults(gameId: GameId, _players: number, generations: number, gameOptions: GameOptions, scores: Score[]): void {
    this.gameResults.push({
      gameId,
      generations,
      completedAt: new Date(this.clock.now()).toISOString(),
      gameOptions: structuredClone(gameOptions),
      scores: structuredClone(scores).map((score) => ({...score, corporation: String(score.corporation)})),
    });
  }
  loadCloneableGame(gameId: GameId): Promise<SerializedGame> {
    return this.getGameVersion(gameId, 0);
  }

  deleteGameNbrSaves(gameId: GameId, rollbackCount: number): Promise<void> {
    const row = this.games.get(gameId);
    if (row === undefined) {
      throw new Error('Game not found ' + gameId);
    }
    row.splice(row.length - rollbackCount, rollbackCount);

    return Promise.resolve();
  }
  markFinished(gameId: GameId): Promise<void> {
    this.completedGames.set(gameId, new Date(this.clock.now()));
    return Promise.resolve();
  }
  purgeUnfinishedGames(): Promise<Array<GameId>> {
    const keys = [...this.games.keys()];
    for (const key of keys) {
      this.games.delete(key);
    }
    return Promise.resolve(keys);
  }
  compressCompletedGames(): Promise<unknown> {
    return Promise.resolve();
  }
  stats(): Promise<{[ key: string ]: string | number;}> {
    return Promise.resolve({
      type: 'InMemoryDatabase',
    });
  }
  storeParticipants() {
    return Promise.resolve();
  }
  async getParticipants(): Promise<Array<GameIdLedger>> {
    const entries: Array<GameIdLedger> = [];
    this.games.forEach((games, gameId) => {
      // Last save is always defined
      const lastSave = games[games.length - 1]!;
      const participantIds: Array<ParticipantId> = lastSave.players.map((p) => p.id);
      if (lastSave.spectatorId) {
        participantIds.push(lastSave.spectatorId);
      }
      entries.push({gameId, participantIds});
    });
    return entries;
  }
  createSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }
  deleteSession(sessionId: SessionId): Promise<void> {
    this.sessions.delete(sessionId);
    return Promise.resolve();
  }
  getSessions(): Promise<Array<Session>> {
    const now = this.clock.now();
    return Promise.resolve(Array.from(this.sessions.values()).filter((e) => e.expirationTimeMillis > now));
  }
  createPlayerProfile(profile: PlayerProfile): Promise<void> {
    if ([...this.playerProfiles.values()].some((value) => value.discordId === profile.discordId)) {
      return Promise.reject(new Error(`Discord profile ${profile.discordId} already exists`));
    }
    this.playerProfiles.set(profile.id, structuredClone(profile));
    return Promise.resolve();
  }
  getPlayerProfile(profileId: PlayerProfileId): Promise<PlayerProfile | undefined> {
    const profile = this.playerProfiles.get(profileId);
    return Promise.resolve(profile === undefined ? undefined : structuredClone(profile));
  }
  getPlayerProfileByDiscordId(discordId: string): Promise<PlayerProfile | undefined> {
    const profile = [...this.playerProfiles.values()].find((value) => value.discordId === discordId);
    return Promise.resolve(profile === undefined ? undefined : structuredClone(profile));
  }

  listPlayerProfiles(): Promise<Array<PlayerProfile>> {
    return Promise.resolve([...this.playerProfiles.values()].map((profile) => structuredClone(profile)));
  }
  savePlayerProfile(profile: PlayerProfile): Promise<void> {
    if (!this.playerProfiles.has(profile.id)) {
      return Promise.reject(new Error(`Player profile ${profile.id} not found`));
    }
    this.playerProfiles.set(profile.id, structuredClone(profile));
    return Promise.resolve();
  }
  claimPlayer(claim: PlayerClaim): Promise<void> {
    const existing = this.playerClaims.get(claim.participantId);
    if (existing !== undefined && existing.profileId !== claim.profileId) {
      return Promise.reject(new Error('This player has already been claimed by another profile'));
    }
    this.playerClaims.set(claim.participantId, structuredClone(claim));
    return Promise.resolve();
  }
  unclaimPlayer(participantId: ParticipantId, profileId: PlayerProfileId): Promise<boolean> {
    const claim = this.playerClaims.get(participantId);
    if (claim?.profileId !== profileId) {
      return Promise.resolve(false);
    }
    this.playerClaims.delete(participantId);
    return Promise.resolve(true);
  }
  getPlayerClaim(participantId: ParticipantId): Promise<PlayerClaim | undefined> {
    const claim = this.playerClaims.get(participantId);
    return Promise.resolve(claim === undefined ? undefined : structuredClone(claim));
  }
  listPlayerClaims(profileId: PlayerProfileId): Promise<Array<PlayerClaim>> {
    return Promise.resolve([...this.playerClaims.values()]
      .filter((claim) => claim.profileId === profileId)
      .map((claim) => structuredClone(claim)));
  }
  listCompletedGameResults(): Promise<Array<CompletedGameResult>> {
    return Promise.resolve(structuredClone(this.gameResults));
  }
  getDiscordGamePost(gameId: GameId): Promise<DiscordGamePost | undefined> {
    const post = this.discordGamePosts.get(gameId);
    return Promise.resolve(post === undefined ? undefined : structuredClone(post));
  }
  listDiscordGamePosts(): Promise<Array<DiscordGamePost>> {
    return Promise.resolve([...this.discordGamePosts.values()].map((post) => structuredClone(post)));
  }
  saveDiscordGamePost(post: DiscordGamePost): Promise<void> {
    this.discordGamePosts.set(post.gameId, structuredClone(post));
    return Promise.resolve();
  }
  createLegacyCampaign(campaign: LegacyCampaign): Promise<void> {
    if (this.legacyCampaigns.has(campaign.id)) {
      return Promise.reject(new Error(`Legacy campaign ${campaign.id} already exists`));
    }
    this.legacyCampaigns.set(campaign.id, structuredClone(campaign));
    return Promise.resolve();
  }
  getLegacyCampaign(campaignId: LegacyCampaignId): Promise<LegacyCampaign | undefined> {
    const campaign = this.legacyCampaigns.get(campaignId);
    return Promise.resolve(campaign === undefined ? undefined : structuredClone(campaign));
  }
  listLegacyCampaigns(): Promise<Array<LegacyCampaign>> {
    const campaigns = Array.from(this.legacyCampaigns.values()).map((campaign) => structuredClone(campaign));
    campaigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Promise.resolve(campaigns);
  }
  saveLegacyCampaign(campaign: LegacyCampaign): Promise<void> {
    if (!this.legacyCampaigns.has(campaign.id)) {
      return Promise.reject(new Error(`Legacy campaign ${campaign.id} not found`));
    }
    this.legacyCampaigns.set(campaign.id, structuredClone(campaign));
    return Promise.resolve();
  }
}

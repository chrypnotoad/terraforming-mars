import {GameIdLedger, IDatabase} from './IDatabase';
import {IGame, Score} from '../IGame';
import {GameOptions} from '../game/GameOptions';
import {GameId, isGameId, isPlayerId, ParticipantId} from '../../common/Types';
import {SerializedGame} from '../SerializedGame';
import {Dirent, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import {Session, SessionId} from '../auth/Session';
import {toID} from '../../common/utils/utils';
import {isLegacyCampaignId, LegacyCampaign, LegacyCampaignId} from '../../common/legacy/LegacyCampaign';
import {CompletedGameResult, isPlayerProfileId, PlayerClaim, PlayerProfile, PlayerProfileId} from '../../common/profile/PlayerProfile';

const path = require('path');
const defaultDbFolder = path.resolve(process.cwd(), './db/files');

export class LocalFilesystem implements IDatabase {
  protected readonly dbFolder: string;
  private readonly historyFolder: string;
  private readonly completedFolder: string;
  private readonly sessionsFolder: string;
  private readonly legacyCampaignsFolder: string;
  private readonly playerProfilesFolder: string;
  private readonly playerClaimsFolder: string;
  public static quiet: boolean = false;

  constructor(dbFolder: string = defaultDbFolder) {
    this.dbFolder = dbFolder;
    this.historyFolder = path.resolve(dbFolder, 'history');
    this.completedFolder = path.resolve(dbFolder, 'completed');
    this.sessionsFolder = path.resolve(dbFolder, 'sessions');
    this.legacyCampaignsFolder = path.resolve(dbFolder, 'legacy-campaigns');
    this.playerProfilesFolder = path.resolve(dbFolder, 'player-profiles');
    this.playerClaimsFolder = path.resolve(dbFolder, 'player-claims');
  }

  public initialize(): Promise<void> {
    console.log(`Starting local database at ${this.dbFolder}`);
    const dirs = [this.dbFolder, this.historyFolder, this.completedFolder, this.sessionsFolder, this.legacyCampaignsFolder, this.playerProfilesFolder, this.playerClaimsFolder];
    for (const folder of dirs) {
      if (!existsSync(folder)) {
        mkdirSync(folder);
      }
    }
    return Promise.resolve();
  }

  private filename(gameId: GameId): string {
    return path.resolve(this.dbFolder, `${gameId}.json`);
  }

  private historyFilename(gameId: GameId, saveId: number) {
    const saveIdString = saveId.toString().padStart(5, '0');
    return path.resolve(this.historyFolder, `${gameId}-${saveIdString}.json`);
  }

  private completedFilename(gameId: GameId) {
    return path.resolve(this.completedFolder, `${gameId}.json`);
  }

  private sessionFilename(sessionId: SessionId) {
    return path.resolve(this.sessionsFolder, `${sessionId}.json`);
  }

  private legacyCampaignFilename(campaignId: LegacyCampaignId) {
    if (!isLegacyCampaignId(campaignId)) {
      throw new Error(`Invalid legacy campaign id ${campaignId}`);
    }
    return path.resolve(this.legacyCampaignsFolder, `${campaignId}.json`);
  }

  private playerProfileFilename(profileId: PlayerProfileId): string {
    if (!isPlayerProfileId(profileId)) {
      throw new Error(`Invalid player profile id ${profileId}`);
    }
    return path.resolve(this.playerProfilesFolder, `${profileId}.json`);
  }

  private playerClaimFilename(participantId: ParticipantId): string {
    if (!isPlayerId(participantId)) {
      throw new Error(`Invalid player id ${participantId}`);
    }
    return path.resolve(this.playerClaimsFolder, `${participantId}.json`);
  }

  saveGame(game: IGame): Promise<void> {
    console.log(`saving ${game.id} at position ${game.lastSaveId}`);
    this.saveSerializedGame(game.serialize());
    game.lastSaveId++;
    return Promise.resolve();
  }

  saveSerializedGame(serializedGame: SerializedGame): void {
    const text = JSON.stringify(serializedGame, null, 2);
    writeFileSync(this.filename(serializedGame.id), text);
    writeFileSync(this.historyFilename(serializedGame.id, serializedGame.lastSaveId), text);
  }

  getGame(gameId: GameId): Promise<SerializedGame> {
    try {
      console.log(`Loading ${gameId}`);
      const text = readFileSync(this.filename(gameId));
      const serializedGame = JSON.parse(text.toString());
      return Promise.resolve(serializedGame);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw error;
    }
  }

  async getGameId(participantId: ParticipantId): Promise<GameId> {
    const participants = await this.getParticipants();
    for (const entry of participants) {
      if (entry.participantIds.includes(participantId)) {
        return entry.gameId;
      }
    }
    throw new Error(`participant id ${participantId} not found`);
  }

  getSaveIds(gameId: GameId): Promise<Array<number>> {
    const results: Array<number> = [];
    const entries = readdirSync(this.historyFolder, {withFileTypes: true});
    for (const dirent of entries) {
      if (dirent.name.startsWith(gameId + '-') && dirent.isFile()) {
        const match = dirent.name.match(/(.*)-(.*).json/);
        if (match !== null) {
          const saveIdAsString = match[2];
          results.push(Number(saveIdAsString));
        }
      }
    }
    return Promise.resolve(results);
  }

  getGameVersion(gameId: GameId, saveId: number): Promise<SerializedGame> {
    try {
      if (!LocalFilesystem.quiet) {
        console.log(`Loading ${gameId} at ${saveId}`);
      }
      const text = readFileSync(this.historyFilename(gameId, saveId));
      const serializedGame = JSON.parse(text.toString());
      return Promise.resolve(serializedGame);
    } catch (e) {
      console.log(e);
      return Promise.reject(new Error(`Game ${gameId} not found at save_id ${saveId}`));
    }
  }

  async getPlayerCount(gameId: GameId): Promise<number> {
    const gameIds = await this.getGameIds();
    const found = gameIds.find((gId) => gId === gameId && existsSync(this.historyFilename(gameId, 0)));
    if (found === undefined) {
      throw new Error(`${gameId} not found`);
    }
    const text = readFileSync(this.historyFilename(gameId, 0));
    const serializedGame = JSON.parse(text.toString()) as SerializedGame;
    return serializedGame.players.length;
  }

  getGameIds(): Promise<Array<GameId>> {
    const gameIds: Array<GameId> = [];

    readdirSync(this.dbFolder, {withFileTypes: true}).forEach((dirent: Dirent) => {
      const gameId = this.asGameId(dirent);
      if (gameId !== undefined) {
        gameIds.push(gameId);
      }
    });
    return Promise.resolve(gameIds);
  }

  saveGameResults(gameId: GameId, players: number, generations: number, gameOptions: GameOptions, scores: Array<Score>): void {
    const obj = {gameId, players, generations, gameOptions, scores, completedAt: new Date().toISOString()};
    const text = JSON.stringify(obj, null, 2);
    writeFileSync(this.completedFilename(gameId), text);
  }

  markFinished(_gameId: GameId): Promise<void> {
    // Not implemented here.
    return Promise.resolve();
  }

  purgeUnfinishedGames(): Promise<Array<GameId>> {
    // Not implemented.
    return Promise.resolve([]);
  }

  compressCompletedGames(): Promise<unknown> {
    // Not implemented.
    return Promise.resolve();
  }

  deleteGameNbrSaves(gameId: GameId, rollbackCount: number): Promise<void> {
    if (rollbackCount <= 0) {
      console.error(`invalid rollback count for ${gameId}: ${rollbackCount}`);
      // Should this be an error?
      return Promise.resolve();
    }

    return this.getSaveIds(gameId).then((saveIds) => {
      const versionsToDelete = saveIds.slice(-rollbackCount);
      for (const version of versionsToDelete) {
        this.deleteVersion(gameId, version);
      }
      return undefined;
    });
  }

  public stats(): Promise<{[key: string]: string | number}> {
    return Promise.resolve({
      type: 'Local Filesystem',
      path: this.dbFolder.toString(),
      history_path: this.historyFolder.toString(),
    });
  }

  public storeParticipants(_entry: GameIdLedger): Promise<void> {
    // Not necessary.
    return Promise.resolve();
  }

  private asGameId(dirent: Dirent): GameId | undefined {
    if (!dirent.isFile()) {
      return undefined;
    }
    const re = /(.*).json/;
    const result = dirent.name.match(re);
    if (result === null) {
      return undefined;
    }
    return isGameId(result[1]) ? result[1] : undefined;
  }

  public getParticipants(): Promise<Array<GameIdLedger>> {
    const gameIds: Array<GameIdLedger> = [];
    const entries = readdirSync(this.dbFolder, {withFileTypes: true});
    for (const dirent of entries) {
      const gameId = this.asGameId(dirent);
      if (gameId !== undefined) {
        try {
          const text = readFileSync(this.filename(gameId));
          const game: SerializedGame = JSON.parse(text.toString());
          const participantIds: Array<ParticipantId> = game.players.map(toID);
          if (game.spectatorId) {
            participantIds.push(game.spectatorId);
          }
          gameIds.push({gameId, participantIds});
        } catch (e) {
          console.error(`While reading ${gameId} `, e);
        }
      }
    }
    return Promise.resolve(gameIds);
  }

  createSession(session: Session): Promise<void> {
    const text = JSON.stringify(session, null, 2);
    writeFileSync(this.sessionFilename(session.id), text);
    return Promise.resolve();
  }
  deleteSession(sessionId: SessionId): Promise<void> {
    unlinkSync(this.sessionFilename(sessionId));
    return Promise.resolve();
  }
  getSessions(): Promise<Array<Session>> {
    const sessions: Array<Session> = [];
    const now = Date.now();
    const entries = readdirSync(this.sessionsFolder, {withFileTypes: true});
    for (const dirent of entries) {
      if (dirent.isFile() && dirent.name.endsWith('.json')) {
        try {
          const text = readFileSync(this.sessionsFolder + '/' + dirent.name);
          const session: Session = JSON.parse(text.toString());
          if (session.expirationTimeMillis > now) {
            sessions.push(session);
          }
        } catch (e) {
          console.error(`While reading ${dirent.name} `, e);
        }
      }
    }
    return Promise.resolve(sessions);
  }

  createPlayerProfile(profile: PlayerProfile): Promise<void> {
    const filename = this.playerProfileFilename(profile.id);
    if (existsSync(filename)) {
      return Promise.reject(new Error(`Player profile ${profile.id} already exists`));
    }
    writeFileSync(filename, JSON.stringify(profile, null, 2));
    return Promise.resolve();
  }

  getPlayerProfile(profileId: PlayerProfileId): Promise<PlayerProfile | undefined> {
    const filename = this.playerProfileFilename(profileId);
    if (!existsSync(filename)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(JSON.parse(readFileSync(filename).toString()) as PlayerProfile);
  }

  getPlayerProfileByDiscordId(discordId: string): Promise<PlayerProfile | undefined> {
    for (const entry of readdirSync(this.playerProfilesFolder, {withFileTypes: true})) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const profile = JSON.parse(readFileSync(path.resolve(this.playerProfilesFolder, entry.name)).toString()) as PlayerProfile;
      if (profile.discordId === discordId) {
        return Promise.resolve(profile);
      }
    }
    return Promise.resolve(undefined);
  }

  listPlayerProfiles(): Promise<Array<PlayerProfile>> {
    const profiles: Array<PlayerProfile> = [];
    for (const entry of readdirSync(this.playerProfilesFolder, {withFileTypes: true})) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        profiles.push(JSON.parse(readFileSync(path.resolve(this.playerProfilesFolder, entry.name)).toString()) as PlayerProfile);
      }
    }
    return Promise.resolve(profiles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  savePlayerProfile(profile: PlayerProfile): Promise<void> {
    const filename = this.playerProfileFilename(profile.id);
    if (!existsSync(filename)) {
      return Promise.reject(new Error(`Player profile ${profile.id} not found`));
    }
    writeFileSync(filename, JSON.stringify(profile, null, 2));
    return Promise.resolve();
  }

  async claimPlayer(claim: PlayerClaim): Promise<void> {
    const existing = await this.getPlayerClaim(claim.participantId);
    if (existing !== undefined && existing.profileId !== claim.profileId) {
      throw new Error('This player has already been claimed by another profile');
    }
    writeFileSync(this.playerClaimFilename(claim.participantId), JSON.stringify(claim, null, 2));
  }

  async unclaimPlayer(participantId: ParticipantId, profileId: PlayerProfileId): Promise<boolean> {
    const claim = await this.getPlayerClaim(participantId);
    if (claim?.profileId !== profileId) {
      return false;
    }
    unlinkSync(this.playerClaimFilename(participantId));
    return true;
  }

  getPlayerClaim(participantId: ParticipantId): Promise<PlayerClaim | undefined> {
    const filename = this.playerClaimFilename(participantId);
    if (!existsSync(filename)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(JSON.parse(readFileSync(filename).toString()) as PlayerClaim);
  }

  listPlayerClaims(profileId: PlayerProfileId): Promise<Array<PlayerClaim>> {
    const claims: Array<PlayerClaim> = [];
    for (const entry of readdirSync(this.playerClaimsFolder, {withFileTypes: true})) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const claim = JSON.parse(readFileSync(path.resolve(this.playerClaimsFolder, entry.name)).toString()) as PlayerClaim;
      if (claim.profileId === profileId) {
        claims.push(claim);
      }
    }
    return Promise.resolve(claims);
  }

  listCompletedGameResults(): Promise<Array<CompletedGameResult>> {
    const results: Array<CompletedGameResult> = [];
    for (const entry of readdirSync(this.completedFolder, {withFileTypes: true})) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const row = JSON.parse(readFileSync(path.resolve(this.completedFolder, entry.name)).toString());
      results.push({
        gameId: row.gameId,
        generations: row.generations,
        completedAt: row.completedAt ?? '',
        gameOptions: row.gameOptions,
        scores: row.scores,
      });
    }
    return Promise.resolve(results);
  }

  createLegacyCampaign(campaign: LegacyCampaign): Promise<void> {
    const filename = this.legacyCampaignFilename(campaign.id);
    if (existsSync(filename)) {
      return Promise.reject(new Error(`Legacy campaign ${campaign.id} already exists`));
    }
    writeFileSync(filename, JSON.stringify(campaign, null, 2));
    return Promise.resolve();
  }

  getLegacyCampaign(campaignId: LegacyCampaignId): Promise<LegacyCampaign | undefined> {
    const filename = this.legacyCampaignFilename(campaignId);
    if (!existsSync(filename)) {
      return Promise.resolve(undefined);
    }
    const text = readFileSync(filename);
    return Promise.resolve(JSON.parse(text.toString()) as LegacyCampaign);
  }

  listLegacyCampaigns(): Promise<Array<LegacyCampaign>> {
    const campaigns: Array<LegacyCampaign> = [];
    const entries = readdirSync(this.legacyCampaignsFolder, {withFileTypes: true});
    for (const dirent of entries) {
      if (!dirent.isFile() || !dirent.name.endsWith('.json')) {
        continue;
      }
      const campaignId = dirent.name.substring(0, dirent.name.length - '.json'.length);
      if (!isLegacyCampaignId(campaignId)) {
        continue;
      }
      const text = readFileSync(this.legacyCampaignFilename(campaignId));
      campaigns.push(JSON.parse(text.toString()) as LegacyCampaign);
    }
    campaigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Promise.resolve(campaigns);
  }

  saveLegacyCampaign(campaign: LegacyCampaign): Promise<void> {
    const filename = this.legacyCampaignFilename(campaign.id);
    if (!existsSync(filename)) {
      return Promise.reject(new Error(`Legacy campaign ${campaign.id} not found`));
    }
    writeFileSync(filename, JSON.stringify(campaign, null, 2));
    return Promise.resolve();
  }

  private deleteVersion(gameId: GameId, version: number) {
    unlinkSync(this.historyFilename(gameId, version));
  }
}

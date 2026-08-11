import fs from 'fs';
import path from 'path';
import BetterSqlite3 = require('better-sqlite3');

import {GameIdLedger, IDatabase} from './IDatabase';
import {IGame, Score} from '../IGame';
import {GameOptions} from '../game/GameOptions';
import {GameId, ParticipantId} from '../../common/Types';
import {SerializedGame} from '../SerializedGame';
import {daysAgoToSeconds} from './utils';
import {getPurgeGameDaysForMaintenance} from './GameRetention';
import {MultiMap} from 'mnemonist';
import {Session, SessionId} from '../auth/Session';
import {toID} from '../../common/utils/utils';
import {LegacyCampaign, LegacyCampaignId} from '../../common/legacy/LegacyCampaign';
import {CompletedGameResult, PlayerClaim, PlayerProfile, PlayerProfileId} from '../../common/profile/PlayerProfile';

export const IN_MEMORY_SQLITE_PATH = ':memory:';

export class SQLite implements IDatabase {
  private _db: BetterSqlite3.Database | undefined;

  protected get db(): BetterSqlite3.Database {
    if (this._db === undefined) {
      throw new Error('attempt to get db before initialize');
    }
    return this._db;
  }

  constructor(private filename: undefined | string = undefined, private throwQuietFailures: boolean = false) {
  }

  public async initialize(): Promise<void> {
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const dbFolder = path.resolve(process.cwd(), './db');
    const dbPath = path.resolve(dbFolder, 'game.db');
    if (this.filename === undefined) {
      this.filename = dbPath;
    }
    if (this.filename !== IN_MEMORY_SQLITE_PATH) {
      if (!fs.existsSync(dbFolder)) {
        fs.mkdirSync(dbFolder);
      }
    }
    this._db = new Database(String(this.filename));
    await this.asyncRun('CREATE TABLE IF NOT EXISTS games(game_id varchar, players integer, save_id integer, game text, status text default \'running\', created_time timestamp default (strftime(\'%s\', \'now\')), PRIMARY KEY (game_id, save_id))');
    await this.asyncRun('CREATE TABLE IF NOT EXISTS participants(game_id varchar, participant varchar, PRIMARY KEY (game_id, participant))');
    await this.asyncRun('CREATE TABLE IF NOT EXISTS game_results(game_id varchar not null, seed_game_id varchar, players integer, generations integer, game_options text, scores text, PRIMARY KEY (game_id))');
    await this.asyncRun(
      `CREATE TABLE IF NOT EXISTS completed_game(
      game_id varchar not null,
      completed_time timestamp not null default (strftime('%s', 'now')),
      PRIMARY KEY (game_id))`);
    await this.asyncRun('DROP TABLE IF EXISTS purges');

    await this.asyncRun(
      `CREATE TABLE IF NOT EXISTS session(
        session_id varchar not null,
        data varchar not null,
        expiration_time timestamp not null,
        PRIMARY KEY (session_id)
      )`);
    await this.asyncRun(
      `CREATE TABLE IF NOT EXISTS legacy_campaign(
        campaign_id varchar not null,
        data text not null,
        created_time timestamp not null default (strftime('%s', 'now')),
        updated_time timestamp not null default (strftime('%s', 'now')),
        PRIMARY KEY (campaign_id)
      )`);
    await this.asyncRun(
      `CREATE TABLE IF NOT EXISTS player_profile(
        profile_id varchar not null,
        discord_id varchar not null unique,
        data text not null,
        created_time timestamp not null default (strftime('%s', 'now')),
        updated_time timestamp not null default (strftime('%s', 'now')),
        PRIMARY KEY (profile_id)
      )`);
    await this.asyncRun(
      `CREATE TABLE IF NOT EXISTS player_claim(
        participant_id varchar not null,
        game_id varchar not null,
        profile_id varchar not null,
        claimed_time timestamp not null default (strftime('%s', 'now')),
        PRIMARY KEY (participant_id)
      )`);
    const resultColumns = await this.asyncAll('PRAGMA table_info(game_results)');
    if (!resultColumns.some((column) => column.name === 'completed_time')) {
      await this.asyncRun('ALTER TABLE game_results ADD COLUMN completed_time timestamp');
    }
  }

  public async getPlayerCount(gameId: GameId): Promise<number> {
    const sql = 'SELECT players FROM games WHERE save_id = 0 AND game_id = ? LIMIT 1';
    const row = await this.asyncGet(sql, [gameId]);
    if (row === undefined) {
      throw new Error(`bad game id ${gameId}`);
    }
    return row.players;
  }

  public async getGameIds(): Promise<Array<GameId>> {
    const sql = 'SELECT distinct game_id game_id FROM games';
    const rows = await this.asyncAll(sql, []);
    return rows.map((row) => row.game_id);
  }

  saveGameResults(gameId: GameId, players: number, generations: number, gameOptions: GameOptions, scores: Array<Score>): void {
    try {
      this.db.prepare(
        'INSERT INTO game_results (game_id, seed_game_id, players, generations, game_options, scores, completed_time) VALUES(?, ?, ?, ?, ?, ?, ?)',
      ).run([gameId, gameOptions.clonedGamedId, players, generations, JSON.stringify(gameOptions), JSON.stringify(scores), Date.now()]);
    } catch (err) {
      console.error('SQLite:saveGameResults', err);
      throw err;
    }
  }

  public async getGame(gameId: GameId): Promise<SerializedGame> {
    // Retrieve last save from database
    const row: { game: any; } = await this.asyncGet('SELECT game game FROM games WHERE game_id = ? ORDER BY save_id DESC LIMIT 1', [gameId]);
    if (row === undefined) {
      throw new Error(`bad game id ${gameId}`);
    }
    return JSON.parse(row.game);
  }

  public async getGameId(participantId: ParticipantId): Promise<GameId> {
    // Default sql is for player id;
    let sql = 'SELECT game_id from games, json_each(games.game, \'$.players\') e where json_extract(e.value, \'$.id\') = ?';
    if (participantId.charAt(0) === 's') {
      sql = 'SELECT game_id from games where json_extract(games.game, \'$.spectatorId\') = ?';
    } else if (participantId.charAt(0) !== 'p') {
      throw new Error(`id ${participantId} is neither a player id or spectator id`);
    }

    const row: { game_id: any; } = await this.asyncGet(sql, [participantId]);
    if (row === undefined) {
      throw new Error(`No game id found for participant id ${participantId}`);
    }
    return row.game_id;
  }

  public async getSaveIds(gameId: GameId): Promise<Array<number>> {
    const rows = await this.asyncAll('SELECT distinct save_id FROM games WHERE game_id = ?', [gameId]);
    return rows.map((row) => row.save_id);
  }

  public async getGameVersion(gameId: GameId, saveId: number): Promise<SerializedGame> {
    const sql = 'SELECT game_id, game FROM games WHERE game_id = ? and save_id = ?';
    const row: { game_id: GameId, game: any; } = await this.asyncGet(sql, [gameId, saveId]);
    if (row === undefined || row.game_id === undefined || row.game === undefined) {
      throw new Error(`Game ${gameId} not found`);
    }
    return JSON.parse(row.game);
  }

  async getMaxSaveId(gameId: GameId): Promise<number> {
    const row: { save_id: any; } = await this.asyncGet('SELECT MAX(save_id) AS save_id FROM games WHERE game_id = ?', [gameId]);
    if (row === undefined) {
      throw new Error(`bad game id ${gameId}`);
    }
    return row.save_id;
  }

  async markFinished(gameId: GameId): Promise<void> {
    const promise1 = this.asyncRun('INSERT into completed_game (game_id) values (?)', [gameId]);
    const promise2 = this.asyncRun('UPDATE games SET status = \'finished\' WHERE game_id = ?', [gameId]);
    await Promise.all([promise1, promise2]);
  }


  async purgeUnfinishedGames(maxGameDays?: string): Promise<Array<GameId>> {
    const retentionDays = getPurgeGameDaysForMaintenance(maxGameDays);
    // Purge unfinished games only when MAX_GAME_DAYS is explicitly configured.
    if (retentionDays !== undefined) {
      const dateToSeconds = daysAgoToSeconds(String(retentionDays), 0);
      const selectResult = await this.asyncAll('SELECT DISTINCT game_id game_id FROM games WHERE created_time < ? and status = \'running\'', [dateToSeconds]);
      let gameIds = selectResult.map((row) => row.game_id);
      if (gameIds.length > 1000) {
        console.log('Truncated purge to 1000 games.');
        gameIds = gameIds.slice(0, 1000);
      } else {
        console.log(`${gameIds.length} games to be purged.`);
      }

      if (gameIds.length > 0) {
        console.log(`About to purge ${gameIds.length} games`);
        const placeholders = gameIds.map(() => '?').join(', ');
        const deleteResult = await this.asyncRun(`DELETE FROM games WHERE game_id in ( ${placeholders} )`, [...gameIds]);
        console.log(`Purged ${deleteResult.changes} rows from games`);
        const deleteParticipantsResult = await this.asyncRun(`DELETE FROM participants WHERE game_id in ( ${placeholders} )`, [...gameIds]);
        console.log(`Purged ${deleteParticipantsResult.changes} rows from participants`);
      }
      return gameIds;
    } else {
      return Promise.resolve([]);
    }
  }

  async compressCompletedGames(compressCompletedGamesDays: string | undefined = process.env.COMPRESS_COMPLETED_GAMES_DAYS): Promise<void> {
    if (compressCompletedGamesDays === undefined) {
      return;
    }
    const dateToSeconds = daysAgoToSeconds(compressCompletedGamesDays, 0);
    const selectResult = await this.asyncAll('SELECT DISTINCT game_id FROM completed_game WHERE completed_time < ?', [dateToSeconds]);
    const gameIds = selectResult.map((row) => row.game_id);
    console.log(`${gameIds.length} completed games to be compressed.`);
    if (gameIds.length > 1000) {
      gameIds.length = 1000;
      console.log('Compressing 1000 games.');
    }
    for (const gameId of gameIds) {
      // This isn't using await because nothing really depends on it.
      this.compressCompletedGame(gameId);
    }
  }

  async compressCompletedGame(gameId: GameId): Promise<BetterSqlite3.RunResult> {
    const maxSaveId = await this.getMaxSaveId(gameId);
    return this.asyncRun('DELETE FROM games WHERE game_id = ? AND save_id < ? AND save_id > 0', [gameId, maxSaveId])
      .then(() => {
        return this.asyncRun('DELETE FROM completed_game where game_id = ?', [gameId]);
      });
  }

  async saveGame(game: IGame): Promise<void> {
    const gameJSON = JSON.stringify(game.serialize());

    // This app has a bad habit of re-saving the same state. It hasn't been fully cleaned, but OK.
    // If this is the first time we're saving the game, then store the participants. No need
    // to store them again.
    const isFirstSave = game.lastSaveId === 0 &&
      await this.asyncGet('SELECT 1 FROM games WHERE game_id = ? AND save_id = 0', [game.id]) === undefined;

    // Insert
    await this.runQuietly(
      'INSERT INTO games (game_id, save_id, game, players) VALUES (?, ?, ?, ?) ON CONFLICT (game_id, save_id) DO UPDATE SET game = ?',
      [game.id, game.lastSaveId, gameJSON, game.players.length, gameJSON]);

    if (isFirstSave) {
      const participantIds: Array<ParticipantId> = game.players.map(toID);
      if (game.spectatorId) {
        participantIds.push(game.spectatorId);
      }
      try {
        await this.storeParticipants({gameId: game.id, participantIds: participantIds});
      } catch (e) {
        console.error(e);
      }
    }

    // This must occur after the save.
    game.lastSaveId++;
  }

  deleteGameNbrSaves(gameId: GameId, rollbackCount: number): Promise<void> {
    if (rollbackCount <= 0) {
      console.error(`invalid rollback count for ${gameId}: ${rollbackCount}`);
      // Should this be an error?
      return Promise.resolve();
    }
    return this.runQuietly('DELETE FROM games WHERE rowid IN (SELECT rowid FROM games WHERE game_id = ? ORDER BY save_id DESC LIMIT ?)', [gameId, rollbackCount]);
  }

  public stats(): Promise<{[key: string]: string | number}> {
    const size = this.filename === IN_MEMORY_SQLITE_PATH ? -1 : fs.statSync(String(this.filename)).size;

    return Promise.resolve({
      type: 'SQLite',
      path: String(this.filename),
      size_bytes: size,
    });
  }

  public async storeParticipants(entry: GameIdLedger): Promise<void> {
    // Sequence of '(?, ?)' pairs.
    const placeholders = entry.participantIds.map(() => '(?, ?)').join(', ');
    // Sequence of [game_id, id] pairs.
    const values: Array<GameId | ParticipantId> = entry.participantIds.map((participant) => [entry.gameId, participant]).flat();

    await this.asyncRun('INSERT INTO participants (game_id, participant) VALUES ' + placeholders + ' ON CONFLICT (game_id, participant) DO NOTHING', values);
  }

  public async getParticipants(): Promise<Array<GameIdLedger>> {
    const rows = await this.asyncAll('SELECT game_id, participant FROM participants');
    const multimap = new MultiMap<GameId, ParticipantId>();
    rows.forEach((row) => multimap.set(row.game_id, row.participant));
    const result: Array<GameIdLedger> = [];
    multimap.forEachAssociation((participantIds, gameId) => {
      result.push({gameId, participantIds});
    });
    return result;
  }

  public async createSession(session: Session): Promise<void> {
    await this.asyncRun('INSERT INTO session (session_id, data, expiration_time) VALUES(?, ?, ?)', [session.id, JSON.stringify(session.data), session.expirationTimeMillis / 1000]);
  }

  public async deleteSession(sessionId: SessionId): Promise<void> {
    await this.asyncRun('DELETE FROM session where session_id = ?', [sessionId]);
  }

  async getSessions(): Promise<Array<Session>> {
    const selectResult = await this.asyncAll('SELECT session_id, data, expiration_time FROM session where expiration_time > ?', [Date.now() / 1000]);
    return selectResult.map((row) => {
      return {
        id: row.session_id,
        data: JSON.parse(row.data),
        expirationTimeMillis: row.expiration_time * 1000,
      };
    });
  }

  public async createPlayerProfile(profile: PlayerProfile): Promise<void> {
    await this.asyncRun(
      'INSERT INTO player_profile (profile_id, discord_id, data, created_time, updated_time) VALUES (?, ?, ?, ?, ?)',
      [profile.id, profile.discordId, JSON.stringify(profile), profile.createdAt, profile.updatedAt]);
  }

  public async getPlayerProfile(profileId: PlayerProfileId): Promise<PlayerProfile | undefined> {
    const row = await this.asyncGet('SELECT data FROM player_profile WHERE profile_id = ?', [profileId]);
    return row === undefined ? undefined : JSON.parse(row.data) as PlayerProfile;
  }

  public async getPlayerProfileByDiscordId(discordId: string): Promise<PlayerProfile | undefined> {
    const row = await this.asyncGet('SELECT data FROM player_profile WHERE discord_id = ?', [discordId]);
    return row === undefined ? undefined : JSON.parse(row.data) as PlayerProfile;
  }

  public async listPlayerProfiles(): Promise<Array<PlayerProfile>> {
    const rows = await this.asyncAll('SELECT data FROM player_profile ORDER BY updated_time DESC');
    return rows.map((row) => JSON.parse(row.data) as PlayerProfile);
  }

  public async savePlayerProfile(profile: PlayerProfile): Promise<void> {
    const result = await this.asyncRun(
      'UPDATE player_profile SET discord_id = ?, data = ?, updated_time = ? WHERE profile_id = ?',
      [profile.discordId, JSON.stringify(profile), profile.updatedAt, profile.id]);
    if (result.changes === 0) {
      throw new Error(`Player profile ${profile.id} not found`);
    }
  }

  public async claimPlayer(claim: PlayerClaim): Promise<void> {
    const existing = await this.getPlayerClaim(claim.participantId);
    if (existing !== undefined && existing.profileId !== claim.profileId) {
      throw new Error('This player has already been claimed by another profile');
    }
    await this.asyncRun(
      `INSERT INTO player_claim (participant_id, game_id, profile_id, claimed_time)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (participant_id) DO UPDATE SET profile_id = excluded.profile_id, claimed_time = excluded.claimed_time`,
      [claim.participantId, claim.gameId, claim.profileId, claim.claimedAt]);
  }

  public async unclaimPlayer(participantId: ParticipantId, profileId: PlayerProfileId): Promise<boolean> {
    const result = await this.asyncRun(
      'DELETE FROM player_claim WHERE participant_id = ? AND profile_id = ?',
      [participantId, profileId]);
    return result.changes > 0;
  }

  public async getPlayerClaim(participantId: ParticipantId): Promise<PlayerClaim | undefined> {
    const row = await this.asyncGet(
      'SELECT participant_id, game_id, profile_id, claimed_time FROM player_claim WHERE participant_id = ?',
      [participantId]);
    if (row === undefined) {
      return undefined;
    }
    return {
      participantId: row.participant_id,
      gameId: row.game_id,
      profileId: row.profile_id,
      claimedAt: typeof row.claimed_time === 'number' ? new Date(row.claimed_time).toISOString() : String(row.claimed_time),
    };
  }

  public async listPlayerClaims(profileId: PlayerProfileId): Promise<Array<PlayerClaim>> {
    const rows = await this.asyncAll(
      'SELECT participant_id, game_id, profile_id, claimed_time FROM player_claim WHERE profile_id = ? ORDER BY claimed_time DESC',
      [profileId]);
    return rows.map((row) => ({
      participantId: row.participant_id,
      gameId: row.game_id,
      profileId: row.profile_id,
      claimedAt: typeof row.claimed_time === 'number' ? new Date(row.claimed_time).toISOString() : String(row.claimed_time),
    }));
  }

  public async listCompletedGameResults(): Promise<Array<CompletedGameResult>> {
    const rows = await this.asyncAll(
      'SELECT game_id, generations, game_options, scores, completed_time FROM game_results ORDER BY completed_time DESC');
    return rows.map((row) => ({
      gameId: row.game_id,
      generations: row.generations,
      completedAt: row.completed_time === null ? '' : new Date(Number(row.completed_time)).toISOString(),
      gameOptions: JSON.parse(row.game_options),
      scores: JSON.parse(row.scores),
    }));
  }

  public async createLegacyCampaign(campaign: LegacyCampaign): Promise<void> {
    await this.asyncRun(
      'INSERT INTO legacy_campaign (campaign_id, data, created_time, updated_time) VALUES (?, ?, ?, ?)',
      [campaign.id, JSON.stringify(campaign), campaign.createdAt, campaign.updatedAt]);
  }

  public async getLegacyCampaign(campaignId: LegacyCampaignId): Promise<LegacyCampaign | undefined> {
    const row = await this.asyncGet('SELECT data FROM legacy_campaign WHERE campaign_id = ?', [campaignId]);
    return row === undefined ? undefined : JSON.parse(row.data) as LegacyCampaign;
  }

  public async listLegacyCampaigns(): Promise<Array<LegacyCampaign>> {
    const rows = await this.asyncAll('SELECT data FROM legacy_campaign ORDER BY updated_time DESC, created_time DESC');
    return rows.map((row) => JSON.parse(row.data) as LegacyCampaign);
  }

  public async saveLegacyCampaign(campaign: LegacyCampaign): Promise<void> {
    const result = await this.asyncRun(
      `UPDATE legacy_campaign
       SET data = ?, updated_time = ?
       WHERE campaign_id = ?`,
      [JSON.stringify(campaign), campaign.updatedAt, campaign.id]);
    if (result.changes === 0) {
      throw new Error(`Legacy campaign ${campaign.id} not found`);
    }
  }

  protected asyncRun(sql: string, params?: any): Promise<BetterSqlite3.RunResult> {
    try {
      const stmt = this.db.prepare(sql);
      const result = params !== undefined ? stmt.run(params) : stmt.run();
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  protected asyncGet(sql: string, params?: any): Promise<any> {
    try {
      const stmt = this.db.prepare(sql);
      const row = params !== undefined ? stmt.get(params) : stmt.get();
      return Promise.resolve(row);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  protected asyncAll(sql: string, params?: any): Promise<Array<any>> {
    try {
      const stmt = this.db.prepare(sql);
      const rows = params !== undefined ? stmt.all(params) : stmt.all();
      return Promise.resolve(rows as Array<any>);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Run the given SQL but do not return errors.
  protected async runQuietly(sql: string, params: any): Promise<void> {
    try {
      await this.asyncRun(sql, params);
    } catch (err) {
      console.error(err);
      console.error('for sql: ' + sql);
      if (this.throwQuietFailures) {
        throw err;
      }
    }
  }
}

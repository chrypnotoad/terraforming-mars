import fs from 'fs';
import os from 'os';
import path from 'path';
import {expect} from 'chai';
import BetterSqlite3 = require('better-sqlite3');
import {backupSqliteDatabase} from '../../../src/server/tools/backup_sqlite';

describe('backupSqliteDatabase', () => {
  let temporaryDirectory: string;
  let sourcePath: string;
  let backupDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mars-legacy-backup-'));
    sourcePath = path.join(temporaryDirectory, 'game.db');
    backupDirectory = path.join(temporaryDirectory, 'backups');

    const database = new BetterSqlite3(sourcePath);
    database.exec('CREATE TABLE sample (value TEXT NOT NULL)');
    database.close();
  });

  afterEach(async () => {
    await fs.promises.rm(temporaryDirectory, {recursive: true, force: true});
  });

  it('creates restorable backups and retains seven daily and four weekly copies', async () => {
    for (let week = 0; week < 10; week++) {
      const database = new BetterSqlite3(sourcePath);
      database.prepare('INSERT INTO sample (value) VALUES (?)').run(`week-${week}`);
      database.close();

      await backupSqliteDatabase({
        sourcePath,
        backupDirectory,
        now: new Date(2026, 0, 4 + (week * 7), 3, 15),
      });
    }

    const filenames = (await fs.promises.readdir(backupDirectory)).sort();
    expect(filenames.filter((filename) => filename.startsWith('game-daily-'))).length(7);
    expect(filenames.filter((filename) => filename.startsWith('game-weekly-'))).length(4);

    const dailyFilenames = filenames.filter((filename) => filename.startsWith('game-daily-'));
    const newestDaily = dailyFilenames[dailyFilenames.length - 1];
    expect(newestDaily).not.eq(undefined);
    const restored = new BetterSqlite3(path.join(backupDirectory, newestDaily!));
    try {
      expect(restored.pragma('integrity_check', {simple: true})).eq('ok');
      expect(restored.prepare('SELECT value FROM sample ORDER BY rowid').all()).deep.eq(
        Array.from({length: 10}, (_value, index) => ({value: `week-${index}`})),
      );
    } finally {
      restored.close();
    }
  });
});

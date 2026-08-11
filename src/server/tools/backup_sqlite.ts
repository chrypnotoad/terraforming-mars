import fs from 'fs';
import os from 'os';
import path from 'path';
import BetterSqlite3 = require('better-sqlite3');

export type BackupSqliteOptions = {
  sourcePath?: string;
  backupDirectory?: string;
  dailyKeep?: number;
  weeklyKeep?: number;
  now?: Date;
};

export type BackupSqliteResult = {
  dailyPath: string;
  weeklyPath?: string;
};

const DEFAULT_DAILY_KEEP = 7;
const DEFAULT_WEEKLY_KEEP = 4;

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertIntegrity(filename: string): void {
  const database = new BetterSqlite3(filename, {readonly: true});
  try {
    const result = database.pragma('integrity_check', {simple: true});
    if (result !== 'ok') {
      throw new Error(`SQLite integrity check failed for ${filename}: ${String(result)}`);
    }
  } finally {
    database.close();
  }
}

async function prune(directory: string, prefix: string, keep: number): Promise<void> {
  const filenames = (await fs.promises.readdir(directory))
    .filter((filename) => filename.startsWith(prefix) && filename.endsWith('.db'))
    .sort()
    .reverse();

  await Promise.all(filenames.slice(keep).map((filename) => fs.promises.unlink(path.join(directory, filename))));
}

async function publishBackup(sourcePath: string, destinationPath: string): Promise<void> {
  const temporaryPath = `${destinationPath}.tmp-${process.pid}`;
  const source = new BetterSqlite3(sourcePath, {readonly: true, fileMustExist: true});
  try {
    await source.backup(temporaryPath);
    assertIntegrity(temporaryPath);
    await fs.promises.chmod(temporaryPath, 0o600);
    await fs.promises.rename(temporaryPath, destinationPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, {force: true});
    throw error;
  } finally {
    source.close();
  }
}

export async function backupSqliteDatabase(options: BackupSqliteOptions = {}): Promise<BackupSqliteResult> {
  const sourcePath = path.resolve(options.sourcePath ?? process.env.SQLITE_BACKUP_SOURCE ?? path.join(process.cwd(), 'db/game.db'));
  const backupDirectory = path.resolve(options.backupDirectory ?? process.env.SQLITE_BACKUP_DIR ?? path.join(os.homedir(), 'Library/Application Support/Terraforming Mars Legacy/backups'));
  const dailyKeep = options.dailyKeep ?? positiveInteger(process.env.SQLITE_BACKUP_DAILY_KEEP, DEFAULT_DAILY_KEEP);
  const weeklyKeep = options.weeklyKeep ?? positiveInteger(process.env.SQLITE_BACKUP_WEEKLY_KEEP, DEFAULT_WEEKLY_KEEP);
  const now = options.now ?? new Date();

  await fs.promises.mkdir(backupDirectory, {recursive: true, mode: 0o700});
  await fs.promises.chmod(backupDirectory, 0o700);

  const dailyPath = path.join(backupDirectory, `game-daily-${dateKey(now)}.db`);
  await publishBackup(sourcePath, dailyPath);

  let weeklyPath: string | undefined;
  if (now.getDay() === 0) {
    weeklyPath = path.join(backupDirectory, `game-weekly-${dateKey(now)}.db`);
    await publishBackup(sourcePath, weeklyPath);
  }

  await prune(backupDirectory, 'game-daily-', dailyKeep);
  await prune(backupDirectory, 'game-weekly-', weeklyKeep);

  return {dailyPath, weeklyPath};
}

if (require.main === module) {
  backupSqliteDatabase()
    .then((result) => {
      const paths = [result.dailyPath, result.weeklyPath].filter((filename) => filename !== undefined);
      console.log(`SQLite backup complete: ${paths.join(', ')}`);
    })
    .catch((error) => {
      console.error('SQLite backup failed:', error);
      process.exitCode = 1;
    });
}

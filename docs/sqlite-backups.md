# SQLite backup and restore

The Mac mini keeps ordinary games and Legacy campaign records together in
`db/game.db`. A user LaunchAgent runs the compiled backup tool every day at
03:15 local time and once when the job is first loaded.

Backups are written outside the repository to:

`~/Library/Application Support/Terraforming Mars Legacy/backups`

The backup tool uses SQLite's online backup API, runs `PRAGMA integrity_check`
before publishing each file, and retains:

- seven daily backups named `game-daily-YYYY-MM-DD.db`;
- four Sunday backups named `game-weekly-YYYY-MM-DD.db`.

Run an additional backup manually from the repository with:

```sh
npm run backup:sqlite
```

## Restore

Restoring replaces the live database, so first stop only the application
LaunchAgent. The Cloudflare Tunnel can remain running.

```sh
uid="$(id -u)"
app_plist="$HOME/Library/LaunchAgents/com.chrypnotoad.terraforming-mars-legacy.plist"
backup="$HOME/Library/Application Support/Terraforming Mars Legacy/backups/game-daily-YYYY-MM-DD.db"

launchctl bootout "gui/$uid" "$app_plist"
sqlite3 "$backup" 'PRAGMA integrity_check;'
cp -p db/game.db "db/game.db.before-restore-$(date +%Y%m%d-%H%M%S)"
cp -p "$backup" db/game.db
launchctl bootstrap "gui/$uid" "$app_plist"
```

Replace `YYYY-MM-DD` with the selected backup. Proceed only when the integrity
check prints `ok`. After restoration, confirm the local and public routes:

```sh
curl --fail http://127.0.0.1:8080/
curl --fail https://mars.chrypnotoad.com/
```

The `db/game.db.before-restore-*` copy is the immediate rollback. Stop the app,
copy it back over `db/game.db`, and bootstrap the app LaunchAgent again if the
restored backup is not the intended one.

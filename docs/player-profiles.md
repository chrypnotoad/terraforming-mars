# Optional player profiles

Profiles are optional. Hosts can still type arbitrary names, create a game,
and share player links without anybody signing in. A signed-in friend can claim
their player link so the nickname, corporation, result, and future statistics
are associated with one durable profile.

## Discord application setup

Discord is used only as an OAuth identity provider. The application requests
the `identify` scope; it does not use a bot, join a server, or read channels.

1. Create an application at <https://discord.com/developers/applications>.
2. Under OAuth2, add this exact redirect URI:
   `https://mars.chrypnotoad.com/auth/discord/callback`
3. Copy the Application ID (client ID) and generate a client secret.
4. On the Mac mini, open the ignored, owner-readable `.env` file and add:

   ```dotenv
   DISCORD_CLIENT_ID=the-application-id
   DISCORD_CLIENT_SECRET=the-client-secret
   ```

   Do not paste the client secret into a Codex task, commit it, or put it in a
   shell command that will be saved in history. Editing `.env` interactively is
   preferred. Keep its permissions at `600`.

5. Regenerate public settings, build, and restart only the application agent:

   ```sh
   npm run make:json
   npm run build:server
   npm run build:client
   launchctl kickstart -k "gui/$(id -u)/com.chrypnotoad.terraforming-mars-legacy"
   ```

6. Visit `https://mars.chrypnotoad.com/profile`, sign in, and confirm Discord
   returns to the profile page.

`URL_ROOT=https://mars.chrypnotoad.com` and `SESSION_DURATION=720H` are already
configured on the Mac mini. OAuth uses a short-lived, HTTP-only state cookie to
protect the callback, and profile sessions use secure HTTP-only cookies.

## Avatar and result storage

The browser resizes custom avatars to at most 256 pixels before upload. The
server accepts only PNG, JPEG, or WebP payloads up to 512 KB. Profile records,
avatars, player claims, and participant-level results live in `db/game.db`, so
the existing daily SQLite backup and restore procedure covers them.

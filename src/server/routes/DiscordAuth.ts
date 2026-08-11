import {paths} from '../../common/app/paths';
import {DEFAULT_URL_ROOT} from '../../common/constants';
import {Database} from '../database/Database';
import {ProfileService} from '../profiles/ProfileService';
import {Request} from '../Request';
import {Response} from '../Response';
import {oauthClaimCookieName, oauthStateCookieName, extractCookie, sessionIdCookieName} from '../server/auth/authcookies';
import {getDiscordUser} from '../server/auth/discord';
import {SESSION_EXPIRATION_TIME_MS} from '../server/auth/SessionManager';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';

/** Receives the authentication response from Discord. */
export class DiscordAuth extends Handler {
  public static readonly INSTANCE = new DiscordAuth();

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const code = ctx.url.searchParams.get('code');
    const state = ctx.url.searchParams.get('state');
    const expectedState = extractCookie(req, oauthStateCookieName);
    const claim = extractCookie(req, oauthClaimCookieName);
    if (code === null || state === null || expectedState === undefined || state !== expectedState) {
      responses.badRequest(req, res, 'Invalid or expired Discord login state');
      return;
    }
    responses.clearCookie(res, oauthStateCookieName);
    if (claim !== undefined) {
      responses.clearCookie(res, oauthClaimCookieName);
    }
    const urlRoot = process.env.URL_ROOT || DEFAULT_URL_ROOT;
    const discordUser = await getDiscordUser(code, `${urlRoot}/${paths.AUTH_DISCORD_CALLBACK}`);
    await new ProfileService(Database.getInstance()).getOrCreate(discordUser, new Date(ctx.clock.now()));
    const sessionId = await ctx.sessionManager.create(discordUser);
    responses.setCookie(res, sessionIdCookieName, sessionId, Math.floor(SESSION_EXPIRATION_TIME_MS / 1000));
    const destination = claim === undefined ? `/${paths.PROFILE}` : `/${paths.PROFILE}?claim=${encodeURIComponent(claim)}`;
    responses.redirect(res, destination);
  }
}

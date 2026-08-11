import {randomBytes} from 'crypto';
import {paths} from '../../common/app/paths';
import {DEFAULT_URL_ROOT} from '../../common/constants';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {oauthClaimCookieName, oauthStateCookieName} from '../server/auth/authcookies';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';

export class DiscordAuthStart extends Handler {
  public static readonly INSTANCE = new DiscordAuthStart();

  public override get(req: Request, res: Response, ctx: Context): Promise<void> {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (clientId === undefined || process.env.DISCORD_CLIENT_SECRET === undefined) {
      responses.notFound(req, res, 'Discord login is not configured');
      return Promise.resolve();
    }
    const state = randomBytes(32).toString('hex');
    const urlRoot = process.env.URL_ROOT || DEFAULT_URL_ROOT;
    const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'identify');
    authorizeUrl.searchParams.set('redirect_uri', `${urlRoot}/${paths.AUTH_DISCORD_CALLBACK}`);
    authorizeUrl.searchParams.set('state', state);
    responses.setCookie(res, oauthStateCookieName, state, 600, 'Lax');
    const claim = ctx.url.searchParams.get('claim');
    if (claim !== null && isPlayerId(claim)) {
      responses.setCookie(res, oauthClaimCookieName, claim, 600, 'Lax');
    }
    responses.redirect(res, authorizeUrl.toString());
    return Promise.resolve();
  }
}

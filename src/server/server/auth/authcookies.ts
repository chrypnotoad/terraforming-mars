import {Request} from '../../Request';

export const sessionIdCookieName = 'sessionId';
export const oauthStateCookieName = 'oauthState';
export const oauthClaimCookieName = 'oauthClaim';

export function extractCookie(req: Request, cookieName: string): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    for (const cookie of cookieHeader.split(';')) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName) {
        return value;
      }
    }
  }
  return undefined;
}

export function extract(req: Request): string | undefined {
  return extractCookie(req, sessionIdCookieName);
}

import {expect} from 'chai';
import {statusCode} from '../../src/common/http/statusCode';
import {DiscordAuth} from '../../src/server/routes/DiscordAuth';
import {DiscordAuthStart} from '../../src/server/routes/DiscordAuthStart';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('Discord OAuth flow', () => {
  const originalClientId = process.env.DISCORD_CLIENT_ID;
  const originalClientSecret = process.env.DISCORD_CLIENT_SECRET;
  const originalUrlRoot = process.env.URL_ROOT;

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('DISCORD_CLIENT_ID', originalClientId);
    restore('DISCORD_CLIENT_SECRET', originalClientSecret);
    restore('URL_ROOT', originalUrlRoot);
  });

  it('starts identify-only OAuth without a bot or guild scope', async () => {
    process.env.DISCORD_CLIENT_ID = 'client-123';
    process.env.DISCORD_CLIENT_SECRET = 'secret';
    process.env.URL_ROOT = 'https://mars.example.com';
    const scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/auth/discord/start?claim=p-rick';
    const response = new MockResponse();
    await DiscordAuthStart.INSTANCE.get(scaffolding.req, response, scaffolding.ctx);

    expect(response.statusCode).eq(statusCode.found);
    const location = new URL(String(response.headers.get('Location')));
    expect(location.searchParams.get('scope')).eq('identify');
    expect(location.searchParams.get('scope')).not.contains('bot');
    expect(location.searchParams.get('redirect_uri')).eq('https://mars.example.com/auth/discord/callback');
    expect(String(response.headers.get('Set-Cookie'))).contains('oauthState=');
  });

  it('rejects a callback without a matching state before contacting Discord', async () => {
    const scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/auth/discord/callback?code=code&state=wrong';
    const response = new MockResponse();
    await DiscordAuth.INSTANCE.get(scaffolding.req, response, scaffolding.ctx);
    expect(response.statusCode).eq(statusCode.badRequest);
    expect(response.content).contains('Invalid or expired Discord login state');
  });
});

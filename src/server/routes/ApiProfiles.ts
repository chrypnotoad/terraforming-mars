import {PlayerProfileSummary} from '../../common/profile/PlayerProfile';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {Request} from '../Request';
import {Response} from '../Response';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';

export class ApiProfiles extends Handler {
  public static readonly INSTANCE = new ApiProfiles();

  public constructor(private database: IDatabase = Database.getInstance()) {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    if (ctx.user === undefined) {
      responses.notAuthorized(req, res);
      return;
    }
    const profiles = await this.database.listPlayerProfiles();
    const summaries: Array<PlayerProfileSummary> = profiles
      .map((profile) => ({
        id: profile.id,
        displayName: profile.displayName,
        discordUsername: profile.discordUsername,
        avatarUrl: profile.customAvatarDataUrl ?? profile.discordAvatarUrl,
        preferredColor: profile.preferredColor,
        isCurrentUser: profile.discordId === ctx.user?.id,
      }))
      .sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.displayName.localeCompare(b.displayName));
    responses.writeJson(res, ctx, summaries);
  }
}

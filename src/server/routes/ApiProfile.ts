import {PlayerProfile} from '../../common/profile/PlayerProfile';
import {PLAYER_COLORS} from '../../common/Color';
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {ProfileService, MAX_AVATAR_DATA_URL_LENGTH, MAX_PROFILE_NAME_LENGTH} from '../profiles/ProfileService';
import {Request} from '../Request';
import {Response} from '../Response';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {readJsonRequest, RequestBodyError} from './RequestBody';

const MAX_AVATAR_BYTES = 512 * 1024;

type UpdateProfileRequest = {
  displayName?: unknown;
  customAvatarDataUrl?: unknown;
  preferredColor?: unknown;
};

function validateAvatar(value: unknown): string | undefined {
  if (value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > MAX_AVATAR_DATA_URL_LENGTH) {
    throw new RequestBodyError('Avatar is too large');
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (match === null) {
    throw new RequestBodyError('Avatar must be a PNG, JPEG, or WebP image');
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) {
    throw new RequestBodyError('Avatar must be no larger than 512 KB');
  }
  const mimeType = match[1];
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if ((mimeType === 'image/png' && !isPng) || (mimeType === 'image/jpeg' && !isJpeg) || (mimeType === 'image/webp' && !isWebp)) {
    throw new RequestBodyError('Avatar contents do not match its image type');
  }
  return value;
}

export class ApiProfile extends Handler {
  public static readonly INSTANCE = new ApiProfile();
  private readonly profileService: ProfileService;

  public constructor(private database: IDatabase = Database.getInstance()) {
    super();
    this.profileService = new ProfileService(database);
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    if (ctx.user === undefined) {
      responses.notAuthorized(req, res);
      return;
    }
    const profile = await this.profileService.getOrCreate(ctx.user, new Date(ctx.clock.now()));
    responses.writeJson(res, ctx, await this.profileService.getResponse(profile));
  }

  public override async put(req: Request, res: Response, ctx: Context): Promise<void> {
    if (ctx.user === undefined) {
      responses.notAuthorized(req, res);
      return;
    }
    try {
      const request = await readJsonRequest(req, MAX_AVATAR_DATA_URL_LENGTH + 1024) as UpdateProfileRequest;
      const profile = await this.profileService.getOrCreate(ctx.user, new Date(ctx.clock.now()));
      const updated: PlayerProfile = {...profile, updatedAt: new Date(ctx.clock.now()).toISOString()};
      if (request.displayName !== undefined) {
        if (typeof request.displayName !== 'string') {
          throw new RequestBodyError('Display name must be text');
        }
        const displayName = request.displayName.trim();
        if (displayName.length === 0 || displayName.length > MAX_PROFILE_NAME_LENGTH) {
          throw new RequestBodyError(`Display name must be between 1 and ${MAX_PROFILE_NAME_LENGTH} characters`);
        }
        updated.displayName = displayName;
      }
      if (request.customAvatarDataUrl !== undefined) {
        updated.customAvatarDataUrl = validateAvatar(request.customAvatarDataUrl);
      }
      if (request.preferredColor !== undefined) {
        if (request.preferredColor === null || request.preferredColor === '') {
          updated.preferredColor = undefined;
        } else if (typeof request.preferredColor === 'string' && PLAYER_COLORS.includes(request.preferredColor as typeof PLAYER_COLORS[number])) {
          updated.preferredColor = request.preferredColor as typeof PLAYER_COLORS[number];
        } else {
          throw new RequestBodyError('Preferred color is invalid');
        }
      }
      await this.database.savePlayerProfile(updated);
      responses.writeJson(res, ctx, await this.profileService.getResponse(updated));
    } catch (error) {
      if (error instanceof RequestBodyError) {
        responses.badRequest(req, res, error.message);
        return;
      }
      throw error;
    }
  }
}

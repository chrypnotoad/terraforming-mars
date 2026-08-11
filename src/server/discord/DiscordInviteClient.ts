import {SimpleGameModel} from '../../common/models/SimpleGameModel';

export interface DiscordInviteResult {
  messageId: string;
}

export interface IDiscordInviteClient {
  postGame(channelId: string, game: SimpleGameModel, gameUrl: string, postedBy: string): Promise<DiscordInviteResult>;
}

export class DiscordInviteClient implements IDiscordInviteClient {
  public constructor(private readonly botToken: string) {}

  public async postGame(channelId: string, game: SimpleGameModel, gameUrl: string, postedBy: string): Promise<DiscordInviteResult> {
    const players = game.players.map((player) => player.name).join(' · ');
    const response = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MarsChrypnotoad (https://mars.chrypnotoad.com, 1.0)',
      },
      body: JSON.stringify({
        content: `**${game.name}** is ready to join.`,
        embeds: [{
          title: 'Terraforming Mars game',
          description: players,
          url: gameUrl,
          color: 0xc86839,
          footer: {text: `Posted by ${postedBy}`},
        }],
        components: [{
          type: 1,
          components: [{type: 2, style: 5, label: 'Open game', url: gameUrl}],
        }],
        allowed_mentions: {parse: []},
        nonce: game.id,
        enforce_nonce: true,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Discord rejected the invite (${response.status}): ${detail}`);
    }
    const result = await response.json() as {id?: unknown};
    if (typeof result.id !== 'string') {
      throw new Error('Discord did not return a message ID');
    }
    return {messageId: result.id};
  }
}

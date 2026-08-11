import {DiscordGameCardSnapshot} from './DiscordGameCard';

export interface DiscordInviteResult {
  messageId: string;
}

export interface IDiscordInviteClient {
  postGame(channelId: string, snapshot: DiscordGameCardSnapshot, gameUrl: string, image: Buffer): Promise<DiscordInviteResult>;
  updateGame(channelId: string, messageId: string, snapshot: DiscordGameCardSnapshot, gameUrl: string, image: Buffer): Promise<void>;
}

export class DiscordInviteError extends Error {
  public constructor(public readonly status: number, detail: string) {
    super(`Discord rejected the game card (${status}): ${detail}`);
  }
}

export class DiscordInviteClient implements IDiscordInviteClient {
  public constructor(private readonly botToken: string) {}

  public async postGame(channelId: string, snapshot: DiscordGameCardSnapshot, gameUrl: string, image: Buffer): Promise<DiscordInviteResult> {
    const response = await this.send(
      `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
      'POST', snapshot, gameUrl, image, true);
    const result = await response.json() as {id?: unknown};
    if (typeof result.id !== 'string') {
      throw new Error('Discord did not return a message ID');
    }
    return {messageId: result.id};
  }

  public async updateGame(channelId: string, messageId: string, snapshot: DiscordGameCardSnapshot, gameUrl: string, image: Buffer): Promise<void> {
    await this.send(
      `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
      'PATCH', snapshot, gameUrl, image, false);
  }

  private async send(url: string, method: 'POST' | 'PATCH', snapshot: DiscordGameCardSnapshot, gameUrl: string, image: Buffer, create: boolean): Promise<Response> {
    const form = new FormData();
    const payload = messagePayload(snapshot, gameUrl, create);
    form.append('payload_json', JSON.stringify(payload));
    form.append('files[0]', new Blob([Uint8Array.from(image)], {type: 'image/png'}), 'mars-game-card.png');
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'User-Agent': 'MarsChrypnotoad (https://mars.chrypnotoad.com, 1.0)',
      },
      body: form,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new DiscordInviteError(response.status, detail);
    }
    return response;
  }
}

function messagePayload(snapshot: DiscordGameCardSnapshot, gameUrl: string, create: boolean): Record<string, unknown> {
  const status = snapshot.status === 'complete' ? 'Final results' : snapshot.status === 'active' ? `Generation ${snapshot.generation}` : 'Lobby open';
  const playerSummary = snapshot.players.map((player) => {
    const result = snapshot.status === 'complete' ? ` — #${player.rank ?? '—'}, ${player.score ?? '—'} VP` : '';
    return `${colorEmoji(player.color)} **${escapeMarkdown(player.name)}**${player.corporation ? ` · ${escapeMarkdown(player.corporation)}` : ''}${result}`;
  }).join('\n');
  return {
    content: snapshot.status === 'complete' ?
      `🏆 **${escapeMarkdown(snapshot.gameName)}** has finished!` :
      `🪐 **${escapeMarkdown(snapshot.gameName)}** is ready on Mars Chrypnotoad.`,
    embeds: [{
      title: `${status} · Terraforming Mars`,
      description: playerSummary,
      url: gameUrl,
      color: 0xc86839,
      image: {url: 'attachment://mars-game-card.png'},
      footer: {text: `Game ${snapshot.gameId} · Posted by ${snapshot.postedBy}`},
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1,
      components: [{type: 2, style: 5, label: snapshot.status === 'complete' ? 'View final game' : 'Open game', emoji: {name: '🚀'}, url: gameUrl}],
    }],
    attachments: [{id: 0, filename: 'mars-game-card.png', description: `${snapshot.gameName} game card`}],
    allowed_mentions: {parse: []},
    ...(create ? {nonce: snapshot.gameId, enforce_nonce: true} : {}),
  };
}

function colorEmoji(color: string): string {
  return ({red: '🟥', green: '🟩', yellow: '🟨', blue: '🟦', black: '⬛', purple: '🟪', orange: '🟧', pink: '🩷'} as Record<string, string>)[color] ?? '⬜';
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, '\\$1');
}

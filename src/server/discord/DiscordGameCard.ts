import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {Resvg} from '@resvg/resvg-js';
import {Color} from '../../common/Color';
import {MODULE_NAMES} from '../../common/cards/GameModule';
import {Phase} from '../../common/Phase';
import {IGame} from '../IGame';
import {IDatabase} from '../database/IDatabase';
import {isICorporationCard} from '../cards/corporation/ICorporationCard';

export type DiscordGameCardStatus = 'lobby' | 'active' | 'complete';

export interface DiscordGameCardPlayer {
  name: string;
  color: Color;
  corporation?: string;
  avatar?: string;
  score?: number;
  rank?: number;
}

export interface DiscordGameCardSnapshot {
  gameId: string;
  gameName: string;
  status: DiscordGameCardStatus;
  generation: number;
  board: string;
  expansions: Array<string>;
  temperature: number;
  oxygen: number;
  oceans: number;
  players: Array<DiscordGameCardPlayer>;
  postedBy: string;
  postedByAvatar?: string;
}

export interface IDiscordGameCardRenderer {
  render(snapshot: DiscordGameCardSnapshot): Promise<Buffer>;
}

// Bump whenever artwork/layout changes so already-posted games refresh too.
const DISCORD_GAME_CARD_RENDER_VERSION = 2;

const COLOR_HEX: Record<Color, string> = {
  red: '#ef4444', green: '#22c55e', yellow: '#facc15', blue: '#3b82f6', black: '#6b7280',
  purple: '#a855f7', orange: '#f97316', pink: '#ec4899', neutral: '#d1d5db', bronze: '#b7791f',
};

export async function buildDiscordGameCardSnapshot(game: IGame, database: IDatabase, postedBy: string, postedByAvatar?: string): Promise<DiscordGameCardSnapshot> {
  const players: Array<DiscordGameCardPlayer> = [];
  const completedScores = game.phase === Phase.END ? game.players.map((player) => ({player, score: player.getVictoryPoints().total})) : [];
  for (const player of game.playersInGenerationOrder) {
    const claim = await database.getPlayerClaim(player.id);
    const profile = claim === undefined ? undefined : await database.getPlayerProfile(claim.profileId);
    const corporation = player.playedCards.filter(isICorporationCard).map((card) => card.name).join(' / ') || undefined;
    const completed = completedScores.find((row) => row.player.id === player.id);
    const score = completed?.score;
    const rank = score === undefined ? undefined : 1 + completedScores.filter((row) =>
      row.score > score || row.score === score && row.player.megaCredits > player.megaCredits).length;
    players.push({
      name: player.name,
      color: player.color,
      corporation,
      avatar: profile?.customAvatarDataUrl ?? profile?.discordAvatarUrl,
      score,
      rank,
    });
  }
  const hasCorporations = players.every((player) => player.corporation !== undefined);
  const status: DiscordGameCardStatus = game.phase === Phase.END ? 'complete' : hasCorporations ? 'active' : 'lobby';
  const expansions = Object.entries(game.gameOptions.expansions)
    .filter(([, enabled]) => enabled)
    .map(([name]) => MODULE_NAMES[name as keyof typeof MODULE_NAMES])
    .filter((name) => name !== 'Corporate Era');
  return {
    gameId: game.id,
    gameName: game.name,
    status,
    generation: game.generation,
    board: titleCase(game.gameOptions.boardName),
    expansions,
    temperature: game.getTemperature(),
    oxygen: game.getOxygenLevel(),
    oceans: game.board.getOceanSpaces().length,
    players,
    postedBy,
    postedByAvatar,
  };
}

export function discordGameCardSnapshotHash(snapshot: DiscordGameCardSnapshot): string {
  return crypto.createHash('sha256').update(`${DISCORD_GAME_CARD_RENDER_VERSION}:${JSON.stringify(snapshot)}`).digest('hex');
}

export class DiscordGameCardRenderer implements IDiscordGameCardRenderer {
  private readonly backgroundDataUrl: string;
  private readonly fontFiles: Array<string>;

  public constructor(assetRoot: string = process.cwd()) {
    this.backgroundDataUrl = `data:image/png;base64,${fs.readFileSync(path.resolve(assetRoot, 'assets/discord-game-card-background.png')).toString('base64')}`;
    this.fontFiles = [path.resolve(assetRoot, 'assets/futureforces.ttf'), path.resolve(assetRoot, 'assets/Prototype.ttf')];
  }

  public async render(snapshot: DiscordGameCardSnapshot): Promise<Buffer> {
    const avatars = await Promise.all(snapshot.players.map((player) => loadAvatar(player.avatar)));
    const svg = this.svg(snapshot, avatars);
    return Buffer.from(new Resvg(svg, {
      fitTo: {mode: 'width', value: 1200},
      font: {fontFiles: this.fontFiles, loadSystemFonts: false},
    }).render().asPng());
  }

  private svg(snapshot: DiscordGameCardSnapshot, avatars: Array<string | undefined>): string {
    const twoColumns = snapshot.players.length > 4;
    const rowsPerColumn = twoColumns ? Math.ceil(snapshot.players.length / 2) : snapshot.players.length;
    const playerRows = snapshot.players.map((player, index) => {
      const column = twoColumns ? Math.floor(index / rowsPerColumn) : 0;
      const row = twoColumns ? index % rowsPerColumn : index;
      const x = twoColumns ? 64 + column * 570 : 92;
      const y = 220 + row * 94;
      const avatarX = x + 35;
      const textX = x + 86;
      const scoreX = twoColumns ? x + 520 : 1090;
      const avatar = avatars[index];
      const name = escapeXml(truncate(player.name, twoColumns ? 20 : 32));
      const detail = escapeXml(truncate(player.corporation ?? (snapshot.status === 'lobby' ? 'Choosing corporation' : 'Corporation unknown'), twoColumns ? 26 : 42));
      const score = snapshot.status === 'complete' ? `<text x="${scoreX}" y="${y + 8}" text-anchor="end" class="score">#${player.rank ?? '—'} · ${player.score ?? '—'} VP</text>` : '';
      const avatarMarkup = avatar === undefined ?
        `<circle cx="${avatarX}" cy="${y}" r="32" fill="#121722"/><text x="${avatarX}" y="${y + 10}" text-anchor="middle" class="initial">${escapeXml(initials(player.name))}</text>` :
        `<defs><clipPath id="avatar-${index}"><circle cx="${avatarX}" cy="${y}" r="32"/></clipPath></defs><image href="${avatar}" x="${avatarX - 32}" y="${y - 32}" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-${index})"/>`;
      return `${avatarMarkup}<circle cx="${avatarX}" cy="${y}" r="36" fill="none" stroke="${COLOR_HEX[player.color]}" stroke-width="7"/>
        <text x="${textX}" y="${y - 3}" class="player-name">${name}</text><text x="${textX}" y="${y + 27}" class="player-detail">${detail}</text>${score}`;
    }).join('');
    const statusLabel = snapshot.status === 'complete' ? 'FINAL RESULTS' : snapshot.status === 'active' ? 'PLAYERS &amp; CORPORATIONS' : 'GAME ROSTER';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <style>
        @font-face{font-family:Future;src:url('${this.fontFiles[0]}')} @font-face{font-family:Prototype;src:url('${this.fontFiles[1]}')}
        text{font-family:Prototype, sans-serif;fill:#f8fafc}.brand{font-family:Future;font-size:18px;letter-spacing:4px;fill:#f4a45c}.title{font-family:Future;font-size:43px;fill:white}.status{font-size:20px;letter-spacing:3px;fill:#7dd3fc}.player-name{font-size:35px}.player-detail{font-size:24px;fill:#b9c4d4}.score{font-size:24px;fill:#ffd28f}.initial{font-size:23px;font-weight:bold}.footer{font-size:15px;fill:#98a4b5}
      </style>
      <image href="${this.backgroundDataUrl}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
      <rect x="0" y="0" width="1200" height="630" fill="url(#shade)"/><defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05070b" stop-opacity=".95"/><stop offset=".75" stop-color="#05070b" stop-opacity=".82"/><stop offset="1" stop-color="#05070b" stop-opacity=".55"/></linearGradient></defs>
      <text x="64" y="48" class="brand">MARS CHRYPNOTOAD</text><text x="64" y="103" class="title">${escapeXml(truncate(snapshot.gameName, 39))}</text>
      <text x="66" y="145" class="status">${statusLabel}</text><line x1="65" y1="168" x2="1135" y2="168" stroke="#c86839" stroke-width="2" opacity=".8"/>${playerRows}
      <text x="65" y="596" class="footer">GAME ${escapeXml(snapshot.gameId.toUpperCase())}</text><text x="1135" y="596" text-anchor="end" class="footer">TERRAFORM MARS. CLAIM THE FUTURE.</text>
    </svg>`;
  }
}

async function loadAvatar(value?: string): Promise<string | undefined> {
  if (value === undefined) {
    return undefined;
  }
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 800_000) {
    return value;
  }
  try {
    const url = new URL(value);
    if (!['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) {
      return undefined;
    }
    const response = await fetch(url, {signal: AbortSignal.timeout(3_000)});
    if (!response.ok) {
      return undefined;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^image\/(png|jpeg|webp)/.test(contentType)) {
      return undefined;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 800_000) {
      return undefined;
    }
    return `data:${contentType.split(';')[0]};base64,${bytes.toString('base64')}`;
  } catch (_error) {
    return undefined;
  }
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(1, length - 1))}…`;
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function escapeXml(value: string): string {
  const entities: Record<string, string> = {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'};
  return value.replace(/[<>&"']/g, (character) => entities[character] ?? character);
}

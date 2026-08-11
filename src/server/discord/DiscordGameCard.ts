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
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
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
    const posterAvatar = await loadAvatar(snapshot.postedByAvatar);
    const svg = this.svg(snapshot, avatars, posterAvatar);
    return Buffer.from(new Resvg(svg, {
      fitTo: {mode: 'width', value: 1200},
      font: {fontFiles: this.fontFiles, loadSystemFonts: false},
    }).render().asPng());
  }

  private svg(snapshot: DiscordGameCardSnapshot, avatars: Array<string | undefined>, posterAvatar?: string): string {
    const playerRows = snapshot.players.map((player, index) => {
      const y = 276 + index * 62;
      const avatar = avatars[index];
      const name = escapeXml(truncate(player.name, 24));
      const detail = escapeXml(truncate(player.corporation ?? (snapshot.status === 'lobby' ? 'Choosing corporation' : 'Corporation unknown'), 30));
      const score = snapshot.status === 'complete' ? `<text x="710" y="${y + 8}" text-anchor="end" class="score">#${player.rank ?? '—'}  ${player.score ?? '—'} VP</text>` : '';
      const avatarMarkup = avatar === undefined ?
        `<circle cx="93" cy="${y}" r="24" fill="#121722"/><text x="93" y="${y + 8}" text-anchor="middle" class="initial">${escapeXml(initials(player.name))}</text>` :
        `<defs><clipPath id="avatar-${index}"><circle cx="93" cy="${y}" r="24"/></clipPath></defs><image href="${avatar}" x="69" y="${y - 24}" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-${index})"/>`;
      return `${avatarMarkup}<circle cx="93" cy="${y}" r="27" fill="none" stroke="${COLOR_HEX[player.color]}" stroke-width="5"/>
        <text x="135" y="${y - 2}" class="player-name">${name}</text><text x="135" y="${y + 21}" class="player-detail">${detail}</text>${score}`;
    }).join('');
    const statusLabel = snapshot.status === 'complete' ? 'FINAL RESULTS' : snapshot.status === 'active' ? `IN PROGRESS  ·  GENERATION ${snapshot.generation}` : 'LOBBY OPEN';
    const expansionText = snapshot.expansions.length === 0 ? 'Base game' : snapshot.expansions.join(' · ');
    const poster = posterAvatar === undefined ?
      '' :
      `<defs><clipPath id="poster"><circle cx="1090" cy="71" r="21"/></clipPath></defs><image href="${posterAvatar}" x="1069" y="50" width="42" height="42" preserveAspectRatio="xMidYMid slice" clip-path="url(#poster)"/>`;
    const winner = snapshot.status === 'complete' ? snapshot.players.find((player) => player.rank === 1) : undefined;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <style>
        @font-face{font-family:Future;src:url('${this.fontFiles[0]}')} @font-face{font-family:Prototype;src:url('${this.fontFiles[1]}')}
        text{font-family:Prototype, sans-serif;fill:#f8fafc}.brand{font-family:Future;font-size:20px;letter-spacing:4px;fill:#f4a45c}.title{font-family:Future;font-size:47px;fill:white}.status{font-size:18px;letter-spacing:3px;fill:#7dd3fc}.player-name{font-size:23px}.player-detail{font-size:16px;fill:#aeb8c7}.score{font-size:22px;fill:#f6ad55}.initial{font-size:19px;font-weight:bold}.meta-label{font-size:14px;letter-spacing:2px;fill:#8b98aa}.meta{font-size:23px}.footer{font-size:14px;fill:#98a4b5}.winner{font-size:18px;fill:#ffd28f}
      </style>
      <image href="${this.backgroundDataUrl}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
      <rect x="0" y="0" width="1200" height="630" fill="url(#shade)"/><defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05070b" stop-opacity=".93"/><stop offset=".68" stop-color="#05070b" stop-opacity=".62"/><stop offset="1" stop-color="#05070b" stop-opacity=".25"/></linearGradient></defs>
      <text x="64" y="57" class="brand">MARS CHRYPNOTOAD</text><text x="64" y="117" class="title">${escapeXml(truncate(snapshot.gameName, 34))}</text>
      <text x="66" y="159" class="status">${statusLabel}</text>${winner === undefined ? '' : `<text x="66" y="194" class="winner">★ ${escapeXml(truncate(winner.name, 28))} wins Mars</text>`}
      <line x1="65" y1="214" x2="730" y2="214" stroke="#c86839" stroke-width="2" opacity=".8"/>${playerRows}
      <rect x="774" y="222" width="360" height="257" rx="18" fill="#080b11" fill-opacity=".78" stroke="#e17a3e" stroke-opacity=".45"/>
      <text x="808" y="265" class="meta-label">BOARD</text><text x="808" y="296" class="meta">${escapeXml(truncate(snapshot.board, 25))}</text>
      <text x="808" y="345" class="meta-label">EXPANSIONS</text><text x="808" y="376" class="meta">${escapeXml(truncate(expansionText, 29))}</text>
      <text x="808" y="425" class="meta-label">MARS</text><text x="808" y="456" class="meta">${snapshot.temperature}°C  ·  ${snapshot.oxygen}% O2  ·  ${snapshot.oceans}/9 oceans</text>
      ${poster}<text x="1127" y="67" text-anchor="end" class="footer">Posted by</text><text x="1127" y="87" text-anchor="end" class="footer">${escapeXml(truncate(snapshot.postedBy, 22))}</text>
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

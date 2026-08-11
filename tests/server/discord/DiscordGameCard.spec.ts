import {expect} from 'chai';
import {Phase} from '../../../src/common/Phase';
import {buildDiscordGameCardSnapshot, DiscordGameCardRenderer, discordGameCardSnapshotHash} from '../../../src/server/discord/DiscordGameCard';
import {testGame} from '../../TestGame';
import {InMemoryDatabase} from '../../testing/InMemoryDatabase';

describe('DiscordGameCard', () => {
  it('builds lobby and final snapshots from live game state', async () => {
    const database = new InMemoryDatabase();
    const [game] = testGame(2);

    const lobby = await buildDiscordGameCardSnapshot(game, database, 'Chris');
    expect(lobby.status).eq('lobby');
    expect(lobby.players.map((player) => player.name)).deep.eq(['player1', 'player2']);
    expect(lobby.players.every((player) => player.score === undefined)).eq(true);

    game.phase = Phase.END;
    const complete = await buildDiscordGameCardSnapshot(game, database, 'Chris');
    expect(complete.status).eq('complete');
    expect(complete.players.every((player) => player.score !== undefined && player.rank !== undefined)).eq(true);
    expect(discordGameCardSnapshotHash(complete)).not.eq(discordGameCardSnapshotHash(lobby));
  });

  it('renders a Discord-ready 1200 by 630 PNG', async () => {
    const renderer = new DiscordGameCardRenderer();
    const image = await renderer.render({
      gameId: 'gpreview',
      gameName: 'The Tuesday Mars League',
      status: 'active',
      generation: 7,
      board: 'Tharsis',
      expansions: ['Prelude', 'Venus Next', 'Colonies'],
      temperature: -8,
      oxygen: 8,
      oceans: 5,
      postedBy: 'chrypnotoad',
      players: [
        {name: 'Rock', color: 'green', corporation: 'Helion'},
        {name: 'Chrus', color: 'purple', corporation: 'Tharsis Republic'},
        {name: 'The Martian Formerly Known as Dan', color: 'orange', corporation: 'Credicor'},
      ],
    });

    expect(image.subarray(0, 8).toString('hex')).eq('89504e470d0a1a0a');
    expect(image.readUInt32BE(16)).eq(1200);
    expect(image.readUInt32BE(20)).eq(630);
    expect(image.length).greaterThan(50_000);
  });
});

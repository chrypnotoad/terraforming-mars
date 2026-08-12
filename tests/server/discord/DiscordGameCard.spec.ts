import {expect} from 'chai';
import {Phase} from '../../../src/common/Phase';
import {buildDiscordGameCardSnapshot, DiscordGameCardRenderer, discordGameCardSnapshotHash} from '../../../src/server/discord/DiscordGameCard';
import {discordGameMessagePayload} from '../../../src/server/discord/DiscordInviteClient';
import {Helion} from '../../../src/server/cards/corporation/Helion';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
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

    game.players[0]?.playedCards.push(new Helion());
    game.players[1]?.playedCards.push(new TharsisRepublic());
    const active = await buildDiscordGameCardSnapshot(game, database, 'Chris');
    expect(active.status).eq('active');
    expect(active.players[0]?.corporationCards?.[0]).deep.include({name: 'Helion', startingMegaCredits: 42, cardNumber: 'R18'});

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
        {name: 'Rock', color: 'green', corporation: 'Helion', corporationCards: [{name: 'Helion', startingMegaCredits: 42, tags: ['space'], cardNumber: 'R18', description: 'You start with 3 heat production and 42 M€. You may use heat as M€.'}]},
        {name: 'Chrus', color: 'purple', corporation: 'Tharsis Republic', corporationCards: [{name: 'Tharsis Republic', startingMegaCredits: 40, tags: ['building'], cardNumber: 'R31', description: 'You start with 40 M€. Place a city tile. When any city tile is placed on Mars, increase your M€ production.'}]},
        {name: 'The Martian Formerly Known as Dan', color: 'orange', corporation: 'Credicor', corporationCards: [{name: 'Credicor', startingMegaCredits: 57, tags: ['earth'], cardNumber: 'R04', description: 'You start with 57 M€. After you pay for a card or standard project with a basic cost of 20 M€ or more, gain 4 M€.'}]},
      ],
    });

    expect(image.subarray(0, 8).toString('hex')).eq('89504e470d0a1a0a');
    expect(image.readUInt32BE(16)).eq(1200);
    expect(image.readUInt32BE(20)).eq(630);
    expect(image.length).greaterThan(50_000);
  });

  it('keeps detailed game statistics in native Discord text', () => {
    const payload = discordGameMessagePayload({
      gameId: 'gpreview', gameName: 'Tuesday Mars', status: 'active', generation: 7,
      board: 'Tharsis', expansions: ['Prelude', 'Colonies'], temperature: -8,
      oxygen: 8, oceans: 5, postedBy: 'Chris',
      players: [{name: 'Rock', color: 'green', corporation: 'Helion'}],
    }, 'https://mars.example/game?id=gpreview', true);
    const embed = (payload.embeds as Array<{fields: Array<{name: string; value: string}>}>)[0];

    expect(embed?.fields[0]?.value).contains('**Board:** Tharsis');
    expect(embed?.fields[0]?.value).contains('**Expansions:** Prelude, Colonies');
    expect(embed?.fields[1]?.value).contains('**Generation:** 7');
    expect(embed?.fields[1]?.value).contains('**Temperature:** -8°C');
    expect(embed?.fields[1]?.value).contains('**Oxygen:** 8%');
    expect(embed?.fields[1]?.value).contains('**Oceans:** 5/9');
  });
});

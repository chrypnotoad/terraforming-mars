import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameHome from '@/client/components/GameHome.vue';
import {fakeGameOptionsModel} from './testHelpers';
import {Phase} from '@/common/Phase';

describe('GameHome', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameHome, {
      ...globalConfig,
      props: {
        game: {
          activePlayer: 'blue',
          id: 'game-id-123',
          phase: Phase.ACTION,
          players: [{color: 'blue', id: 'p-blue', name: 'Blue'}],
          spectatorId: undefined,
          gameOptions: fakeGameOptionsModel(),
          lastSoloGeneration: 14,
          expectedPurgeTimeMs: 0,
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('posts the existing shared game URL through the Discord endpoint', async () => {
    const originalFetch = global.fetch;
    let requestBody = '';
    const fakeFetch: typeof global.fetch = async (_input, init) => {
      requestBody = String(init?.body);
      return {ok: true, status: 200, json: async () => ({messageUrl: 'https://discord.com/channels/1/2/3'})} as Awaited<ReturnType<typeof global.fetch>>;
    };
    global.fetch = fakeFetch;
    try {
      const wrapper = shallowMount(GameHome, {
        ...globalConfig,
        props: {
          game: {
            activePlayer: 'blue',
            id: 'g123',
            name: 'Friday Mars',
            phase: Phase.ACTION,
            players: [{color: 'blue', id: 'p-blue', name: 'Blue'}],
            spectatorId: undefined,
            gameOptions: fakeGameOptionsModel(),
            lastSoloGeneration: 14,
            expectedPurgeTimeMs: 0,
          },
        },
      });

      await (wrapper.vm as unknown as {postToDiscord(): Promise<void>}).postToDiscord();

      expect(JSON.parse(requestBody)).deep.eq({gameId: 'g123'});
      expect(wrapper.vm.discordPostMessage).eq('Posted to Discord.');
      expect(wrapper.vm.discordMessageUrl).eq('https://discord.com/channels/1/2/3');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import LegacyCampaignHome from '@/client/components/legacy/LegacyCampaignHome.vue';
import {globalConfig} from '../getLocalVue';

describe('LegacyCampaignHome', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the campaign picker', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        campaigns: [{
          id: 'c123',
          name: 'Friday Night Mars',
          status: 'planning',
          currentMission: 1,
          playerNames: ['Chris', 'Taylor'],
          completedMissions: 0,
          createdAt: '2026-08-08T00:00:00.000Z',
          updatedAt: '2026-08-08T00:00:00.000Z',
        }],
      }),
    })) as typeof fetch;

    const wrapper = shallowMount(LegacyCampaignHome, {...globalConfig});
    await flushPromises();

    expect(wrapper.text()).contains('Choose a campaign');
    expect(wrapper.text()).contains('Friday Night Mars');
    expect(wrapper.text()).contains('Chris · Taylor');
  });
});

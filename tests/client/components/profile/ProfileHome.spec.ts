import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import ProfileHome from '@/client/components/profile/ProfileHome.vue';
import {globalConfig} from '../getLocalVue';

describe('ProfileHome', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps account-free play available when signed out', async () => {
    global.fetch = (() => Promise.resolve({ok: false, status: 403})) as typeof fetch;
    const wrapper = shallowMount(ProfileHome, {...globalConfig});
    await flushPromises();
    expect(wrapper.text()).contains('Play without an account');
    expect(wrapper.text()).contains('Signing in is optional');
    expect((wrapper.vm as any).formatPercent(0.5)).eq('50%');
    expect((wrapper.vm as any).formatScore(93.5)).eq('93.5');
  });
});

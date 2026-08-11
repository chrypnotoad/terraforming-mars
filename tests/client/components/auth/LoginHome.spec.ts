import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import LoginHome from '@/client/components/auth/LoginHome.vue';

describe('LoginHome', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    (global as any).fetch = () => Promise.resolve({ok: false, statusText: 'stubbed'});
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  function mount(discordClientId: string) {
    return shallowMount(LoginHome, {
      ...globalConfig,
      data() {
        return {discordClientId};
      },
    });
  }

  it('mounts without errors', () => {
    const wrapper = mount('');
    expect(wrapper.exists()).to.be.true;
  });

  it('loginUrl is empty when discordClientId is not set', () => {
    const wrapper = mount('');
    expect((wrapper.vm as any).loginUrl).to.equal('');
  });

  it('loginUrl starts the server-side OAuth flow when discordClientId is set', () => {
    const wrapper = mount('test-client-id');
    expect((wrapper.vm as any).loginUrl).to.equal('/auth/discord/start');
  });
});

import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import StartScreen from '@/client/components/StartScreen.vue';
import {LEGACY_EXPECTED_DELIVERY} from '@/common/legacy/LegacyCampaign';

describe('StartScreen', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(StartScreen, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
    expect(wrapper.get('.start-screen-link--legacy').text()).contains(LEGACY_EXPECTED_DELIVERY);
  });
});

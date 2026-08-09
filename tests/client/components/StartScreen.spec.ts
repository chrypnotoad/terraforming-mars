import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import StartScreen from '@/client/components/StartScreen.vue';

describe('StartScreen', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(StartScreen, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
    expect(wrapper.find('.start-screen-link--legacy').exists()).to.be.false;
    expect(wrapper.get('.start-screen-link--new-game').text()).contains('Standard & Legacy');
  });
});

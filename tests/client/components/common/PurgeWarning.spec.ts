import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';

describe('PurgeWarning', () => {
  it('shows the configured purge deadline', () => {
    const wrapper = shallowMount(PurgeWarning, {
      ...globalConfig,
      props: {
        expectedPurgeTimeMs: Date.now() + 86400000,
      },
    });
    expect(wrapper.text()).contains('Warning: This game will be purged');
  });

  it('is hidden when games are retained indefinitely', () => {
    const wrapper = shallowMount(PurgeWarning, {
      ...globalConfig,
      props: {
        expectedPurgeTimeMs: 0,
      },
    });
    expect(wrapper.text()).eq('');
  });
});

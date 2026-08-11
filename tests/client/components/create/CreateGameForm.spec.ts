import {mount, shallowMount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import CreateGameForm from '@/client/components/create/CreateGameForm.vue';
import {CreateGameSettingsStorage} from '@/client/components/create/CreateGameSettingsStorage';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {BoardName} from '@/common/boards/BoardName';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {JSONObject} from '@/common/Types';
import {defineComponent} from 'vue';
import {LEGACY_EXPECTED_DELIVERY} from '@/common/legacy/LegacyCampaign';
import {PlayerProfileSummary} from '@/common/profile/PlayerProfile';

// Minimal serialized Create Game payload used by settings restore tests.
function createGameSettings(overrides: JSONObject = {}): JSONObject {
  return {
    players: [
      {name: 'Alice', color: 'red', beginner: false, handicap: 0},
      {name: 'Bob', color: 'blue', beginner: false, handicap: 0},
    ],
    expansions: DEFAULT_EXPANSIONS,
    board: BoardName.HELLAS,
    draftVariant: false,
    solarPhaseOption: true,
    ...overrides,
  };
}

describe('CreateGameForm', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
    expect(wrapper.get('.game-type-card--selected').text()).contains('Standard game');
    expect(wrapper.get('.game-type-card--legacy').attributes('href')).eq('/legacy');
    expect(wrapper.get('.game-type-card--legacy').text()).contains(LEGACY_EXPECTED_DELIVERY);
  });

  it('restores the last saved game settings on load', async () => {
    new CreateGameSettingsStorage(localStorage).saveSettings(createGameSettings({
      expansions: {...DEFAULT_EXPANSIONS, venus: true},
    }));

    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playersCount).eq(2);
    expect((wrapper.vm as any).players[0].name).eq('Alice');
    expect((wrapper.vm as any).players[1].name).eq('Bob');
    expect((wrapper.vm as any).board).eq(BoardName.HELLAS);
    expect((wrapper.vm as any).draftVariant).eq(false);
    expect((wrapper.vm as any).expansions.venus).eq(true);
    expect((wrapper.vm as any).solarPhaseOption).eq(true);
  });

  it('shows warnings when restoring saved settings', async () => {
    const alerts: Array<{title: string, message: string}> = [];
    const Root = defineComponent({
      components: {
        CreateGameForm,
      },
      template: '<CreateGameForm ref="form" />',
    });
    const wrapper = mount(Root, {
      ...globalConfig,
    });
    const form = wrapper.findComponent(CreateGameForm);
    (form.vm.$root as any).showAlert = (title: string, message: string) => {
      alerts.push({title, message});
    };

    new CreateGameSettingsStorage(localStorage).saveSettings(createGameSettings({
      customPreludes: ['Bad Prelude Name'],
    }));

    (form.vm as any).restoreLastSettings();
    await form.vm.$nextTick();

    expect(alerts).deep.eq([{
      title: 'Restore settings',
      message: "Settings loaded with these warnings: \nUnknown card name 'Bad Prelude Name' in customPreludes",
    }]);
  });

  it('resets the form and clears saved settings', async () => {
    const settingsStorage = new CreateGameSettingsStorage(localStorage);
    settingsStorage.saveSettings(createGameSettings());

    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).board).eq(BoardName.HELLAS);

    (wrapper.vm as any).resetSettings();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).board).eq(BoardName.THARSIS);
    expect((wrapper.vm as any).draftVariant).eq(true);
    expect(settingsStorage.loadSettings()).eq(undefined);
    expect(wrapper.findAllComponents({name: 'AppButton'}).map((button) => button.props('title'))).includes('Reset');
  });

  it('clears uploading when applying settings throws', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });

    expect(() => (wrapper.vm as any).applySettings(createGameSettings({
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 0},
        {name: 'Bob', color: 'red', beginner: false, handicap: 0},
      ],
    }))).throws('Colors are duplicated');
    expect((wrapper.vm as any).uploading).eq(false);
  });

  it('saves current settings before creating a game', async () => {
    const originalFetch = global.fetch;
    const originalAlert = global.alert;
    global.fetch = (() => Promise.reject(new Error('stop after saving'))) as typeof fetch;
    global.alert = (() => {}) as typeof alert;

    try {
      const wrapper = shallowMount(CreateGameForm, {
        ...globalConfig,
      });
      (wrapper.vm as any).playersCount = 2;
      (wrapper.vm as any).randomFirstPlayer = false;
      (wrapper.vm as any).players[0].name = 'Alice';
      (wrapper.vm as any).players[1].name = 'Bob';
      (wrapper.vm as any).board = BoardName.ELYSIUM;

      await (wrapper.vm as any).createGame();

      const savedSettings = new CreateGameSettingsStorage(localStorage).loadSettings();
      expect(savedSettings?.board).eq(BoardName.ELYSIUM);
      expect((savedSettings?.players as Array<{name: string}>).map((player) => player.name)).deep.eq(['Alice', 'Bob']);
    } finally {
      global.fetch = originalFetch;
      global.alert = originalAlert;
    }
  });

  it('selects profiles without automatically adding the signed-in creator', async () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    const profiles: Array<PlayerProfileSummary> = [
      {id: 'u2', displayName: 'Beth', discordUsername: 'beth', preferredColor: 'green', isCurrentUser: false},
      {id: 'u1', displayName: 'Rick', discordUsername: 'rick', avatarUrl: 'data:image/png;base64,avatar', preferredColor: 'red', isCurrentUser: true},
    ];
    (wrapper.vm as any).profileDirectory = profiles;
    (wrapper.vm as any).playersCount = 2;

    expect((wrapper.vm as any).players[0].profileId).eq(undefined);
    expect((wrapper.vm as any).filteredProfiles(0)[0].id).eq('u1');

    (wrapper.vm as any).selectProfile(1, profiles[1]);
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).players[1]).deep.include({name: 'Rick', profileId: 'u1', color: 'green'});
    expect(wrapper.find('.create-game-player-avatar').attributes('src')).eq(profiles[1].avatarUrl);
    expect(wrapper.find('.create-game-player-avatar').classes()).includes('create-game-profile-color-red');
    expect(wrapper.text()).not.contains('prefers red');
  });

  it('keeps a linked profile when its game nickname changes', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    const profile: PlayerProfileSummary = {id: 'u1', displayName: 'Rick', discordUsername: 'rick', isCurrentUser: true};
    (wrapper.vm as any).profileDirectory = [profile];
    (wrapper.vm as any).selectProfile(0, profile);
    (wrapper.vm as any).players[0].name = 'Rock';
    expect((wrapper.vm as any).players[0].profileId).eq('u1');
  });
});

<template>
  <main class="legacy-home">
    <header class="legacy-header">
      <a class="back-link" href="/new-game">← New game</a>
      <div>
        <p class="eyebrow">Terraforming Mars</p>
        <h1>Legacy campaigns</h1>
        <p class="subtitle">Long-term campaign state, stored between missions on this server.</p>
        <p class="release-subtitle">
          Official game estimated {{ expectedDelivery }}
          <span aria-hidden="true">·</span>
          <a :href="gamefoundUrl" target="_blank" rel="noopener noreferrer">Follow on Gamefound ↗</a>
        </p>
      </div>
    </header>

    <div v-if="loading" class="panel message">Loading campaigns…</div>
    <div v-else-if="error" class="panel message error-message">
      <p>{{ error }}</p>
      <button type="button" class="secondary-button" @click="loadCampaigns">Try again</button>
    </div>

    <section v-else-if="selectedCampaign !== undefined" class="campaign-detail">
      <button type="button" class="text-button" @click="closeCampaign">← All campaigns</button>
      <div class="panel detail-heading">
        <div>
          <p class="eyebrow">Mission {{ selectedCampaign.currentMission }} of {{ missionCount }}</p>
          <h2>{{ selectedCampaign.name }}</h2>
          <p class="campaign-meta">{{ selectedCampaign.players.length }} players · {{ selectedCampaign.status }}</p>
        </div>
        <div class="mission-progress" aria-label="Campaign mission progress">
          <span
            v-for="mission in missionCount"
            :key="mission"
            class="mission-dot"
            :class="{
              complete: mission < selectedCampaign.currentMission,
              current: mission === selectedCampaign.currentMission,
            }"
          >{{ mission }}</span>
        </div>
      </div>

      <div class="detail-grid">
        <section class="panel">
          <h3>Campaign roster</h3>
          <ul class="player-list">
            <li v-for="player in selectedCampaign.players" :key="player.id">
              <div>
                <strong>{{ player.name }}</strong>
                <span>{{ player.corporation || 'Corporation not chosen' }}</span>
              </div>
              <div class="player-score">
                <strong>{{ player.titlePoints }}</strong>
                <span>title points</span>
              </div>
            </li>
          </ul>
        </section>

        <section class="panel mission-panel">
          <p class="eyebrow">Next up</p>
          <h3>Mission {{ selectedCampaign.currentMission }}</h3>
          <p>The campaign and roster are ready. Mission gameplay stays locked until the official board, briefing, cards, milestones, and awards are available.</p>
          <button type="button" class="primary-button" disabled>Official game estimated {{ expectedDelivery }}</button>
        </section>
      </div>

      <section class="panel history-panel">
        <h3>Mission history</h3>
        <p v-if="selectedCampaign.missionHistory.length === 0" class="empty-state">No missions have been completed yet.</p>
        <ol v-else>
          <li v-for="record in selectedCampaign.missionHistory" :key="record.mission">
            Mission {{ record.mission }} · completed {{ formatDate(record.completedAt) }}
          </li>
        </ol>
      </section>
    </section>

    <template v-else>
      <section class="campaign-toolbar">
        <div>
          <h2>Choose a campaign</h2>
          <p>Each group gets its own permanent roster and progress.</p>
        </div>
        <button v-if="!creatingCampaign" type="button" class="primary-button" @click="beginCreate">New campaign</button>
      </section>

      <section v-if="creatingCampaign" class="panel create-panel">
        <div class="create-heading">
          <div>
            <p class="eyebrow">New campaign</p>
            <h2>Name your expedition</h2>
          </div>
          <button type="button" class="text-button" @click="cancelCreate">Cancel</button>
        </div>

        <label class="field-label" for="campaign-name">Campaign name</label>
        <input id="campaign-name" v-model="newCampaignName" class="text-input" maxlength="80" placeholder="Friday Night Mars" autocomplete="off">

        <div class="roster-heading">
          <div>
            <h3>Players</h3>
            <p>Names can be tied to corporations and mission results later.</p>
          </div>
          <button type="button" class="secondary-button" :disabled="newPlayers.length >= 5" @click="addPlayer">Add player</button>
        </div>

        <div v-for="(player, index) in newPlayers" :key="index" class="player-input-row">
          <label :for="`player-${index}`">Player {{ index + 1 }}</label>
          <div class="player-field">
            <img v-if="selectedProfile(player)?.avatarUrl" :src="selectedProfile(player)?.avatarUrl" alt="" class="player-avatar">
            <input :id="`player-${index}`" v-model="player.name" class="text-input" maxlength="40" :placeholder="`Player ${index + 1} name`" autocomplete="off" @input="unlinkPlayer(player)">
            <button v-if="newPlayers.length > 1" type="button" class="remove-button" :aria-label="`Remove player ${index + 1}`" @click="removePlayer(index)">×</button>
          </div>
          <div v-if="profileMatches(player, index).length > 0" class="profile-options">
            <button v-for="profile in profileMatches(player, index)" :key="profile.id" type="button" @click="selectPlayerProfile(player, profile)">
              <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="">
              <span><strong>{{ profile.displayName }}<template v-if="profile.isCurrentUser"> (You)</template></strong><small>@{{ profile.discordUsername }}</small></span>
            </button>
          </div>
          <p v-if="selectedProfile(player)" class="linked-profile">Linked to {{ selectedProfile(player)?.displayName }}’s profile</p>
        </div>

        <p v-if="createError" class="form-error">{{ createError }}</p>
        <button type="button" class="primary-button create-button" :disabled="savingCampaign" @click="createCampaign">
          {{ savingCampaign ? 'Creating…' : 'Create campaign' }}
        </button>
      </section>

      <section v-else-if="campaigns.length === 0" class="panel empty-campaigns">
        <h3>No campaigns yet</h3>
        <p>Create one for your group. It will remain here when everyone closes their browser.</p>
        <button type="button" class="primary-button" @click="beginCreate">Create the first campaign</button>
      </section>

      <section v-else class="campaign-list">
        <button
          v-for="campaign in campaigns"
          :key="campaign.id"
          type="button"
          class="campaign-card"
          @click="selectCampaign(campaign.id)"
        >
          <div class="campaign-card-topline">
            <span class="mission-label">Mission {{ campaign.currentMission }} of {{ missionCount }}</span>
            <span class="status-label">{{ campaign.status }}</span>
          </div>
          <h3>{{ campaign.name }}</h3>
          <p>{{ campaign.playerNames.join(' · ') }}</p>
          <div class="campaign-card-footer">
            <span>{{ campaign.completedMissions }} missions complete</span>
            <span>Open →</span>
          </div>
        </button>
      </section>
    </template>
  </main>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {
  LEGACY_CAMPAIGN_MISSION_COUNT,
  LEGACY_EXPECTED_DELIVERY,
  LEGACY_GAMEFOUND_URL,
  LegacyCampaign,
  LegacyCampaignId,
  LegacyCampaignSummary,
} from '@/common/legacy/LegacyCampaign';
import {PlayerProfileId, PlayerProfileSummary} from '@/common/profile/PlayerProfile';

type CampaignListResponse = {campaigns: Array<LegacyCampaignSummary>};
type NewCampaignPlayer = {name: string; profileId?: PlayerProfileId};

export default defineComponent({
  name: 'LegacyCampaignHome',
  data() {
    return {
      campaigns: [] as Array<LegacyCampaignSummary>,
      selectedCampaign: undefined as LegacyCampaign | undefined,
      loading: true,
      error: '',
      creatingCampaign: false,
      savingCampaign: false,
      createError: '',
      newCampaignName: '',
      newPlayers: [{name: ''}, {name: ''}] as Array<NewCampaignPlayer>,
      profileDirectory: [] as Array<PlayerProfileSummary>,
      missionCount: LEGACY_CAMPAIGN_MISSION_COUNT,
      expectedDelivery: LEGACY_EXPECTED_DELIVERY,
      gamefoundUrl: LEGACY_GAMEFOUND_URL,
    };
  },
  methods: {
    async loadCampaigns(): Promise<void> {
      this.loading = true;
      this.error = '';
      try {
        const response = await fetch(`/${paths.API_LEGACY_CAMPAIGNS}`);
        if (!response.ok) {
          throw new Error('The campaign list could not be loaded.');
        }
        const result = await response.json() as CampaignListResponse;
        this.campaigns = result.campaigns;
        const campaignId = new URLSearchParams(window.location.search).get('id');
        if (campaignId !== null) {
          await this.selectCampaign(campaignId as LegacyCampaignId, false);
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'The campaign list could not be loaded.';
      } finally {
        this.loading = false;
      }
    },
    async loadProfileDirectory(): Promise<void> {
      try {
        const response = await fetch(`/${paths.API_PROFILES}`);
        if (response.ok) {
          this.profileDirectory = await response.json() as Array<PlayerProfileSummary>;
        }
      } catch (_error) {
        // Profiles remain optional; campaign names can always be entered manually.
      }
    },
    selectedProfile(player: NewCampaignPlayer): PlayerProfileSummary | undefined {
      return this.profileDirectory.find((profile) => profile.id === player.profileId);
    },
    profileMatches(player: NewCampaignPlayer, index: number): Array<PlayerProfileSummary> {
      if (player.profileId !== undefined || player.name.trim().length < 1) {
        return [];
      }
      const query = player.name.trim().toLocaleLowerCase();
      const selectedIds = new Set(this.newPlayers.filter((_item, itemIndex) => itemIndex !== index).map((item) => item.profileId));
      return this.profileDirectory
        .filter((profile) => !selectedIds.has(profile.id))
        .filter((profile) => profile.displayName.toLocaleLowerCase().includes(query) || profile.discordUsername.toLocaleLowerCase().includes(query))
        .sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.displayName.localeCompare(b.displayName))
        .slice(0, 5);
    },
    selectPlayerProfile(player: NewCampaignPlayer, profile: PlayerProfileSummary): void {
      player.name = profile.displayName;
      player.profileId = profile.id;
    },
    unlinkPlayer(player: NewCampaignPlayer): void {
      delete player.profileId;
    },
    async selectCampaign(campaignId: LegacyCampaignId, updateUrl: boolean = true): Promise<void> {
      this.loading = true;
      this.error = '';
      try {
        const response = await fetch(`/${paths.API_LEGACY_CAMPAIGNS}?id=${encodeURIComponent(campaignId)}`);
        if (!response.ok) {
          throw new Error('That campaign could not be loaded.');
        }
        this.selectedCampaign = await response.json() as LegacyCampaign;
        if (updateUrl) {
          window.history.pushState({}, this.selectedCampaign.name, `/${paths.LEGACY_CAMPAIGNS}?id=${campaignId}`);
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'That campaign could not be loaded.';
      } finally {
        this.loading = false;
      }
    },
    closeCampaign(): void {
      this.selectedCampaign = undefined;
      window.history.pushState({}, 'Legacy campaigns', `/${paths.LEGACY_CAMPAIGNS}`);
    },
    beginCreate(): void {
      this.creatingCampaign = true;
      this.createError = '';
    },
    cancelCreate(): void {
      this.creatingCampaign = false;
      this.createError = '';
    },
    addPlayer(): void {
      if (this.newPlayers.length < 5) {
        this.newPlayers.push({name: ''});
      }
    },
    removePlayer(index: number): void {
      this.newPlayers.splice(index, 1);
    },
    async createCampaign(): Promise<void> {
      this.createError = '';
      const name = this.newCampaignName.trim();
      const players = this.newPlayers.map((player) => ({name: player.name.trim(), profileId: player.profileId}));
      if (name.length === 0) {
        this.createError = 'Give the campaign a name.';
        return;
      }
      if (players.some((player) => player.name.length === 0)) {
        this.createError = 'Every player needs a name.';
        return;
      }
      this.savingCampaign = true;
      try {
        const response = await fetch(`/${paths.API_LEGACY_CAMPAIGNS}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({name, players}),
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message.replace(/^Bad request:\s*/, '') || 'The campaign could not be created.');
        }
        const campaign = await response.json() as LegacyCampaign;
        this.campaigns.unshift({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          currentMission: campaign.currentMission,
          playerNames: campaign.players.map((player) => player.name),
          completedMissions: campaign.missionHistory.length,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        });
        this.newCampaignName = '';
        this.newPlayers = [{name: ''}, {name: ''}];
        this.creatingCampaign = false;
        this.selectedCampaign = campaign;
        window.history.pushState({}, campaign.name, `/${paths.LEGACY_CAMPAIGNS}?id=${campaign.id}`);
      } catch (error) {
        this.createError = error instanceof Error ? error.message : 'The campaign could not be created.';
      } finally {
        this.savingCampaign = false;
      }
    },
    formatDate(isoDate: string): string {
      return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'}).format(new Date(isoDate));
    },
  },
  mounted() {
    this.loadCampaigns();
    this.loadProfileDirectory();
  },
});
</script>

<style scoped lang="less">
.legacy-home {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 36px max(24px, calc((100vw - 1050px) / 2)) 80px;
  color: #f2eee5;
  background:
    radial-gradient(circle at 78% 12%, rgba(194, 78, 38, 0.28), transparent 32%),
    radial-gradient(circle at 15% 40%, rgba(42, 83, 115, 0.22), transparent 38%),
    #090c12 url("/assets/stars.jpg");
}

.legacy-header,
.campaign-toolbar,
.create-heading,
.roster-heading,
.detail-heading,
.campaign-card-topline,
.campaign-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.legacy-header {
  align-items: flex-start;
  margin-bottom: 40px;
}

.release-subtitle {
  margin-bottom: 0;
  color: #8995a2;
  font-size: 14px;
}

.release-subtitle span {
  margin: 0 5px;
  color: #66717d;
}

.release-subtitle a {
  color: #e4b66d;
  text-decoration: none;
}

.release-subtitle a:hover {
  text-decoration: underline;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1,
h2,
h3 {
  font-family: Prototype, sans-serif;
  letter-spacing: 0.04em;
}

h1 {
  margin-bottom: 8px;
  color: #e4b66d;
  font-size: clamp(32px, 5vw, 54px);
  text-transform: uppercase;
}

h2 {
  margin-bottom: 6px;
  font-size: 28px;
}

h3 {
  margin-bottom: 14px;
  font-size: 20px;
}

.subtitle,
.campaign-toolbar p,
.roster-heading p,
.campaign-meta,
.empty-state {
  color: #aeb7c1;
}

.eyebrow,
.mission-label {
  margin-bottom: 5px;
  color: #df9b56;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.back-link,
.text-button {
  border: 0;
  color: #d5dae0;
  background: transparent;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.back-link:hover,
.text-button:hover {
  color: #ffffff;
}

.panel,
.campaign-card {
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(20, 25, 34, 0.94);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
}

.panel {
  padding: 28px;
}

.message {
  text-align: center;
}

.error-message,
.form-error {
  color: #ff9c8a;
}

.campaign-toolbar {
  margin-bottom: 24px;
}

.primary-button,
.secondary-button,
.remove-button {
  border-radius: 7px;
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  border: 1px solid #e69b55;
  padding: 11px 18px;
  background: linear-gradient(180deg, #c86839, #954124);
}

.secondary-button {
  border: 1px solid #596473;
  padding: 8px 13px;
  background: #2b333e;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.campaign-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 18px;
}

.campaign-card {
  padding: 23px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
}

.campaign-card:hover {
  border-color: rgba(230, 155, 85, 0.7);
  background: rgba(29, 35, 46, 0.98);
  transform: translateY(-2px);
}

.campaign-card h3 {
  margin: 24px 0 8px;
  font-size: 24px;
}

.campaign-card p {
  min-height: 42px;
  color: #bec6ce;
}

.status-label {
  border: 1px solid #596473;
  border-radius: 999px;
  padding: 3px 9px;
  color: #bfc7cf;
  font-size: 12px;
  text-transform: capitalize;
}

.campaign-card-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  padding-top: 15px;
  color: #8995a2;
  font-size: 13px;
}

.empty-campaigns {
  padding: 55px 30px;
  text-align: center;
}

.create-panel {
  max-width: 720px;
  margin: 0 auto;
}

.field-label,
.player-input-row label {
  display: block;
  margin-bottom: 7px;
  color: #cbd1d7;
  font-weight: 700;
}

.text-input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #4b5664;
  border-radius: 7px;
  padding: 11px 12px;
  color: #ffffff;
  background: #10151d;
  font: inherit;
}

.text-input:focus {
  border-color: #df9b56;
  outline: 2px solid rgba(223, 155, 86, 0.18);
}

.roster-heading {
  align-items: flex-end;
  margin: 30px 0 14px;
}

.roster-heading h3,
.roster-heading p {
  margin-bottom: 3px;
}

.player-input-row {
  position: relative;
  margin-bottom: 13px;
}

.player-field { position: relative; display: flex; align-items: center; gap: 9px; }
.player-avatar { width: 40px; height: 40px; border: 3px solid #df9b56; border-radius: 50%; object-fit: cover; }
.profile-options { display: grid; gap: 1px; margin: 4px 38px 10px 0; overflow: hidden; border: 1px solid #4b5664; border-radius: 7px; }
.profile-options button { display: flex; align-items: center; gap: 9px; border: 0; padding: 8px 10px; color: #fff; background: #171e28; text-align: left; cursor: pointer; }
.profile-options button:hover { background: #283342; }
.profile-options img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.profile-options span { display: grid; }
.profile-options small, .linked-profile { color: #9fa9b4; }
.linked-profile { margin: 5px 0 0 49px; font-size: 13px; }

.player-input-row .text-input {
  padding-right: 44px;
}

.remove-button {
  position: absolute;
  right: 8px;
  bottom: 7px;
  width: 30px;
  height: 30px;
  border: 0;
  color: #b8c0c8;
  background: transparent;
  font-size: 24px;
}

.create-button {
  margin-top: 10px;
}

.campaign-detail > .text-button {
  margin-bottom: 14px;
}

.detail-heading {
  margin-bottom: 18px;
}

.mission-progress {
  display: flex;
  gap: 7px;
}

.mission-dot {
  display: grid;
  width: 30px;
  height: 30px;
  border: 1px solid #4f5b68;
  border-radius: 50%;
  place-items: center;
  color: #7f8b97;
  font-size: 12px;
}

.mission-dot.complete {
  border-color: #789864;
  color: #dcebd2;
  background: #405736;
}

.mission-dot.current {
  border-color: #dc8e4b;
  color: #ffffff;
  background: #a34d2a;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  gap: 18px;
}

.player-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.player-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 14px 0;
}

.player-list li:first-child {
  border-top: 0;
}

.player-list span,
.player-score span {
  display: block;
  margin-top: 4px;
  color: #87929e;
  font-size: 12px;
}

.player-score {
  text-align: right;
}

.mission-panel p:not(.eyebrow) {
  color: #bdc5cd;
  line-height: 1.55;
}

.mission-panel .primary-button {
  width: 100%;
  margin-top: 8px;
}

.history-panel {
  margin-top: 18px;
}

@media (max-width: 720px) {
  .legacy-home {
    padding: 22px 16px 70px;
  }

  .legacy-header,
  .campaign-toolbar,
  .detail-heading,
  .roster-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .legacy-header {
    gap: 25px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .mission-progress {
    flex-wrap: wrap;
  }
}
</style>

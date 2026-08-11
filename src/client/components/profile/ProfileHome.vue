<template>
  <main class="profile-home">
    <header class="profile-header">
      <a href="/" class="back-link">← Main menu</a>
      <div>
        <p class="eyebrow">Mars Chrypnotoad</p>
        <h1>My profile</h1>
        <p class="subtitle">Optional identity, aliases, and statistics across games.</p>
      </div>
    </header>

    <section v-if="loading" class="profile-panel">Loading profile…</section>
    <section v-else-if="signedOut" class="profile-panel signed-out">
      <h2>Play without an account—or keep your history</h2>
      <p>Signing in is optional. It lets you claim player links, upload an avatar, and collect statistics without changing how games are created or shared.</p>
      <a v-if="discordConfigured" class="primary-link" :href="loginUrl">Sign in with Discord</a>
      <p v-else class="setup-note">Discord login is being configured. Anonymous games still work normally.</p>
    </section>
    <section v-else-if="error" class="profile-panel error-message">{{ error }}</section>

    <template v-else-if="response !== undefined">
      <p v-if="claimMessage" class="claim-message">{{ claimMessage }}</p>
      <section class="profile-panel identity-panel">
        <div class="avatar-wrap">
          <img v-if="avatarUrl" :src="avatarUrl" alt="Profile avatar" class="avatar">
          <div v-else class="avatar avatar-fallback">{{ initials }}</div>
        </div>
        <div class="identity-form">
          <label for="profile-name">Display name</label>
          <input id="profile-name" v-model="displayName" maxlength="40" autocomplete="nickname">
          <p class="discord-name">Connected as {{ response.profile.discordUsername }} on Discord</p>
          <fieldset class="preferred-color">
            <legend>Preferred player color</legend>
            <label class="no-color-preference">
              <input type="radio" value="" v-model="preferredColor">
              No preference
            </label>
            <label v-for="color in PLAYER_COLORS" :key="color" class="color-preference" :title="color">
              <input type="radio" :value="color" v-model="preferredColor">
              <span :class="'color-choice player_bg_color_' + color"></span>
              <span class="color-name">{{ color }}</span>
            </label>
          </fieldset>
          <div class="avatar-actions">
            <label class="secondary-button">
              Upload avatar
              <input class="file-input" type="file" accept="image/png,image/jpeg,image/webp" @change="selectAvatar">
            </label>
            <button v-if="response.profile.customAvatarDataUrl" type="button" class="text-button" @click="removeCustomAvatar">Use Discord avatar</button>
          </div>
          <p class="form-note">Uploads are resized in your browser and stored with the backed-up game data.</p>
          <p v-if="saveError" class="error-message">{{ saveError }}</p>
          <button type="button" class="primary-button" :disabled="saving" @click="saveProfile">{{ saving ? 'Saving…' : 'Save profile' }}</button>
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card"><strong>{{ response.stats.gamesPlayed }}</strong><span>games</span></div>
        <div class="stat-card"><strong>{{ response.stats.wins }}</strong><span>wins</span></div>
        <div class="stat-card"><strong>{{ formatPercent(response.stats.winRate) }}</strong><span>win rate</span></div>
        <div class="stat-card"><strong>{{ formatScore(response.stats.averageScore) }}</strong><span>average score</span></div>
        <div class="stat-card"><strong>{{ response.stats.highScore ?? '—' }}</strong><span>high score</span></div>
        <div class="stat-card"><strong>{{ response.stats.favoriteCorporation ?? '—' }}</strong><span>favorite corp</span></div>
      </section>

      <section class="profile-grid">
        <div class="profile-panel">
          <h2>Corporations</h2>
          <p v-if="response.stats.corporationCounts.length === 0" class="empty-state">Claim a completed player link to begin tracking corporations.</p>
          <table v-else>
            <thead><tr><th>Corporation</th><th>Games</th><th>Wins</th></tr></thead>
            <tbody><tr v-for="corp in response.stats.corporationCounts" :key="corp.corporation"><td>{{ corp.corporation }}</td><td>{{ corp.games }}</td><td>{{ corp.wins }}</td></tr></tbody>
          </table>
        </div>
        <div class="profile-panel">
          <h2>Nickname hall of fame</h2>
          <p v-if="response.stats.aliases.length === 0" class="empty-state">No aliases yet. Rick is still Rick—for now.</p>
          <div v-else class="alias-list"><span v-for="alias in response.stats.aliases" :key="alias">{{ alias }}</span></div>
        </div>
      </section>

      <section class="profile-panel">
        <h2>Game history</h2>
        <p v-if="response.stats.games.length === 0" class="empty-state">Your claimed completed games will appear here.</p>
        <div v-else class="game-history">
          <div v-for="game in response.stats.games" :key="game.gameId" class="game-row">
            <a :href="`/game?id=${game.gameId}`" class="game-link">
              <span><strong>{{ game.playerName }}</strong> · {{ game.corporation }}</span>
              <span>{{ game.won ? 'Won' : `Place ${game.rank ?? '—'}` }} · {{ game.playerScore }} VP · Gen {{ game.generations }}</span>
            </a>
            <button type="button" class="text-button unclaim-button" @click="unclaimGame(game.participantId)">Remove</button>
          </div>
        </div>
      </section>
      <section class="profile-grid">
        <div class="profile-panel">
          <h2>Head to head</h2>
          <p v-if="response.stats.headToHead.length === 0" class="empty-state">Results against other linked profiles will appear here.</p>
          <div v-else class="opponent-list">
            <div v-for="opponent in response.stats.headToHead" :key="opponent.profileId" class="opponent-row">
              <img v-if="opponent.avatarUrl" :src="opponent.avatarUrl" alt="" class="opponent-avatar">
              <span><strong>{{ opponent.displayName }}</strong><small>{{ opponent.games }} games</small></span>
              <span>{{ opponent.wins }}–{{ opponent.losses }}–{{ opponent.ties }}</span>
            </div>
          </div>
        </div>
        <div class="profile-panel">
          <h2>Campaigns</h2>
          <p v-if="response.stats.campaigns.length === 0" class="empty-state">Linked Legacy campaigns will appear here.</p>
          <div v-else class="campaign-history">
            <a v-for="campaign in response.stats.campaigns" :key="campaign.id" :href="`/legacy?id=${campaign.id}`">
              <strong>{{ campaign.name }}</strong>
              <span>{{ campaign.playerName }} · Mission {{ campaign.currentMission }} · {{ campaign.status }}</span>
            </a>
          </div>
        </div>
      </section>
      <p class="logout"><a href="/api/logout">Log out</a></p>
    </template>
  </main>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {PlayerProfileResponse} from '@/common/profile/PlayerProfile';
import {Color, PLAYER_COLORS} from '@/common/Color';
import rawSettings from '@/genfiles/settings.json';

async function resizedAvatar(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Please choose an image smaller than 10 MB.');
  }
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read that image.'));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('That file is not a supported image.'));
    element.src = source;
  });
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Your browser could not resize that image.');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.85);
}

export default defineComponent({
  name: 'ProfileHome',
  data() {
    return {
      loading: true,
      signedOut: false,
      error: '',
      saveError: '',
      saving: false,
      response: undefined as PlayerProfileResponse | undefined,
      displayName: '',
      preferredColor: '' as Color | '',
      pendingAvatar: undefined as string | null | undefined,
      claimMessage: '',
      discordConfigured: rawSettings.discordClientId.length > 0,
    };
  },
  computed: {
    PLAYER_COLORS(): typeof PLAYER_COLORS {
      return PLAYER_COLORS;
    },
    loginUrl(): string {
      const claim = new URLSearchParams(window.location.search).get('claim');
      return `/${paths.AUTH_DISCORD_START}${claim === null ? '' : `?claim=${encodeURIComponent(claim)}`}`;
    },
    avatarUrl(): string | undefined {
      if (this.pendingAvatar !== undefined) {
        return this.pendingAvatar ?? this.response?.profile.discordAvatarUrl;
      }
      return this.response?.profile.customAvatarDataUrl ?? this.response?.profile.discordAvatarUrl;
    },
    initials(): string {
      return this.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
    },
  },
  mounted() {
    this.loadProfile();
  },
  methods: {
    async loadProfile(): Promise<void> {
      try {
        const response = await fetch(`/${paths.API_PROFILE}`);
        if (response.status === 403) {
          this.signedOut = true;
          return;
        }
        if (!response.ok) {
          throw new Error('Your profile could not be loaded.');
        }
        this.response = await response.json() as PlayerProfileResponse;
        this.displayName = this.response.profile.displayName;
        this.preferredColor = this.response.profile.preferredColor ?? '';
        await this.claimFromUrl();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Your profile could not be loaded.';
      } finally {
        this.loading = false;
      }
    },
    async claimFromUrl(): Promise<void> {
      const participantId = new URLSearchParams(window.location.search).get('claim');
      if (participantId === null) {
        return;
      }
      const response = await fetch(`/${paths.API_PROFILE_CLAIM}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({participantId}),
      });
      if (!response.ok) {
        this.claimMessage = response.status === 422 ? 'That player has already been claimed by another profile.' : 'That player could not be claimed.';
        return;
      }
      this.response = await response.json() as PlayerProfileResponse;
      this.displayName = this.response.profile.displayName;
      this.preferredColor = this.response.profile.preferredColor ?? '';
      this.claimMessage = 'Player claimed—this game now counts toward your profile.';
      window.history.replaceState({}, 'My profile', `/${paths.PROFILE}`);
    },
    async selectAvatar(event: Event): Promise<void> {
      this.saveError = '';
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file === undefined) {
        return;
      }
      try {
        this.pendingAvatar = await resizedAvatar(file);
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'That avatar could not be prepared.';
      } finally {
        input.value = '';
      }
    },
    removeCustomAvatar(): void {
      this.pendingAvatar = null;
    },
    async saveProfile(): Promise<void> {
      this.saving = true;
      this.saveError = '';
      try {
        const body: {displayName: string; preferredColor: Color | null; customAvatarDataUrl?: string | null} = {
          displayName: this.displayName,
          preferredColor: this.preferredColor || null,
        };
        if (this.pendingAvatar !== undefined) {
          body.customAvatarDataUrl = this.pendingAvatar;
        }
        const response = await fetch(`/${paths.API_PROFILE}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(await response.text() || 'Your profile could not be saved.');
        }
        this.response = await response.json() as PlayerProfileResponse;
        this.displayName = this.response.profile.displayName;
        this.preferredColor = this.response.profile.preferredColor ?? '';
        this.pendingAvatar = undefined;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'Your profile could not be saved.';
      } finally {
        this.saving = false;
      }
    },
    async unclaimGame(participantId: string | undefined): Promise<void> {
      if (participantId === undefined || !window.confirm('Remove this player and game from your profile history? The game itself will not be deleted.')) {
        return;
      }
      const result = await fetch(`/${paths.API_PROFILE_CLAIM}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({participantId, action: 'unclaim'}),
      });
      if (!result.ok) {
        this.claimMessage = 'That game could not be removed from your profile.';
        return;
      }
      this.response = await result.json() as PlayerProfileResponse;
      this.claimMessage = 'Game removed from your profile. The game itself is unchanged.';
    },
    formatPercent(value: number): string {
      return `${Math.round(value * 100)}%`;
    },
    formatScore(value: number): string {
      return value === 0 ? '—' : value.toFixed(1);
    },
  },
});
</script>

<style scoped>
.profile-home { width: min(1050px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 70px; color: #f5f0e8; }
.profile-header { display: grid; grid-template-columns: 130px 1fr; gap: 20px; align-items: start; margin-bottom: 24px; }
.back-link, a { color: #f2b45f; }
.eyebrow { margin: 0; color: #e69a42; text-transform: uppercase; letter-spacing: .16em; font-size: 13px; }
h1 { margin: 4px 0; font-size: clamp(34px, 7vw, 58px); }
h2 { margin-top: 0; }
.subtitle, .form-note, .discord-name, .empty-state, .setup-note { color: #bbb4a9; }
.profile-panel, .stat-card { background: rgba(12, 14, 20, .9); border: 1px solid #554637; border-radius: 14px; padding: 22px; margin-bottom: 18px; }
.signed-out { max-width: 680px; margin: 50px auto; text-align: center; }
.primary-link, .primary-button, .secondary-button { display: inline-block; border: 0; border-radius: 8px; background: #d87f31; color: #fff; padding: 11px 17px; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; }
.secondary-button { background: #3c4658; }
.text-button { border: 0; background: transparent; color: #f2b45f; cursor: pointer; font: inherit; }
.identity-panel { display: flex; gap: 26px; align-items: flex-start; }
.avatar { width: 128px; height: 128px; border-radius: 50%; object-fit: cover; border: 3px solid #d87f31; }
.avatar-fallback { display: grid; place-items: center; background: #3c4658; font-size: 42px; font-weight: 700; }
.identity-form { flex: 1; }
.identity-form label { display: block; margin-bottom: 6px; font-weight: 700; }
.identity-form input:not(.file-input) { width: min(420px, 100%); box-sizing: border-box; padding: 10px; border-radius: 7px; border: 1px solid #71614f; background: #171b24; color: white; font: inherit; }
.preferred-color { margin: 18px 0 4px; padding: 0; border: 0; }
.preferred-color legend { margin-bottom: 8px; font-weight: 700; }
.preferred-color label { display: inline-flex; align-items: center; gap: 5px; margin: 0 8px 8px 0; font-weight: 400; cursor: pointer; }
.preferred-color input { width: auto !important; }
.color-choice { display: inline-block; width: 24px; height: 24px; border: 1px solid rgba(255, 255, 255, .45); border-radius: 5px; }
.color-name { text-transform: capitalize; }
.avatar-actions { display: flex; align-items: center; gap: 8px; margin: 15px 0 8px; }
.file-input { display: none; }
.stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 18px; }
.stat-card { margin: 0; min-width: 0; text-align: center; }
.stat-card strong { display: block; color: #f2b45f; font-size: 24px; overflow-wrap: anywhere; }
.stat-card span { color: #aaa; font-size: 13px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.profile-grid .profile-panel { margin: 0 0 18px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px; border-bottom: 1px solid #3e3b38; text-align: left; }
.alias-list { display: flex; flex-wrap: wrap; gap: 8px; }
.alias-list span { border-radius: 999px; background: #342c27; padding: 7px 11px; }
.game-history { display: grid; gap: 8px; }
.game-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: #1a1e28; }
.game-link { display: flex; flex: 1; justify-content: space-between; gap: 16px; text-decoration: none; color: #eee; }
.unclaim-button { flex: none; }
.opponent-list, .campaign-history { display: grid; gap: 8px; }
.opponent-row { display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: center; padding: 8px; border-radius: 8px; background: #1a1e28; }
.opponent-row span { display: grid; }
.opponent-row small, .campaign-history span { color: #aaa; }
.opponent-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.campaign-history a { display: grid; gap: 3px; padding: 10px; border-radius: 8px; background: #1a1e28; text-decoration: none; }
.claim-message { padding: 12px; border-radius: 8px; background: #234c34; }
.error-message { color: #ff9a87; }
.logout { text-align: center; }
@media (max-width: 800px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .profile-grid { grid-template-columns: 1fr; } .profile-header { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .identity-panel { align-items: center; flex-direction: column; } .identity-form { width: 100%; } .game-row, .game-link { align-items: flex-start; flex-direction: column; } }
</style>

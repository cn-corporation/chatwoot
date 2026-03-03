<script>
import { mapGetters } from 'vuex';
import { useAlert } from 'dashboard/composables';
import { dynamicTime } from 'shared/helpers/timeHelper';
import { useAdmin } from 'dashboard/composables/useAdmin';
// import ContactInfoRow from './ContactInfoRow.vue'; // Removed for poker UI
import Avatar from 'next/avatar/Avatar.vue';
// import SocialIcons from './SocialIcons.vue'; // Removed for poker UI
import EditContact from './EditContact.vue';
import ContactMergeModal from 'dashboard/modules/contact/ContactMergeModal.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import VoiceCallButton from 'dashboard/components-next/Contacts/VoiceCallButton.vue';
import AdsLogsModal from './AdsLogsModal.vue';

import {
  isAConversationRoute,
  isAInboxViewRoute,
  getConversationDashboardRoute,
} from '../../../../helper/routeHelpers';

export default {
  components: {
    NextButton,
    // ContactInfoRow, // Removed for poker UI
    EditContact,
    Avatar,
    // SocialIcons, // Removed for poker UI
    ContactMergeModal,
    VoiceCallButton,
    AdsLogsModal,
  },
  props: {
    contact: {
      type: Object,
      default: () => ({}),
    },
    showAvatar: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['panelClose'],
  setup() {
    const { isAdmin } = useAdmin();
    return {
      isAdmin,
      isDevelopmentEnvironment:
        window.chatwootConfig?.environment === 'development',
    };
  },
  data() {
    return {
      showEditModal: false,
      showMergeModal: false,
      showDeleteModal: false,
      showAdsLogsModal: false,
    };
  },
  computed: {
    ...mapGetters({
      uiFlags: 'contacts/getUIFlags',
      agents: 'agents/getAgents',
      currentChat: 'getSelectedChat',
    }),
    linkedContactName() {
      return this.$store.getters['linkedSourceChannels/getLinkedContactName'](
        this.currentChat?.id
      );
    },
    showLinkedContactName() {
      return (
        this.linkedContactName && this.linkedContactName !== this.contact.name
      );
    },
    contactProfileLink() {
      return `/app/accounts/${this.$route.params.accountId}/contacts/${this.contact.id}`;
    },
    assignedAgent() {
      return this.currentChat?.meta?.assignee || null;
    },
    agentsList() {
      return [
        {
          id: null,
          name: this.$t('CONVERSATION.UNASSIGNED'),
          thumbnail: '',
        },
        ...this.agents,
      ];
    },
    additionalAttributes() {
      return this.contact.additional_attributes || {};
    },
    location() {
      const {
        country = '',
        city = '',
        country_code: countryCode,
      } = this.additionalAttributes;
      const cityAndCountry = [city, country].filter(item => !!item).join(', ');

      if (!cityAndCountry) {
        return '';
      }
      return this.findCountryFlag(countryCode, cityAndCountry);
    },
    socialProfiles() {
      const {
        social_profiles: socialProfiles,
        screen_name: twitterScreenName,
        social_telegram_user_name: telegramUsername,
      } = this.additionalAttributes;
      return {
        twitter: twitterScreenName,
        telegram: telegramUsername,
        ...(socialProfiles || {}),
      };
    },
    telegramId() {
      const id = this.additionalAttributes.social_telegram_user_id;
      return id ? Number(id) : null;
    },
    telegramUsername() {
      return this.additionalAttributes.social_telegram_user_name || null;
    },
    chatwootChannelId() {
      return this.currentChat?.inbox_id || null;
    },
    playerName() {
      return this.contact.custom_attributes?.player_name || null;
    },
    playerOverlay() {
      const val = this.contact.custom_attributes?.overlay;
      return val != null ? Number(val).toFixed(2) : null;
    },
    // Delete Modal
    confirmDeleteMessage() {
      return ` ${this.contact.name}?`;
    },
  },
  watch: {
    'contact.id': {
      handler(id) {
        if (!id) return;
        this.$store.dispatch('contacts/fetchContactableInbox', id);
      },
      immediate: true,
    },
  },
  methods: {
    dynamicTime,
    toggleEditModal() {
      this.showEditModal = !this.showEditModal;
    },
    copyContactName() {
      navigator.clipboard.writeText(this.contact.name).then(() => {
        useAlert(this.$t('CONTACT_PANEL.COPY_SUCCESSFUL'));
      });
    },
    copyTelegramId() {
      if (this.telegramId) {
        navigator.clipboard.writeText(this.telegramId).then(() => {
          useAlert(this.$t('CONTACT_PANEL.COPY_SUCCESSFUL'));
        });
      }
    },
    copyTelegramUsername() {
      if (this.telegramUsername) {
        navigator.clipboard.writeText(this.telegramUsername).then(() => {
          useAlert(this.$t('CONTACT_PANEL.COPY_SUCCESSFUL'));
        });
      }
    },
    copyPlayerName() {
      if (this.playerName) {
        navigator.clipboard.writeText(this.playerName).then(() => {
          useAlert(this.$t('CONTACT_PANEL.COPY_SUCCESSFUL'));
        });
      }
    },
    copyOverlay() {
      if (this.playerOverlay != null) {
        navigator.clipboard.writeText(String(this.playerOverlay)).then(() => {
          useAlert(this.$t('CONTACT_PANEL.COPY_SUCCESSFUL'));
        });
      }
    },
    onAssignAgent(agent) {
      if (!this.currentChat?.id) return;

      const agentId = agent?.id || 0;
      this.$store.dispatch('setCurrentChatAssignee', agent);
      this.$store
        .dispatch('assignAgent', {
          conversationId: this.currentChat.id,
          agentId,
        })
        .then(() => {
          useAlert(this.$t('CONVERSATION.CHANGE_AGENT'));
        });
    },
    toggleDeleteModal() {
      this.showDeleteModal = !this.showDeleteModal;
    },
    confirmDeletion() {
      this.deleteContact(this.contact);
      this.closeDelete();
    },
    closeDelete() {
      this.showDeleteModal = false;
      this.showEditModal = false;
    },
    findCountryFlag(countryCode, cityAndCountry) {
      try {
        if (!countryCode) {
          return `${cityAndCountry} 🌎`;
        }

        const code = countryCode?.toLowerCase();
        return `${cityAndCountry} <span class="fi fi-${code} size-3.5"></span>`;
      } catch (error) {
        return '';
      }
    },
    async deleteContact({ id }) {
      try {
        await this.$store.dispatch('contacts/delete', id);
        this.$emit('panelClose');
        useAlert(this.$t('DELETE_CONTACT.API.SUCCESS_MESSAGE'));

        if (isAConversationRoute(this.$route.name)) {
          this.$router.push({
            name: getConversationDashboardRoute(this.$route.name),
          });
        } else if (isAInboxViewRoute(this.$route.name)) {
          this.$router.push({
            name: 'inbox_view',
          });
        } else if (this.$route.name !== 'contacts_dashboard') {
          this.$router.push({
            name: 'contacts_dashboard',
          });
        }
      } catch (error) {
        useAlert(
          error.message
            ? error.message
            : this.$t('DELETE_CONTACT.API.ERROR_MESSAGE')
        );
      }
    },
    closeMergeModal() {
      this.showMergeModal = false;
    },
    openMergeModal() {
      this.showMergeModal = true;
    },
    toggleAdsLogsModal() {
      this.showAdsLogsModal = !this.showAdsLogsModal;
    },
    async saveLinkedName() {
      try {
        await this.$store.dispatch('contacts/update', {
          id: this.contact.id,
          name: this.linkedContactName,
        });
        useAlert(this.$t('CONTACT_PANEL.LINKED_NAME_SAVED'));
      } catch (error) {
        useAlert(this.$t('CONTACT_PANEL.LINKED_NAME_SAVE_ERROR'));
      }
    },
  },
};
</script>

<template>
  <!-- Block 4: Simplified contact info panel for operators -->
  <div class="relative items-center w-full p-4">
    <div class="flex flex-col w-full gap-2 text-left rtl:text-right">
      <div class="flex flex-row justify-between">
        <Avatar
          v-if="showAvatar"
          :src="contact.thumbnail"
          :name="contact.name"
          :status="contact.availability_status"
          :size="48"
          hide-offline-status
          rounded-full
        />
      </div>

      <div class="flex flex-col items-start gap-1.5 min-w-0 w-full">
        <div v-if="showAvatar" class="flex items-center w-full min-w-0 gap-3">
          <h3
            v-tooltip.left="$t('CONTACT_PANEL.COPY_CONTACT_NAME')"
            class="flex-shrink max-w-full min-w-0 my-0 text-base capitalize break-words text-n-slate-12 cursor-pointer hover:text-n-slate-11"
            @click="copyContactName"
          >
            {{ contact.name }}
          </h3>
          <div class="flex flex-row items-center gap-2">
            <span
              v-if="contact.created_at"
              v-tooltip.left="
                `${$t('CONTACT_PANEL.CREATED_AT_LABEL')} ${dynamicTime(
                  contact.created_at
                )}`
              "
              class="i-lucide-info text-sm text-n-slate-10"
            />
            <button
              v-tooltip.left="$t('CONTACT_PANEL.COPY_CONTACT_NAME')"
              class="i-lucide-copy text-sm text-n-slate-10 hover:text-n-slate-12 cursor-pointer"
              @click="copyContactName"
            />
            <a
              :href="contactProfileLink"
              target="_blank"
              rel="noopener nofollow noreferrer"
              class="leading-3"
            >
              <span class="i-lucide-external-link text-sm text-n-slate-10" />
            </a>
          </div>
        </div>

        <!-- Telegram ID display -->
        <div
          v-if="telegramId"
          class="flex items-center gap-2 text-sm text-n-slate-11"
        >
          <span class="text-n-slate-10">{{ $t('CONTACT_PANEL.LABEL_TELEGRAM_ID') }}</span>
          <span
            v-tooltip.left="$t('CONTACT_PANEL.COPY_TELEGRAM_ID')"
            class="cursor-pointer hover:text-n-slate-12"
            @click="copyTelegramId"
          >
            {{ telegramId }}
          </span>
          <button
            v-tooltip.left="$t('CONTACT_PANEL.COPY_TELEGRAM_ID')"
            class="i-lucide-copy text-xs text-n-slate-10 hover:text-n-slate-12 cursor-pointer"
            @click="copyTelegramId"
          />
        </div>

        <!-- Telegram Username display -->
        <div
          v-if="telegramUsername"
          class="flex items-center gap-2 text-sm text-n-slate-11"
        >
          <span class="text-n-slate-10">{{ $t('CONTACT_PANEL.LABEL_TELEGRAM_USERNAME') }}</span>
          <span
            v-tooltip.left="$t('CONTACT_PANEL.COPY_TELEGRAM_USERNAME')"
            class="cursor-pointer hover:text-n-slate-12"
            @click="copyTelegramUsername"
          >
            {{ telegramUsername }}
          </span>
          <button
            v-tooltip.left="$t('CONTACT_PANEL.COPY_TELEGRAM_USERNAME')"
            class="i-lucide-copy text-xs text-n-slate-10 hover:text-n-slate-12 cursor-pointer"
            @click="copyTelegramUsername"
          />
        </div>

        <!-- ClubGG Username display -->
        <div
          v-if="playerName"
          class="flex items-center gap-2 text-sm text-n-slate-11"
        >
          <span class="text-n-slate-10">{{ $t('CONTACT_PANEL.LABEL_CLUBGG_USERNAME') }}</span>
          <span
            v-tooltip.left="$t('CONTACT_PANEL.COPY_CLUBGG_USERNAME')"
            class="cursor-pointer hover:text-n-slate-12"
            @click="copyPlayerName"
          >
            {{ playerName }}
          </span>
          <button
            v-tooltip.left="$t('CONTACT_PANEL.COPY_CLUBGG_USERNAME')"
            class="i-lucide-copy text-xs text-n-slate-10 hover:text-n-slate-12 cursor-pointer"
            @click="copyPlayerName"
          />
        </div>

        <!-- Overlay display -->
        <div
          v-if="playerOverlay != null"
          class="flex items-center gap-2 text-sm text-n-slate-11"
        >
          <span class="text-n-slate-10">{{ $t('CONTACT_PANEL.LABEL_OVERLAY') }}</span>
          <span
            v-tooltip.left="$t('CONTACT_PANEL.COPY_OVERLAY')"
            class="cursor-pointer hover:text-n-slate-12"
            @click="copyOverlay"
          >
            {{ playerOverlay }}
          </span>
          <button
            v-tooltip.left="$t('CONTACT_PANEL.COPY_OVERLAY')"
            class="i-lucide-copy text-xs text-n-slate-10 hover:text-n-slate-12 cursor-pointer"
            @click="copyOverlay"
          />
        </div>

        <!-- Previous Contact Name from Linked Source Channel -->
        <div
          v-if="showLinkedContactName"
          class="flex items-center gap-2 p-2 mt-2 bg-n-alpha-1 dark:bg-n-alpha-2 rounded-lg"
        >
          <span class="text-xs text-n-slate-10">
            {{
              $t('CONTACT_PANEL.PREVIOUS_NAME_LABEL', {
                name: linkedContactName,
              })
            }}
          </span>
          <NextButton
            v-tooltip="$t('CONTACT_PANEL.SAVE_LINKED_NAME')"
            icon="i-lucide-save"
            slate
            faded
            xs
            @click="saveLinkedName"
          />
        </div>

        <!-- Ads Logs Button -->
        <div v-if="telegramId" class="mt-2">
          <NextButton
            v-tooltip.left="'View ads history'"
            icon="i-ph-list-bullets"
            slate
            faded
            xs
            @click="toggleAdsLogsModal"
          />
        </div>

        <p v-if="additionalAttributes.description" class="break-words mb-0.5">
          {{ additionalAttributes.description }}
        </p>
      </div>
      <div class="flex items-center w-full mt-0.5 gap-2">
        <VoiceCallButton
          :phone="contact.phone_number"
          icon="i-ri-phone-fill"
          size="sm"
          :tooltip-label="$t('CONTACT_PANEL.CALL')"
          slate
          faded
        />
        <NextButton
          v-tooltip.top-end="$t('EDIT_CONTACT.BUTTON_LABEL')"
          icon="i-ph-pencil-simple"
          slate
          faded
          sm
          @click="toggleEditModal"
        />
        <NextButton
          v-tooltip.top-end="$t('CONTACT_PANEL.MERGE_CONTACT')"
          icon="i-ph-arrows-merge"
          slate
          faded
          sm
          :disabled="uiFlags.isMerging"
          @click="openMergeModal"
        />
        <NextButton
          v-if="isAdmin && isDevelopmentEnvironment"
          v-tooltip.top-end="$t('DELETE_CONTACT.BUTTON_LABEL')"
          icon="i-ph-trash"
          slate
          faded
          sm
          ruby
          :disabled="uiFlags.isDeleting"
          @click="toggleDeleteModal"
        />
      </div>
      <EditContact
        v-if="showEditModal"
        :show="showEditModal"
        :contact="contact"
        @cancel="toggleEditModal"
      />
      <ContactMergeModal
        v-if="showMergeModal"
        :primary-contact="contact"
        :show="showMergeModal"
        @close="closeMergeModal"
      />
      <AdsLogsModal
        v-if="showAdsLogsModal"
        :show="showAdsLogsModal"
        :telegram-id="telegramId"
        :chatwoot-channel-id="chatwootChannelId"
        @close="toggleAdsLogsModal"
      />
    </div>
    <woot-delete-modal
      v-if="showDeleteModal"
      v-model:show="showDeleteModal"
      :on-close="closeDelete"
      :on-confirm="confirmDeletion"
      :title="$t('DELETE_CONTACT.CONFIRM.TITLE')"
      :message="$t('DELETE_CONTACT.CONFIRM.MESSAGE')"
      :message-value="confirmDeleteMessage"
      :confirm-text="$t('DELETE_CONTACT.CONFIRM.YES')"
      :reject-text="$t('DELETE_CONTACT.CONFIRM.NO')"
    />
  </div>
</template>

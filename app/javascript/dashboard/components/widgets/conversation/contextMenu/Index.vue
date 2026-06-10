<script>
import { mapGetters } from 'vuex';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { useAlert } from 'dashboard/composables';
import { copyTextToClipboard } from 'shared/helpers/clipboard';
import {
  getSortedAgentsByAvailability,
  getAgentsByUpdatedPresence,
} from 'dashboard/helper/agentHelper.js';
import MenuItem from './menuItem.vue';
import MenuItemWithSubmenu from './menuItemWithSubmenu.vue';
import wootConstants from 'dashboard/constants/globals';
import AgentLoadingPlaceholder from './agentLoadingPlaceholder.vue';

const MENU = {
  MARK_AS_READ: 'mark-as-read',
  MARK_AS_UNREAD: 'mark-as-unread',
  PRIORITY: 'priority',
  STATUS: 'status',
  AGENT: 'agent',
  TEAM: 'team',
  LABEL: 'label',
  BLOCK_CONTACT: 'block-contact',
  CREATE_TASK: 'create-task',
  DELETE: 'delete',
  OPEN_NEW_TAB: 'open-new-tab',
  COPY_LINK: 'copy-link',
};

export default {
  components: {
    MenuItem,
    MenuItemWithSubmenu,
    AgentLoadingPlaceholder,
  },
  props: {
    chatId: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      default: '',
    },
    hasUnreadMessages: {
      type: Boolean,
      default: false,
    },
    inboxId: {
      type: Number,
      default: null,
    },
    priority: {
      type: String,
      default: null,
    },
    conversationUrl: {
      type: String,
      default: '',
    },
    allowedOptions: {
      type: Array,
      default: () => [],
    },
    contactBlockedUntil: {
      type: String,
      default: null,
    },
  },
  emits: [
    'updateConversation',
    'assignPriority',
    'markAsUnread',
    'markAsRead',
    'assignAgent',
    'assignTeam',
    'assignLabel',
    'createTask',
    'deleteConversation',
    'blockContact',
    'unblockContact',
    'close',
  ],
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
      MENU,
      STATUS_TYPE: wootConstants.STATUS_TYPE,
      readOption: {
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.MARK_AS_READ'),
        icon: 'mail',
      },
      unreadOption: {
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.MARK_AS_UNREAD'),
        icon: 'mail-unread',
      },
      statusMenuConfig: [
        {
          key: wootConstants.STATUS_TYPE.RESOLVED,
          label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.RESOLVED'),
          icon: 'checkmark',
        },
        {
          key: wootConstants.STATUS_TYPE.OPEN,
          label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.REOPEN'),
          icon: 'arrow-redo',
        },
      ],
      priorityConfig: {
        key: MENU.PRIORITY,
        label: this.$t('CONVERSATION.PRIORITY.TITLE'),
        icon: 'warning',
        options: [
          {
            label: this.$t('CONVERSATION.PRIORITY.OPTIONS.NONE'),
            key: null,
          },
          {
            label: this.$t('CONVERSATION.PRIORITY.OPTIONS.HIGH'),
            key: 'high',
          },
          {
            label: this.$t('CONVERSATION.PRIORITY.OPTIONS.MEDIUM'),
            key: 'medium',
          },
          {
            label: this.$t('CONVERSATION.PRIORITY.OPTIONS.LOW'),
            key: 'low',
          },
        ].filter(item => item.key !== this.priority),
      },
      labelMenuConfig: {
        key: MENU.LABEL,
        icon: 'tag',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.ASSIGN_LABEL'),
      },
      agentMenuConfig: {
        key: MENU.AGENT,
        icon: 'person-add',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.ASSIGN_AGENT'),
      },
      teamMenuConfig: {
        key: MENU.TEAM,
        icon: 'people-team-add',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.ASSIGN_TEAM'),
      },
      createTaskOption: {
        key: MENU.CREATE_TASK,
        icon: 'add',
        label: this.$t('TODO.CREATE_TASK'),
      },
      deleteOption: {
        key: MENU.DELETE,
        icon: 'delete',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.DELETE'),
      },
      openInNewTabOption: {
        key: MENU.OPEN_NEW_TAB,
        icon: 'open',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.OPEN_IN_NEW_TAB'),
      },
      copyLinkOption: {
        key: MENU.COPY_LINK,
        icon: 'copy',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.COPY_LINK'),
      },
    };
  },
  computed: {
    ...mapGetters({
      labels: 'labels/getLabels',
      teams: 'teams/getTeams',
      assignableAgentsUiFlags: 'inboxAssignableAgents/getUIFlags',
      currentUser: 'getCurrentUser',
      currentAccountId: 'getCurrentAccountId',
    }),
    filteredAgentOnAvailability() {
      const agents = this.$store.getters[
        'inboxAssignableAgents/getAssignableAgents'
      ](this.inboxId);
      const agentsByUpdatedPresence = getAgentsByUpdatedPresence(
        agents,
        this.currentUser,
        this.currentAccountId
      );
      let filteredAgents = getSortedAgentsByAvailability(
        agentsByUpdatedPresence
      );
      const account = this.$store.getters['accounts/getAccount'](
        this.currentAccountId
      );
      const allowedIds = account?.settings?.assignable_agent_ids;
      if (allowedIds?.length) {
        const numericIds = allowedIds.map(Number);
        filteredAgents = filteredAgents.filter(a => numericIds.includes(a.id));
      }
      return filteredAgents;
    },
    assignableAgents() {
      return [
        {
          confirmed: true,
          name: 'None',
          id: null,
          role: 'agent',
          account_id: 0,
          email: 'None',
        },
        ...this.filteredAgentOnAvailability,
      ];
    },
    assignableTeams() {
      const account = this.$store.getters['accounts/getAccount'](
        this.currentAccountId
      );
      const support247TeamId =
        Number(account?.settings?.support_247_team_id) || null;
      const noneOption = support247TeamId
        ? []
        : [{ name: this.$t('TEAMS_SETTINGS.LIST.NONE'), id: 0 }];
      return [...noneOption, ...this.teams];
    },
    isContactBlocked() {
      if (!this.contactBlockedUntil) return false;
      return new Date(this.contactBlockedUntil) > new Date();
    },
    blockRemainingMinutes() {
      if (!this.isContactBlocked) return 0;
      const diff = new Date(this.contactBlockedUntil) - new Date();
      return Math.max(1, Math.ceil(diff / 60000));
    },
    blockMenuConfig() {
      return {
        key: MENU.BLOCK_CONTACT,
        icon: 'dismiss-circle',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.BLOCK_CONTACT'),
      };
    },
    unblockOption() {
      return {
        icon: 'dismiss-circle',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.UNBLOCK_CONTACT'),
      };
    },
    unblockTooltip() {
      const minutes = this.blockRemainingMinutes;
      return this.$t('CONVERSATION.CARD_CONTEXT_MENU.REMAINING_TIME', {
        minutes,
      });
    },
    blockDurationOptions() {
      return [
        {
          key: 10,
          label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.BLOCK_10_MIN'),
        },
        {
          key: 20,
          label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.BLOCK_20_MIN'),
        },
        {
          key: 30,
          label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.BLOCK_30_MIN'),
        },
      ];
    },
  },
  mounted() {
    this.$store.dispatch('inboxAssignableAgents/fetch', [this.inboxId]);
  },
  methods: {
    isAllowed(keys) {
      if (!this.allowedOptions.length) return true;
      return keys.some(key => this.allowedOptions.includes(key));
    },
    toggleStatus(status, snoozedUntil) {
      this.$emit('updateConversation', status, snoozedUntil);
    },
    assignPriority(priority) {
      this.$emit('assignPriority', priority);
    },
    createTask() {
      this.$emit('createTask', this.chatId);
    },
    deleteConversation() {
      this.$emit('deleteConversation', this.chatId);
    },
    blockContact(duration) {
      this.$emit('blockContact', duration);
    },
    unblockContact() {
      this.$emit('unblockContact');
    },
    openInNewTab() {
      if (!this.conversationUrl) return;

      const url = `${window.chatwootConfig.hostURL}${this.conversationUrl}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      this.$emit('close');
    },
    async copyConversationLink() {
      if (!this.conversationUrl) return;
      try {
        const url = `${window.chatwootConfig.hostURL}${this.conversationUrl}`;
        await copyTextToClipboard(url);
        useAlert(this.$t('CONVERSATION.CARD_CONTEXT_MENU.COPY_LINK_SUCCESS'));
        this.$emit('close');
      } catch (error) {
        // error
      }
    },
    show(key) {
      return this.status !== key;
    },
    generateMenuLabelConfig(option, type = 'text') {
      return {
        key: option.id,
        ...(type === 'icon' && { icon: option.icon }),
        ...(type === 'label' && { color: option.color }),
        ...(type === 'agent' && { thumbnail: option.thumbnail }),
        ...(type === 'agent' && { status: option.availability_status }),
        ...(type === 'text' && { label: option.label }),
        ...(type === 'label' && { label: option.title }),
        ...(type === 'agent' && { label: option.name }),
        ...(type === 'team' && { label: option.name }),
      };
    },
  },
};
</script>

<template>
  <div
    class="p-1 rounded-md shadow-xl bg-n-solid-1 backdrop-blur-[100px] outline-1 outline outline-n-weak"
  >
    <template v-if="isAllowed([MENU.MARK_AS_READ, MENU.MARK_AS_UNREAD])">
      <MenuItem
        v-if="!hasUnreadMessages"
        :option="unreadOption"
        variant="icon"
        @click.stop="$emit('markAsUnread')"
      />
      <MenuItem
        v-else
        :option="readOption"
        variant="icon"
        @click.stop="$emit('markAsRead')"
      />
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
    </template>
    <template v-if="isAllowed([MENU.STATUS])">
      <template v-for="option in statusMenuConfig">
        <MenuItem
          v-if="show(option.key) && isAllowed([MENU.STATUS])"
          :key="option.key"
          :option="option"
          variant="icon"
          @click.stop="toggleStatus(option.key, null)"
        />
      </template>
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
    </template>
    <template
      v-if="isAllowed([MENU.PRIORITY, MENU.LABEL, MENU.AGENT, MENU.TEAM])"
    >
      <!-- Priority assignment removed - now automatic based on waiting time -->
      <MenuItemWithSubmenu
        v-if="isAllowed([MENU.LABEL])"
        :option="labelMenuConfig"
        :sub-menu-available="!!labels.length"
      >
        <MenuItem
          v-for="label in labels"
          :key="label.id"
          :option="generateMenuLabelConfig(label, 'label')"
          variant="label"
          @click.stop="$emit('assignLabel', label)"
        />
      </MenuItemWithSubmenu>
      <MenuItemWithSubmenu
        v-if="isAllowed([MENU.AGENT])"
        :option="agentMenuConfig"
        :sub-menu-available="!!assignableAgents.length"
      >
        <AgentLoadingPlaceholder v-if="assignableAgentsUiFlags.isFetching" />
        <template v-else>
          <MenuItem
            v-for="agent in assignableAgents"
            :key="agent.id"
            :option="generateMenuLabelConfig(agent, 'agent')"
            variant="agent"
            @click.stop="$emit('assignAgent', agent)"
          />
        </template>
      </MenuItemWithSubmenu>
      <MenuItemWithSubmenu
        v-if="isAllowed([MENU.TEAM])"
        :option="teamMenuConfig"
        :sub-menu-available="!!assignableTeams.length"
      >
        <MenuItem
          v-for="team in assignableTeams"
          :key="team.id"
          :option="generateMenuLabelConfig(team, 'team')"
          @click.stop="$emit('assignTeam', team)"
        />
      </MenuItemWithSubmenu>
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
    </template>
    <template v-if="isAllowed([MENU.BLOCK_CONTACT])">
      <div v-if="isContactBlocked" v-tooltip="unblockTooltip">
        <MenuItem
          :option="unblockOption"
          variant="icon"
          @click.stop="unblockContact"
        />
      </div>
      <MenuItemWithSubmenu v-else :option="blockMenuConfig" sub-menu-available>
        <MenuItem
          v-for="opt in blockDurationOptions"
          :key="opt.key"
          :option="opt"
          @click.stop="blockContact(opt.key)"
        />
      </MenuItemWithSubmenu>
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
    </template>
    <template v-if="isAllowed([MENU.CREATE_TASK])">
      <MenuItem
        :option="createTaskOption"
        variant="icon"
        @click.stop="createTask"
      />
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
    </template>
    <template v-if="isAllowed([MENU.OPEN_NEW_TAB, MENU.COPY_LINK])">
      <MenuItem
        v-if="isAllowed([MENU.OPEN_NEW_TAB])"
        :option="openInNewTabOption"
        variant="icon"
        @click.stop="openInNewTab"
      />
      <MenuItem
        v-if="isAllowed([MENU.COPY_LINK])"
        :option="copyLinkOption"
        variant="icon"
        @click.stop="copyConversationLink"
      />
    </template>
    <template
      v-if="isAdmin && isDevelopmentEnvironment && isAllowed([MENU.DELETE])"
    >
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
      <MenuItem
        :option="deleteOption"
        variant="icon"
        @click.stop="deleteConversation"
      />
    </template>
  </div>
</template>

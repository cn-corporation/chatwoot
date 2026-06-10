<!-- eslint-disable vue/v-slot-style -->
<script>
import { mapGetters } from 'vuex';
import { useAlert } from 'dashboard/composables';
import { useAgentsList } from 'dashboard/composables/useAgentsList';
import ContactDetailsItem from './ContactDetailsItem.vue';
import MultiselectDropdown from 'shared/components/ui/MultiselectDropdown.vue';
import ConversationLabels from './labels/LabelBox.vue';

export default {
  components: {
    ContactDetailsItem,
    MultiselectDropdown,
    ConversationLabels,
  },
  props: {
    conversationId: {
      type: [Number, String],
      required: true,
    },
  },
  setup() {
    const { agentsList } = useAgentsList();
    return {
      agentsList,
    };
  },
  data() {
    return {};
  },
  computed: {
    ...mapGetters({
      currentChat: 'getSelectedChat',
      teams: 'teams/getTeams',
      currentAccountId: 'getCurrentAccountId',
    }),
    support247TeamId() {
      const account = this.$store.getters['accounts/getAccount'](
        this.currentAccountId
      );
      return Number(account?.settings?.support_247_team_id) || null;
    },
    hasAnAssignedTeam() {
      return !!this.currentChat?.meta?.team;
    },
    teamsList() {
      if (this.hasAnAssignedTeam && !this.support247TeamId) {
        return [
          { id: 0, name: this.$t('TEAMS_SETTINGS.LIST.NONE') },
          ...this.teams,
        ];
      }
      return this.teams;
    },
    assignedAgent: {
      get() {
        return this.currentChat?.meta?.assignee;
      },
      set(agent) {
        if (!this.currentChat) return;
        const agentId = agent ? agent.id : null;
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
    },
    assignedTeam: {
      get() {
        return this.currentChat?.meta?.team;
      },
      set(team) {
        if (!this.currentChat) return;
        const conversationId = this.currentChat.id;
        const teamId = team ? team.id : 0;
        this.$store.dispatch('setCurrentChatTeam', { team, conversationId });
        this.$store
          .dispatch('assignTeam', { conversationId, teamId })
          .then(() => {
            useAlert(this.$t('CONVERSATION.CHANGE_TEAM'));
          });
      },
    },
  },
  methods: {
    onClickAssignAgent(selectedItem) {
      if (this.assignedAgent && this.assignedAgent.id === selectedItem.id) {
        this.assignedAgent = null;
      } else {
        this.assignedAgent = selectedItem;
      }
    },

    onClickAssignTeam(selectedItemTeam) {
      if (this.assignedTeam && this.assignedTeam.id === selectedItemTeam.id) {
        return;
      }
      this.assignedTeam = selectedItemTeam;
    },
  },
};
</script>

<template>
  <div v-if="currentChat && currentChat.meta" class="bg-n-background">
    <div class="multiselect-wrap--small">
      <ContactDetailsItem
        compact
        :title="$t('CONVERSATION_SIDEBAR.ASSIGNEE_LABEL')"
      />
      <MultiselectDropdown
        :options="agentsList"
        :selected-item="assignedAgent"
        :multiselector-title="$t('AGENT_MGMT.MULTI_SELECTOR.TITLE.AGENT')"
        :multiselector-placeholder="$t('AGENT_MGMT.MULTI_SELECTOR.PLACEHOLDER')"
        :no-search-result="
          $t('AGENT_MGMT.MULTI_SELECTOR.SEARCH.NO_RESULTS.AGENT')
        "
        :input-placeholder="
          $t('AGENT_MGMT.MULTI_SELECTOR.SEARCH.PLACEHOLDER.AGENT')
        "
        @select="onClickAssignAgent"
      />
    </div>
    <div class="multiselect-wrap--small">
      <ContactDetailsItem
        compact
        :title="$t('CONVERSATION_SIDEBAR.TEAM_LABEL')"
      />
      <MultiselectDropdown
        :options="teamsList"
        :selected-item="assignedTeam"
        :multiselector-title="$t('AGENT_MGMT.MULTI_SELECTOR.TITLE.TEAM')"
        :multiselector-placeholder="$t('TEAMS_SETTINGS.LIST.NONE')"
        :no-search-result="
          $t('AGENT_MGMT.MULTI_SELECTOR.SEARCH.NO_RESULTS.TEAM')
        "
        :input-placeholder="
          $t('AGENT_MGMT.MULTI_SELECTOR.SEARCH.PLACEHOLDER.TEAM')
        "
        @select="onClickAssignTeam"
      />
    </div>
    <ContactDetailsItem
      compact
      :title="$t('CONVERSATION_SIDEBAR.ACCORDION.CONVERSATION_LABELS')"
    />
    <ConversationLabels :conversation-id="conversationId" />
  </div>
</template>

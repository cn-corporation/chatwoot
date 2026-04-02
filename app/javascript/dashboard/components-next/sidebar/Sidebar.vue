<script setup>
import { h, computed, onMounted, onUnmounted } from 'vue';
import { provideSidebarContext } from './provider';
import { useAccount } from 'dashboard/composables/useAccount';
import { useKbd } from 'dashboard/composables/utils/useKbd';
import { useMapGetter } from 'dashboard/composables/store';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { useStorage } from '@vueuse/core';
import { useSidebarKeyboardShortcuts } from './useSidebarKeyboardShortcuts';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { emitter } from 'shared/helpers/mitt';
import { vOnClickOutside } from '@vueuse/components';

import Button from 'dashboard/components-next/button/Button.vue';
import SidebarGroup from './SidebarGroup.vue';
import SidebarProfileMenu from './SidebarProfileMenu.vue';
import SidebarChangelogCard from './SidebarChangelogCard.vue';
import ChannelLeaf from './ChannelLeaf.vue';
import SidebarAccountSwitcher from './SidebarAccountSwitcher.vue';
import Logo from 'next/icon/Logo.vue';
import ComposeConversation from 'dashboard/components-next/NewConversation/ComposeConversation.vue';

const props = defineProps({
  isMobileSidebarOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'closeKeyShortcutModal',
  'openKeyShortcutModal',
  'showCreateAccountModal',
  'closeMobileSidebar',
]);

const { accountScopedRoute, isOnChatwootCloud } = useAccount();
const store = useStore();
const searchShortcut = useKbd([`$mod`, 'k']);
const { t } = useI18n();
const { isAdmin } = useAdmin();

const isACustomBrandedInstance = useMapGetter(
  'globalConfig/isACustomBrandedInstance'
);

const toggleShortcutModalFn = show => {
  if (show) {
    emit('openKeyShortcutModal');
  } else {
    emit('closeKeyShortcutModal');
  }
};

useSidebarKeyboardShortcuts(toggleShortcutModalFn);

// We're using localStorage to store the expanded item in the sidebar
// This helps preserve context when navigating between portal and dashboard layouts
// and also when the user refreshes the page
const expandedItem = useStorage(
  'next-sidebar-expanded-item',
  null,
  sessionStorage
);

const setExpandedItem = name => {
  expandedItem.value = expandedItem.value === name ? null : name;
};
provideSidebarContext({
  expandedItem,
  setExpandedItem,
});

const inboxes = useMapGetter('inboxes/getInboxes');
const labels = useMapGetter('labels/getLabelsOnSidebar');
const teams = useMapGetter('teams/getMyTeams');
const standByUnreadCount = useMapGetter('getStandByOperatorUnreadCount');
const getUnreadCountForLabel = useMapGetter('getOperatorUnreadCountForLabel');
const getUnreadCountForTeam = useMapGetter('getOperatorUnreadCountForTeam');
const allSectionUnreadCount = useMapGetter('getAllSectionOperatorUnreadCount');
const unattendedUnreadCount = useMapGetter('getUnattendedOperatorUnreadCount');
const mineUnreadCount = useMapGetter('getMineOperatorUnreadCount');
const sidebarAllCount = useMapGetter('getSidebarAllCount');
const sidebarUnattendedCount = useMapGetter('getSidebarUnattendedCount');
const sidebarMineCount = useMapGetter('getSidebarMineCount');
const sidebarStandByCount = useMapGetter('getSidebarStandByCount');
const getSidebarTotalCountForTeam = useMapGetter('getSidebarTotalCountForTeam');
const isTelegramOperator = useMapGetter(
  'telegramDialoguesAccess/isCurrentUserAllowed'
);
// Removed unused custom views - simplified for poker operator UI

const refreshCounts = async () => {
  await store.dispatch('fetchAllConversationsForCounts');
};
onMounted(async () => {
  await Promise.all([
    store.dispatch('labels/get'),
    store.dispatch('inboxes/get'),
    store.dispatch('teams/get'),
    store.dispatch('attributes/get'),
    store.dispatch('customViews/get', 'conversation'),
    store.dispatch('customViews/get', 'contact'),
    store.dispatch('macros/get'),
    store.dispatch('fetchAllConversationsForCounts'),
    store.dispatch('telegramDialoguesAccess/fetchOperators'),
  ]);
  if (isAdmin.value || isTelegramOperator.value) {
    store.dispatch('telegramDialogues/initGlobalSSE');
  }
  // Refresh counts when conversations are updated
  emitter.on(BUS_EVENTS.WEBSOCKET_RECONNECT, refreshCounts);
  emitter.on('fetch_conversation_stats', refreshCounts);
});

onUnmounted(() => {
  emitter.off(BUS_EVENTS.WEBSOCKET_RECONNECT, refreshCounts);
  emitter.off('fetch_conversation_stats', refreshCounts);
});

const sortedInboxes = computed(() =>
  inboxes.value
    .filter(inbox => inbox.is_member)
    .sort((a, b) => a.name.localeCompare(b.name))
);

const closeMobileSidebar = () => {
  if (!props.isMobileSidebarOpen) return;
  emit('closeMobileSidebar');
};

const menuItems = computed(() => {
  const settingsChildren = [
    {
      name: 'Settings Account Settings',
      label: t('SIDEBAR.ACCOUNT_SETTINGS'),
      icon: 'i-lucide-briefcase',
      to: accountScopedRoute('general_settings_index'),
    },
    {
      name: 'Settings Agents',
      label: t('SIDEBAR.AGENTS'),
      icon: 'i-lucide-square-user',
      to: accountScopedRoute('agent_list'),
    },
    {
      name: 'Settings Teams',
      label: t('SIDEBAR.TEAMS'),
      icon: 'i-lucide-users',
      to: accountScopedRoute('settings_teams_list'),
    },
    {
      name: 'Settings Agent Assignment',
      label: t('SIDEBAR.AGENT_ASSIGNMENT'),
      icon: 'i-lucide-user-cog',
      to: accountScopedRoute('assignment_policy_index'),
    },
    {
      name: 'Settings Inboxes',
      label: t('SIDEBAR.INBOXES'),
      icon: 'i-lucide-inbox',
      to: accountScopedRoute('settings_inbox_list'),
    },
    {
      name: 'Settings Labels',
      label: t('SIDEBAR.LABELS'),
      icon: 'i-lucide-tags',
      to: accountScopedRoute('labels_list'),
    },
    {
      name: 'Settings Custom Attributes',
      label: t('SIDEBAR.CUSTOM_ATTRIBUTES'),
      icon: 'i-lucide-code',
      to: accountScopedRoute('attributes_list'),
    },
    {
      name: 'Settings Automation',
      label: t('SIDEBAR.AUTOMATION'),
      icon: 'i-lucide-workflow',
      to: accountScopedRoute('automation_list'),
    },
    {
      name: 'Settings Agent Bots',
      label: t('SIDEBAR.AGENT_BOTS'),
      icon: 'i-lucide-bot',
      to: accountScopedRoute('agent_bots'),
    },
    {
      name: 'Settings Macros',
      label: t('SIDEBAR.MACROS'),
      icon: 'i-lucide-toy-brick',
      to: accountScopedRoute('macros_wrapper'),
    },
  ];

  settingsChildren.push({
    name: 'Settings Personal Canned Responses',
    label: t('SIDEBAR.PERSONAL_CANNED_RESPONSES'),
    icon: 'i-lucide-user-pen',
    to: accountScopedRoute('personal_canned_list'),
  });

  if (isAdmin.value) {
    settingsChildren.push({
      name: 'Settings Ads',
      label: t('SIDEBAR.ADS'),
      icon: 'i-lucide-megaphone',
      to: accountScopedRoute('ads_wrapper'),
    });
    settingsChildren.push({
      name: 'Settings Canned Responses',
      label: t('SIDEBAR.CANNED_RESPONSES'),
      icon: 'i-lucide-message-square-quote',
      to: accountScopedRoute('canned_list'),
    });
    if (window.location.hostname === 'localhost') {
      settingsChildren.push({
        name: 'Settings Knowledge Base',
        label: t('SIDEBAR.KNOWLEDGE_BASE'),
        icon: 'i-lucide-book-open',
        to: accountScopedRoute('knowledge_base_wrapper'),
      });
    }
    settingsChildren.push({
      name: 'Settings RAG Admin',
      label: 'RAG Admin',
      icon: 'i-lucide-brain',
      to: accountScopedRoute('rag_admin_index'),
    });
    settingsChildren.push({
      name: 'Settings Telegram Dialogues Access',
      label: 'Telegram Access',
      icon: 'i-lucide-send',
      to: accountScopedRoute('telegram_dialogues_access'),
    });
  }

  settingsChildren.push(
    {
      name: 'Settings Integrations',
      label: t('SIDEBAR.INTEGRATIONS'),
      icon: 'i-lucide-blocks',
      to: accountScopedRoute('settings_applications'),
    },
    {
      name: 'Settings Audit Logs',
      label: t('SIDEBAR.AUDIT_LOGS'),
      icon: 'i-lucide-briefcase',
      to: accountScopedRoute('auditlogs_list'),
    },
    {
      name: 'Settings Custom Roles',
      label: t('SIDEBAR.CUSTOM_ROLES'),
      icon: 'i-lucide-shield-plus',
      to: accountScopedRoute('custom_roles_list'),
    },
    {
      name: 'Settings Sla',
      label: t('SIDEBAR.SLA'),
      icon: 'i-lucide-clock-alert',
      to: accountScopedRoute('sla_list'),
    },
    {
      name: 'Settings Security',
      label: t('SIDEBAR.SECURITY'),
      icon: 'i-lucide-shield',
      to: accountScopedRoute('security_settings_index'),
    },
    {
      name: 'Settings Billing',
      label: t('SIDEBAR.BILLING'),
      icon: 'i-lucide-credit-card',
      to: accountScopedRoute('billing_settings_index'),
    }
  );

  const reportsChildren = [
    {
      name: 'Reports Overview',
      label: t('SIDEBAR.REPORTS_OVERVIEW'),
      icon: 'i-lucide-bar-chart-3',
      to: accountScopedRoute('account_overview_reports'),
    },
    {
      name: 'Reports Conversation',
      label: t('SIDEBAR.REPORTS_CONVERSATION'),
      icon: 'i-lucide-messages-square',
      to: accountScopedRoute('conversation_reports'),
    },
    {
      name: 'Reports Agent',
      label: t('SIDEBAR.REPORTS_AGENT'),
      icon: 'i-lucide-square-user',
      to: accountScopedRoute('agent_reports_index'),
    },
    {
      name: 'Reports Team',
      label: t('SIDEBAR.REPORTS_TEAM'),
      icon: 'i-lucide-users',
      to: accountScopedRoute('team_reports_index'),
    },
    {
      name: 'Reports Inbox',
      label: t('SIDEBAR.REPORTS_INBOX'),
      icon: 'i-lucide-inbox',
      to: accountScopedRoute('inbox_reports_index'),
    },
    {
      name: 'Reports Label',
      label: t('SIDEBAR.REPORTS_LABEL'),
      icon: 'i-lucide-tags',
      to: accountScopedRoute('label_reports_index'),
    },
    {
      name: 'Reports Tasks',
      label: t('SIDEBAR.REPORTS_TASKS'),
      icon: 'i-lucide-list-todo',
      to: accountScopedRoute('tasks_reports'),
    },
  ];

  if (isAdmin.value) {
    reportsChildren.push({
      name: 'Reports Response Statistics',
      label: t('SIDEBAR.RESPONSE_STATISTICS'),
      icon: 'i-lucide-timer',
      to: accountScopedRoute('response_statistics'),
    });
    reportsChildren.push({
      name: 'Reports Resolution Statistics',
      label: t('SIDEBAR.RESOLUTION_STATISTICS'),
      icon: 'i-lucide-check-circle',
      to: accountScopedRoute('resolution_statistics'),
    });
    reportsChildren.push({
      name: 'Reports CSAT Statistics',
      label: t('SIDEBAR.CSAT_STATISTICS'),
      icon: 'i-lucide-star',
      to: accountScopedRoute('csat_statistics'),
    });
    reportsChildren.push({
      name: 'Reports Quality Review',
      label: t('SIDEBAR.QUALITY_REVIEW'),
      icon: 'i-lucide-brain',
      to: accountScopedRoute('quality_review_statistics'),
    });
  }

  const topItems = [
    {
      name: 'TodoList',
      label: t('TODO.TITLE'),
      icon: 'i-lucide-list-todo',
      to: accountScopedRoute('todo_list'),
      activeOn: ['todo_list'],
    },
  ];

  if (isAdmin.value || isTelegramOperator.value) {
    topItems.push({
      name: 'TelegramDialogues',
      label: t('SIDEBAR.TELEGRAM_DIALOGUES'),
      icon: 'i-lucide-send',
      to: accountScopedRoute('telegram_dialogues'),
      activeOn: ['telegram_dialogues', 'telegram_dialogues_chat'],
      getterKeys: {
        count: 'telegramDialogues/getTotalUnreadCount',
        badge: 'telegramDialogues/getTotalUnreadCount',
      },
    });
  }

  return [
    ...topItems,
    {
      name: 'Conversation',
      label: t('SIDEBAR.CONVERSATIONS'),
      icon: 'i-lucide-message-circle',
      children: [
        {
          name: 'All',
          label: t('SIDEBAR.ALL_CONVERSATIONS'),
          activeOn: ['inbox_conversation'],
          to: accountScopedRoute('home'),
          count: allSectionUnreadCount.value || 0,
          totalCount: sidebarAllCount.value,
        },
        {
          name: 'Unattended',
          activeOn: ['conversation_through_unattended'],
          label: t('SIDEBAR.UNATTENDED_CONVERSATIONS'),
          to: accountScopedRoute('conversation_unattended'),
          count: unattendedUnreadCount.value || 0,
          totalCount: sidebarUnattendedCount.value,
        },
        ...(isAdmin.value
          ? [
              {
                name: 'Mine',
                activeOn: ['conversation_through_mine'],
                label: t('SIDEBAR.MINE_CONVERSATIONS'),
                to: accountScopedRoute('conversation_mine'),
                count: mineUnreadCount.value || 0,
                totalCount: sidebarMineCount.value,
              },
            ]
          : []),
        {
          name: 'Pending',
          activeOn: ['conversation_through_pending'],
          label: t('SIDEBAR.PENDING_CONVERSATIONS'),
          to: accountScopedRoute('conversation_pending'),
          count: standByUnreadCount.value || 0,
          totalCount: sidebarStandByCount.value,
        },
        {
          name: 'Teams',
          label: t('SIDEBAR.TEAMS'),
          icon: 'i-lucide-users',
          activeOn: ['conversations_through_team'],
          children: teams.value.map(team => {
            const unreadCount = getUnreadCountForTeam.value(team.id);
            const teamTotalCount = getSidebarTotalCountForTeam.value(team.id);
            return {
              name: `${team.name}-${team.id}`,
              label: team.name,
              count: unreadCount,
              totalCount: teamTotalCount,
              to: accountScopedRoute('team_conversations', { teamId: team.id }),
            };
          }),
        },
        {
          name: 'Channels',
          label: t('SIDEBAR.CHANNELS'),
          icon: 'i-lucide-mailbox',
          activeOn: ['conversation_through_inbox'],
          children: sortedInboxes.value.map(inbox => ({
            name: `${inbox.name}-${inbox.id}`,
            label: inbox.name,
            to: accountScopedRoute('inbox_dashboard', { inbox_id: inbox.id }),
            component: leafProps =>
              h(ChannelLeaf, {
                label: leafProps.label,
                active: leafProps.active,
                inbox,
              }),
          })),
        },
        {
          name: 'Labels',
          label: t('SIDEBAR.LABELS'),
          icon: 'i-lucide-tag',
          activeOn: ['conversations_through_label'],
          children: labels.value.map(label => {
            const unreadCount = getUnreadCountForLabel.value(label.title);
            return {
              name: `${label.title}-${label.id}`,
              label: label.title,
              count: unreadCount,
              icon: h('span', {
                class: `size-[12px] ring-1 ring-n-alpha-1 dark:ring-white/20 ring-inset rounded-sm`,
                style: { backgroundColor: label.color },
              }),
              to: accountScopedRoute('label_conversations', {
                label: label.title,
              }),
              component: leafProps =>
                h('div', { class: 'flex items-center gap-2 flex-1 min-w-0' }, [
                  h('span', {
                    class: `size-[12px] ring-1 ring-n-alpha-1 dark:ring-white/20 ring-inset rounded-sm flex-shrink-0`,
                    style: { backgroundColor: label.color },
                  }),
                  h(
                    'div',
                    { class: 'flex-1 truncate min-w-0' },
                    leafProps.label
                  ),
                  leafProps.count > 0
                    ? h(
                        'span',
                        {
                          class:
                            'ml-auto text-xs font-semibold px-1.5 py-0.5 rounded bg-n-ruby-9 text-white',
                        },
                        leafProps.count > 99 ? '99+' : leafProps.count
                      )
                    : null,
                ]),
            };
          }),
        },
      ],
    },
    {
      name: 'Reports',
      label: t('SIDEBAR.REPORTS'),
      icon: 'i-lucide-bar-chart-2',
      children: reportsChildren,
    },
    {
      name: 'Settings',
      label: t('SIDEBAR.SETTINGS'),
      icon: 'i-lucide-bolt',
      children: settingsChildren,
    },
  ];
});
</script>

<template>
  <aside
    v-on-click-outside="[
      closeMobileSidebar,
      { ignore: ['#mobile-sidebar-launcher'] },
    ]"
    class="bg-n-solid-2 rtl:border-l ltr:border-r border-n-weak flex flex-col text-sm pb-1 fixed top-0 ltr:left-0 rtl:right-0 h-full z-40 transition-transform duration-200 ease-in-out md:static w-[200px] basis-[200px] md:flex-shrink-0 md:ltr:translate-x-0 md:rtl:-translate-x-0"
    :class="[
      {
        'shadow-lg md:shadow-none': isMobileSidebarOpen,
        'ltr:-translate-x-full rtl:translate-x-full': !isMobileSidebarOpen,
      },
    ]"
  >
    <section class="grid gap-2 mt-2 mb-4">
      <div class="flex gap-2 items-center px-2 min-w-0">
        <div class="grid flex-shrink-0 place-content-center size-6">
          <Logo class="size-4" />
        </div>
        <div class="flex-shrink-0 w-px h-3 bg-n-strong" />
        <SidebarAccountSwitcher
          class="flex-grow -mx-1 min-w-0"
          @show-create-account-modal="emit('showCreateAccountModal')"
        />
      </div>
      <div class="flex gap-2 px-2">
        <RouterLink
          :to="{ name: 'search' }"
          class="flex gap-2 items-center px-2 py-1 w-full h-7 rounded-lg outline outline-1 outline-n-weak bg-n-solid-3 dark:bg-n-black/30"
        >
          <span class="flex-shrink-0 i-lucide-search size-4 text-n-slate-11" />
          <span class="flex-grow text-left">
            {{ t('COMBOBOX.SEARCH_PLACEHOLDER') }}
          </span>
          <span
            class="hidden tracking-wide pointer-events-none select-none text-n-slate-10"
          >
            {{ searchShortcut }}
          </span>
        </RouterLink>
        <ComposeConversation align-position="right">
          <template #trigger="{ toggle }">
            <Button
              icon="i-lucide-pen-line"
              color="slate"
              size="sm"
              class="!h-7 !bg-n-solid-3 dark:!bg-n-black/30 !outline-n-weak !text-n-slate-11"
              @click="toggle"
            />
          </template>
        </ComposeConversation>
      </div>
    </section>
    <nav class="grid overflow-y-scroll flex-grow gap-2 px-2 pb-5 no-scrollbar">
      <ul class="flex flex-col gap-1.5 m-0 list-none">
        <SidebarGroup
          v-for="item in menuItems"
          :key="item.name"
          v-bind="item"
        />
      </ul>
    </nav>
    <section
      class="flex flex-col flex-shrink-0 relative gap-1 justify-between items-center"
    >
      <div
        class="pointer-events-none absolute inset-x-0 -top-[31px] h-8 bg-gradient-to-t from-n-solid-2 to-transparent"
      />
      <SidebarChangelogCard
        v-if="isOnChatwootCloud && !isACustomBrandedInstance"
      />
      <div
        class="p-1 flex-shrink-0 flex w-full justify-between z-10 gap-2 items-center border-t border-n-weak shadow-[0px_-2px_4px_0px_rgba(27,28,29,0.02)]"
      >
        <SidebarProfileMenu
          @open-key-shortcut-modal="emit('openKeyShortcutModal')"
        />
      </div>
    </section>
  </aside>
</template>

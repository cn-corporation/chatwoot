<script setup>
// [TODO] This componet is too big and bulky to be in the same file, we can consider splitting this into multiple
// composables and components, useVirtualChatList, useChatlistFilters
import {
  ref,
  unref,
  provide,
  computed,
  watch,
  onMounted,
  onUnmounted,
  defineEmits,
} from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import {
  useMapGetter,
  useFunctionGetter,
} from 'dashboard/composables/store.js';

// [VITE] [TODO] We are using vue-virtual-scroll for now, since that seemed the simplest way to migrate
// from the current one. But we should consider using tanstack virtual in the future
// https://tanstack.com/virtual/latest/docs/framework/vue/examples/variable
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import ChatListHeader from './ChatListHeader.vue';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import ConversationFilter from 'next/filter/ConversationFilter.vue';
import SaveCustomView from 'next/filter/SaveCustomView.vue';
import ChatTypeTabs from './widgets/ChatTypeTabs.vue';
import ConversationItem from './ConversationItem.vue';
import DeleteCustomViews from 'dashboard/routes/dashboard/customviews/DeleteCustomViews.vue';
import ConversationBulkActions from './widgets/conversation/conversationBulkActions/Index.vue';
import IntersectionObserver from './IntersectionObserver.vue';
import TeleportWithDirection from 'dashboard/components-next/TeleportWithDirection.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import NoteTaskModal from './widgets/conversation/NoteTaskModal.vue';
import ConversationCloseTopicsModal from './ConversationCloseTopicsModal.vue';

import { useUISettings } from 'dashboard/composables/useUISettings';
import { useAlert } from 'dashboard/composables';
import { useChatListKeyboardEvents } from 'dashboard/composables/chatlist/useChatListKeyboardEvents';
import {
  useBulkActions,
  MAX_BULK_MESSAGE_SELECTIONS,
} from 'dashboard/composables/chatlist/useBulkActions';
import BulkMessageModal from './widgets/conversation/BulkMessageModal.vue';
import { useFilter } from 'shared/composables/useFilter';
import { useI18n } from 'vue-i18n';
import {
  useCamelCase,
  useSnakeCase,
} from 'dashboard/composables/useTransformKeys';
import { useEmitter } from 'dashboard/composables/emitter';

import { emitter } from 'shared/helpers/mitt';

import wootConstants from 'dashboard/constants/globals';
import advancedFilterOptions from './widgets/conversation/advancedFilterItems';
import filterQueryGenerator from '../helper/filterQueryGenerator.js';
import languages from 'dashboard/components/widgets/conversation/advancedFilterItems/languages';
import countries from 'shared/constants/countries';
import { generateValuesForEditCustomViews } from 'dashboard/helper/customViewsHelper';
import { conversationListPageURL } from '../helper/URLHelper';
import {
  isOnMentionsView,
  isOnUnattendedView,
} from '../store/modules/conversations/helpers/actionHelpers';
import {
  getUserPermissions,
  filterItemsByPermission,
} from 'dashboard/helper/permissionsHelper.js';
import { matchesFilters } from '../store/modules/conversations/helpers/filterHelpers';
import { ASSIGNEE_TYPE_TAB_PERMISSIONS } from 'dashboard/constants/permissions.js';

import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

const props = defineProps({
  conversationInbox: { type: [String, Number], default: 0 },
  teamId: { type: [String, Number], default: 0 },
  label: { type: String, default: '' },
  conversationType: { type: String, default: '' },
  foldersId: { type: [String, Number], default: 0 },
  showConversationList: { default: true, type: Boolean },
  isOnExpandedLayout: { default: false, type: Boolean },
});

const emit = defineEmits(['conversationLoad']);
const { uiSettings } = useUISettings();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useStore();

const conversationListRef = ref(null);
const conversationDynamicScroller = ref(null);

provide('contextMenuElementTarget', conversationDynamicScroller);

// Single timer for all conversation priority calculations
const conversationTimerTick = ref(Date.now());
let priorityTimer = null;

// Update timer every 30 seconds to recalculate priorities
const startPriorityTimer = () => {
  priorityTimer = setInterval(() => {
    conversationTimerTick.value = Date.now();
  }, 30000); // 30 seconds
};

const stopPriorityTimer = () => {
  if (priorityTimer) {
    clearInterval(priorityTimer);
    priorityTimer = null;
  }
};

let pendingTasksTimer = null;

const fetchPendingTasks = () => {
  store.dispatch('tasks/fetchPending');
};

// Backstop for task events missed while the SSE stream was down.
const startPendingTasksTimer = () => {
  pendingTasksTimer = setInterval(fetchPendingTasks, 60000); // 60 seconds
};

const stopPendingTasksTimer = () => {
  if (pendingTasksTimer) {
    clearInterval(pendingTasksTimer);
    pendingTasksTimer = null;
  }
};

provide('conversationTimerTick', conversationTimerTick);

const activeAssigneeTab = ref(wootConstants.ASSIGNEE_TYPE.UNASSIGNED);
const activeStatus = ref(wootConstants.STATUS_TYPE.OPEN);
const activeSortBy = ref(wootConstants.SORT_BY_TYPE.LAST_ACTIVITY_AT_DESC);
const showAdvancedFilters = ref(false);
// chatsOnView is to store the chats that are currently visible on the screen,
// which mirrors the conversationList.
const chatsOnView = ref([]);
const foldersQuery = ref({});
const showAddFoldersModal = ref(false);
const showDeleteFoldersModal = ref(false);
const isContextMenuOpen = ref(false);
const appliedFilter = ref([]);
const isLoadingMore = ref(false);
const advancedFilterTypes = ref(
  advancedFilterOptions.map(filter => ({
    ...filter,
    attributeName: t(`FILTER.ATTRIBUTES.${filter.attributeI18nKey}`),
  }))
);

const currentUser = useMapGetter('getCurrentUser');
const chatLists = useMapGetter('getFilteredConversations');
const mineChatsList = useMapGetter('getMineChats');
const allChatList = useMapGetter('getAllStatusChats');
const unAssignedChatsList = useMapGetter('getUnAssignedChats');
const resolvedChatsList = useMapGetter('getResolvedChats');
const chatListLoading = useMapGetter('getChatListLoadingStatus');
const activeInbox = useMapGetter('getSelectedInbox');
const conversationStats = useMapGetter('conversationStats/getStats');
const appliedFilters = useMapGetter('getAppliedConversationFiltersV2');
const folders = useMapGetter('customViews/getConversationCustomViews');
const agentList = useMapGetter('agents/getAgents');
const teamsList = useMapGetter('teams/getTeams');
const inboxesList = useMapGetter('inboxes/getInboxes');
const campaigns = useMapGetter('campaigns/getAllCampaigns');
const labels = useMapGetter('labels/getLabels');
const currentAccountId = useMapGetter('getCurrentAccountId');

const myTeams = useMapGetter('teams/getMyTeams');
// We can't useFunctionGetter here since it needs to be called on setup?
const getTeamFn = useMapGetter('teams/getTeam');

useChatListKeyboardEvents(conversationListRef);
const {
  selectedConversations,
  selectedInboxes,
  isBulkMessageMode,
  canSelectMore,
  selectConversation,
  deSelectConversation,
  selectAllConversations,
  resetBulkActions,
  isConversationSelected,
  toggleBulkMessageMode,
  onAssignAgent,
  onAssignLabels,
  onAssignTeamsForBulk,
  onUpdateConversations: onUpdateConversationsOriginal,
} = useBulkActions();

const showCloseTopicsModal = ref(false);
const closeConversationId = ref(null);
const pendingBulkAction = ref(null);

const onUpdateConversations = (status, snoozedUntil) => {
  if (status === wootConstants.STATUS_TYPE.RESOLVED) {
    if (selectedConversations.value.length > 0) {
      closeConversationId.value = selectedConversations.value[0];
      showCloseTopicsModal.value = true;
      pendingBulkAction.value = { status, snoozedUntil };
      return;
    }
  }

  onUpdateConversationsOriginal(status, snoozedUntil);
};
const showBulkMessageModal = ref(false);

function onToggleBulkMessageMode(value) {
  toggleBulkMessageMode(value);
}

function openBulkMessageModal() {
  showBulkMessageModal.value = true;
}

function closeBulkMessageModal() {
  showBulkMessageModal.value = false;
}

function onBulkSendComplete() {
  closeBulkMessageModal();
  toggleBulkMessageMode(false);
}

const {
  initializeStatusAndAssigneeFilterToModal,
  initializeInboxTeamAndLabelFilterToModal,
} = useFilter({
  filteri18nKey: 'FILTER',
  attributeModel: 'conversation_attribute',
});

// computed
const intersectionObserverOptions = computed(() => {
  return {
    root: conversationListRef.value,
    rootMargin: '100px 0px 100px 0px',
  };
});

const hasAppliedFilters = computed(() => {
  return appliedFilters.value.length !== 0;
});

const activeFolder = computed(() => {
  if (props.foldersId) {
    const activeView = folders.value.filter(
      view => view.id === Number(props.foldersId)
    );
    const [firstValue] = activeView;
    return firstValue;
  }
  return undefined;
});

const activeFolderName = computed(() => {
  return activeFolder.value?.name;
});

const hasActiveFolders = computed(() => {
  return Boolean(activeFolder.value && props.foldersId !== 0);
});

const hasAppliedFiltersOrActiveFolders = computed(() => {
  return hasAppliedFilters.value || hasActiveFolders.value;
});

const isSidebarConversationType = computed(() => {
  return ['mine', 'pending'].includes(props.conversationType);
});

const currentUserDetails = computed(() => {
  const { id, name } = currentUser.value;
  return { id, name };
});

const userPermissions = computed(() => {
  return getUserPermissions(currentUser.value, currentAccountId.value);
});

const assigneeTabItems = computed(() => {
  const stats = conversationStats.value;

  return filterItemsByPermission(
    ASSIGNEE_TYPE_TAB_PERMISSIONS,
    userPermissions.value,
    item => item.permissions
  ).map(({ key }) => {
    let count = 0;

    switch (key) {
      case 'me':
        count = stats.mineCount || 0;
        break;
      case 'unassigned':
        count = stats.unAssignedCount || 0;
        break;
      case 'all':
      case 'all-operators':
        count = stats.allCount || 0;
        break;
      case 'pending':
        count = stats.pendingCount || 0;
        break;
      case 'resolved':
        count = stats.resolvedCount || 0;
        break;
      default:
        count = 0;
    }

    return {
      key,
      name: t(`CHAT_LIST.ASSIGNEE_TYPE_TABS.${key}`),
      count,
    };
  });
});

const simplifiedAssigneeTabItems = computed(() => {
  const operatorEssentialTabs = ['unassigned', 'resolved'];

  const filteredTabs = assigneeTabItems.value.filter(item =>
    operatorEssentialTabs.includes(item.key)
  );

  return filteredTabs;
});

const showAssigneeInConversationCard = computed(() => {
  return (
    hasAppliedFiltersOrActiveFolders.value ||
    activeAssigneeTab.value === wootConstants.ASSIGNEE_TYPE.ALL
  );
});

const currentPageFilterKey = computed(() => {
  if (hasAppliedFiltersOrActiveFolders.value) {
    return 'appliedFilters';
  }
  if (props.conversationType === 'pending') {
    return 'stand_by';
  }
  return activeAssigneeTab.value;
});

const inbox = useFunctionGetter('inboxes/getInbox', activeInbox);
const currentPage = useFunctionGetter(
  'conversationPage/getCurrentPageFilter',
  currentPageFilterKey
);
const currentFiltersPage = useFunctionGetter(
  'conversationPage/getCurrentPageFilter',
  currentPageFilterKey
);
const hasCurrentPageEndReached = useFunctionGetter(
  'conversationPage/getHasEndReached',
  currentPageFilterKey
);

const conversationCustomAttributes = useFunctionGetter(
  'attributes/getAttributesByModel',
  'conversation_attribute'
);

const conversationListPagination = computed(() => {
  return currentPage.value + 1;
});

const conversationFilters = computed(() => {
  let status = activeStatus.value;
  if (activeAssigneeTab.value === 'resolved') {
    status = 'resolved';
  }

  let assigneeType = activeAssigneeTab.value;

  if (props.conversationType === 'mine') {
    assigneeType = 'me';
  }

  if (props.conversationType === 'pending') {
    assigneeType = 'stand_by';
    status = 'stand_by';
  }

  return {
    inboxId: props.conversationInbox ? props.conversationInbox : undefined,
    assigneeType,
    status,
    sortBy: activeSortBy.value,
    page: conversationListPagination.value,
    labels: props.label ? [props.label] : undefined,
    teamId: props.teamId || undefined,
    conversationType: props.conversationType || undefined,
  };
});

const activeTeam = computed(() => {
  if (props.teamId) {
    return getTeamFn.value(props.teamId);
  }
  return {};
});

const pageTitle = computed(() => {
  if (hasAppliedFilters.value) {
    return t('CHAT_LIST.TAB_HEADING');
  }
  if (inbox.value.name) {
    return inbox.value.name;
  }
  if (activeTeam.value.name) {
    return activeTeam.value.name;
  }
  if (props.label) {
    return `#${props.label}`;
  }
  if (props.conversationType === 'mention') {
    return t('CHAT_LIST.MENTION_HEADING');
  }
  if (props.conversationType === 'participating') {
    return t('CONVERSATION_PARTICIPANTS.SIDEBAR_MENU_TITLE');
  }
  if (props.conversationType === 'unattended') {
    return t('CHAT_LIST.UNATTENDED_HEADING');
  }
  if (props.conversationType === 'mine') {
    return t('SIDEBAR.MINE_CONVERSATIONS');
  }
  if (props.conversationType === 'pending') {
    return t('SIDEBAR.PENDING_CONVERSATIONS');
  }
  if (hasActiveFolders.value) {
    return activeFolder.value.name;
  }
  return t('CHAT_LIST.TAB_HEADING');
});

const conversationList = computed(() => {
  let localConversationList = [];

  if (!hasAppliedFiltersOrActiveFolders.value) {
    const filters = conversationFilters.value;
    if (props.conversationType === 'mine') {
      localConversationList = [...mineChatsList.value(filters)];
    } else if (props.conversationType === 'pending') {
      localConversationList = [...allChatList.value(filters)];
    } else if (activeAssigneeTab.value === 'unassigned') {
      localConversationList = [...unAssignedChatsList.value(filters)];
    } else if (activeAssigneeTab.value === 'resolved') {
      localConversationList = [...resolvedChatsList.value(filters)];
    } else {
      localConversationList = [...allChatList.value(filters)];
    }
  } else {
    localConversationList = [...chatLists.value];
  }

  if (activeFolder.value) {
    const { payload } = activeFolder.value.query;
    localConversationList = localConversationList.filter(conversation => {
      return matchesFilters(conversation, payload);
    });
  }

  if (activeAssigneeTab.value !== 'resolved') {
    const isCurrentUserAdmin = currentUser.value?.role === 'administrator';
    if (!isCurrentUserAdmin) {
      const myTeamIds = myTeams.value.map(team => team.id);

      localConversationList = localConversationList.filter(conversation => {
        const teamId =
          conversation.team_id || conversation.meta?.team?.id || null;

        if (myTeamIds.length) return myTeamIds.includes(teamId);
        return teamId === null;
      });
    }
  }

  return localConversationList;
});

const showEndOfListMessage = computed(() => {
  return (
    conversationList.value.length &&
    hasCurrentPageEndReached.value &&
    !chatListLoading.value
  );
});

const allConversationsSelected = computed(() => {
  return (
    conversationList.value.length === selectedConversations.value.length &&
    conversationList.value.every(el =>
      selectedConversations.value.includes(el.id)
    )
  );
});

const uniqueInboxes = computed(() => {
  return [...new Set(selectedInboxes.value)];
});

// ---------------------- Methods -----------------------
function setFiltersFromUISettings() {
  const { conversations_filter_by: filterBy = {} } = uiSettings.value;
  const { status, order_by: orderBy } = filterBy;
  activeStatus.value = status || wootConstants.STATUS_TYPE.OPEN;
  activeSortBy.value = Object.values(wootConstants.SORT_BY_TYPE).includes(
    orderBy
  )
    ? orderBy
    : wootConstants.SORT_BY_TYPE.PRIORITY_DESC;
}

function emitConversationLoaded() {
  emit('conversationLoad');
  // [VITE] removing this since the library has changed
  // nextTick(() => {
  //   // Addressing a known issue in the virtual list library where dynamically added items
  //   // might not render correctly. This workaround involves a slight manual adjustment
  //   // to the scroll position, triggering the list to refresh its rendering.
  //   const virtualList = conversationListRef.value;
  //   const scrollToOffset = virtualList?.scrollToOffset;
  //   const currentOffset = virtualList?.getOffset() || 0;
  //   if (scrollToOffset) {
  //     scrollToOffset(currentOffset + 1);
  //   }
  // });
}

function fetchFilteredConversations(payload) {
  payload = useSnakeCase(payload);
  let page = currentFiltersPage.value + 1;
  const promise = store
    .dispatch('fetchFilteredConversations', {
      queryData: filterQueryGenerator(payload),
      page,
    })
    .then(emitConversationLoaded);

  showAdvancedFilters.value = false;
  return promise;
}

function fetchSavedFilteredConversations(payload) {
  payload = useSnakeCase(payload);
  let page = currentFiltersPage.value + 1;
  return store
    .dispatch('fetchFilteredConversations', {
      queryData: payload,
      page,
    })
    .then(emitConversationLoaded);
}

function onApplyFilter(payload) {
  payload = useSnakeCase(payload);
  resetBulkActions();
  foldersQuery.value = filterQueryGenerator(payload);
  store.dispatch('conversationPage/reset');
  store.dispatch('emptyAllConversations');
  fetchFilteredConversations(payload);
}

function closeAdvanceFiltersModal() {
  showAdvancedFilters.value = false;
  appliedFilter.value = [];
}

function onUpdateSavedFilter(payload, folderName) {
  const transformedPayload = useSnakeCase(payload);
  const payloadData = {
    ...unref(activeFolder),
    name: unref(folderName),
    query: filterQueryGenerator(transformedPayload),
  };
  store.dispatch('customViews/update', payloadData);
  closeAdvanceFiltersModal();
}

function onClickOpenAddFoldersModal() {
  showAddFoldersModal.value = true;
}

function onCloseAddFoldersModal() {
  showAddFoldersModal.value = false;
}

function onClickOpenDeleteFoldersModal() {
  showDeleteFoldersModal.value = true;
}

function onCloseDeleteFoldersModal() {
  showDeleteFoldersModal.value = false;
}

function setParamsForEditFolderModal() {
  // Here we are setting the params for edit folder modal to show the existing values.

  // For agent, team, inboxes,and campaigns we get only the id's from the query.
  // So we are mapping the id's to the actual values.

  // For labels we get the name of the label from the query.
  // If we delete the label from the label list then we will not be able to show the label name.

  // For custom attributes we get only attribute key.
  // So we are mapping it to find the input type of the attribute to show in the edit folder modal.
  return {
    agents: agentList.value,
    teams: teamsList.value,
    inboxes: inboxesList.value,
    labels: labels.value,
    campaigns: campaigns.value,
    languages: languages,
    countries: countries,
    priority: [
      { id: 'low', name: t('CONVERSATION.PRIORITY.OPTIONS.LOW') },
      { id: 'medium', name: t('CONVERSATION.PRIORITY.OPTIONS.MEDIUM') },
      { id: 'high', name: t('CONVERSATION.PRIORITY.OPTIONS.HIGH') },
      { id: 'urgent', name: t('CONVERSATION.PRIORITY.OPTIONS.URGENT') },
    ],
    filterTypes: advancedFilterTypes.value,
    allCustomAttributes: conversationCustomAttributes.value,
  };
}

function initializeExistingFilterToModal() {
  const statusFilter = initializeStatusAndAssigneeFilterToModal(
    activeStatus.value,
    currentUserDetails.value,
    activeAssigneeTab.value
  );
  // TODO: Remove the usage of useCamelCase after migrating useFilter to camelcase
  if (statusFilter) {
    appliedFilter.value = [...appliedFilter.value, useCamelCase(statusFilter)];
  }

  // TODO: Remove the usage of useCamelCase after migrating useFilter to camelcase
  const otherFilters = initializeInboxTeamAndLabelFilterToModal(
    props.conversationInbox,
    inbox.value,
    props.teamId,
    activeTeam.value,
    props.label
  ).map(useCamelCase);

  appliedFilter.value = [...appliedFilter.value, ...otherFilters];
}

function initializeFolderToFilterModal(newActiveFolder) {
  // Here we are setting the params for edit folder modal.
  //  To show the existing values. when we click on edit folder button.

  // Here we get the query from the active folder.
  // And we are mapping the query to the actual values.
  // To show in the edit folder modal by the help of generateValuesForEditCustomViews helper.
  const query = unref(newActiveFolder)?.query?.payload;
  if (!Array.isArray(query)) return;

  const newFilters = query.map(filter => {
    const transformed = useCamelCase(filter);
    const values = Array.isArray(transformed.values)
      ? generateValuesForEditCustomViews(
          useSnakeCase(filter),
          setParamsForEditFolderModal()
        )
      : [];

    return {
      attributeKey: transformed.attributeKey,
      attributeModel: transformed.attributeModel,
      customAttributeType: transformed.customAttributeType,
      filterOperator: transformed.filterOperator,
      queryOperator: transformed.queryOperator ?? 'and',
      values,
    };
  });

  appliedFilter.value = [...appliedFilter.value, ...newFilters];
}

function initalizeAppliedFiltersToModal() {
  appliedFilter.value = [...appliedFilters.value];
}

function onToggleAdvanceFiltersModal() {
  if (showAdvancedFilters.value === true) {
    closeAdvanceFiltersModal();
    return;
  }

  if (!hasAppliedFilters.value && !hasActiveFolders.value) {
    initializeExistingFilterToModal();
  }
  if (hasActiveFolders.value) {
    initializeFolderToFilterModal(activeFolder.value);
  }
  if (hasAppliedFilters.value) {
    initalizeAppliedFiltersToModal();
  }

  showAdvancedFilters.value = true;
}

function fetchConversations() {
  store.dispatch('updateChatListFilters', conversationFilters.value);
  return store.dispatch('fetchAllConversations').then(emitConversationLoaded);
}

function resetAndFetchData() {
  appliedFilter.value = [];
  resetBulkActions();
  store.dispatch('conversationPage/reset');
  store.dispatch('emptyAllConversations');
  store.dispatch('clearConversationFilters');
  if (hasActiveFolders.value) {
    const payload = activeFolder.value.query;
    fetchSavedFilteredConversations(payload);
  }
  if (props.foldersId) {
    return;
  }
  fetchConversations();
  store.dispatch('conversationStats/get', conversationFilters.value);
}

function loadMoreConversations() {
  // Guard against multiple simultaneous requests
  if (
    hasCurrentPageEndReached.value ||
    chatListLoading.value ||
    isLoadingMore.value
  ) {
    return;
  }

  isLoadingMore.value = true;

  let loadPromise;
  if (!hasAppliedFiltersOrActiveFolders.value) {
    loadPromise = fetchConversations();
  } else if (hasActiveFolders.value) {
    loadPromise = fetchSavedFilteredConversations(activeFolder.value.query);
  } else if (hasAppliedFilters.value) {
    loadPromise = fetchFilteredConversations(appliedFilters.value);
  }

  // Ensure flag is cleared even if request fails
  Promise.resolve(loadPromise).finally(() => {
    isLoadingMore.value = false;
  });
}

function updateAssigneeTab(selectedTab) {
  if (activeAssigneeTab.value !== selectedTab) {
    // Guard against switching while data is loading
    if (chatListLoading.value || isLoadingMore.value) {
      return;
    }

    resetBulkActions();
    emitter.emit('clearSearchInput');

    // Reset page counter for the new tab before switching
    store.dispatch('conversationPage/reset');

    activeAssigneeTab.value = selectedTab;

    // Always fetch conversations for the new tab (will fetch page 1 now)
    fetchConversations();
  }
}

function onBasicFilterChange(value, type) {
  if (type === 'status') {
    activeStatus.value = value;
  } else {
    activeSortBy.value = value;
  }
  resetAndFetchData();
}

function openLastSavedItemInFolder() {
  const lastItemOfFolder = folders.value[folders.value.length - 1];
  const lastItemId = lastItemOfFolder.id;
  router.push({
    name: 'folder_conversations',
    params: { id: lastItemId },
  });
}

function openLastItemAfterDeleteInFolder() {
  if (folders.value.length > 0) {
    openLastSavedItemInFolder();
  } else {
    router.push({ name: 'home' });
    fetchConversations();
  }
}

function redirectToConversationList() {
  const {
    params: { accountId, inbox_id: inboxId, label, teamId },
    name,
  } = route;

  let conversationType = '';
  if (isOnMentionsView({ route: { name } })) {
    conversationType = 'mention';
  } else if (isOnUnattendedView({ route: { name } })) {
    conversationType = 'unattended';
  }
  router.push(
    conversationListPageURL({
      accountId,
      conversationType: conversationType,
      customViewId: props.foldersId,
      inboxId,
      label,
      teamId,
    })
  );
}

// Auto-assign priority based on waiting time (no manual assignment)
async function assignPriority(priority, conversationId = null) {
  // Skip if trying to set null or same priority
  const conversation = chatLists.value.find(c => c.id === conversationId);
  if (!priority || (conversation && conversation.priority === priority)) {
    return;
  }

  store.dispatch('setCurrentChatPriority', {
    priority,
    conversationId,
  });
  // Silent update for automatic priority changes
  await store.dispatch('assignPriority', { conversationId, priority });
}

async function markAsUnread(conversationId) {
  try {
    await store.dispatch('markMessagesUnread', {
      id: conversationId,
    });
    await store.dispatch('markConversationAsUnreadForOperator', conversationId);
    redirectToConversationList();
  } catch (error) {
    // Ignore error
  }
}
async function markAsRead(conversationId) {
  try {
    await store.dispatch('markMessagesRead', {
      id: conversationId,
    });
    await store.dispatch('markConversationAsReadForOperator', conversationId);
  } catch (error) {
    // Ignore error
  }
}

async function onAssignTeam(team, conversationId = null) {
  try {
    await store.dispatch('assignTeam', {
      conversationId,
      teamId: team.id,
    });
    useAlert(
      t('CONVERSATION.CARD_CONTEXT_MENU.API.TEAM_ASSIGNMENT.SUCCESFUL', {
        team: team.name,
        conversationId,
      })
    );
  } catch (error) {
    useAlert(t('CONVERSATION.CARD_CONTEXT_MENU.API.TEAM_ASSIGNMENT.FAILED'));
  }
}

function toggleConversationStatus(conversationId, status, snoozedUntil) {
  if (status === wootConstants.STATUS_TYPE.RESOLVED) {
    closeConversationId.value = conversationId;
    showCloseTopicsModal.value = true;
    return;
  }

  store
    .dispatch('toggleStatus', {
      conversationId,
      status,
      snoozedUntil,
    })
    .then(() => {
      useAlert(t('CONVERSATION.CHANGE_STATUS'));
    });
}

function closeTopicsModal() {
  showCloseTopicsModal.value = false;
  closeConversationId.value = null;
}

function onCloseTopicsSuccess() {
  showCloseTopicsModal.value = false;
  const conversationId = closeConversationId.value;
  closeConversationId.value = null;

  if (pendingBulkAction.value && selectedConversations.value.length > 1) {
    const remainingIds = selectedConversations.value.filter(
      id => id !== conversationId
    );
    store.dispatch('bulkActions/setSelectedConversationIds', remainingIds);
    onUpdateConversationsOriginal(
      pendingBulkAction.value.status,
      pendingBulkAction.value.snoozedUntil
    );
    pendingBulkAction.value = null;
  } else {
    pendingBulkAction.value = null;
  }

  useAlert(t('CONVERSATION.CHANGE_STATUS'));
}

function allSelectedConversationsStatus(status) {
  if (!selectedConversations.value.length) return false;
  return selectedConversations.value.every(item => {
    return store.getters.getConversationById(item)?.status === status;
  });
}

function onContextMenuToggle(state) {
  isContextMenuOpen.value = state;
}

function toggleSelectAll(check) {
  selectAllConversations(check, conversationList);
}

let fetchStatsTimer = null;
useEmitter('fetch_conversation_stats', () => {
  if (hasAppliedFiltersOrActiveFolders.value) return;
  if (fetchStatsTimer) clearTimeout(fetchStatsTimer);
  fetchStatsTimer = setTimeout(() => {
    if (!hasCurrentPageEndReached.value) {
      fetchConversations();
    }
    store.dispatch('conversationStats/get', conversationFilters.value);
  }, 2000);
});

onMounted(() => {
  store.dispatch('setChatListFilters', conversationFilters.value);
  setFiltersFromUISettings();
  store.dispatch('setChatStatusFilter', activeStatus.value);
  store.dispatch('setChatSortFilter', activeSortBy.value);
  resetAndFetchData();
  if (hasActiveFolders.value) {
    store.dispatch('campaigns/get');
  }
  startPriorityTimer();
  fetchPendingTasks();
  startPendingTasksTimer();
});

onUnmounted(() => {
  stopPriorityTimer();
  stopPendingTasksTimer();
});

const deleteConversationDialogRef = ref(null);
const selectedConversationId = ref(null);
const showNoteTaskModal = ref(false);
const selectedChatForNoteTask = ref(null);
const noteTaskType = ref('note');

async function deleteConversation() {
  try {
    await store.dispatch('deleteConversation', selectedConversationId.value);
    redirectToConversationList();
    selectedConversationId.value = null;
    deleteConversationDialogRef.value.close();
    useAlert(t('CONVERSATION.SUCCESS_DELETE_CONVERSATION'));
  } catch (error) {
    useAlert(t('CONVERSATION.FAIL_DELETE_CONVERSATION'));
  }
}

const handleDelete = conversationId => {
  selectedConversationId.value = conversationId;
  deleteConversationDialogRef.value.open();
};

const handleOpenNoteTask = (conversationId, type) => {
  const conversation = chatLists.value.find(c => c.id === conversationId);
  if (conversation) {
    selectedChatForNoteTask.value = conversation;
    noteTaskType.value = type;
    showNoteTaskModal.value = true;
  }
};

const closeNoteTaskModal = () => {
  showNoteTaskModal.value = false;
  selectedChatForNoteTask.value = null;
};

async function onBlockContact(duration, conversationId) {
  try {
    await store.dispatch('blockContact', { conversationId, duration });
    useAlert(t('CONVERSATION.CARD_CONTEXT_MENU.BLOCK_SUCCESS', { duration }));
  } catch (error) {
    // Handle error
  }
}

async function onUnblockContact(conversationId) {
  try {
    await store.dispatch('unblockContact', conversationId);
    useAlert(t('CONVERSATION.CARD_CONTEXT_MENU.UNBLOCK_SUCCESS'));
  } catch (error) {
    // Handle error
  }
}

provide('selectConversation', selectConversation);
provide('deSelectConversation', deSelectConversation);
provide('assignAgent', onAssignAgent);
provide('assignTeam', onAssignTeam);
provide('assignLabels', onAssignLabels);
provide('updateConversationStatus', toggleConversationStatus);
provide('toggleContextMenu', onContextMenuToggle);
provide('markAsUnread', markAsUnread);
provide('markAsRead', markAsRead);
provide('assignPriority', assignPriority);
provide('isConversationSelected', isConversationSelected);
provide('openNoteTask', handleOpenNoteTask);
provide('deleteConversation', handleDelete);
provide('blockContact', onBlockContact);
provide('unblockContact', onUnblockContact);
provide('isBulkMessageMode', isBulkMessageMode);
provide('canSelectMore', canSelectMore);

watch(activeTeam, () => resetAndFetchData());

watch(
  computed(() => props.conversationInbox),
  () => resetAndFetchData()
);
watch(
  computed(() => props.label),
  () => resetAndFetchData()
);
watch(
  computed(() => props.conversationType),
  () => resetAndFetchData()
);

watch(activeFolder, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    store.dispatch('customViews/setActiveConversationFolder', newVal || null);
  }
  resetAndFetchData();
});

watch(chatLists, () => {
  chatsOnView.value = conversationList.value;
});

// Remove infinite loop watcher - conversationFilters is already updated via fetchConversations
// watch(conversationFilters, (newVal, oldVal) => {
//   if (newVal !== oldVal) {
//     store.dispatch('updateChatListFilters', newVal);
//   }
// });
</script>

<template>
  <div
    class="flex flex-col flex-shrink-0 bg-n-solid-1 conversations-list-wrap w-full h-full"
    :class="[{ hidden: !showConversationList }]"
  >
    <slot />
    <ChatListHeader
      :page-title="pageTitle"
      :has-applied-filters="hasAppliedFilters"
      :has-active-folders="hasActiveFolders"
      :active-status="activeStatus"
      :is-on-expanded-layout="isOnExpandedLayout"
      :conversation-stats="conversationStats"
      :is-list-loading="chatListLoading && !conversationList.length"
      @add-folders="onClickOpenAddFoldersModal"
      @delete-folders="onClickOpenDeleteFoldersModal"
      @filters-modal="onToggleAdvanceFiltersModal"
      @reset-filters="resetAndFetchData"
      @basic-filter-change="onBasicFilterChange"
      @toggle-bulk-message-mode="onToggleBulkMessageMode"
    />

    <TeleportWithDirection
      v-if="showAddFoldersModal"
      to="#saveFilterTeleportTarget"
    >
      <SaveCustomView
        v-model="appliedFilter"
        :custom-views-query="foldersQuery"
        :open-last-saved-item="openLastSavedItemInFolder"
        @close="onCloseAddFoldersModal"
      />
    </TeleportWithDirection>

    <DeleteCustomViews
      v-if="showDeleteFoldersModal"
      v-model:show="showDeleteFoldersModal"
      :active-custom-view="activeFolder"
      :custom-views-id="foldersId"
      :open-last-item-after-delete="openLastItemAfterDeleteInFolder"
      @close="onCloseDeleteFoldersModal"
    />

    <ChatTypeTabs
      v-if="!hasAppliedFiltersOrActiveFolders && !isSidebarConversationType"
      :items="simplifiedAssigneeTabItems"
      :active-tab="activeAssigneeTab"
      is-compact
      @chat-tab-change="updateAssigneeTab"
    />

    <p
      v-if="!chatListLoading && !conversationList.length"
      class="flex items-center justify-center p-4 overflow-auto"
    >
      {{ $t('CHAT_LIST.LIST.404') }}
    </p>
    <ConversationBulkActions
      v-if="selectedConversations.length"
      :conversations="selectedConversations"
      :all-conversations-selected="allConversationsSelected"
      :selected-inboxes="uniqueInboxes"
      :show-open-action="allSelectedConversationsStatus('open')"
      :show-resolved-action="allSelectedConversationsStatus('resolved')"
      :show-snoozed-action="allSelectedConversationsStatus('snoozed')"
      :is-bulk-message-mode="isBulkMessageMode"
      :max-selections="MAX_BULK_MESSAGE_SELECTIONS"
      @select-all-conversations="toggleSelectAll"
      @assign-agent="onAssignAgent"
      @update-conversations="onUpdateConversations"
      @assign-labels="onAssignLabels"
      @assign-team="onAssignTeamsForBulk"
      @bulk-send="openBulkMessageModal"
    />
    <div
      ref="conversationListRef"
      class="flex-1 overflow-hidden conversations-list hover:overflow-y-auto"
      :class="{ 'overflow-hidden': isContextMenuOpen }"
    >
      <DynamicScroller
        ref="conversationDynamicScroller"
        :items="conversationList"
        :min-item-size="24"
        class="w-full h-full overflow-auto"
      >
        <template #default="{ item, index, active }">
          <!--
            If we encounter resizing issues, we can set the `watchData` prop to true
            this will deeply watch the entire object instead of just size dependencies
            But it can impact performance
          -->
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :data-index="index"
            :size-dependencies="[
              item.messages,
              item.labels,
              item.uuid,
              item.inbox_id,
            ]"
          >
            <ConversationItem
              :source="item"
              :label="label"
              :team-id="teamId"
              :folders-id="foldersId"
              :conversation-type="conversationType"
              :show-assignee="showAssigneeInConversationCard"
              @select-conversation="selectConversation"
              @de-select-conversation="deSelectConversation"
            />
          </DynamicScrollerItem>
        </template>
        <template #after>
          <div v-if="chatListLoading" class="flex justify-center my-4">
            <Spinner class="text-n-brand" />
          </div>
          <p
            v-else-if="showEndOfListMessage"
            class="p-4 text-center text-n-slate-11"
          >
            {{ $t('CHAT_LIST.EOF') }}
          </p>
          <IntersectionObserver
            v-else-if="!hasCurrentPageEndReached && conversationList.length > 0"
            :options="intersectionObserverOptions"
            @observed="loadMoreConversations"
          />
        </template>
      </DynamicScroller>
    </div>
    <Dialog
      ref="deleteConversationDialogRef"
      type="alert"
      :title="
        $t('CONVERSATION.DELETE_CONVERSATION.TITLE', {
          conversationId: selectedConversationId,
        })
      "
      :description="$t('CONVERSATION.DELETE_CONVERSATION.DESCRIPTION')"
      :confirm-button-label="$t('CONVERSATION.DELETE_CONVERSATION.CONFIRM')"
      @confirm="deleteConversation"
      @close="selectedConversationId = null"
    />
    <NoteTaskModal
      v-if="showNoteTaskModal"
      :show="showNoteTaskModal"
      :current-chat="selectedChatForNoteTask"
      :type="noteTaskType"
      @close="closeNoteTaskModal"
    />
    <ConversationCloseTopicsModal
      v-if="showCloseTopicsModal && closeConversationId"
      :show="showCloseTopicsModal"
      :conversation-id="closeConversationId"
      @close="closeTopicsModal"
      @success="onCloseTopicsSuccess"
    />
    <BulkMessageModal
      v-if="showBulkMessageModal"
      :selected-conversations="selectedConversations"
      @close="closeBulkMessageModal"
      @send-complete="onBulkSendComplete"
    />
    <TeleportWithDirection
      v-if="showAdvancedFilters"
      to="#conversationFilterTeleportTarget"
    >
      <ConversationFilter
        v-model="appliedFilter"
        :folder-name="activeFolderName"
        :is-folder-view="hasActiveFolders"
        @apply-filter="onApplyFilter"
        @update-folder="onUpdateSavedFilter"
        @close="closeAdvanceFiltersModal"
      />
    </TeleportWithDirection>
  </div>
</template>

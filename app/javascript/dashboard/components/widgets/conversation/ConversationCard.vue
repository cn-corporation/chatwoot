<script setup>
import { computed, ref, onMounted, inject, toValue } from 'vue';
import { useRouter } from 'vue-router';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import { getLastMessage } from 'dashboard/helper/conversationHelper';
import { frontendURL, conversationUrl } from 'dashboard/helper/URLHelper';
import { calculateTimePriority } from 'dashboard/helper/conversationPriority';
import Avatar from 'next/avatar/Avatar.vue';
import MessagePreview from './MessagePreview.vue';
import InboxName from '../InboxName.vue';
import ConversationContextMenu from './contextMenu/Index.vue';
import CardLabels from './conversationCardComponents/CardLabels.vue';
import SLACardLabel from './components/SLACardLabel.vue';
import PriorityMark from './PriorityMark.vue';
import ContextMenu from 'dashboard/components/ui/ContextMenu.vue';
import { useSourceChannelColors } from 'dashboard/composables/useSourceChannelColors';
import { useUISettings } from 'dashboard/composables/useUISettings';
import {
  format,
  fromUnixTime,
  isToday,
  isYesterday,
  isSameYear,
} from 'date-fns';

const props = defineProps({
  activeLabel: { type: String, default: '' },
  chat: { type: Object, default: () => ({}) },
  hideInboxName: { type: Boolean, default: false },
  hideThumbnail: { type: Boolean, default: false },
  teamId: { type: [String, Number], default: 0 },
  foldersId: { type: [String, Number], default: 0 },
  showAssignee: { type: Boolean, default: false },
  conversationType: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  enableContextMenu: { type: Boolean, default: false },
  allowedContextMenuOptions: { type: Array, default: () => [] },
});

const emit = defineEmits([
  'contextMenuToggle',
  'assignAgent',
  'assignLabel',
  'assignTeam',
  'markAsUnread',
  'markAsRead',
  'updateConversationStatus',
  'createTask',
  'deleteConversation',
  'blockContact',
  'unblockContact',
  'selectConversation',
  'deSelectConversation',
]);

const router = useRouter();
const store = useStore();

const hovered = ref(false);
const showContextMenu = ref(false);
const contextMenu = ref({
  x: null,
  y: null,
});

const { getSourceBgColor } = useSourceChannelColors();
const { uiSettings } = useUISettings();

const currentChat = useMapGetter('getSelectedChat');
const inboxesList = useMapGetter('inboxes/getInboxes');
const activeInbox = useMapGetter('getSelectedInbox');
const accountId = useMapGetter('getCurrentAccountId');

const chatMetadata = computed(() => props.chat.meta || {});

const assignee = computed(() => chatMetadata.value.assignee || {});

const senderId = computed(() => chatMetadata.value.sender?.id);

const currentContact = computed(() => {
  return senderId.value
    ? store.getters['contacts/getContact'](senderId.value)
    : {};
});

const isActiveChat = computed(() => {
  return currentChat.value.id === props.chat.id;
});

const contactBlockedUntil = computed(() => {
  return currentContact.value?.blocked_until || null;
});

const getOperatorUnreadCount = useMapGetter('getOperatorUnreadCount');
const unreadCount = computed(() => getOperatorUnreadCount.value(props.chat.id));

const hasUnread = computed(() => unreadCount.value > 0);

// Inject the reactive timer trigger from ChatList
const timerTick = inject('conversationTimerTick', ref(Date.now()));

const isContactTimeBlocked = computed(() => {
  // eslint-disable-next-line no-unused-vars
  const _ = timerTick.value;
  if (!contactBlockedUntil.value) return false;
  return new Date(contactBlockedUntil.value) > new Date();
});

// Inject bulk message mode state
const isBulkMessageMode = inject('isBulkMessageMode', ref(false));
const canSelectMore = inject(
  'canSelectMore',
  computed(() => true)
);

// Compute priority based on elapsed time (updates when timerTick changes)
const computedPriority = computed(() => {
  // eslint-disable-next-line no-unused-vars
  const _ = timerTick.value; // Force reactivity on timer updates
  return calculateTimePriority(props.chat);
});

const showConversationColor = computed(
  () => uiSettings.value.show_conversation_color || false
);

const conversationColor = computed(() => {
  if (!showConversationColor.value) return null;
  return props.chat.custom_attributes?.conversation_color || null;
});

const TOPIC_EMOJIS = {
  deposits_withdrawals: '💰',
  registration_login: '📝',
  bonuses_rakeback: '🎁',
  complaint: '🚨',
  other: '❓',
};

const topicEmoji = computed(() => {
  const topic = props.chat.custom_attributes?.bot_topic;
  if (!topic) return null;
  if (TOPIC_EMOJIS[topic]) return TOPIC_EMOJIS[topic];
  const match = topic.match(/^\p{Emoji_Presentation}/u);
  return match ? match[0] : null;
});

const isInboxNameVisible = computed(() => !activeInbox.value);

const lastMessageInChat = computed(() => getLastMessage(props.chat));

const inboxId = computed(() => props.chat.inbox_id);

const inbox = computed(() => {
  return inboxId.value ? store.getters['inboxes/getInbox'](inboxId.value) : {};
});

const showInboxName = computed(() => {
  return (
    !props.hideInboxName &&
    isInboxNameVisible.value &&
    inboxesList.value.length > 1
  );
});

const showMetaSection = computed(() => {
  return showInboxName.value || (props.showAssignee && assignee.value.name);
});

const hasSlaPolicyId = computed(() => props.chat?.sla_policy_id);

const showLabelsSection = computed(() => {
  return props.chat.labels?.length > 0 || hasSlaPolicyId.value;
});

const messagePreviewClass = computed(() => {
  return [
    hasUnread.value ? 'font-medium text-n-slate-12' : 'text-n-slate-11',
    !props.compact && hasUnread.value ? 'ltr:pr-4 rtl:pl-4' : '',
    props.compact && hasUnread.value ? 'ltr:pr-6 rtl:pl-6' : '',
  ];
});

const formattedTimestamp = computed(() => {
  if (!props.chat.timestamp) return '';

  const date = fromUnixTime(props.chat.timestamp);
  const now = new Date();

  if (isToday(date)) {
    return format(date, 'HH:mm');
  }

  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'HH:mm')}`;
  }

  if (isSameYear(date, now)) {
    return format(date, 'MMM d, HH:mm');
  }

  return format(date, 'MMM d yyyy, HH:mm');
});

onMounted(() => {
  if (inboxId.value) {
    getSourceBgColor(inboxId.value);
  }
});

const conversationPath = computed(() => {
  return frontendURL(
    conversationUrl({
      accountId: accountId.value,
      activeInbox: activeInbox.value,
      id: props.chat.id,
      label: props.activeLabel,
      teamId: props.teamId,
      conversationType: props.conversationType,
      foldersId: props.foldersId,
    })
  );
});

const onCardClick = e => {
  const path = conversationPath.value;
  if (!path) return;

  // Handle Ctrl/Cmd + Click for new tab
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    window.open(
      `${window.chatwootConfig.hostURL}${path}`,
      '_blank',
      'noopener,noreferrer'
    );
    return;
  }

  // Skip if already active
  if (isActiveChat.value) return;

  router.push({ path });
};

const onThumbnailHover = () => {
  hovered.value = !props.hideThumbnail;
};

const onThumbnailLeave = () => {
  hovered.value = false;
};

const onSelectConversation = checked => {
  if (checked) {
    emit('selectConversation', props.chat.id, inbox.value.id);
  } else {
    emit('deSelectConversation', props.chat.id, inbox.value.id);
  }
};

const openContextMenu = e => {
  if (toValue(isBulkMessageMode)) {
    e.preventDefault();
    if (props.selected) {
      emit('deSelectConversation', props.chat.id, inbox.value.id);
    } else if (toValue(canSelectMore)) {
      emit('selectConversation', props.chat.id, inbox.value.id);
    }
    return;
  }

  if (!props.enableContextMenu) return;
  e.preventDefault();
  emit('contextMenuToggle', true);
  contextMenu.value.x = e.pageX || e.clientX;
  contextMenu.value.y = e.pageY || e.clientY;
  showContextMenu.value = true;
};

const closeContextMenu = () => {
  emit('contextMenuToggle', false);
  showContextMenu.value = false;
  contextMenu.value.x = null;
  contextMenu.value.y = null;
};

const onUpdateConversation = (status, snoozedUntil) => {
  closeContextMenu();
  emit('updateConversationStatus', props.chat.id, status, snoozedUntil);
};

const onAssignAgent = agent => {
  emit('assignAgent', agent, [props.chat.id]);
  closeContextMenu();
};

const onAssignLabel = label => {
  emit('assignLabel', [label.title], [props.chat.id]);
  closeContextMenu();
};

const onAssignTeam = team => {
  emit('assignTeam', team, props.chat.id);
  closeContextMenu();
};

const markAsUnread = () => {
  emit('markAsUnread', props.chat.id);
  closeContextMenu();
};

const markAsRead = () => {
  emit('markAsRead', props.chat.id);
  closeContextMenu();
};

const createTask = () => {
  emit('createTask', props.chat.id);
  closeContextMenu();
};

const deleteConversation = () => {
  emit('deleteConversation', props.chat.id);
  closeContextMenu();
};

const onBlockContact = duration => {
  emit('blockContact', duration, props.chat.id);
  closeContextMenu();
};

const onUnblockContact = () => {
  emit('unblockContact', props.chat.id);
  closeContextMenu();
};
</script>

<template>
  <div
    class="relative flex items-start flex-grow-0 flex-shrink-0 w-auto max-w-full py-0 border-t-0 border-b-0 border-r-0 border-transparent border-solid cursor-pointer conversation hover:bg-n-alpha-1 dark:hover:bg-n-alpha-3 group"
    :class="{
      'active animate-card-select bg-n-alpha-1 dark:bg-n-alpha-3 border-n-weak border-l-4 !border-l-woot-500':
        isActiveChat,
      'bg-n-slate-2 dark:bg-n-slate-3': selected,
      'ring-2 ring-n-brand ring-inset': selected && isBulkMessageMode,
      'px-0 border-l-0': compact,
      'px-3 border-l-0': !compact,
    }"
    @click="onCardClick"
    @contextmenu="openContextMenu($event)"
  >
    <div
      v-if="conversationColor"
      class="absolute inset-0 pointer-events-none rounded"
      :style="{ backgroundColor: conversationColor + '33' }"
    />
    <div
      class="relative"
      @mouseenter="onThumbnailHover"
      @mouseleave="onThumbnailLeave"
    >
      <Avatar
        v-if="!hideThumbnail"
        :name="currentContact.name"
        :src="currentContact.thumbnail"
        :size="32"
        :status="currentContact.availability_status"
        :inbox="inbox"
        :class="!showInboxName ? 'mt-4' : 'mt-8'"
        hide-offline-status
        rounded-full
      >
        <template #overlay="{ size }">
          <label
            v-if="hovered || selected"
            class="flex items-center justify-center rounded-full cursor-pointer absolute inset-0 z-10 backdrop-blur-[2px]"
            :style="{ width: `${size}px`, height: `${size}px` }"
            @click.stop
          >
            <input
              :value="selected"
              :checked="selected"
              class="!m-0 cursor-pointer"
              type="checkbox"
              @change="onSelectConversation($event.target.checked)"
            />
          </label>
        </template>
      </Avatar>
    </div>
    <div
      class="px-0 py-3 border-b group-hover:border-transparent flex-1 border-n-slate-3 min-w-0"
    >
      <div
        v-if="showMetaSection"
        class="flex items-center min-w-0 gap-1"
        :class="{
          'ltr:ml-2 rtl:mr-2': !compact,
          'mx-2': compact,
        }"
      >
        <InboxName v-if="showInboxName" :inbox="inbox" class="flex-1 min-w-0" />
        <div
          class="flex items-center gap-2 flex-shrink-0"
          :class="{
            'flex-1 justify-between': !showInboxName,
          }"
        >
          <span
            v-if="showAssignee && assignee.name"
            class="text-n-slate-11 text-xs font-medium leading-3 py-0.5 px-0 inline-flex items-center truncate"
          >
            <fluent-icon icon="person" size="12" class="text-n-slate-11" />
            {{ assignee.name }}
          </span>
        </div>
      </div>
      <h4
        class="conversation--user text-sm my-0 mx-2 capitalize pt-0.5 text-ellipsis overflow-hidden whitespace-nowrap flex-1 min-w-0 ltr:pr-16 rtl:pl-16 text-n-slate-12 flex items-center gap-1"
        :class="hasUnread ? 'font-semibold' : 'font-medium'"
      >
        {{ currentContact.name }}
        <fluent-icon
          v-if="isContactTimeBlocked"
          icon="dismiss-circle"
          size="14"
          class="text-n-ruby-9 flex-shrink-0"
        />
      </h4>
      <MessagePreview
        v-if="lastMessageInChat"
        :message="lastMessageInChat"
        class="my-0 mx-2 leading-6 h-6 flex-1 min-w-0 text-sm"
        :class="messagePreviewClass"
      />
      <p
        v-else
        class="text-n-slate-11 text-sm my-0 mx-2 leading-6 h-6 flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
        :class="messagePreviewClass"
      >
        <fluent-icon
          size="16"
          class="-mt-0.5 align-middle inline-block text-n-slate-10"
          icon="info"
        />
        <span class="mx-0.5">
          {{ $t(`CHAT_LIST.NO_MESSAGES`) }}
        </span>
      </p>
      <span
        v-if="topicEmoji"
        class="absolute z-10 ltr:right-14 rtl:left-14 text-lg leading-4"
        :class="showMetaSection ? 'top-9' : 'top-5'"
      >
        {{ topicEmoji }}
      </span>
      <div
        class="absolute flex flex-col ltr:right-3 rtl:left-3 items-end"
        :class="showMetaSection ? 'top-8' : 'top-4'"
      >
        <PriorityMark
          v-if="computedPriority"
          :priority="computedPriority"
          class="mb-0.5"
        />
        <span class="font-normal leading-4 text-xxs text-n-slate-10">
          {{ formattedTimestamp }}
        </span>
        <span
          class="shadow-lg rounded-full text-xxs font-semibold h-4 leading-4 mt-0.5 min-w-[1rem] px-1 py-0 text-center text-white bg-n-ruby-9"
          :class="hasUnread ? 'block' : 'hidden'"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </div>
      <CardLabels
        v-if="showLabelsSection"
        :conversation-labels="chat.labels"
        class="mt-0.5 mx-2 mb-0"
      >
        <template v-if="hasSlaPolicyId" #before>
          <SLACardLabel :chat="chat" class="ltr:mr-1 rtl:ml-1" />
        </template>
      </CardLabels>
    </div>
    <ContextMenu
      v-if="showContextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @close="closeContextMenu"
    >
      <ConversationContextMenu
        :status="chat.status"
        :inbox-id="inbox.id"
        :chat-id="chat.id"
        :has-unread-messages="hasUnread"
        :conversation-url="conversationPath"
        :allowed-options="allowedContextMenuOptions"
        :contact-blocked-until="contactBlockedUntil"
        @update-conversation="onUpdateConversation"
        @assign-agent="onAssignAgent"
        @assign-label="onAssignLabel"
        @assign-team="onAssignTeam"
        @mark-as-unread="markAsUnread"
        @mark-as-read="markAsRead"
        @create-task="createTask"
        @delete-conversation="deleteConversation"
        @block-contact="onBlockContact"
        @unblock-contact="onUnblockContact"
        @close="closeContextMenu"
      />
    </ContextMenu>
  </div>
</template>

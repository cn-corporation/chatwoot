<script setup>
import { defineProps, computed, reactive, watch, onBeforeUnmount } from 'vue';
import Message from './Message.vue';
import LinkedConversationSeparator from './LinkedConversationSeparator.vue';
import { MESSAGE_TYPES } from './constants.js';
import { useCamelCase } from 'dashboard/composables/useTransformKeys';
import { useMapGetter } from 'dashboard/composables/store.js';
import MessageApi from 'dashboard/api/inbox/message.js';

/**
 * Props definition for the component
 * @typedef {Object} Props
 * @property {Array} readMessages - Array of read messages
 * @property {Array} unReadMessages - Array of unread messages
 * @property {Number} currentUserId - ID of the current user
 * @property {Boolean} isAnEmailChannel - Whether this is an email channel
 * @property {Object} inboxSupportsReplyTo - Inbox reply support configuration
 * @property {Array} messages - Array of all messages [These are not in camelcase]
 */
const props = defineProps({
  currentUserId: {
    type: Number,
    required: true,
  },
  firstUnreadId: {
    type: Number,
    default: null,
  },
  isAnEmailChannel: {
    type: Boolean,
    default: false,
  },
  inboxSupportsReplyTo: {
    type: Object,
    default: () => ({ incoming: false, outgoing: false }),
  },
  messages: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['retry']);

const allMessages = computed(() => {
  const camelCasedMessages = useCamelCase(props.messages, { deep: true });

  const notesByOriginalId = new Map();
  const otherMessages = [];

  camelCasedMessages.forEach(message => {
    if (message.private && message.additionalAttributes?.originalMessageId) {
      const origId = message.additionalAttributes.originalMessageId;
      if (!notesByOriginalId.has(origId)) {
        notesByOriginalId.set(origId, []);
      }
      notesByOriginalId.get(origId).push(message);
    } else {
      otherMessages.push(message);
    }
  });

  if (notesByOriginalId.size === 0) return otherMessages;

  const result = [];
  otherMessages.forEach(message => {
    const relatedNotes = notesByOriginalId.get(message.id);
    if (relatedNotes) {
      result.push(...relatedNotes);
    }
    result.push(message);
  });

  return result;
});

const currentChat = useMapGetter('getSelectedChat');

// Cache for fetched reply messages to avoid duplicate API calls
// Limited to 100 entries to prevent unbounded memory growth
const MAX_CACHE_SIZE = 100;
const fetchedReplyMessages = reactive(new Map());

// Clear cache when conversation changes to prevent memory accumulation
watch(
  () => currentChat.value?.id,
  () => {
    fetchedReplyMessages.clear();
  }
);

// Clear cache on component unmount
onBeforeUnmount(() => {
  fetchedReplyMessages.clear();
});

/**
 * Fetches a specific message from the API by trying to get messages around it
 * @param {number} messageId - The ID of the message to fetch
 * @param {number} conversationId - The ID of the conversation
 * @returns {Promise<Object|null>} - The fetched message or null if not found/error
 */
const fetchReplyMessage = async (messageId, conversationId) => {
  // Return cached result if already fetched
  if (fetchedReplyMessages.has(messageId)) {
    return fetchedReplyMessages.get(messageId);
  }

  try {
    const response = await MessageApi.getPreviousMessages({
      conversationId,
      before: messageId + 100,
      after: messageId - 100,
    });

    const messages = response.data?.payload || [];
    const targetMessage = messages.find(msg => msg.id === messageId);

    if (targetMessage) {
      const camelCaseMessage = useCamelCase(targetMessage);

      // Implement LRU eviction: remove oldest entry if cache is full
      if (fetchedReplyMessages.size >= MAX_CACHE_SIZE) {
        const firstKey = fetchedReplyMessages.keys().next().value;
        fetchedReplyMessages.delete(firstKey);
      }

      fetchedReplyMessages.set(messageId, camelCaseMessage);
      return camelCaseMessage;
    }

    // Cache null result to avoid repeated API calls
    if (fetchedReplyMessages.size >= MAX_CACHE_SIZE) {
      const firstKey = fetchedReplyMessages.keys().next().value;
      fetchedReplyMessages.delete(firstKey);
    }
    fetchedReplyMessages.set(messageId, null);
    return null;
  } catch (error) {
    if (fetchedReplyMessages.size >= MAX_CACHE_SIZE) {
      const firstKey = fetchedReplyMessages.keys().next().value;
      fetchedReplyMessages.delete(firstKey);
    }
    fetchedReplyMessages.set(messageId, null);
    return null;
  }
};

/**
 * Determines if a message should be grouped with the next message
 * @param {Number} index - Index of the current message
 * @param {Array} searchList - Array of messages to check
 * @returns {Boolean} - Whether the message should be grouped with next
 */
const shouldGroupWithNext = (index, searchList) => {
  if (index === searchList.length - 1) return false;

  const current = searchList[index];
  const next = searchList[index + 1];

  if (next.status === 'failed') return false;

  const nextSenderId = next.senderId ?? next.sender?.id;
  const currentSenderId = current.senderId ?? current.sender?.id;
  const hasSameSender = nextSenderId === currentSenderId;

  const nextMessageType = next.messageType;
  const currentMessageType = current.messageType;

  const areBothTemplates =
    nextMessageType === MESSAGE_TYPES.TEMPLATE &&
    currentMessageType === MESSAGE_TYPES.TEMPLATE;

  if (!hasSameSender || areBothTemplates) return false;

  if (currentMessageType !== nextMessageType) return false;

  // Check if messages are in the same minute by rounding down to nearest minute
  return Math.floor(next.createdAt / 60) === Math.floor(current.createdAt / 60);
};

/**
 * Gets the message that was replied to
 * @param {Object} parentMessage - The message containing the reply reference
 * @returns {Object|null} - The message being replied to, or null if not found
 */
const getInReplyToMessage = parentMessage => {
  if (!parentMessage) return null;

  const inReplyToMessageId =
    parentMessage.contentAttributes?.inReplyTo ??
    parentMessage.content_attributes?.in_reply_to;

  if (!inReplyToMessageId) return null;

  // Try to find in current messages first
  let replyMessage = props.messages?.find(msg => msg.id === inReplyToMessageId);

  // Then try store messages
  if (!replyMessage && currentChat.value?.messages) {
    replyMessage = currentChat.value.messages.find(
      msg => msg.id === inReplyToMessageId
    );
  }

  // Then check fetch cache
  if (!replyMessage && fetchedReplyMessages.has(inReplyToMessageId)) {
    replyMessage = fetchedReplyMessages.get(inReplyToMessageId);
  }

  // If still not found and we have conversation context, fetch it
  if (!replyMessage && currentChat.value?.id) {
    fetchReplyMessage(inReplyToMessageId, currentChat.value.id);
    return null; // Let UI handle loading state
  }

  return replyMessage ? useCamelCase(replyMessage) : null;
};
</script>

<template>
  <ul class="px-4 bg-n-background">
    <slot name="beforeAll" />
    <template v-for="(message, index) in allMessages" :key="message.id">
      <slot
        v-if="firstUnreadId && message.id === firstUnreadId"
        name="unreadBadge"
      />
      <LinkedConversationSeparator
        v-if="message.isLinkedConversationSeparator"
        :contact-name="message.content"
      />
      <Message
        v-else
        v-bind="message"
        :is-email-inbox="isAnEmailChannel"
        :in-reply-to="getInReplyToMessage(message)"
        :group-with-next="shouldGroupWithNext(index, allMessages)"
        :inbox-supports-reply-to="inboxSupportsReplyTo"
        :current-user-id="currentUserId"
        data-clarity-mask="True"
        @retry="emit('retry', message)"
      />
    </template>
    <slot name="after" />
  </ul>
</template>

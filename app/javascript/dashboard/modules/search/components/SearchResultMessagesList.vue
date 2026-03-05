<script setup>
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store.js';

import SearchResultConversationItem from './SearchResultConversationItem.vue';
import SearchResultSection from './SearchResultSection.vue';
import MessageContent from './MessageContent.vue';

defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  query: {
    type: String,
    default: '',
  },
  isFetching: {
    type: Boolean,
    default: false,
  },
  showTitle: {
    type: Boolean,
    default: true,
  },
});
const { t } = useI18n();

const accountId = useMapGetter('getCurrentAccountId');

const getName = message => {
  return message && message.sender && message.sender.name
    ? message.sender.name
    : t('SEARCH.BOT_LABEL');
};
</script>

<template>
  <SearchResultSection
    :title="$t('SEARCH.SECTION.MESSAGES')"
    :empty="!messages.length"
    :query="query"
    :show-title="showTitle"
    :is-fetching="isFetching"
  >
    <ul v-if="messages.length" class="space-y-1.5 list-none">
      <li v-for="message in messages" :key="message.id">
        <SearchResultConversationItem
          :id="message.conversation_id"
          :account-id="accountId"
          :inbox="message.inbox"
          :created-at="message.created_at"
          :message-id="message.id"
        >
          <div class="flex items-center gap-1">
            <span
              v-if="message.message_type === 'private_note'"
              class="inline-flex items-center rounded-sm px-1 py-0.5 text-xxs font-medium bg-y-50 text-y-800"
            >
              {{ $t('SEARCH.TYPE_BADGE.PRIVATE_NOTE') }}
            </span>
            <span
              v-if="message.message_type === 'task'"
              class="inline-flex items-center rounded-sm px-1 py-0.5 text-xxs font-medium bg-b-50 text-b-800"
            >
              {{ $t('SEARCH.TYPE_BADGE.TASK') }}
            </span>
          </div>
          <MessageContent
            :author="getName(message)"
            :message="message"
            :search-term="query"
          />
        </SearchResultConversationItem>
      </li>
    </ul>
  </SearchResultSection>
</template>

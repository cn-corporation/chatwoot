<script setup>
import { ref, computed } from 'vue';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import { useStore, useStoreGetters } from 'dashboard/composables/store';
import { useEmitter } from 'dashboard/composables/emitter';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';

import QualityRatingModal from 'dashboard/components/QualityRatingModal.vue';
import wootConstants from 'dashboard/constants/globals';
import {
  CMD_REOPEN_CONVERSATION,
  CMD_RESOLVE_CONVERSATION,
} from 'dashboard/helper/commandbar/events';

import Button from 'dashboard/components-next/button/Button.vue';

const store = useStore();
const getters = useStoreGetters();
const { t } = useI18n();

const isLoading = ref(false);
const showRatingModal = ref(false);
const ratingConversationId = ref(null);
const ratingAgentName = ref('');

const currentChat = computed(() => getters.getSelectedChat.value);

const isOpen = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.OPEN
);
const isPending = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.PENDING
);
const isResolved = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.RESOLVED
);
const isSnoozed = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.SNOOZED
);

const showOpenButton = computed(() => {
  return isPending.value || isSnoozed.value;
});

const getConversationParams = () => {
  const allConversations = document.querySelectorAll(
    '.conversations-list .conversation'
  );

  const activeConversation = document.querySelector(
    'div.conversations-list div.conversation.active'
  );
  const activeConversationIndex = [...allConversations].indexOf(
    activeConversation
  );
  const lastConversationIndex = allConversations.length - 1;

  return {
    all: allConversations,
    activeIndex: activeConversationIndex,
    lastIndex: lastConversationIndex,
  };
};

const toggleStatus = (status, snoozedUntil) => {
  isLoading.value = true;
  store
    .dispatch('toggleStatus', {
      conversationId: currentChat.value.id,
      status,
      snoozedUntil,
    })
    .then(() => {
      useAlert(t('CONVERSATION.CHANGE_STATUS'));
      isLoading.value = false;

      // Show quality rating modal when conversation is resolved
      if (status === wootConstants.STATUS_TYPE.RESOLVED) {
        ratingConversationId.value = currentChat.value.id;
        ratingAgentName.value = currentChat.value.meta?.assignee?.name || '';
        showRatingModal.value = true;
      }
    });
};

const closeRatingModal = () => {
  showRatingModal.value = false;
  ratingConversationId.value = null;
  ratingAgentName.value = '';
};

const onCmdOpenConversation = () => {
  toggleStatus(wootConstants.STATUS_TYPE.OPEN);
};

const onCmdResolveConversation = () => {
  toggleStatus(wootConstants.STATUS_TYPE.RESOLVED);
};

const keyboardEvents = {
  'Alt+KeyE': {
    action: () => {
      toggleStatus(wootConstants.STATUS_TYPE.RESOLVED);
    },
  },
  '$mod+Alt+KeyE': {
    action: event => {
      const { all, activeIndex, lastIndex } = getConversationParams();
      toggleStatus(wootConstants.STATUS_TYPE.RESOLVED);

      if (activeIndex < lastIndex) {
        all[activeIndex + 1].click();
      } else if (all.length > 1) {
        all[0].click();
        document.querySelector('.conversations-list').scrollTop = 0;
      }
      event.preventDefault();
    },
  },
};

useKeyboardEvents(keyboardEvents);

useEmitter(CMD_REOPEN_CONVERSATION, onCmdOpenConversation);
useEmitter(CMD_RESOLVE_CONVERSATION, onCmdResolveConversation);
</script>

<template>
  <div class="relative flex items-center justify-end resolve-actions">
    <Button
      v-if="isOpen"
      :label="t('CONVERSATION.HEADER.RESOLVE_ACTION')"
      size="sm"
      color="slate"
      :is-loading="isLoading"
      @click="onCmdResolveConversation"
    />
    <Button
      v-else-if="isResolved"
      :label="t('CONVERSATION.HEADER.REOPEN_ACTION')"
      size="sm"
      color="slate"
      :is-loading="isLoading"
      @click="onCmdOpenConversation"
    />
    <Button
      v-else-if="showOpenButton"
      :label="t('CONVERSATION.HEADER.OPEN_ACTION')"
      size="sm"
      color="slate"
      :is-loading="isLoading"
      @click="onCmdOpenConversation"
    />
    <!-- Quality Rating Modal -->
    <QualityRatingModal
      v-if="showRatingModal"
      :conversation-id="ratingConversationId"
      :agent-name="ratingAgentName"
      @close="closeRatingModal"
    />
  </div>
</template>

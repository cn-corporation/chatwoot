<script setup>
import { ref, computed } from 'vue';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import { useStore, useStoreGetters } from 'dashboard/composables/store';
import { useEmitter } from 'dashboard/composables/emitter';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';

import ConversationCloseTopicsModal from 'dashboard/components/ConversationCloseTopicsModal.vue';
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
const showCloseTopicsModal = ref(false);
const closeConversationId = ref(null);

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
const isStandBy = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.STAND_BY
);

const showOpenButton = computed(() => {
  return isPending.value || isSnoozed.value || isStandBy.value;
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
  if (status === wootConstants.STATUS_TYPE.RESOLVED) {
    closeConversationId.value = currentChat.value.id;
    showCloseTopicsModal.value = true;
    return;
  }

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
    });
};

const closeTopicsModal = () => {
  showCloseTopicsModal.value = false;
  closeConversationId.value = null;
};

const onCloseTopicsSuccess = () => {
  showCloseTopicsModal.value = false;
  closeConversationId.value = null;
  useAlert(t('CONVERSATION.CHANGE_STATUS'));
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
    <ConversationCloseTopicsModal
      v-if="showCloseTopicsModal"
      :show="showCloseTopicsModal"
      :conversation-id="closeConversationId"
      @close="closeTopicsModal"
      @success="onCloseTopicsSuccess"
    />
  </div>
</template>

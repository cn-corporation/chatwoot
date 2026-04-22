<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import wootConstants from 'dashboard/constants/globals';

const { t } = useI18n();
const store = useStore();

const isLoading = ref(false);

const currentChat = computed(() => store.getters.getSelectedChat);

const isStandBy = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.STAND_BY
);

const toggleStandBy = () => {
  if (isLoading.value) return;
  const nextStatus = isStandBy.value
    ? wootConstants.STATUS_TYPE.OPEN
    : wootConstants.STATUS_TYPE.STAND_BY;
  isLoading.value = true;
  store
    .dispatch('toggleStatus', {
      conversationId: currentChat.value.id,
      status: nextStatus,
    })
    .then(() => {
      useAlert(t('CONVERSATION.CHANGE_STATUS'));
    })
    .finally(() => {
      isLoading.value = false;
    });
};
</script>

<template>
  <button
    class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors border border-solid text-center leading-none"
    :class="
      isStandBy
        ? 'bg-n-brand border-n-brand text-white hover:brightness-110'
        : 'bg-transparent border-n-brand text-n-brand hover:bg-n-brand/10'
    "
    :disabled="isLoading"
    @click="toggleStandBy"
  >
    {{ t('CONVERSATION.HEADER.WAITING_ACTION') }}
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAccount } from 'dashboard/composables/useAccount';
import TelegramMessageList from './TelegramMessageList.vue';
import TelegramMessageInput from './TelegramMessageInput.vue';

const store = useStore();
const router = useRouter();
const { t } = useI18n();
const { accountScopedRoute } = useAccount();

const activeChat = computed(
  () => store.getters['telegramDialogues/getActiveChat']
);

const chatTitle = computed(() => {
  if (!activeChat.value) return '';
  if (activeChat.value.topicId && activeChat.value.topicName) {
    return activeChat.value.topicName;
  }
  return activeChat.value.name || `Chat #${activeChat.value.chatId}`;
});

const goBackToList = () => {
  store.commit('telegramDialogues/SET_ACTIVE_CHAT_ID', null);
  router.push(accountScopedRoute('telegram_dialogues'));
};
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      class="flex items-center gap-2 h-12 px-2 md:px-4 border-b border-n-weak flex-shrink-0"
    >
      <button
        type="button"
        class="md:hidden flex items-center justify-center h-10 w-10 rounded-lg text-n-slate-12 hover:bg-n-alpha-2 flex-shrink-0"
        :aria-label="t('GENERAL_SETTINGS.BACK')"
        @click="goBackToList"
      >
        <span class="i-lucide-arrow-left size-5" aria-hidden="true" />
      </button>
      <h2 class="text-sm font-medium text-n-slate-12 truncate">
        {{ chatTitle }}
      </h2>
    </div>
    <TelegramMessageList />
    <TelegramMessageInput />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import TelegramMessageList from './TelegramMessageList.vue';
import TelegramMessageInput from './TelegramMessageInput.vue';

const store = useStore();
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
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      class="flex items-center h-12 px-4 border-b border-n-weak flex-shrink-0"
    >
      <h2 class="text-sm font-medium text-n-slate-12 truncate">
        {{ chatTitle }}
      </h2>
    </div>
    <TelegramMessageList />
    <TelegramMessageInput />
  </div>
</template>

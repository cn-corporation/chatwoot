<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useAccount } from 'dashboard/composables/useAccount';
import TelegramSourceSelector from './TelegramSourceSelector.vue';
import TelegramChatList from './TelegramChatList.vue';
import TelegramMessagePanel from './TelegramMessagePanel.vue';
import TelegramChatInfo from './TelegramChatInfo.vue';

const props = defineProps({
  sourceId: { type: String, default: '' },
  chatId: { type: Number, default: 0 },
});

const store = useStore();
const router = useRouter();
const { accountScopedRoute } = useAccount();

const sources = computed(() => store.getters['telegramDialogues/getSources']);
const activeSourceId = computed(
  () => store.getters['telegramDialogues/getActiveSourceId']
);
const activeChatId = computed(
  () => store.getters['telegramDialogues/getActiveChatId']
);
const activeChat = computed(
  () => store.getters['telegramDialogues/getActiveChat']
);

const onSelectSource = sourceId => {
  store.dispatch('telegramDialogues/setActiveSource', sourceId);
  router.push(accountScopedRoute('telegram_dialogues'));
};

const onSelectChat = chat => {
  if (chat.isForumGroup) {
    store.commit('telegramDialogues/SET_ACTIVE_GROUP_CHAT_ID', chat.chatId);
    return;
  }
  store.dispatch('telegramDialogues/setActiveChat', chat.id);
  router.push(
    accountScopedRoute('telegram_dialogues_chat', {
      sourceId: activeSourceId.value,
      chatId: chat.id,
    })
  );
};

onUnmounted(() => {
  store.commit('telegramDialogues/SET_ACTIVE_CHAT_ID', null);
});

onMounted(async () => {
  const cachedSources = sources.value;
  const fetchedSources =
    cachedSources.length > 0
      ? cachedSources
      : await store.dispatch('telegramDialogues/fetchSources');

  if (fetchedSources.length > 0) {
    const targetSourceId = props.sourceId || fetchedSources[0].id;
    if (activeSourceId.value !== targetSourceId) {
      await store.dispatch('telegramDialogues/setActiveSource', targetSourceId);
    } else if (!store.state.telegramDialogues.chats.length) {
      await store.dispatch('telegramDialogues/fetchChats');
    }
    if (props.chatId) {
      store.dispatch('telegramDialogues/setActiveChat', props.chatId);
    }
  }
});
</script>

<template>
  <div class="flex h-full w-full overflow-hidden">
    <div
      class="flex flex-col w-[340px] flex-shrink-0 border-r border-n-weak bg-n-background"
    >
      <TelegramSourceSelector
        :sources="sources"
        :active-source-id="activeSourceId"
        @select="onSelectSource"
      />
      <TelegramChatList :active-chat-id="activeChatId" @select="onSelectChat" />
    </div>
    <div class="flex flex-col flex-1 min-w-0">
      <TelegramMessagePanel v-if="activeChatId" />
      <div
        v-else
        class="flex items-center justify-center h-full text-n-slate-11"
      >
        Select a chat to start messaging
      </div>
    </div>
    <TelegramChatInfo
      v-if="activeChat"
      :chat="activeChat"
      class="w-[260px] flex-shrink-0 border-l border-n-weak"
    />
  </div>
</template>

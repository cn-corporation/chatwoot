<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useAccount } from 'dashboard/composables/useAccount';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import TelegramSourceSelector from './TelegramSourceSelector.vue';
import TelegramChatList from './TelegramChatList.vue';
import TelegramMessagePanel from './TelegramMessagePanel.vue';
import TelegramChatInfo from './TelegramChatInfo.vue';

const STORAGE_KEY = 'telegram_splitpane_sizes';

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

const splitpaneSizes = ref({
  chatList: 15,
  messagePanel: 65,
  sidebar: 20,
});
const isLayoutLocked = ref(false);

const loadSplitpaneSizes = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      splitpaneSizes.value = JSON.parse(saved);
      isLayoutLocked.value = true;
    } catch {
      // use defaults
    }
  }
};

const saveSplitpaneSizes = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(splitpaneSizes.value));
};

const onSplitpaneResize = ({ panes }) => {
  if (panes && panes.length === 3) {
    splitpaneSizes.value.chatList = panes[0]?.size;
    splitpaneSizes.value.messagePanel = panes[1]?.size;
    splitpaneSizes.value.sidebar = panes[2]?.size;
  }
};

const toggleLayoutLock = () => {
  if (isLayoutLocked.value) {
    localStorage.removeItem(STORAGE_KEY);
    isLayoutLocked.value = false;
  } else {
    saveSplitpaneSizes();
    isLayoutLocked.value = true;
  }
};

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
  loadSplitpaneSizes();

  const cachedSources = sources.value;
  const fetchedSources =
    cachedSources.length > 0
      ? cachedSources
      : await store.dispatch('telegramDialogues/fetchSources');

  if (fetchedSources.length > 0) {
    const targetSourceId = props.sourceId || fetchedSources[0].id;
    if (activeSourceId.value !== targetSourceId) {
      await store.dispatch(
        'telegramDialogues/setActiveSource',
        targetSourceId
      );
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
  <section class="flex w-full h-full min-w-0 relative">
    <Splitpanes
      class="w-full h-full"
      :class="{ 'splitpanes-locked': isLayoutLocked }"
      @resized="onSplitpaneResize"
    >
      <Pane
        :size="splitpaneSizes.chatList"
        min-size="10"
        max-size="30"
        class="flex h-full chat-list-pane"
      >
        <div class="flex flex-col w-full h-full border-r border-n-weak bg-n-background">
          <TelegramSourceSelector
            :sources="sources"
            :active-source-id="activeSourceId"
            @select="onSelectSource"
          />
          <TelegramChatList
            :active-chat-id="activeChatId"
            @select="onSelectChat"
          />
        </div>
      </Pane>
      <Pane
        :size="splitpaneSizes.messagePanel"
        min-size="30"
        max-size="100"
        class="flex h-full"
      >
        <div class="flex flex-col flex-1 min-w-0 h-full">
          <TelegramMessagePanel v-if="activeChatId" />
          <div
            v-else
            class="flex items-center justify-center h-full text-n-slate-11"
          >
            Select a chat to start messaging
          </div>
        </div>
      </Pane>
      <Pane
        :size="splitpaneSizes.sidebar"
        min-size="10"
        max-size="35"
        class="flex h-full"
      >
        <TelegramChatInfo
          v-if="activeChat"
          :chat="activeChat"
          class="w-full border-l border-n-weak"
        />
      </Pane>
    </Splitpanes>

    <button
      type="button"
      class="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors outline-none"
      :class="{ 'border-woot-500 dark:border-woot-400': isLayoutLocked }"
      @click="toggleLayoutLock"
    >
      <span
        :class="isLayoutLocked ? 'i-lucide-lock' : 'i-lucide-unlock'"
        class="size-3.5"
      />
      {{ isLayoutLocked ? 'Unlock layout' : 'Lock layout' }}
    </button>
  </section>
</template>

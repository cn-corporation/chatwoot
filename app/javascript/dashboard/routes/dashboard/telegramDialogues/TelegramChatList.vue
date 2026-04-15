<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from 'vuex';
import TelegramChatItem from './TelegramChatItem.vue';

defineProps({
  activeChatId: { type: Number, default: null },
});

const emit = defineEmits(['select', 'archive']);
const store = useStore();

const activeGroupChatId = computed(
  () => store.getters['telegramDialogues/getActiveGroupChatId']
);
const groupedChats = computed(
  () => store.getters['telegramDialogues/getGroupedChats']
);
const topicsForGroup = computed(() => {
  if (!activeGroupChatId.value) return [];
  return store.getters['telegramDialogues/getTopicsForGroup'](
    activeGroupChatId.value
  );
});
const activeGroupName = computed(() => {
  if (!activeGroupChatId.value) return '';
  const topic = topicsForGroup.value[0];
  return topic?.name || 'Group';
});

const displayedChats = computed(() =>
  activeGroupChatId.value ? topicsForGroup.value : groupedChats.value
);

const loading = computed(
  () => store.getters['telegramDialogues/getChatsLoading']
);
const hasMore = computed(
  () => store.getters['telegramDialogues/getChatsHasMore']
);

const sentinelRef = ref(null);
let observer = null;

const loadUntilScrollable = async () => {
  if (!sentinelRef.value || loading.value || !hasMore.value) return;
  const container = sentinelRef.value.parentElement?.parentElement;
  if (!container) return;
  if (container.scrollHeight <= container.clientHeight) {
    const before = displayedChats.value.length;
    await store.dispatch('telegramDialogues/fetchMoreChats');
    if (displayedChats.value.length === before) return;
    requestAnimationFrame(loadUntilScrollable);
  }
};

const archivedChats = computed(
  () => store.getters['telegramDialogues/getArchivedChats']
);

const goBack = () => {
  store.commit('telegramDialogues/SET_ACTIVE_GROUP_CHAT_ID', null);
};

const openArchive = () => {
  store.dispatch('telegramDialogues/toggleArchiveView');
};

const onArchive = chat => {
  emit('archive', chat);
};

onMounted(() => {
  observer = new IntersectionObserver(
    async entries => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) {
        const before = displayedChats.value.length;
        await store.dispatch('telegramDialogues/fetchMoreChats');
        if (displayedChats.value.length === before) return;
        requestAnimationFrame(loadUntilScrollable);
      }
    },
    { threshold: 0.1 }
  );
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value);
  }
});

onUnmounted(() => {
  observer?.disconnect();
});

watch(
  () => displayedChats.value.length,
  () => {
    requestAnimationFrame(loadUntilScrollable);
  }
);
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <button
      v-if="activeGroupChatId"
      class="flex items-center gap-2 w-full px-3 py-2 text-left border-b border-n-weak hover:bg-n-alpha-1 transition-colors"
      @click="goBack"
    >
      <span class="i-lucide-arrow-left size-4 text-n-slate-11" />
      <span class="i-lucide-users size-4 text-n-slate-11" />
      <span class="text-sm font-medium text-n-slate-12 truncate">
        {{ activeGroupName }}
      </span>
    </button>
    <div class="flex flex-col gap-0.5 p-2">
      <TelegramChatItem
        v-for="chat in displayedChats"
        :key="chat.id"
        :chat="chat"
        :active="chat.id === activeChatId"
        @select="emit('select', chat)"
        @archive="onArchive"
      />
    </div>
    <div v-show="!activeGroupChatId" ref="sentinelRef" class="h-4" />
    <div v-if="loading" class="flex justify-center py-3">
      <span class="i-lucide-loader-2 animate-spin size-5 text-n-slate-10" />
    </div>
    <div
      v-if="!loading && displayedChats.length === 0"
      class="flex items-center justify-center py-8 text-sm text-n-slate-10"
    >
      {{ activeGroupChatId ? 'No topics found' : 'No chats found' }}
    </div>
    <button
      v-if="!activeGroupChatId && archivedChats.length > 0"
      class="flex items-center gap-2 w-full px-4 py-2.5 text-left border-t border-n-weak hover:bg-n-alpha-1 transition-colors"
      @click="openArchive"
    >
      <span class="i-lucide-archive size-4 text-n-slate-10" />
      <span class="text-sm text-n-slate-10"> Archive </span>
      <span class="text-xs text-n-slate-9 ml-auto">
        {{ archivedChats.length }}
      </span>
    </button>
  </div>
</template>

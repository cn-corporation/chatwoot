<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from 'vuex';
import TelegramChatItem from './TelegramChatItem.vue';

defineProps({
  activeChatId: { type: Number, default: null },
});

const emit = defineEmits(['select']);
const store = useStore();

const chats = computed(() => store.getters['telegramDialogues/getChats']);
const loading = computed(() => store.getters['telegramDialogues/getChatsLoading']);
const hasMore = computed(() => store.getters['telegramDialogues/getChatsHasMore']);

const sentinelRef = ref(null);
let observer = null;

const loadUntilScrollable = () => {
  if (!sentinelRef.value || loading.value || !hasMore.value) return;
  const container = sentinelRef.value.parentElement?.parentElement;
  if (!container) return;
  if (container.scrollHeight <= container.clientHeight) {
    store.dispatch('telegramDialogues/fetchMoreChats').then(() => {
      requestAnimationFrame(loadUntilScrollable);
    });
  }
};

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) {
        store.dispatch('telegramDialogues/fetchMoreChats').then(() => {
          requestAnimationFrame(loadUntilScrollable);
        });
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

watch(() => chats.value.length, () => {
  requestAnimationFrame(loadUntilScrollable);
});
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="flex flex-col gap-0.5 p-2">
      <TelegramChatItem
        v-for="chat in chats"
        :key="chat.id"
        :chat="chat"
        :active="chat.id === activeChatId"
        @select="emit('select', chat)"
      />
    </div>
    <div ref="sentinelRef" class="h-4" />
    <div v-if="loading" class="flex justify-center py-3">
      <span class="i-lucide-loader-2 animate-spin size-5 text-n-slate-10" />
    </div>
    <div
      v-if="!loading && chats.length === 0"
      class="flex items-center justify-center py-8 text-sm text-n-slate-10"
    >
      No chats found
    </div>
  </div>
</template>

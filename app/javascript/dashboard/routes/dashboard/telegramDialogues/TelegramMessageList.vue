<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import TelegramMessageItem from './TelegramMessageItem.vue';

const store = useStore();

const messages = computed(() => store.getters['telegramDialogues/getMessages']);
const loading = computed(
  () => store.getters['telegramDialogues/getMessagesLoading']
);
const hasMore = computed(
  () => store.getters['telegramDialogues/getMessagesHasMore']
);
const activeChatId = computed(
  () => store.getters['telegramDialogues/getActiveChatId']
);

const scrollContainer = ref(null);
const topSentinelRef = ref(null);
let observer = null;
let pendingScrollToBottom = true;

const formatDateLabel = dateStr => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

const toDateKey = dateStr => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const groupedMessages = computed(() => {
  const groups = [];
  let currentDateKey = null;

  for (const msg of messages.value) {
    const dateKey = msg.createdAt ? toDateKey(msg.createdAt) : null;
    if (dateKey && dateKey !== currentDateKey) {
      groups.push({
        type: 'date',
        key: dateKey,
        label: formatDateLabel(msg.createdAt),
      });
      currentDateKey = dateKey;
    }
    groups.push({ type: 'message', key: msg.id, data: msg });
  }
  return groups;
});

const scrollToBottom = () => {
  if (!scrollContainer.value) return;
  scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
};

const loadUntilScrollable = () => {
  const container = scrollContainer.value;
  if (!container || loading.value || !hasMore.value) return;
  if (container.scrollHeight <= container.clientHeight) {
    const prevScrollHeight = container.scrollHeight;
    store.dispatch('telegramDialogues/fetchMoreMessages').then(() => {
      nextTick(() => {
        if (pendingScrollToBottom) {
          scrollToBottom();
        } else {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
        requestAnimationFrame(loadUntilScrollable);
      });
    });
  }
};

onMounted(() => {
  observer = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) {
        const container = scrollContainer.value;
        const prevScrollHeight = container?.scrollHeight || 0;

        store.dispatch('telegramDialogues/fetchMoreMessages').then(() => {
          nextTick(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevScrollHeight;
            }
            requestAnimationFrame(loadUntilScrollable);
          });
        });
      }
    },
    {
      root: scrollContainer.value,
      threshold: 0.1,
    }
  );
  if (topSentinelRef.value) {
    observer.observe(topSentinelRef.value);
  }
});

onUnmounted(() => {
  observer?.disconnect();
});

watch(activeChatId, () => {
  pendingScrollToBottom = true;
});

watch(
  () => messages.value.length,
  (newLen, oldLen) => {
    if (newLen === 0) return;
    nextTick(() => {
      if (pendingScrollToBottom) {
        scrollToBottom();
        pendingScrollToBottom = false;
        requestAnimationFrame(loadUntilScrollable);
        return;
      }
      if (newLen > oldLen) {
        const container = scrollContainer.value;
        if (!container) return;
        const isNearBottom =
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <
          100;
        if (isNearBottom) {
          scrollToBottom();
        }
      }
    });
  },
  { flush: 'post' }
);
</script>

<template>
  <div ref="scrollContainer" class="flex-1 overflow-y-auto px-4 py-3">
    <div ref="topSentinelRef" class="h-1" />
    <div v-if="loading" class="flex justify-center py-3">
      <span class="i-lucide-loader-2 animate-spin size-5 text-n-slate-10" />
    </div>
    <div class="flex flex-col gap-2">
      <template v-for="item in groupedMessages" :key="item.key">
        <div
          v-if="item.type === 'date'"
          class="flex items-center justify-center py-3"
        >
          <div class="px-3 py-1 bg-n-alpha-2 dark:bg-n-alpha-3 rounded-lg">
            <span class="text-xs font-medium text-n-slate-11">
              {{ item.label }}
            </span>
          </div>
        </div>
        <TelegramMessageItem v-else :message="item.data" />
      </template>
    </div>
    <div
      v-if="!loading && messages.length === 0"
      class="flex items-center justify-center h-full text-sm text-n-slate-10"
    >
      No messages
    </div>
  </div>
</template>

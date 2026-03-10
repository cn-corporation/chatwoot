<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

const props = defineProps({
  message: { type: Object, required: true },
});

const store = useStore();

const isOutgoing = computed(() => props.message.direction === 'outgoing');

const formattedTime = computed(() => {
  if (!props.message.createdAt) return '';
  const d = new Date(props.message.createdAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

const senderDisplay = computed(() => {
  if (props.message.telegramName) return props.message.telegramName;
  if (props.message.telegramUsername) return `@${props.message.telegramUsername}`;
  return `User ${props.message.telegramUserId}`;
});

const isImage = computed(
  () => props.message.mediaType === 'photo' || props.message.mediaMimeType?.startsWith('image/')
);

const isDocument = computed(
  () => props.message.mediaType && !isImage.value
);

const hasMedia = computed(() => !!props.message.mediaPath);

const displayFileName = computed(
  () => props.message.mediaFileName || 'Download file'
);

const formatFileSize = size => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const mediaBlobUrl = ref(null);
const mediaLoading = ref(false);
const mediaError = ref(false);

const loadMedia = async () => {
  if (mediaBlobUrl.value || mediaLoading.value || !props.message.mediaPath) return;
  const sourceId = store.getters['telegramDialogues/getActiveSourceId'];
  if (!sourceId) return;

  mediaLoading.value = true;
  mediaError.value = false;
  try {
    const blob = await ChatwootExtraAPI.fetchTelegramMedia(sourceId, props.message.mediaPath);
    mediaBlobUrl.value = URL.createObjectURL(blob);
  } catch {
    mediaError.value = true;
  } finally {
    mediaLoading.value = false;
  }
};

const downloadMedia = async () => {
  if (!props.message.mediaPath) return;

  if (!mediaBlobUrl.value) {
    await loadMedia();
  }
  if (!mediaBlobUrl.value) return;

  const a = document.createElement('a');
  a.href = mediaBlobUrl.value;
  a.download = props.message.mediaFileName || 'file';
  a.click();
};

onMounted(() => {
  if (hasMedia.value && isImage.value) {
    loadMedia();
  }
});

onBeforeUnmount(() => {
  if (mediaBlobUrl.value) {
    URL.revokeObjectURL(mediaBlobUrl.value);
  }
});
</script>

<template>
  <div
    class="flex"
    :class="isOutgoing ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[70%] rounded-xl px-3 py-2"
      :class="isOutgoing
        ? 'bg-n-brand text-white rounded-br-sm'
        : 'bg-n-solid-3 text-n-slate-12 rounded-bl-sm'"
    >
      <div
        v-if="!isOutgoing"
        class="text-xs font-medium mb-0.5 text-n-brand"
      >
        {{ senderDisplay }}
      </div>
      <template v-if="hasMedia && isImage">
        <img
          v-if="mediaBlobUrl"
          :src="mediaBlobUrl"
          :alt="message.mediaFileName || 'Image'"
          class="max-w-full rounded-lg max-h-[300px] object-contain mb-1 cursor-pointer"
          @click="downloadMedia"
        />
        <div
          v-else-if="mediaLoading"
          class="flex items-center justify-center h-24 rounded-lg mb-1"
          :class="isOutgoing ? 'bg-white/10' : 'bg-n-solid-2'"
        >
          <span class="i-lucide-loader-2 animate-spin size-5" />
        </div>
        <button
          v-else
          class="flex items-center gap-2 p-3 rounded-lg mb-1 w-full"
          :class="isOutgoing ? 'bg-white/10 hover:bg-white/20' : 'bg-n-solid-2 hover:bg-n-solid-3'"
          @click="loadMedia"
        >
          <span class="i-lucide-image size-5 flex-shrink-0" />
          <span class="text-sm">{{ mediaError ? 'Retry loading image' : 'Load image' }}</span>
        </button>
      </template>
      <template v-else-if="hasMedia && isDocument">
        <button
          v-if="mediaLoading"
          class="flex items-center gap-2 p-2 mb-1 rounded-lg w-full"
          :class="isOutgoing ? 'bg-white/10' : 'bg-n-solid-2'"
          disabled
        >
          <span class="i-lucide-loader-2 animate-spin size-5 flex-shrink-0" />
          <div class="min-w-0 flex-1 text-left">
            <div class="text-sm truncate">{{ displayFileName }}</div>
          </div>
        </button>
        <button
          v-else
          class="flex items-center gap-2 p-2 mb-1 rounded-lg w-full"
          :class="isOutgoing ? 'bg-white/10 hover:bg-white/20' : 'bg-n-solid-2 hover:bg-n-solid-3'"
          @click="downloadMedia"
        >
          <span class="i-lucide-file-text size-5 flex-shrink-0" />
          <div class="min-w-0 flex-1 text-left">
            <div class="text-sm truncate">{{ displayFileName }}</div>
            <div
              v-if="message.mediaSize"
              class="text-xs"
              :class="isOutgoing ? 'text-white/60' : 'text-n-slate-10'"
            >
              {{ formatFileSize(message.mediaSize) }}
            </div>
          </div>
          <span class="i-lucide-download size-4 flex-shrink-0" />
        </button>
      </template>
      <div
        v-if="message.text"
        class="text-sm whitespace-pre-wrap break-words"
      >
        {{ message.text }}
      </div>
      <div
        class="text-[10px] mt-1 text-right"
        :class="isOutgoing ? 'text-white/60' : 'text-n-slate-10'"
      >
        {{ formattedTime }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import DOMPurify from 'dompurify';

const props = defineProps({
  chat: { type: Object, required: true },
  active: { type: Boolean, default: false },
});

defineEmits(['select']);

const store = useStore();

const chatTypeLabel = computed(() => {
  if (props.chat.topicId) return 'Topic';
  if (props.chat.type === 'personal') return 'Personal';
  return 'Group';
});

const chatTypeIcon = computed(() => {
  if (props.chat.topicId) return 'i-lucide-hash';
  if (props.chat.type === 'personal') return 'i-lucide-user';
  return 'i-lucide-users';
});

const displayName = computed(() => {
  if (props.chat.topicId && props.chat.topicName) {
    return `${props.chat.name || 'Group'} › ${props.chat.topicName}`;
  }
  return props.chat.name || `Chat #${props.chat.chatId}`;
});

const timeDisplay = computed(() => {
  if (!props.chat.updatedAt) return '';
  const date = new Date(props.chat.updatedAt);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - msgDate) / 86400000);

  if (diffDays === 0)
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  if (diffDays === 1) return '1d';
  return `${diffDays}d`;
});

const unreadCount = computed(() =>
  store.getters['telegramDialogues/getUnreadCountForChat'](props.chat.id)
);

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripMarkdown(text) {
  if (!text) return '';
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  result = result.replace(/__(.+?)__/g, '<i>$1</i>');
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');
  result = result.replace(/`(.+?)`/g, '<code>$1</code>');
  return DOMPurify.sanitize(result, {
    ALLOWED_TAGS: ['b', 'i', 's', 'code'],
    ALLOWED_ATTR: [],
  });
}

const formattedPreview = computed(() =>
  stripMarkdown(props.chat.lastMessageText)
);

const previewHasFormatting = computed(() => {
  if (!props.chat.lastMessageText) return false;
  return /\*\*.+?\*\*|__.+?__|~~.+?~~|`.+?`/.test(props.chat.lastMessageText);
});
</script>

<template>
  <button
    class="flex items-start gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors"
    :class="active ? 'bg-n-alpha-2' : 'hover:bg-n-alpha-1'"
    @click="$emit('select', chat)"
  >
    <span
      :class="chatTypeIcon"
      class="size-5 flex-shrink-0 text-n-slate-11 mt-0.5"
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium text-sm truncate text-n-slate-12">
          {{ displayName }}
        </span>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span
            v-if="unreadCount > 0"
            class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-n-ruby-9 text-white min-w-[20px] text-center"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
          <span class="text-xs text-n-slate-10">
            {{ timeDisplay }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 mt-0.5">
        <span
          class="text-[11px] px-1 py-0.5 rounded bg-n-alpha-1 text-n-slate-10 flex-shrink-0"
        >
          {{ chatTypeLabel }}
        </span>
        <span
          v-if="chat.lastMessageText && previewHasFormatting"
          class="text-xs truncate"
          :class="
            unreadCount > 0 ? 'text-n-slate-12 font-medium' : 'text-n-slate-10'
          "
          v-html="formattedPreview"
        />
        <span
          v-else-if="chat.lastMessageText"
          class="text-xs truncate"
          :class="
            unreadCount > 0 ? 'text-n-slate-12 font-medium' : 'text-n-slate-10'
          "
        >
          {{ chat.lastMessageText }}
        </span>
      </div>
    </div>
  </button>
</template>

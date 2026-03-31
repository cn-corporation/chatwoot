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

const isForumGroup = computed(() => !!props.chat.isForumGroup);

const chatTypeLabel = computed(() => {
  if (isForumGroup.value)
    return `${props.chat.topicCount} topic${props.chat.topicCount !== 1 ? 's' : ''}`;
  if (props.chat.type === 'personal') return 'Personal';
  if (props.chat.topicId) return '';
  return 'Group';
});

const chatTypeIcon = computed(() => {
  if (isForumGroup.value) return 'i-lucide-users';
  if (props.chat.topicId) return 'i-lucide-hash';
  if (props.chat.type === 'personal') return 'i-lucide-user';
  return 'i-lucide-users';
});

const displayName = computed(() => {
  if (isForumGroup.value) return props.chat.name;
  if (props.chat.topicId && props.chat.topicName) return props.chat.topicName;
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

const unreadCount = computed(() => {
  if (isForumGroup.value) return props.chat.totalUnread || 0;
  return store.getters['telegramDialogues/getUnreadCountForChat'](
    props.chat.id
  );
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripMarkdown(text) {
  if (!text) return '';
  let result = escapeHtml(text);
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  result = result.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
  result = result.replace(/__([\s\S]+?)__/g, '<i>$1</i>');
  result = result.replace(/~~([\s\S]+?)~~/g, '<s>$1</s>');
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
  return /\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|`.+?`|\[.+?\]\(.+?\)|https?:\/\/\S+/.test(
    props.chat.lastMessageText
  );
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
          <span
            v-if="isForumGroup"
            class="i-lucide-chevron-right size-4 text-n-slate-9"
          />
        </div>
      </div>
      <div class="flex items-center gap-1.5 mt-0.5">
        <span
          v-if="chatTypeLabel"
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

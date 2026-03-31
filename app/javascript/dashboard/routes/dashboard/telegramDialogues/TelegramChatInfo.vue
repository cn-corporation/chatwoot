<script setup>
import { computed } from 'vue';

const props = defineProps({
  chat: { type: Object, required: true },
});

const chatTypeInfo = computed(() => {
  const c = props.chat;
  if (c.topicId)
    return {
      label: 'Topic',
      icon: 'i-lucide-hash',
      description: `Topic in ${c.name || 'Group'}`,
    };
  if (c.type === 'personal')
    return {
      label: 'Personal Chat',
      icon: 'i-lucide-user',
      description: 'Direct message',
    };
  if (c.type === 'group')
    return {
      label: 'Group',
      icon: 'i-lucide-users',
      description: 'Group chat',
    };
  if (c.type === 'super_group')
    return {
      label: 'Supergroup',
      icon: 'i-lucide-users',
      description: 'Supergroup chat',
    };
  return { label: c.type, icon: 'i-lucide-message-circle', description: '' };
});

const displayName = computed(() => {
  if (props.chat.topicId && props.chat.topicName) return props.chat.topicName;
  return props.chat.name || `Chat #${props.chat.chatId}`;
});
</script>

<template>
  <aside class="flex flex-col p-4 gap-4 bg-n-background">
    <div class="flex flex-col items-center gap-2 pt-4">
      <div
        class="flex items-center justify-center size-12 rounded-full bg-n-alpha-2"
      >
        <span :class="chatTypeInfo.icon" class="size-6 text-n-slate-11" />
      </div>
      <h3
        class="text-sm font-medium text-n-slate-12 text-center break-words max-w-full"
      >
        {{ displayName }}
      </h3>
      <span v-if="chatTypeInfo.description" class="text-xs text-n-slate-10">
        {{ chatTypeInfo.description }}
      </span>
    </div>
    <div class="border-t border-n-weak pt-3">
      <h4 class="text-xs font-medium text-n-slate-10 uppercase mb-2">
        Details
      </h4>
      <div class="flex flex-col gap-2 text-sm">
        <div class="flex justify-between">
          <span class="text-n-slate-10 flex-shrink-0">Type</span>
          <span class="text-n-slate-12 text-right">{{
            chatTypeInfo.label
          }}</span>
        </div>
        <div class="flex justify-between gap-2">
          <span class="text-n-slate-10 flex-shrink-0">Telegram ID</span>
          <span class="text-n-slate-12 font-mono text-xs truncate text-right">{{
            chat.chatId
          }}</span>
        </div>
        <div v-if="chat.topicId" class="flex justify-between gap-2">
          <span class="text-n-slate-10 flex-shrink-0">Topic ID</span>
          <span class="text-n-slate-12 font-mono text-xs truncate text-right">{{
            chat.topicId
          }}</span>
        </div>
        <div v-if="chat.topicName" class="flex justify-between gap-2">
          <span class="text-n-slate-10 flex-shrink-0">Topic</span>
          <span
            class="text-n-slate-12 truncate text-right"
            :title="chat.topicName"
            >{{ chat.topicName }}</span
          >
        </div>
        <div
          v-if="chat.name && chat.topicId"
          class="flex justify-between gap-2"
        >
          <span class="text-n-slate-10 flex-shrink-0">Group</span>
          <span
            class="text-n-slate-12 truncate text-right"
            :title="chat.name"
            >{{ chat.name }}</span
          >
        </div>
      </div>
    </div>
  </aside>
</template>

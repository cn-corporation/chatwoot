<script setup>
import { computed } from 'vue';

const props = defineProps({
  message: { type: Object, required: true },
});

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
      <div class="text-sm whitespace-pre-wrap break-words">
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

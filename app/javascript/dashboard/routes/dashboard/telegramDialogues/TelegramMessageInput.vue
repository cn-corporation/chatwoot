<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();
const messageText = ref('');
const sending = computed(() => store.getters['telegramDialogues/getSendingMessage']);

const handleSend = async () => {
  const text = messageText.value.trim();
  if (!text || sending.value) return;
  messageText.value = '';
  await store.dispatch('telegramDialogues/sendMessage', { text });
};

const handleKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};
</script>

<template>
  <div class="border-t border-n-weak p-3">
    <div class="flex items-end gap-2">
      <textarea
        v-model="messageText"
        rows="1"
        class="flex-1 resize-none rounded-lg border border-n-weak bg-n-solid-3 px-3 py-2 text-sm outline-none placeholder:text-n-slate-10 focus:border-n-brand"
        placeholder="Type a message..."
        @keydown="handleKeydown"
      />
      <button
        class="flex items-center justify-center size-9 rounded-lg bg-n-brand text-white flex-shrink-0 disabled:opacity-50"
        :disabled="!messageText.trim() || sending"
        @click="handleSend"
      >
        <span class="i-lucide-send-horizontal size-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();
const messageText = ref('');
const attachedFile = ref(null);
const fileInputRef = ref(null);
const sending = computed(() => store.getters['telegramDialogues/getSendingMessage']);

const handleSend = async () => {
  const text = messageText.value.trim();
  const file = attachedFile.value;

  if ((!text && !file) || sending.value) return;

  messageText.value = '';
  attachedFile.value = null;

  if (file) {
    await store.dispatch('telegramDialogues/sendMedia', {
      file,
      caption: text || undefined,
    });
  } else {
    await store.dispatch('telegramDialogues/sendMessage', { text });
  }
};

const handleKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    attachedFile.value = file;
  }
  event.target.value = '';
};

const removeFile = () => {
  attachedFile.value = null;
};

const formatFileSize = size => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
</script>

<template>
  <div class="border-t border-n-weak p-3">
    <div
      v-if="attachedFile"
      class="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-n-solid-3"
    >
      <span class="i-lucide-paperclip size-4 text-n-slate-10 flex-shrink-0" />
      <span class="text-sm truncate flex-1">{{ attachedFile.name }}</span>
      <span class="text-xs text-n-slate-10">{{ formatFileSize(attachedFile.size) }}</span>
      <button
        class="flex items-center justify-center size-5 rounded hover:bg-n-solid-4"
        @click="removeFile"
      >
        <span class="i-lucide-x size-3" />
      </button>
    </div>
    <div class="flex items-end gap-2">
      <button
        class="flex items-center justify-center size-9 rounded-lg hover:bg-n-solid-3 text-n-slate-10 flex-shrink-0"
        :disabled="sending"
        @click="openFilePicker"
      >
        <span class="i-lucide-paperclip size-4" />
      </button>
      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        @change="handleFileChange"
      />
      <textarea
        v-model="messageText"
        rows="1"
        class="flex-1 resize-none rounded-lg border border-n-weak bg-n-solid-3 px-3 py-2 text-sm outline-none placeholder:text-n-slate-10 focus:border-n-brand"
        :placeholder="attachedFile ? 'Add a caption...' : 'Type a message...'"
        @keydown="handleKeydown"
      />
      <button
        class="flex items-center justify-center size-9 rounded-lg bg-n-brand text-white flex-shrink-0 disabled:opacity-50"
        :disabled="(!messageText.trim() && !attachedFile) || sending"
        @click="handleSend"
      >
        <span class="i-lucide-send-horizontal size-4" />
      </button>
    </div>
  </div>
</template>

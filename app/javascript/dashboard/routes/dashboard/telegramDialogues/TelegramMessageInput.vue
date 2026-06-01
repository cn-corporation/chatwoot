<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

const DRAFT_STORAGE_PREFIX = 'telegram-dialogues-draft-';

const store = useStore();
const messageText = ref('');
const attachedFile = ref(null);
const attachedFileData = ref(null);
const fileInputRef = ref(null);
const textareaRef = ref(null);
const sending = computed(
  () => store.getters['telegramDialogues/getSendingMessage']
);
const activeChatId = computed(
  () => store.getters['telegramDialogues/getActiveChatId']
);
const draftKey = computed(() =>
  activeChatId.value ? `${DRAFT_STORAGE_PREFIX}${activeChatId.value}` : null
);

const fileToData = file =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

const dataToFile = data => {
  const [meta, base64] = data.dataUrl.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const type = data.type || meta.slice(5, meta.indexOf(';'));
  return new File([bytes], data.name, { type });
};

const saveDraft = () => {
  const key = draftKey.value;
  if (!key) return;
  const text = messageText.value;
  const file = attachedFileData.value;
  if (!text && !file) {
    localStorage.removeItem(key);
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify({ text, file }));
  } catch (error) {
    // Draft exceeds storage quota; keep it in memory only.
  }
};

const setAttachedFile = async file => {
  attachedFile.value = file;
  attachedFileData.value = file ? await fileToData(file) : null;
  saveDraft();
};

const loadDraft = () => {
  const key = draftKey.value;
  const raw = key ? localStorage.getItem(key) : null;
  if (!raw) {
    messageText.value = '';
    attachedFile.value = null;
    attachedFileData.value = null;
    return;
  }
  try {
    const { text, file } = JSON.parse(raw);
    messageText.value = text || '';
    attachedFileData.value = file || null;
    attachedFile.value = file ? dataToFile(file) : null;
  } catch (error) {
    messageText.value = '';
    attachedFile.value = null;
    attachedFileData.value = null;
  }
};

watch(activeChatId, loadDraft, { immediate: true });
watch(messageText, saveDraft);

const wrapSelection = (before, after) => {
  const el = textareaRef.value;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = messageText.value;
  const selected = text.slice(start, end);

  if (selected) {
    messageText.value =
      text.slice(0, start) + before + selected + after + text.slice(end);
    el.focus();
    const newCursorPos = end + before.length + after.length;
    requestAnimationFrame(() => {
      el.setSelectionRange(newCursorPos, newCursorPos);
    });
  } else {
    messageText.value = text.slice(0, start) + before + after + text.slice(end);
    el.focus();
    const cursorPos = start + before.length;
    requestAnimationFrame(() => {
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }
};

const applyBold = () => wrapSelection('**', '**');
const applyItalic = () => wrapSelection('__', '__');
const applyStrikethrough = () => wrapSelection('~~', '~~');
const applyCode = () => wrapSelection('`', '`');

const applyLink = () => {
  const el = textareaRef.value;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = messageText.value;
  const selected = text.slice(start, end);

  if (selected) {
    messageText.value =
      text.slice(0, start) + `[${selected}](url)` + text.slice(end);
    el.focus();
    const urlStart = start + selected.length + 3;
    requestAnimationFrame(() => {
      el.setSelectionRange(urlStart, urlStart + 3);
    });
  } else {
    messageText.value = text.slice(0, start) + '[text](url)' + text.slice(end);
    el.focus();
    const textStart = start + 1;
    requestAnimationFrame(() => {
      el.setSelectionRange(textStart, textStart + 4);
    });
  }
};

const handleSend = async () => {
  const text = messageText.value.trim();
  const file = attachedFile.value;

  if ((!text && !file) || sending.value) return;

  messageText.value = '';
  attachedFile.value = null;
  attachedFileData.value = null;
  saveDraft();

  if (file) {
    await store.dispatch('telegramDialogues/sendMedia', {
      file,
      caption: text || undefined,
    });
  } else {
    await store.dispatch('telegramDialogues/sendMessage', { text });
  }
};

const handleKeydown = event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const handleFileChange = event => {
  const file = event.target.files?.[0];
  if (file) setAttachedFile(file);
  event.target.value = '';
};

const handlePaste = event => {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  event.preventDefault();
  setAttachedFile(file);
};

const removeFile = () => {
  setAttachedFile(null);
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
      <span class="text-xs text-n-slate-10">{{
        formatFileSize(attachedFile.size)
      }}</span>
      <button
        class="flex items-center justify-center size-5 rounded hover:bg-n-solid-4"
        @click="removeFile"
      >
        <span class="i-lucide-x size-3" />
      </button>
    </div>
    <div class="flex items-center gap-0.5 mb-1.5">
      <button
        class="flex items-center justify-center size-9 rounded-lg hover:bg-n-solid-3 text-n-slate-10"
        title="Bold (**text**)"
        @click="applyBold"
      >
        <span class="i-lucide-bold size-4.5" />
      </button>
      <button
        class="flex items-center justify-center size-9 rounded-lg hover:bg-n-solid-3 text-n-slate-10"
        title="Italic (__text__)"
        @click="applyItalic"
      >
        <span class="i-lucide-italic size-4.5" />
      </button>
      <button
        class="flex items-center justify-center size-9 rounded-lg hover:bg-n-solid-3 text-n-slate-10"
        title="Strikethrough (~~text~~)"
        @click="applyStrikethrough"
      >
        <span class="i-lucide-strikethrough size-4.5" />
      </button>
      <button
        class="flex items-center justify-center size-9 rounded-lg hover:bg-n-solid-3 text-n-slate-10"
        title="Code (`code`)"
        @click="applyCode"
      >
        <span class="i-lucide-code size-4.5" />
      </button>
      <button
        class="flex items-center justify-center size-9 rounded-lg hover:bg-n-solid-3 text-n-slate-10"
        title="Link ([text](url))"
        @click="applyLink"
      >
        <span class="i-lucide-link size-4.5" />
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
        ref="textareaRef"
        v-model="messageText"
        rows="3"
        class="flex-1 resize-none rounded-lg border border-n-weak bg-n-solid-3 px-3 py-2 text-sm outline-none placeholder:text-n-slate-10 focus:border-n-brand min-h-[4.5rem]"
        :placeholder="attachedFile ? 'Add a caption...' : 'Type a message...'"
        @keydown="handleKeydown"
        @paste="handlePaste"
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

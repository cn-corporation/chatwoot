<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import { useDebounceFn } from '@vueuse/core';
import {
  getMessageVariables,
  replaceVariablesInMessage,
} from '@chatwoot/utils';
import { MESSAGE_TYPE } from 'shared/constants/messages';
import chatwootExtraAPI from 'dashboard/api/chatwootExtra';
import CannedResponse from 'dashboard/components/widgets/conversation/CannedResponse.vue';

const store = useStore();
const currentChat = useMapGetter('getSelectedChat');

const currentContact = computed(() => {
  const senderId = currentChat.value?.meta?.sender?.id;
  if (!senderId) return null;
  return store.getters['contacts/getContact'](senderId);
});

const inbox = computed(() => {
  const inboxId = currentChat.value?.inbox_id;
  if (!inboxId) return null;
  return store.getters['inboxes/getInbox'](inboxId);
});

const messageVariables = computed(() =>
  getMessageVariables({
    conversation: currentChat.value,
    contact: currentContact.value,
    inbox: inbox.value,
  })
);

const LANGUAGES = [
  { value: 'ru', labelKey: 'CONVERSATION.REPLYBOX.TRANSLATOR.LANG_RU' },
  { value: 'kk', labelKey: 'CONVERSATION.REPLYBOX.TRANSLATOR.LANG_KZ' },
  { value: 'uk', labelKey: 'CONVERSATION.REPLYBOX.TRANSLATOR.LANG_UA' },
];

const sourceText = ref('');
const targetLang = ref('ru');
const translatedText = ref('');
const detectedLang = ref('');
const isLoading = ref(false);
const copied = ref(false);

const lastIncomingMessage = computed(() => {
  const messages = currentChat.value?.messages || [];
  const incoming = messages.filter(
    m => m.message_type === MESSAGE_TYPE.INCOMING && m.content
  );
  return incoming.length > 0 ? incoming[incoming.length - 1].content : '';
});

const fillLastMessage = () => {
  sourceText.value = lastIncomingMessage.value;
};

const translate = async () => {
  if (!sourceText.value.trim()) {
    translatedText.value = '';
    detectedLang.value = '';
    return;
  }
  isLoading.value = true;
  try {
    const result = await chatwootExtraAPI.translateText({
      text: sourceText.value,
      targetLang: targetLang.value,
    });
    translatedText.value = result.translatedText;
    detectedLang.value = result.detectedSourceLang;
  } catch {
    translatedText.value = '';
    detectedLang.value = '';
  } finally {
    isLoading.value = false;
  }
};

const debouncedTranslate = useDebounceFn(translate, 500);

const showCanned = ref(false);
const cannedSearchKey = computed(() =>
  showCanned.value ? sourceText.value.slice(1) : ''
);

watch(sourceText, value => {
  showCanned.value = value.startsWith('/');
  debouncedTranslate();
});
watch(targetLang, translate);

const hideCanned = () => {
  showCanned.value = false;
};

const onCannedSelect = text => {
  const resolved = replaceVariablesInMessage({
    message: text,
    variables: messageVariables.value,
  });
  sourceText.value = resolved;
  showCanned.value = false;
};

const copyTranslation = async () => {
  await navigator.clipboard.writeText(translatedText.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
};

onMounted(() => {
  fillLastMessage();
});
</script>

<template>
  <div class="relative mx-2 mb-2">
    <CannedResponse
      v-if="showCanned"
      v-on-clickaway="hideCanned"
      :search-key="cannedSearchKey"
      @replace="onCannedSelect"
    />
    <div
      class="rounded-xl border border-n-weak bg-n-solid-1 overflow-hidden flex flex-col"
    >
      <!-- Toolbar -->
      <div
        class="flex items-center gap-2 px-3 py-1.5 bg-n-alpha-1 border-b border-n-weak shrink-0"
      >
        <span class="text-xs text-n-slate-11 shrink-0">
          {{ $t('CONVERSATION.REPLYBOX.TRANSLATOR.FROM_LABEL') }}
        </span>
        <span class="text-xs font-medium text-n-slate-12 shrink-0">
          {{ $t('CONVERSATION.REPLYBOX.TRANSLATOR.AUTO_DETECT') }}
          <template v-if="detectedLang">({{ detectedLang }})</template>
        </span>
        <span class="text-n-slate-9 text-xs">→</span>
        <span class="text-xs text-n-slate-11 shrink-0">
          {{ $t('CONVERSATION.REPLYBOX.TRANSLATOR.TO_LABEL') }}
        </span>
        <select
          v-model="targetLang"
          class="h-6 py-0 pl-2 pr-6 text-xs border border-solid rounded bg-n-slate-3 dark:bg-n-solid-3 border-n-weak text-n-slate-12 !mb-0 ![outline:none] hover:![outline:none] focus:![outline:none]"
        >
          <option
            v-for="lang in LANGUAGES"
            :key="lang.value"
            :value="lang.value"
          >
            {{ $t(lang.labelKey) }}
          </option>
        </select>
        <button
          class="ml-auto text-xs text-n-blue-text hover:underline shrink-0"
          @click="fillLastMessage"
        >
          ↙ {{ $t('CONVERSATION.REPLYBOX.TRANSLATOR.LAST_MESSAGE') }}
        </button>
      </div>

      <!-- Source textarea -->
      <textarea
        v-model="sourceText"
        rows="3"
        class="w-full px-3 py-2 text-sm text-n-slate-12 bg-n-solid-1 resize-none border-0 border-b border-n-weak ![outline:none] hover:![outline:none] focus:![outline:none] !mb-0 !h-auto"
        :placeholder="$t('CONVERSATION.REPLYBOX.TRANSLATOR.FROM_LABEL')"
      />

      <!-- Translation output -->
      <div
        class="relative flex items-start gap-2 min-h-[3.5rem] px-3 py-2 bg-n-alpha-1"
      >
        <span v-if="isLoading" class="text-xs text-n-slate-9 mt-0.5">…</span>
        <span
          v-else
          class="flex-1 text-sm text-n-slate-12 whitespace-pre-wrap break-words"
        >
          {{ translatedText }}
        </span>
        <button
          v-if="translatedText && !isLoading"
          class="shrink-0 text-xs px-2 py-1 rounded-lg border border-n-weak bg-n-solid-1 text-n-slate-11 hover:bg-n-solid-2 hover:text-n-slate-12 transition-colors"
          @click="copyTranslation"
        >
          {{
            copied
              ? $t('CONVERSATION.REPLYBOX.TRANSLATOR.COPIED')
              : $t('CONVERSATION.REPLYBOX.TRANSLATOR.COPY')
          }}
        </button>
      </div>
    </div>
  </div>
</template>

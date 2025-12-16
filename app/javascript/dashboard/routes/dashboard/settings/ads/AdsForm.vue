<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStoreGetters, useStore } from 'dashboard/composables/store';
import Button from 'dashboard/components-next/button/Button.vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import InboxesAPI from 'dashboard/api/inboxes';
import { encrypt } from 'dashboard/helper/encryption';

const props = defineProps({
  adData: {
    type: Object,
    default: () => ({}),
  },
  isEdit: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const showPreview = ref(false);

const { t } = useI18n();
const getters = useStoreGetters();
const store = useStore();

const name = ref(props.adData.name || '');
const htmlText = ref(props.adData.htmlText || '');
const sourceId = ref(props.adData.sourceId || '');
const selectedFile = ref(null);
const uploadedMediaId = ref(props.adData.mediaId || undefined);
const mediaInfo = ref(props.adData.media || null);
const fileInputKey = ref(0);

const inboxes = computed(() => getters['inboxes/getInboxes'].value);
const uiFlags = computed(() => getters['ads/getUIFlags'].value);

const isSubmitDisabled = computed(() => {
  if (props.isEdit) {
    return !htmlText.value;
  }
  return !name.value || !sourceId.value || !htmlText.value;
});

watch(
  () => props.adData,
  newData => {
    if (newData) {
      name.value = newData.name || '';
      htmlText.value = newData.htmlText || '';
      sourceId.value = newData.sourceId || '';
      uploadedMediaId.value = newData.mediaId || null;
      mediaInfo.value = newData.media || null;
    }
  },
  { deep: true, immediate: true }
);

const handleFileChange = async event => {
  const file = event.target.files[0];
  if (!file) return;

  selectedFile.value = file;

  try {
    const media = await store.dispatch('ads/uploadMedia', file);
    if (media) {
      uploadedMediaId.value = media.id;
      mediaInfo.value = {
        originalFilename: media.originalFilename,
        fileSize: media.fileSize,
      };
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.MEDIA.UPLOAD_SUCCESS'),
      });
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.MEDIA.UPLOAD_ERROR'),
    });
  }
};

const removeMedia = async () => {
  if (uploadedMediaId.value) {
    try {
      await store.dispatch('ads/deleteMedia', uploadedMediaId.value);
      uploadedMediaId.value = null;
      mediaInfo.value = null;
      selectedFile.value = null;
      fileInputKey.value += 1;
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.MEDIA.REMOVE_SUCCESS'),
      });
    } catch (error) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.MEDIA.REMOVE_ERROR'),
      });
    }
  }
};

const handleSubmit = async () => {
  const formData = {
    htmlText: htmlText.value,
  };

  if (uploadedMediaId.value !== undefined && uploadedMediaId.value !== null) {
    formData.mediaId = uploadedMediaId.value;
  }

  if (!props.isEdit) {
    formData.name = name.value;
    formData.chatwootSourceId = parseInt(sourceId.value, 10);

    try {
      // Fetch the bot token from the selected inbox
      const response = await InboxesAPI.getBotToken(sourceId.value);
      const botToken = response.data.bot_token;

      // Encrypt the bot token
      const encryptedBotToken = await encrypt(botToken);
      formData.encryptedBotToken = encryptedBotToken;
    } catch (error) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.FORM.BOT_TOKEN_ERROR'),
      });
      return;
    }
  }

  emit('submit', formData);
};

const handleCancel = () => {
  emit('cancel');
};

const formatFileSize = bytes => {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const sanitizedHtml = computed(() => {
  if (!htmlText.value) return '';
  let sanitized = htmlText.value;

  sanitized = sanitized.replace(
    /<(?!\/?(b|i|code|u|strike|pre|a)\b)[^>]*>/gi,
    ''
  );

  return sanitized;
});
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
    <div v-if="!isEdit" class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('ADS.FORM.NAME.LABEL') }}
        </label>
        <input
          v-model="name"
          type="text"
          class="px-3 py-2 border border-n-slate-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-woot-500"
          :placeholder="$t('ADS.FORM.NAME.PLACEHOLDER')"
          required
          @keydown.enter.prevent
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('ADS.FORM.SOURCE.LABEL') }}
        </label>
        <select
          v-model="sourceId"
          class="px-3 py-2 pr-2 border border-n-slate-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-woot-500 appearance-none custom-select"
          required
        >
          <option value="">{{ $t('ADS.FORM.SOURCE.PLACEHOLDER') }}</option>
          <option v-for="inbox in inboxes" :key="inbox.id" :value="inbox.id">
            {{ inbox.name }}
          </option>
        </select>
        <p class="text-xs text-n-slate-10 mt-1">
          {{ $t('ADS.FORM.SOURCE.HELP_TEXT') }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('ADS.FORM.HTML_TEXT.LABEL') }}
        </label>
        <div class="flex gap-2">
          <Button
            variant="ghost"
            size="small"
            :label="$t('ADS.FORM.HTML_TEXT.CODE')"
            :color-scheme="!showPreview ? 'primary' : 'secondary'"
            type="button"
            @click="showPreview = false"
          />
          <Button
            variant="ghost"
            size="small"
            :label="$t('ADS.FORM.HTML_TEXT.PREVIEW')"
            :color-scheme="showPreview ? 'primary' : 'secondary'"
            type="button"
            @click="showPreview = true"
          />
        </div>
      </div>

      <div
        v-if="!showPreview"
        class="flex flex-col gap-3 p-4 bg-n-slate-2 rounded-lg border border-n-slate-6"
      >
        <p class="text-xs font-medium text-n-slate-11">
          {{ $t('ADS.FORM.HTML_TEXT.SUPPORTED_TAGS') }}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div class="flex items-start gap-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;b&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.B')
            }}</span>
          </div>
          <div class="flex items-start gap-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;i&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.I')
            }}</span>
          </div>
          <div class="flex items-start gap-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;u&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.U')
            }}</span>
          </div>
          <div class="flex items-start gap-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;strike&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.STRIKE')
            }}</span>
          </div>
          <div class="flex items-start gap-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;code&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.CODE')
            }}</span>
          </div>
          <div class="flex items-start gap-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;pre&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.PRE')
            }}</span>
          </div>
          <div class="flex items-start gap-2 sm:col-span-2">
            <code
              class="px-2 py-1 bg-n-slate-4 rounded text-n-slate-12 shrink-0"
              >&lt;a&gt;</code>
            <span class="text-n-slate-10 leading-6">{{
              $t('ADS.FORM.HTML_TEXT.TAG_DESCRIPTIONS.A')
            }}</span>
          </div>
        </div>
        <p class="text-xs text-n-slate-10 mt-2">
          {{ $t('ADS.FORM.HTML_TEXT.TAGS_CLOSURE_NOTE') }}
        </p>
      </div>

      <textarea
        v-if="!showPreview"
        v-model="htmlText"
        rows="10"
        class="px-3 py-2 border border-n-slate-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-woot-500 font-mono text-sm"
        :placeholder="$t('ADS.FORM.HTML_TEXT.PLACEHOLDER')"
        required
      />

      <div
        v-else
        class="px-4 py-3 border border-n-slate-6 rounded-lg min-h-[240px] bg-white"
      >
        <div
          v-if="htmlText"
          class="html-preview text-base whitespace-pre-wrap break-words"
          v-html="sanitizedHtml"
        />
        <p v-else class="text-sm text-n-slate-10 italic">
          {{ $t('ADS.FORM.HTML_TEXT.PREVIEW_EMPTY') }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-n-slate-12">
        {{ $t('ADS.FORM.MEDIA.LABEL') }}
      </label>

      <div
        v-if="mediaInfo"
        class="flex items-center gap-4 p-4 bg-n-slate-2 rounded-lg"
      >
        <div class="flex-1">
          <p class="text-sm font-medium text-n-slate-12">
            {{ mediaInfo.originalFilename }}
          </p>
          <p class="text-xs text-n-slate-10">
            {{ formatFileSize(mediaInfo.fileSize) }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="small"
          icon="i-lucide-trash-2"
          color-scheme="alert"
          :is-loading="uiFlags.isDeletingMedia"
          type="button"
          @click="removeMedia"
        />
      </div>

      <div v-else class="flex flex-col gap-2">
        <input
          :key="fileInputKey"
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          class="block w-full text-sm text-n-slate-10 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-woot-50 file:text-woot-600 hover:file:bg-woot-100"
          :disabled="uiFlags.isUploadingMedia"
          @change="handleFileChange"
        />
        <p v-if="uiFlags.isUploadingMedia" class="text-sm text-n-slate-10">
          {{ $t('ADS.MEDIA.UPLOADING') }}
        </p>
      </div>
    </div>

    <div class="flex gap-3 justify-end">
      <Button
        variant="ghost"
        :label="$t('ADS.FORM.CANCEL')"
        @click="handleCancel"
      />
      <Button
        type="submit"
        :label="isEdit ? $t('ADS.FORM.UPDATE') : $t('ADS.FORM.CREATE')"
        :is-loading="uiFlags.isCreating || uiFlags.isUpdating"
        :is-disabled="isSubmitDisabled"
      />
    </div>
  </form>
</template>

<style scoped>
.custom-select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
}

.html-preview {
  color: #0f172a;
  line-height: 1.6;
}

.html-preview :deep(b),
.html-preview :deep(strong) {
  font-weight: 700;
  color: #0f172a;
}

.html-preview :deep(i),
.html-preview :deep(em) {
  font-style: italic;
  color: #0f172a;
}

.html-preview :deep(u) {
  text-decoration: underline;
  color: #0f172a;
}

.html-preview :deep(strike),
.html-preview :deep(s) {
  text-decoration: line-through;
  color: #0f172a;
}

.html-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  background-color: #e2e8f0;
  color: #1e293b;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.html-preview :deep(pre) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  background-color: #e2e8f0;
  color: #1e293b;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.html-preview :deep(pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-size: 1em;
}

.html-preview :deep(a) {
  color: #1066eb;
  text-decoration: underline;
  cursor: pointer;
}

.html-preview :deep(a:hover) {
  color: #0d4fb6;
}
</style>

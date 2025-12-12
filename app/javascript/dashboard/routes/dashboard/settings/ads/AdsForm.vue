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
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('ADS.FORM.SOURCE.LABEL') }}
        </label>
        <select
          v-model="sourceId"
          class="px-3 py-2 border border-n-slate-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-woot-500"
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
      <label class="text-sm font-medium text-n-slate-12">
        {{ $t('ADS.FORM.HTML_TEXT.LABEL') }}
      </label>
      <textarea
        v-model="htmlText"
        rows="10"
        class="px-3 py-2 border border-n-slate-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-woot-500 font-mono text-sm"
        :placeholder="$t('ADS.FORM.HTML_TEXT.PLACEHOLDER')"
        required
      />
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

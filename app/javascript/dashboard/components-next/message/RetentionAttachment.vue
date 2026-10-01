<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatBytes } from 'shared/helpers/FileHelper';

const props = defineProps({ attachment: { type: Object, required: true } });
const { t } = useI18n();
const failed = ref(false);
const url = computed(
  () => props.attachment.data_url || props.attachment.external_url
);
const filename = computed(
  () =>
    props.attachment.filename ||
    props.attachment.fallback_title ||
    t('RETENTION.ATTACHMENT')
);
watch(url, () => {
  failed.value = false;
});
</script>

<template>
  <div class="flex flex-col gap-1 py-1 min-w-0">
    <a
      v-if="attachment.file_type === 'image' && url && !failed"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t('RETENTION.OPEN_FILE', { filename })"
    >
      <img
        :src="url"
        :alt="filename"
        class="max-h-72 max-w-full rounded-lg"
        loading="lazy"
        @error="failed = true"
      />
    </a>
    <audio
      v-else-if="attachment.file_type === 'audio' && url && !failed"
      :src="url"
      controls
      preload="none"
      class="max-w-full"
      @error="failed = true"
    />
    <video
      v-else-if="attachment.file_type === 'video' && url && !failed"
      :src="url"
      controls
      preload="metadata"
      class="max-h-72 max-w-full rounded-lg"
      @error="failed = true"
    />
    <a
      v-if="url"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-2 underline break-all text-sm"
    >
      <span class="i-lucide-download shrink-0" aria-hidden="true" />
      {{ filename }}
    </a>
    <span v-else class="text-sm break-all">{{ filename }}</span>
    <span v-if="attachment.byte_size !== undefined" class="text-xs opacity-80">
      {{ formatBytes(attachment.byte_size) }}
    </span>
    <span
      v-if="failed || attachment.available === false"
      role="status"
      class="text-xs opacity-80"
    >
      {{ t('RETENTION.FILE_UNAVAILABLE') }}
    </span>
  </div>
</template>

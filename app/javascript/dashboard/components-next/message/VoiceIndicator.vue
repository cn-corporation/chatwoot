<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Icon from 'next/icon/Icon.vue';

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: value => ['success', 'failed', 'skipped'].includes(value),
  },
});

const { t } = useI18n();

const STATUS_CONFIG = {
  success: {
    icon: 'i-lucide-mic',
    labelKey: 'CONVERSATION.VOICE_TRANSCRIPTION.INDICATOR.SUCCESS',
    toneClass: 'text-n-slate-11',
  },
  failed: {
    icon: 'i-lucide-triangle-alert',
    labelKey: 'CONVERSATION.VOICE_TRANSCRIPTION.INDICATOR.FAILED',
    toneClass: 'text-n-ruby-11',
  },
  skipped: {
    icon: 'i-lucide-clock',
    labelKey: 'CONVERSATION.VOICE_TRANSCRIPTION.INDICATOR.SKIPPED',
    toneClass: 'text-n-slate-11',
  },
};

const config = computed(() => STATUS_CONFIG[props.status]);
const label = computed(() => t(config.value.labelKey));
</script>

<template>
  <div :class="config.toneClass" class="flex items-center gap-1 text-xs mb-1">
    <Icon :icon="config.icon" class="size-3.5" />
    <span>{{ label }}</span>
  </div>
</template>

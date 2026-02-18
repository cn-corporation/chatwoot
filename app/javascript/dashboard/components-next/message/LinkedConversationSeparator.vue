<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  contactName: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
</script>

<template>
  <li class="flex items-center justify-center py-4">
    <div
      class="flex items-center gap-2 px-4 py-2 bg-n-alpha-2 dark:bg-n-alpha-3 rounded-lg"
    >
      <span class="i-lucide-history text-n-slate-10" />
      <span class="text-sm text-n-slate-11">
        {{
          t('CONVERSATION.MESSAGES_FROM_PREVIOUS_ACCOUNT', {
            name: contactName,
          })
        }}
      </span>
    </div>
  </li>
</template>

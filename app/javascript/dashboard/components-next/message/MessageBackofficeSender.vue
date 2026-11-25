<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Icon from 'next/icon/Icon.vue';
import {
  backofficeAccountLabel,
  backofficeSender,
} from 'dashboard/helper/backofficeSender';
import { useMessageContext } from './provider.js';

const { t } = useI18n();
const { contentAttributes } = useMessageContext();

const sender = computed(() => backofficeSender(contentAttributes.value));

const tooltip = computed(() =>
  t('BACKOFFICE_SENDER.TOOLTIP', {
    account: backofficeAccountLabel(sender.value),
  })
);
</script>

<template>
  <span
    v-tooltip.top="tooltip"
    class="inline-flex items-center gap-1 min-w-0 text-xs"
    data-testid="backoffice-sender"
  >
    <Icon icon="i-lucide-monitor" class="size-3 flex-shrink-0" />
    <span class="truncate max-w-48">
      {{ t('BACKOFFICE_SENDER.LABEL', { name: sender?.name }) }}
    </span>
  </span>
</template>

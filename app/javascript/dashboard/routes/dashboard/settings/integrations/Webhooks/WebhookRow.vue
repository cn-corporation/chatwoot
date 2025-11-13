<script setup>
import { computed } from 'vue';
import { getI18nKey } from 'dashboard/routes/dashboard/settings/helper/settingsHelper';
import ShowMore from 'dashboard/components/widgets/ShowMore.vue';
import { useI18n } from 'vue-i18n';

import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  webhook: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['edit', 'delete']);
const { t } = useI18n();
const subscribedEvents = computed(() => {
  const { subscriptions } = props.webhook;
  return subscriptions
    .map(event =>
      t(
        getI18nKey(
          'INTEGRATION_SETTINGS.WEBHOOK.FORM.SUBSCRIPTIONS.EVENTS',
          event
        )
      )
    )
    .join(', ');
});

const maskedUrl = computed(() => {
  const url = props.webhook.url;
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const hostname = urlObj.hostname;

    // Show protocol and hostname, mask the rest
    let masked = `${protocol}//${hostname}`;

    // If there's a path, show it partially masked
    if (urlObj.pathname && urlObj.pathname !== '/') {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        masked += `/${pathParts[0]}/***`;
      }
    } else {
      masked += '/***';
    }

    // Always hide query params and hash (they often contain secrets)
    if (urlObj.search || urlObj.hash) {
      masked += '?***';
    }

    return masked;
  } catch {
    // If URL parsing fails, just mask most of it
    if (url.length > 20) {
      return url.substring(0, 15) + '***';
    }
    return url;
  }
});
</script>

<template>
  <tr>
    <td class="py-4 ltr:pr-4 rtl:pl-4">
      <div class="font-medium break-words text-n-slate-12 font-mono text-sm">
        {{ maskedUrl }}
      </div>
      <div class="block mt-1 text-sm text-n-slate-11">
        <span class="font-medium">
          {{ $t('INTEGRATION_SETTINGS.WEBHOOK.SUBSCRIBED_EVENTS') }}:
        </span>
        <ShowMore :text="subscribedEvents" :limit="60" />
      </div>
    </td>
    <td class="py-4 min-w-xs">
      <div class="flex justify-end gap-1">
        <Button
          v-tooltip.top="$t('INTEGRATION_SETTINGS.WEBHOOK.EDIT.BUTTON_TEXT')"
          icon="i-lucide-pen"
          slate
          xs
          faded
          @click="emit('edit', webhook)"
        />
        <Button
          v-tooltip.top="$t('INTEGRATION_SETTINGS.WEBHOOK.DELETE.BUTTON_TEXT')"
          icon="i-lucide-trash-2"
          xs
          ruby
          faded
          @click="emit('delete', webhook, index)"
        />
      </div>
    </td>
  </tr>
</template>

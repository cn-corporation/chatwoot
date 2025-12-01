<script setup>
import EmptyState from 'dashboard/components/widgets/EmptyState.vue';
import { onMounted, onBeforeUnmount } from 'vue';

const toggleSupportWidgetVisibility = () => {
  if (window.$chatwoot) {
    window.$chatwoot.toggleBubbleVisibility('show');
  }
};

const handleChatwootMessage = () => {
  toggleSupportWidgetVisibility();
};

const setupListenerForWidgetEvent = () => {
  window.addEventListener('chatwoot:on-message', handleChatwootMessage);
};

const removeListenerForWidgetEvent = () => {
  window.removeEventListener('chatwoot:on-message', handleChatwootMessage);
};

onMounted(() => {
  toggleSupportWidgetVisibility();
  setupListenerForWidgetEvent();
});

onBeforeUnmount(() => {
  removeListenerForWidgetEvent();
});
</script>

<template>
  <div class="items-center bg-n-slate-2 flex justify-center h-full w-full">
    <EmptyState
      :title="$t('APP_GLOBAL.ACCOUNT_SUSPENDED.TITLE')"
      :message="$t('APP_GLOBAL.ACCOUNT_SUSPENDED.MESSAGE')"
    />
  </div>
</template>

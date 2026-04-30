<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { useIsMobile } from 'dashboard/composables/useIsMobile';

const { t } = useI18n();
const { isMobile } = useIsMobile();

const dismissed = useStorage('mobile_install_hint_dismissed', false);
const isStandalone = ref(false);
const isIOS = ref(false);

onMounted(() => {
  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  isIOS.value =
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !window.MSStream;
});

const visible = computed(
  () => isMobile.value && isIOS.value && !isStandalone.value && !dismissed.value
);

const dismiss = () => {
  dismissed.value = true;
};
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 rounded-xl bg-n-solid-2 border border-n-weak shadow-lg p-3 flex items-start gap-3 md:hidden"
  >
    <span
      class="i-lucide-smartphone size-5 text-n-brand flex-shrink-0 mt-0.5"
      aria-hidden="true"
    />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-n-slate-12 mb-0.5">
        {{ t('MOBILE.INSTALL_HINT.TITLE') }}
      </p>
      <p class="text-xs text-n-slate-11 mb-0">
        {{ t('MOBILE.INSTALL_HINT.BODY') }}
      </p>
    </div>
    <button
      type="button"
      class="flex items-center justify-center h-8 w-8 rounded-lg text-n-slate-11 hover:bg-n-alpha-2 flex-shrink-0"
      :aria-label="t('MOBILE.INSTALL_HINT.DISMISS')"
      @click="dismiss"
    >
      <span class="i-lucide-x size-4" aria-hidden="true" />
    </button>
  </div>
</template>

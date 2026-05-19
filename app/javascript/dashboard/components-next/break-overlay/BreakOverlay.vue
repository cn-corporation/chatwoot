<script setup>
import { computed, ref, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useOperatorBreak } from 'dashboard/composables/useOperatorBreak';
import Button from 'next/button/Button.vue';

const { t } = useI18n();
const { activeBreak, isOnBreak, isLoading, endBreak } = useOperatorBreak();

const now = ref(Date.now());
let tick = null;

const startTickIfNeeded = active => {
  if (active && !tick) {
    tick = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  } else if (!active && tick) {
    clearInterval(tick);
    tick = null;
  }
};

watch(isOnBreak, startTickIfNeeded, { immediate: true });

onUnmounted(() => {
  if (tick) {
    clearInterval(tick);
    tick = null;
  }
});

const elapsedMs = computed(() => {
  if (!activeBreak.value) return 0;
  const startedAtMs = new Date(activeBreak.value.startedAt).getTime();
  return Math.max(0, now.value - startedAtMs);
});

const elapsedFormatted = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000);
  const h = Math.floor(total / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
});

const breakLabel = computed(() => {
  if (!activeBreak.value) return '';
  return activeBreak.value.breakType === 'lunch'
    ? t('BREAKS.LUNCH')
    : t('BREAKS.SMOKE');
});

const breakIcon = computed(() => {
  if (!activeBreak.value) return 'i-lucide-coffee';
  return activeBreak.value.breakType === 'lunch'
    ? 'i-lucide-utensils'
    : 'i-lucide-cigarette';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOnBreak"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-n-alpha-3 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="flex flex-col gap-8 items-center px-12 py-16 mx-4 max-w-lg text-center rounded-2xl border bg-n-background border-n-weak shadow-2xl"
      >
        <div class="flex gap-3 items-center">
          <span class="size-8 text-n-slate-12" :class="[breakIcon]" />
          <h1 class="text-2xl font-semibold text-n-slate-12">
            {{ t('BREAKS.OVERLAY.HEADING') }}
          </h1>
        </div>

        <div class="flex flex-col gap-2 items-center">
          <span
            class="px-4 py-1 text-sm font-medium tracking-wide uppercase rounded-full bg-n-alpha-2 text-n-slate-11"
          >
            {{ breakLabel }}
          </span>
          <p class="mt-2 text-sm text-n-slate-11">
            {{ t('BREAKS.OVERLAY.SUBHEADING') }}
          </p>
        </div>

        <div
          class="font-mono text-6xl font-bold tabular-nums text-n-slate-12"
          aria-live="polite"
        >
          {{ elapsedFormatted }}
        </div>

        <Button
          color="blue"
          size="lg"
          icon="i-lucide-log-in"
          :is-loading="isLoading"
          :disabled="isLoading"
          @click="endBreak"
        >
          {{ t('BREAKS.OVERLAY.IM_BACK') }}
        </Button>
      </div>
    </div>
  </Teleport>
</template>

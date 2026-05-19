<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

const REFRESH_MS = 15000;

const { t } = useI18n();
const breaks = ref([]);
const isLoading = ref(true);
const now = ref(Date.now());
let refreshInterval = null;
let tickInterval = null;

const formatMs = ms => {
  if (ms == null) return '—';
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const breakLabel = type =>
  type === 'lunch' ? t('BREAKS.LUNCH') : t('BREAKS.SMOKE');

const breakIcon = type =>
  type === 'lunch' ? 'i-lucide-utensils' : 'i-lucide-cigarette';

const sortedBreaks = computed(() =>
  [...breaks.value].sort((a, b) => {
    const startA = new Date(a.startedAt).getTime();
    const startB = new Date(b.startedAt).getTime();
    return startA - startB;
  })
);

const elapsedFor = b => {
  const startedAtMs = new Date(b.startedAt).getTime();
  return Math.max(0, now.value - startedAtMs);
};

const fetchBreaks = async () => {
  try {
    const data = await ChatwootExtraAPI.getCurrentOperatorBreaks();
    breaks.value = Array.isArray(data) ? data : [];
  } catch {
    // silent
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await fetchBreaks();
  refreshInterval = setInterval(fetchBreaks, REFRESH_MS);
  tickInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (tickInterval) clearInterval(tickInterval);
});
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">{{ t('BREAKS.REPORT.LOADING') }}</span>
    </div>
    <div
      v-else-if="!sortedBreaks.length"
      class="flex items-center justify-center py-16"
    >
      <span class="text-n-slate-11">{{ t('BREAKS.REPORT.NO_ACTIVE') }}</span>
    </div>
    <table v-else class="w-full text-left">
      <thead>
        <tr class="border-b border-n-slate-3">
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.OPERATOR') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.TYPE') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.STARTED_AT') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.ELAPSED') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="b in sortedBreaks"
          :key="b.id"
          class="border-b border-n-slate-2"
        >
          <td class="py-3 px-4 text-sm font-medium text-n-slate-12">
            {{ b.operatorName }}
          </td>
          <td class="py-3 px-4 text-sm text-n-slate-11">
            <span class="inline-flex items-center gap-2">
              <span
                class="size-4 text-n-slate-11"
                :class="[breakIcon(b.breakType)]"
              />
              {{ breakLabel(b.breakType) }}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-n-slate-11">
            {{ new Date(b.startedAt).toLocaleString() }}
          </td>
          <td class="py-3 px-4 text-sm font-mono tabular-nums text-n-slate-12">
            {{ formatMs(elapsedFor(b)) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

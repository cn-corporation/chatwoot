<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { format, subDays } from 'date-fns';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

const { t } = useI18n();
const isLoading = ref(false);
const reportData = ref([]);
const operatorOptions = ref([]);
const selectedOperators = ref([]);
const breakTypeFilter = ref('');
const dateRange = ref({
  start: format(subDays(new Date(), 18), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});
const expandedOperators = ref(new Set());
const dropdownOpen = ref(false);
const dropdownRef = ref(null);
const dropdownSearch = ref('');

const filteredOperatorOptions = computed(() => {
  if (!dropdownSearch.value) return operatorOptions.value;
  const q = dropdownSearch.value.toLowerCase();
  return operatorOptions.value.filter(op => op.label.toLowerCase().includes(q));
});

const isSelected = op =>
  selectedOperators.value.some(s => s.value === op.value);

const toggleOperator = op => {
  if (isSelected(op)) {
    selectedOperators.value = selectedOperators.value.filter(
      s => s.value !== op.value
    );
  } else {
    selectedOperators.value = [...selectedOperators.value, op];
  }
};

const operatorButtonLabel = computed(() => {
  if (!selectedOperators.value.length)
    return t('BREAKS.REPORT.FILTERS.ALL_OPERATORS');
  if (selectedOperators.value.length === 1)
    return selectedOperators.value[0].label;
  return t('BREAKS.REPORT.FILTERS.N_OPERATORS', {
    count: selectedOperators.value.length,
  });
});

const handleClickOutside = e => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    dropdownOpen.value = false;
    dropdownSearch.value = '';
  }
};

onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onUnmounted(() =>
  document.removeEventListener('mousedown', handleClickOutside)
);

const toggleExpand = operatorId => {
  const next = new Set(expandedOperators.value);
  if (next.has(operatorId)) {
    next.delete(operatorId);
  } else {
    next.add(operatorId);
  }
  expandedOperators.value = next;
};

const formatMs = ms => {
  if (!ms && ms !== 0) return '—';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

const formatTime = iso => {
  if (!iso) return '—';
  return format(new Date(iso), 'HH:mm:ss');
};

const formatDate = iso => {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM dd, yyyy');
};

const breakLabel = type =>
  type === 'lunch' ? t('BREAKS.LUNCH') : t('BREAKS.SMOKE');

const sortedReportData = computed(() => {
  return [...reportData.value].sort((a, b) =>
    (a.operatorName || '').localeCompare(b.operatorName || '')
  );
});

const summaryMetrics = computed(() => {
  if (!reportData.value.length) return null;
  const totals = reportData.value.reduce(
    (acc, op) => ({
      totalMs: acc.totalMs + op.totalMs,
      smokeMs: acc.smokeMs + op.smokeMs,
      lunchMs: acc.lunchMs + op.lunchMs,
    }),
    { totalMs: 0, smokeMs: 0, lunchMs: 0 }
  );
  return {
    ...totals,
    totalOperators: reportData.value.length,
  };
});

const fetchOperatorOptions = async () => {
  try {
    const res = await ChatwootExtraAPI.getOperatorsList();
    if (res?.data) {
      operatorOptions.value = res.data.map(op => ({
        value: op.operatorId,
        label: op.name,
      }));
    }
  } catch {
    // silent
  }
};

const fetchReport = async () => {
  isLoading.value = true;
  try {
    const params = {
      startDate: dateRange.value.start,
      endDate: dateRange.value.end,
    };
    if (selectedOperators.value.length > 0) {
      params.operatorIds = selectedOperators.value
        .map(op => op.value || op)
        .join(',');
    }
    if (breakTypeFilter.value) {
      params.breakType = breakTypeFilter.value;
    }
    const res = await ChatwootExtraAPI.getOperatorBreaksReport(params);
    reportData.value = res?.data?.operators || [];
  } catch {
    reportData.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await fetchOperatorOptions();
  await fetchReport();
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3 p-4 rounded-lg bg-n-slate-2">
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label class="block mb-1 text-xs font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.FILTERS.START_DATE') }}
          </label>
          <input
            v-model="dateRange.start"
            type="date"
            class="no-margin block h-9 px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
          />
        </div>
        <div>
          <label class="block mb-1 text-xs font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.FILTERS.END_DATE') }}
          </label>
          <input
            v-model="dateRange.end"
            type="date"
            class="no-margin block h-9 px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
          />
        </div>
        <div ref="dropdownRef" class="relative">
          <label class="block mb-1 text-xs font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.FILTERS.OPERATORS') }}
          </label>
          <button
            type="button"
            class="flex items-center justify-between h-9 w-[220px] px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
            @click="dropdownOpen = !dropdownOpen"
          >
            <span class="truncate">{{ operatorButtonLabel }}</span>
            <span class="ml-2 text-n-slate-9">▾</span>
          </button>
          <div
            v-if="dropdownOpen"
            class="absolute z-50 mt-1 w-[220px] rounded-md border border-n-slate-4 bg-n-background shadow-lg"
          >
            <div class="p-1.5 border-b border-n-slate-3">
              <input
                v-model="dropdownSearch"
                type="text"
                :placeholder="t('BREAKS.REPORT.FILTERS.SEARCH_PLACEHOLDER')"
                class="w-full px-2 py-1 text-sm border rounded border-n-slate-4 bg-n-background text-n-slate-12"
              />
            </div>
            <ul class="max-h-[200px] overflow-y-auto py-1">
              <li
                v-for="op in filteredOperatorOptions"
                :key="op.value"
                class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-n-slate-2 text-n-slate-12"
                @click="toggleOperator(op)"
              >
                <span
                  class="flex items-center justify-center w-4 h-4 border rounded border-n-slate-6"
                  :class="{ 'bg-woot-500 border-woot-500': isSelected(op) }"
                >
                  <span
                    v-if="isSelected(op)"
                    class="text-white text-xs"
                  >✓</span>
                </span>
                <span class="truncate">{{ op.label }}</span>
              </li>
              <li
                v-if="!filteredOperatorOptions.length"
                class="px-3 py-1.5 text-sm text-n-slate-9"
              >
                {{ t('BREAKS.REPORT.FILTERS.NO_RESULTS') }}
              </li>
            </ul>
          </div>
        </div>
        <div>
          <label class="block mb-1 text-xs font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.FILTERS.BREAK_TYPE') }}
          </label>
          <select
            v-model="breakTypeFilter"
            class="no-margin block !h-9 !py-0 !mb-0 w-[160px] pl-3 pr-8 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
          >
            <option value="">{{ t('BREAKS.REPORT.FILTERS.ANY_TYPE') }}</option>
            <option value="smoke">{{ t('BREAKS.SMOKE') }}</option>
            <option value="lunch">{{ t('BREAKS.LUNCH') }}</option>
          </select>
        </div>
      </div>
      <div>
        <button
          class="h-9 px-4 text-sm font-medium text-white rounded-md bg-woot-500 hover:bg-woot-600"
          @click="fetchReport"
        >
          {{ t('BREAKS.REPORT.FILTERS.APPLY') }}
        </button>
      </div>
    </div>

    <div v-if="!isLoading && summaryMetrics" class="grid grid-cols-3 gap-4">
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">
          {{ t('BREAKS.REPORT.METRICS.TOTAL') }}
        </p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.totalMs) }}
        </p>
      </div>
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">
          {{ t('BREAKS.REPORT.METRICS.SMOKE') }}
        </p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.smokeMs) }}
        </p>
      </div>
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">
          {{ t('BREAKS.REPORT.METRICS.LUNCH') }}
        </p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.lunchMs) }}
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">{{ t('BREAKS.REPORT.LOADING') }}</span>
    </div>

    <table v-else-if="reportData.length" class="w-full text-left">
      <thead>
        <tr class="border-b border-n-slate-3">
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11 w-8" />
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.OPERATOR') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.TOTAL') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.SMOKE') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.LUNCH') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('BREAKS.REPORT.TABLE.SESSIONS') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="op in sortedReportData" :key="op.operatorId">
          <tr
            class="border-b border-n-slate-2 cursor-pointer hover:bg-n-slate-1"
            @click="toggleExpand(op.operatorId)"
          >
            <td class="py-3 px-4 text-sm text-n-slate-11">
              {{ expandedOperators.has(op.operatorId) ? '▼' : '▶' }}
            </td>
            <td class="py-3 px-4 text-sm font-medium text-n-slate-12">
              {{ op.operatorName }}
            </td>
            <td class="py-3 px-4 text-sm text-n-slate-12">
              {{ formatMs(op.totalMs) }}
            </td>
            <td class="py-3 px-4 text-sm text-n-slate-12">
              {{ formatMs(op.smokeMs) }}
              <span class="text-n-slate-10 text-xs">({{ op.smokeCount }})</span>
            </td>
            <td class="py-3 px-4 text-sm text-n-slate-12">
              {{ formatMs(op.lunchMs) }}
              <span class="text-n-slate-10 text-xs">({{ op.lunchCount }})</span>
            </td>
            <td class="py-3 px-4 text-sm text-n-slate-12">
              {{ op.sessions.length }}
            </td>
          </tr>
          <template v-if="expandedOperators.has(op.operatorId)">
            <tr
              v-for="(session, idx) in op.sessions"
              :key="`${op.operatorId}-${idx}`"
              class="bg-n-slate-1 border-b border-n-slate-2"
            >
              <td class="py-2 px-4" />
              <td class="py-2 px-4 text-xs text-n-slate-11 pl-10">
                {{ formatDate(session.startedAt) }}
              </td>
              <td class="py-2 px-4 text-xs text-n-slate-11">
                {{ breakLabel(session.breakType) }}
              </td>
              <td class="py-2 px-4 text-xs text-n-slate-11" colspan="2">
                {{ formatTime(session.startedAt) }} →
                <template v-if="session.endedAt">
                  {{ formatTime(session.endedAt) }}
                </template>
                <span
                  v-else
                  class="inline-flex items-center gap-1 text-green-600"
                >
                  <span
                    class="inline-block w-1.5 h-1.5 rounded-full bg-green-500"
                  />
                  {{ t('BREAKS.REPORT.TABLE.ACTIVE') }}
                </span>
              </td>
              <td class="py-2 px-4 text-xs text-n-slate-11">
                {{ formatMs(session.durationMs) }}
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>

    <div v-else-if="!isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">{{
        t('BREAKS.REPORT.TABLE.NO_DATA')
      }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import { endOfMonth, format, subDays } from 'date-fns';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

const { t } = useI18n();
const emit = defineEmits(['open-payroll']);
const store = useStore();
const caretDown = '▾';
const checkMark = '✓';
const caretExpanded = '▼';
const caretCollapsed = '▶';
const minHoursPlaceholder = '0';
const rightArrow = '→';
const isLoading = ref(false);
const isExporting = ref(false);
const reportData = ref([]);
const operatorOptions = ref([]);
const selectedOperators = ref([]);
const minHours = ref('');
const dateFilterType = ref('period');
const selectedMonth = ref(format(new Date(), 'yyyy-MM'));
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
    return t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.ALL_OPERATORS');
  if (selectedOperators.value.length === 1)
    return selectedOperators.value[0].label;
  return t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.N_OPERATORS', {
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

const sortedReportData = computed(() => {
  return [...reportData.value].sort((a, b) =>
    (a.operatorName || '').localeCompare(b.operatorName || '')
  );
});

const summaryMetrics = computed(() => {
  if (!reportData.value.length) return null;
  const totalMs = reportData.value.reduce((sum, op) => sum + op.totalMs, 0);
  const totalOperators = reportData.value.length;
  const avgMs = totalOperators > 0 ? totalMs / totalOperators : 0;
  return { totalMs, totalOperators, avgMs };
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
    // Silently handle
  }
};

const buildReportParams = () => {
  const selectedRange = getSelectedRange();
  const params = {
    startDate: selectedRange.start,
    endDate: selectedRange.end,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  if (selectedOperators.value.length > 0) {
    params.operatorIds = selectedOperators.value
      .map(op => op.value || op)
      .join(',');
  }

  if (minHours.value) {
    params.minHours = minHours.value;
  }

  return params;
};

const getSelectedRange = () => {
  if (dateFilterType.value === 'month' && selectedMonth.value) {
    const monthDate = new Date(`${selectedMonth.value}-01T00:00:00`);
    return {
      start: format(monthDate, 'yyyy-MM-dd'),
      end: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
    };
  }
  return dateRange.value;
};

const fetchReport = async () => {
  isLoading.value = true;
  try {
    const res =
      await ChatwootExtraAPI.getOperatorStatusReport(buildReportParams());
    reportData.value = res?.data?.operators || [];
  } catch {
    reportData.value = [];
  } finally {
    isLoading.value = false;
  }
};

const downloadShiftReport = async () => {
  isExporting.value = true;
  try {
    const selectedRange = getSelectedRange();
    const data =
      await ChatwootExtraAPI.downloadOperatorShiftReport(buildReportParams());
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `operator-payroll-${selectedRange.start}-${selectedRange.end}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    useAlert(t('REPORT.OPERATOR_STATUS_PAGE.EXPORT.SUCCESS'));
  } catch {
    useAlert(t('REPORT.OPERATOR_STATUS_PAGE.EXPORT.ERROR'));
  } finally {
    isExporting.value = false;
  }
};

onMounted(async () => {
  store.dispatch('agents/get');
  await fetchOperatorOptions();
  await fetchReport();
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="rounded-lg border border-n-slate-3 bg-n-slate-2 p-4">
      <div class="flex flex-col gap-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-n-slate-12">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.DATE_RANGE') }}
            </p>
            <p class="mt-0.5 text-xs text-n-slate-10">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.DATE_RANGE_HINT') }}
            </p>
          </div>
          <div
            class="inline-flex rounded-md border border-n-slate-4 bg-n-background p-0.5"
            role="group"
            :aria-label="t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.DATE_RANGE')"
          >
            <button
              type="button"
              class="h-8 rounded px-3 text-sm font-medium transition-colors"
              :class="
                dateFilterType === 'month'
                  ? 'bg-woot-500 text-white'
                  : 'text-n-slate-11 hover:bg-n-slate-2 hover:text-n-slate-12'
              "
              :aria-pressed="dateFilterType === 'month'"
              @click="dateFilterType = 'month'"
            >
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.MONTH') }}
            </button>
            <button
              type="button"
              class="h-8 rounded px-3 text-sm font-medium transition-colors"
              :class="
                dateFilterType === 'period'
                  ? 'bg-woot-500 text-white'
                  : 'text-n-slate-11 hover:bg-n-slate-2 hover:text-n-slate-12'
              "
              :aria-pressed="dateFilterType === 'period'"
              @click="dateFilterType = 'period'"
            >
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.CUSTOM_PERIOD') }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-end gap-4">
          <div v-if="dateFilterType === 'month'" class="w-full sm:w-[13rem]">
            <label
              class="mb-1 block text-xs font-medium text-n-slate-11"
              for="operator-report-month"
            >
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.MONTH') }}
            </label>
            <input
              id="operator-report-month"
              v-model="selectedMonth"
              type="month"
              class="no-margin block h-9 w-full rounded-md border border-n-slate-4 bg-n-background px-3 text-sm text-n-slate-12"
            />
          </div>
          <template v-else>
            <div class="w-full sm:w-[13rem]">
              <label class="mb-1 block text-xs font-medium text-n-slate-11">
                {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.START_DATE') }}
              </label>
              <input
                v-model="dateRange.start"
                type="date"
                class="no-margin block h-9 w-full rounded-md border border-n-slate-4 bg-n-background px-3 text-sm text-n-slate-12"
              />
            </div>
            <div class="w-full sm:w-[13rem]">
              <label class="mb-1 block text-xs font-medium text-n-slate-11">
                {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.END_DATE') }}
              </label>
              <input
                v-model="dateRange.end"
                type="date"
                class="no-margin block h-9 w-full rounded-md border border-n-slate-4 bg-n-background px-3 text-sm text-n-slate-12"
              />
            </div>
          </template>
          <div ref="dropdownRef" class="relative">
            <label class="block mb-1 text-xs font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.OPERATORS') }}
            </label>
            <button
              type="button"
              class="flex items-center justify-between h-9 w-[220px] px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
              @click="dropdownOpen = !dropdownOpen"
            >
              <span class="truncate">{{ operatorButtonLabel }}</span>
              <span class="ml-2 text-n-slate-9" aria-hidden="true">{{
                caretDown
              }}</span>
            </button>
            <div
              v-if="dropdownOpen"
              class="absolute z-50 mt-1 w-[220px] rounded-md border border-n-slate-4 bg-n-background shadow-lg"
            >
              <div class="p-1.5 border-b border-n-slate-3">
                <input
                  v-model="dropdownSearch"
                  type="text"
                  :placeholder="
                    t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.SEARCH_PLACEHOLDER')
                  "
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
                    <span v-if="isSelected(op)" class="text-white text-xs">{{
                      checkMark
                    }}</span>
                  </span>
                  <span class="truncate">{{ op.label }}</span>
                </li>
                <li
                  v-if="!filteredOperatorOptions.length"
                  class="px-3 py-1.5 text-sm text-n-slate-9"
                >
                  {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.NO_RESULTS') }}
                </li>
              </ul>
            </div>
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.MIN_HOURS') }}
            </label>
            <input
              v-model="minHours"
              type="number"
              min="0"
              step="0.5"
              :placeholder="minHoursPlaceholder"
              class="no-margin block h-9 px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12 w-20"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              class="h-9 px-4 text-sm font-medium text-white rounded-md bg-woot-500 hover:bg-woot-600"
              @click="fetchReport"
            >
              {{ t('REPORT.OPERATOR_STATUS_PAGE.FILTERS.APPLY') }}
            </button>
            <button
              class="h-9 px-4 text-sm font-medium rounded-md border border-n-slate-5 bg-n-background text-n-slate-12 hover:bg-n-slate-2 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isExporting"
              @click="downloadShiftReport"
            >
              {{
                isExporting
                  ? t('REPORT.OPERATOR_STATUS_PAGE.EXPORT.EXPORTING')
                  : t('REPORT.OPERATOR_STATUS_PAGE.EXPORT.ACTION')
              }}
            </button>
          </div>
        </div>
        <button
          class="self-start text-sm font-medium text-woot-600 hover:text-woot-700"
          @click="emit('open-payroll')"
        >
          {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPEN_SETTINGS') }}
        </button>
      </div>
    </div>

    <div v-if="!isLoading && summaryMetrics" class="grid grid-cols-3 gap-4">
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">
          {{ t('REPORT.OPERATOR_STATUS_PAGE.METRICS.TOTAL_HOURS') }}
        </p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.totalMs) }}
        </p>
      </div>
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">
          {{ t('REPORT.OPERATOR_STATUS_PAGE.METRICS.ACTIVE_OPERATORS') }}
        </p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ summaryMetrics.totalOperators }}
        </p>
      </div>
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">
          {{ t('REPORT.OPERATOR_STATUS_PAGE.METRICS.AVG_PER_OPERATOR') }}
        </p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.avgMs) }}
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.LOADING') }}
      </span>
    </div>

    <table
      v-else-if="reportData.length"
      class="block md:table w-full text-left"
    >
      <thead class="hidden md:table-header-group">
        <tr class="border-b border-n-slate-3">
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11 w-8" />
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.OPERATOR') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.TOTAL_TIME') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.ACTIVE_DAYS') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.SESSIONS') }}
          </th>
        </tr>
      </thead>
      <tbody class="block md:table-row-group">
        <template v-for="op in sortedReportData" :key="op.operatorId">
          <tr
            class="flex md:table-row gap-2 py-3 px-2 md:py-0 md:px-0 items-center border-b border-n-slate-2 cursor-pointer hover:bg-n-slate-1"
            @click="toggleExpand(op.operatorId)"
          >
            <td
              class="py-0 md:py-3 md:px-4 text-sm text-n-slate-11 flex-shrink-0"
            >
              {{
                expandedOperators.has(op.operatorId)
                  ? caretExpanded
                  : caretCollapsed
              }}
            </td>
            <td
              class="py-0 md:py-3 md:px-4 text-sm font-medium text-n-slate-12 flex-1 min-w-0 md:flex-initial"
            >
              <div class="truncate">{{ op.operatorName }}</div>
              <div class="block md:hidden text-xs text-n-slate-10 mt-0.5">
                {{
                  t(
                    'REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.MOBILE_SUMMARY',
                    {
                      total: formatMs(op.totalMs),
                      days: op.activeDays,
                      sessions: op.sessions.length,
                    }
                  )
                }}
              </div>
            </td>
            <td class="hidden md:table-cell py-3 px-4 text-sm text-n-slate-12">
              {{ formatMs(op.totalMs) }}
            </td>
            <td class="hidden md:table-cell py-3 px-4 text-sm text-n-slate-12">
              {{ op.activeDays }}
            </td>
            <td class="hidden md:table-cell py-3 px-4 text-sm text-n-slate-12">
              {{ op.sessions.length }}
            </td>
          </tr>
          <template v-if="expandedOperators.has(op.operatorId)">
            <tr
              v-for="(session, idx) in op.sessions"
              :key="`${op.operatorId}-${idx}`"
              class="flex flex-wrap md:table-row gap-x-2 gap-y-0 px-2 md:px-0 bg-n-slate-1 border-b border-n-slate-2"
            >
              <td class="hidden md:table-cell py-2 px-4" />
              <td
                class="py-2 md:px-4 text-xs text-n-slate-11 md:pl-10 flex-shrink-0"
              >
                {{ formatDate(session.startedAt) }}
              </td>
              <td class="py-2 md:px-4 text-xs text-n-slate-11 flex-1 min-w-0">
                {{ formatTime(session.startedAt) }} {{ rightArrow }}
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
                  {{ t('REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.ACTIVE') }}
                </span>
              </td>
              <td
                class="py-2 md:px-4 text-xs text-n-slate-11 flex-shrink-0"
                colspan="2"
              >
                {{ formatMs(session.durationMs) }}
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>

    <div v-else-if="!isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.SESSIONS_TABLE.NO_DATA') }}
      </span>
    </div>
  </div>
</template>

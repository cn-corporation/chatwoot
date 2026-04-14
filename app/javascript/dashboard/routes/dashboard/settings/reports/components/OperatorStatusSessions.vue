<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'dashboard/composables/store';
import { format, subDays } from 'date-fns';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

const store = useStore();
const isLoading = ref(false);
const reportData = ref([]);
const operatorOptions = ref([]);
const selectedOperators = ref([]);
const minHours = ref('');
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
  if (!selectedOperators.value.length) return 'All operators';
  if (selectedOperators.value.length === 1)
    return selectedOperators.value[0].label;
  return `${selectedOperators.value.length} operators`;
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

    if (minHours.value) {
      params.minHours = minHours.value;
    }

    const res = await ChatwootExtraAPI.getOperatorStatusReport(params);
    reportData.value = res?.data?.operators || [];
  } catch {
    reportData.value = [];
  } finally {
    isLoading.value = false;
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
    <div class="flex flex-col gap-3 p-4 rounded-lg bg-n-slate-2">
      <div class="flex flex-wrap items-end gap-4">
      <div>
        <label class="block mb-1 text-xs font-medium text-n-slate-11">
          Start Date
        </label>
        <input
          v-model="dateRange.start"
          type="date"
          class="no-margin block h-9 px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
        />
      </div>
      <div>
        <label class="block mb-1 text-xs font-medium text-n-slate-11">
          End Date
        </label>
        <input
          v-model="dateRange.end"
          type="date"
          class="no-margin block h-9 px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12"
        />
      </div>
      <div ref="dropdownRef" class="relative">
        <label class="block mb-1 text-xs font-medium text-n-slate-11">
          Operators
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
              placeholder="Search..."
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
                <span v-if="isSelected(op)" class="text-white text-xs">✓</span>
              </span>
              <span class="truncate">{{ op.label }}</span>
            </li>
            <li
              v-if="!filteredOperatorOptions.length"
              class="px-3 py-1.5 text-sm text-n-slate-9"
            >
              No results
            </li>
          </ul>
        </div>
      </div>
      <div>
        <label class="block mb-1 text-xs font-medium text-n-slate-11">
          Min Hours
        </label>
        <input
          v-model="minHours"
          type="number"
          min="0"
          step="0.5"
          placeholder="0"
          class="no-margin block h-9 px-3 text-sm border rounded-md border-n-slate-4 bg-n-background text-n-slate-12 w-20"
        />
      </div>
      </div>
      <div>
        <button
          class="h-9 px-4 text-sm font-medium text-white rounded-md bg-woot-500 hover:bg-woot-600"
          @click="fetchReport"
        >
          Apply
        </button>
      </div>
    </div>

    <div v-if="!isLoading && summaryMetrics" class="grid grid-cols-3 gap-4">
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">Total Hours</p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.totalMs) }}
        </p>
      </div>
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">Active Operators</p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ summaryMetrics.totalOperators }}
        </p>
      </div>
      <div class="p-4 rounded-lg bg-n-slate-2">
        <p class="text-xs text-n-slate-11">Average per Operator</p>
        <p class="text-xl font-semibold text-n-slate-12">
          {{ formatMs(summaryMetrics.avgMs) }}
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">Loading...</span>
    </div>

    <table v-else-if="reportData.length" class="w-full text-left">
      <thead>
        <tr class="border-b border-n-slate-3">
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11 w-8" />
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            Operator
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            Total Time
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            Active Days
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            Sessions
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
              {{ op.activeDays }}
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
                  Active
                </span>
              </td>
              <td class="py-2 px-4 text-xs text-n-slate-11" colspan="2">
                {{ formatMs(session.durationMs) }}
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>

    <div v-else-if="!isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">No data for the selected filters.</span>
    </div>
  </div>
</template>

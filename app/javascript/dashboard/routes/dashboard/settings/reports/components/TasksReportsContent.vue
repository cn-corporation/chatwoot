<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store';
import { useStore } from 'vuex';
import { format, subDays } from 'date-fns';
import Multiselect from 'vue-multiselect';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import ReportHeader from './ReportHeader.vue';
import MetricCard from './overview/MetricCard.vue';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { conversationUrl, frontendURL } from 'dashboard/helper/URLHelper';

const PAGE_SIZE = 100;
const ROW_HEIGHT = 44;

const { t } = useI18n();
const store = useStore();

const isLoading = ref(false);
const isLoadingMore = ref(false);
const tasks = ref([]);
const hasMore = ref(true);
const offset = ref(0);
const sentinelRef = ref(null);
let observer = null;

const allOperatorsOption = {
  value: '',
  label: t('TASKS_REPORT.FILTERS.OPERATOR_ALL'),
};

const dateRange = ref({
  start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});
const selectedOperator = ref(allOperatorsOption);
const selectedCompletedOption = ref({
  value: '',
  label: t('TASKS_REPORT.FILTERS.COMPLETED_ALL'),
});

const agents = useMapGetter('agents/getAgents');
const accountId = useMapGetter('getCurrentAccountId');

const operatorOptions = computed(() => [
  allOperatorsOption,
  ...agents.value.map(agent => ({
    value: agent.id,
    label:
      agent.name ||
      agent.email ||
      t('TASKS_REPORT.FILTERS.OPERATOR_ID', { id: agent.id }),
  })),
]);

const completedOptions = computed(() => [
  { value: '', label: t('TASKS_REPORT.FILTERS.COMPLETED_ALL') },
  { value: 'true', label: t('TASKS_REPORT.FILTERS.COMPLETED_YES') },
  { value: 'false', label: t('TASKS_REPORT.FILTERS.COMPLETED_NO') },
]);

const conversationLink = conversationId => {
  const id = accountId.value;
  if (!id) return '#';
  return frontendURL(conversationUrl({ accountId: id, id: conversationId }));
};

const buildFilters = () => {
  const start = dateRange.value.start
    ? `${dateRange.value.start}T00:00:00.000Z`
    : undefined;
  const end = dateRange.value.end
    ? `${dateRange.value.end}T23:59:59.999Z`
    : undefined;
  const filters = {
    startDate: start,
    endDate: end,
  };
  if (selectedOperator.value?.value) {
    filters.operatorId = selectedOperator.value.value;
  }
  const completedVal = selectedCompletedOption.value?.value;
  if (completedVal === 'true') filters.completed = true;
  if (completedVal === 'false') filters.completed = false;
  return filters;
};

const normalizeTask = task => ({
  id: task.id,
  conversationId: task.conversationId ?? task.conversation_id,
  message: task.message ?? '',
  operatorName: task.operatorName ?? task.operator_name ?? '—',
  completed: task.completed ?? false,
  completedByName: task.completedByName ?? task.completed_by_name ?? null,
  completedAt: task.completedAt ?? task.completed_at ?? null,
  createdAt: task.createdAt ?? task.created_at ?? null,
});

const normalizedTasks = computed(() => tasks.value.map(normalizeTask));

const fetchReport = async () => {
  isLoading.value = true;
  offset.value = 0;
  hasMore.value = true;
  try {
    const data = await ChatwootExtraAPI.getTasksReportPaginated({
      filters: buildFilters(),
      limit: PAGE_SIZE,
      offset: 0,
    });
    tasks.value = Array.isArray(data) ? data : [];
    hasMore.value = data.length >= PAGE_SIZE;
    offset.value = data.length;
  } finally {
    isLoading.value = false;
    await nextTick();
    setupObserver();
  }
};

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return;
  isLoadingMore.value = true;
  try {
    const data = await ChatwootExtraAPI.getTasksReportPaginated({
      filters: buildFilters(),
      limit: PAGE_SIZE,
      offset: offset.value,
    });
    const newTasks = Array.isArray(data) ? data : [];
    tasks.value = [...tasks.value, ...newTasks];
    hasMore.value = newTasks.length >= PAGE_SIZE;
    offset.value += newTasks.length;
  } finally {
    isLoadingMore.value = false;
  }
};

const setupObserver = () => {
  if (observer) observer.disconnect();
  if (!sentinelRef.value) return;
  observer = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) loadMore();
    },
    { rootMargin: '200px' }
  );
  observer.observe(sentinelRef.value);
};

const formatDateTime = iso => {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM dd, yyyy HH:mm');
  } catch {
    return iso;
  }
};

onMounted(() => {
  store.dispatch('agents/get');
  fetchReport();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader :header-title="t('TASKS_REPORT.HEADER')" />

    <div class="flex flex-wrap gap-4 items-start">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ t('TASKS_REPORT.FILTERS.START_DATE') }}
        </label>
        <input
          v-model="dateRange.start"
          type="date"
          class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12"
          @change="fetchReport"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ t('TASKS_REPORT.FILTERS.END_DATE') }}
        </label>
        <input
          v-model="dateRange.end"
          type="date"
          class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12"
          @change="fetchReport"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ t('TASKS_REPORT.FILTERS.OPERATORS') }}
        </label>
        <div class="min-w-[250px]">
          <Multiselect
            v-model="selectedOperator"
            :options="operatorOptions"
            :multiple="false"
            allow-empty
            close-on-select
            clear-on-select
            preserve-search
            :placeholder="t('TASKS_REPORT.FILTERS.OPERATORS_PLACEHOLDER')"
            label="label"
            track-by="value"
            :preselect-first="false"
            @update:model-value="fetchReport"
          />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ t('TASKS_REPORT.FILTERS.COMPLETED') }}
        </label>
        <div class="min-w-[250px]">
          <Multiselect
            v-model="selectedCompletedOption"
            :options="completedOptions"
            :multiple="false"
            allow-empty
            close-on-select
            clear-on-select
            preserve-search
            :placeholder="t('TASKS_REPORT.FILTERS.COMPLETED_PLACEHOLDER')"
            label="label"
            track-by="value"
            :preselect-first="false"
            @update:model-value="fetchReport"
          />
        </div>
      </div>
    </div>

    <MetricCard
      :header="t('TASKS_REPORT.TABLE.HEADER')"
      :is-loading="isLoading"
      :loading-message="t('TASKS_REPORT.LOADING')"
    >
      <div v-if="normalizedTasks.length" class="overflow-x-auto w-full">
        <div class="min-w-[1100px]">
          <table class="w-full">
            <colgroup>
              <col class="w-[100px]" />
              <col />
              <col class="w-[140px]" />
              <col class="w-[100px]" />
              <col class="w-[140px]" />
              <col class="w-[170px]" />
              <col class="w-[170px]" />
            </colgroup>
            <thead>
              <tr class="border-b border-n-slate-6">
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.CONVERSATION') }}
                </th>
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.MESSAGE') }}
                </th>
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.CREATED_BY') }}
                </th>
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.STATUS') }}
                </th>
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.COMPLETED_BY') }}
                </th>
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.CREATED_AT') }}
                </th>
                <th
                  class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
                >
                  {{ t('TASKS_REPORT.TABLE.COMPLETED_AT') }}
                </th>
              </tr>
            </thead>
          </table>
          <RecycleScroller
            :items="normalizedTasks"
            :item-size="ROW_HEIGHT"
            key-field="id"
            class="max-h-[70vh]"
          >
            <template #default="{ item: task }">
              <table class="w-full" :style="{ height: ROW_HEIGHT + 'px' }">
                <colgroup>
                  <col class="w-[100px]" />
                  <col />
                  <col class="w-[140px]" />
                  <col class="w-[100px]" />
                  <col class="w-[140px]" />
                  <col class="w-[170px]" />
                  <col class="w-[170px]" />
                </colgroup>
                <tbody>
                  <tr class="border-b border-n-slate-6 hover:bg-n-solid-2">
                    <td class="py-3 px-4 text-sm text-n-slate-12">
                      <a
                        :href="conversationLink(task.conversationId)"
                        class="text-n-primary hover:underline"
                      >
                        {{ '#' + task.conversationId }}
                      </a>
                    </td>
                    <td
                      class="py-3 px-4 text-sm text-n-slate-12 max-w-0 truncate"
                      :title="task.message"
                    >
                      {{ task.message }}
                    </td>
                    <td class="py-3 px-4 text-sm text-n-slate-12 truncate">
                      {{ task.operatorName }}
                    </td>
                    <td class="py-3 px-4 text-sm">
                      <span
                        :class="
                          task.completed ? 'text-green-600' : 'text-n-slate-11'
                        "
                      >
                        {{
                          task.completed
                            ? t('TASKS_REPORT.STATUS_COMPLETED')
                            : t('TASKS_REPORT.STATUS_OPEN')
                        }}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-sm text-n-slate-12 truncate">
                      {{ task.completedByName ?? '—' }}
                    </td>
                    <td
                      class="py-3 px-4 text-sm text-n-slate-12 whitespace-nowrap"
                    >
                      {{ formatDateTime(task.createdAt) }}
                    </td>
                    <td
                      class="py-3 px-4 text-sm text-n-slate-12 whitespace-nowrap"
                    >
                      {{ formatDateTime(task.completedAt) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #after>
              <div ref="sentinelRef" class="h-px" />
              <div
                v-if="isLoadingMore"
                class="flex items-center justify-center py-4 text-n-slate-11"
              >
                {{ t('TASKS_REPORT.LOADING') }}
              </div>
            </template>
          </RecycleScroller>
        </div>
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[200px] text-n-slate-11"
      >
        {{ t('TASKS_REPORT.NO_DATA') }}
      </div>
    </MetricCard>
  </div>
</template>

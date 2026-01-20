<script setup>
import ReportFilterSelector from './FilterSelector.vue';
import { formatTime } from '@chatwoot/utils';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import Table from 'dashboard/components/table/Table.vue';
import {
  downloadCsvFile,
  generateFileName,
} from 'dashboard/helper/downloadHelper';
import ResponseStatisticsAPI from 'dashboard/api/responseStatistics';
import {
  useVueTable,
  createColumnHelper,
  getCoreRowModel,
} from '@tanstack/vue-table';
import { computed, onMounted, ref, h } from 'vue';
import { useI18n } from 'vue-i18n';

const store = useStore();

const from = ref(0);
const to = ref(0);
const isLoading = ref(false);
const agentOverviewData = ref([]);

const agents = useMapGetter('agents/getAgents');

const getAgentById = id => (agents.value || []).find(agent => agent.id === id);

const columnHelper = createColumnHelper();
const { t } = useI18n();

const defaulSpanRender = cellProps =>
  h(
    'span',
    {
      class: cellProps.getValue() ? '' : 'text-n-slate-12',
    },
    cellProps.getValue()
  );

const columns = computed(() => [
  columnHelper.accessor('name', {
    header: t('SUMMARY_REPORTS.AGENT'),
    width: 300,
    cell: defaulSpanRender,
  }),
  columnHelper.accessor('conversationsCount', {
    header: t('SUMMARY_REPORTS.CONVERSATIONS'),
    width: 200,
    cell: defaulSpanRender,
  }),
  columnHelper.accessor('avgFirstResponseTime', {
    header: t('SUMMARY_REPORTS.AVG_FIRST_RESPONSE_TIME'),
    width: 200,
    cell: defaulSpanRender,
  }),
  columnHelper.accessor('avgResolutionTime', {
    header: t('SUMMARY_REPORTS.AVG_RESOLUTION_TIME'),
    width: 200,
    cell: defaulSpanRender,
  }),
  columnHelper.accessor('avgResponseTime', {
    header: t('SUMMARY_REPORTS.AVG_RESPONSE_TIME'),
    width: 200,
    cell: defaulSpanRender,
  }),
  columnHelper.accessor('maxResponseTime', {
    header: t('SUMMARY_REPORTS.MAX_RESPONSE_TIME'),
    width: 200,
    cell: defaulSpanRender,
  }),
  columnHelper.accessor('resolutionsCount', {
    header: t('SUMMARY_REPORTS.RESOLUTION_COUNT'),
    width: 200,
    cell: defaulSpanRender,
  }),
]);

const renderAvgTime = value => (value ? formatTime(value / 1000) : '--');

const renderCount = value => (value ? value.toLocaleString() : '--');

const tableData = computed(() =>
  agentOverviewData.value.map(row => {
    const agent = getAgentById(row.operatorId);
    return {
      id: row.operatorId,
      name: agent?.name || `Operator ${row.operatorId}`,
      type: 'agent',
      conversationsCount: renderCount(row.conversationsCount),
      avgFirstResponseTime: renderAvgTime(row.avgFirstResponseTimeMs),
      avgResolutionTime: renderAvgTime(row.avgResolutionTimeMs),
      avgResponseTime: renderAvgTime(row.avgResponseTimeMs),
      maxResponseTime: renderAvgTime(row.maxResponseTimeMs),
      resolutionsCount: renderCount(row.resolutionCount),
    };
  })
);

const fetchAgentsOverview = async () => {
  if (!from.value || !to.value) return;

  isLoading.value = true;
  try {
    const startDate = new Date(from.value * 1000).toISOString();
    const endDate = new Date(to.value * 1000).toISOString();

    const response = await ResponseStatisticsAPI.getAgentsOverview({
      startDate,
      endDate,
    });

    if (response.success) {
      agentOverviewData.value = response.data;
    }
  } catch (error) {
    console.error('Failed to fetch agents overview:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchAllData = () => {
  store.dispatch('agents/get');
  fetchAgentsOverview();
};

onMounted(() => {
  store.dispatch('agents/get');
});

const onFilterChange = updatedFilter => {
  from.value = updatedFilter.from;
  to.value = updatedFilter.to;
  fetchAllData();
};

const table = useVueTable({
  get data() {
    return tableData.value;
  },
  get columns() {
    return columns.value;
  },
  enableSorting: false,
  getCoreRowModel: getCoreRowModel(),
});

const downloadReports = () => {
  const fileName = generateFileName({
    type: 'agent',
    to: to.value,
    businessHours: false,
  });

  const headers = [
    t('SUMMARY_REPORTS.AGENT'),
    t('SUMMARY_REPORTS.CONVERSATIONS'),
    t('SUMMARY_REPORTS.AVG_FIRST_RESPONSE_TIME'),
    t('SUMMARY_REPORTS.AVG_RESOLUTION_TIME'),
    t('SUMMARY_REPORTS.AVG_RESPONSE_TIME'),
    t('SUMMARY_REPORTS.MAX_RESPONSE_TIME'),
    t('SUMMARY_REPORTS.RESOLUTION_COUNT'),
  ];

  const rows = tableData.value.map(row => [
    row.name,
    row.conversationsCount,
    row.avgFirstResponseTime,
    row.avgResolutionTime,
    row.avgResponseTime,
    row.maxResponseTime,
    row.resolutionsCount,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  downloadCsvFile(fileName, csvContent);
};

defineExpose({ downloadReports });
</script>

<template>
  <ReportFilterSelector
    :show-business-hours-switch="false"
    @filter-change="onFilterChange"
  />
  <div
    class="flex-1 overflow-auto px-2 py-2 mt-5 shadow outline-1 outline outline-n-container rounded-xl bg-n-solid-2"
  >
    <Table :table="table" />
  </div>
</template>

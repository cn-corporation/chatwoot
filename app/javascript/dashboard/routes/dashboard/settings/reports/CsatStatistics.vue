<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { format, subDays } from 'date-fns';
import ReportHeader from './components/ReportHeader.vue';
import CsatStatsFilters from './components/CsatStatsFilters.vue';
import CsatStatsOverview from './components/CsatStatsOverview.vue';
import CsatStatsCharts from './components/CsatStatsCharts.vue';
import CsatStatsTable from './components/CsatStatsTable.vue';
import csatStatisticsAPI from 'dashboard/api/csatStatistics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const { t } = useI18n();
const store = useStore();

const isLoading = ref(false);
const aggregatedData = ref(null);
const selectedOperators = ref([]);
const selectedRating = ref(null);
const dateRange = ref({
  start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});

const agents = useMapGetter('agents/getAgents');

const agentsMap = computed(() => {
  const map = new Map();
  agents.value.forEach(agent => {
    map.set(String(agent.id), agent);
  });
  return map;
});

const RATING_CONFIG = {
  awesome: { emoji: '\u{1F604}', label: 'CSAT_STATISTICS.RATINGS.AWESOME' },
  good: { emoji: '\u{1F642}', label: 'CSAT_STATISTICS.RATINGS.GOOD' },
  bad: { emoji: '\u{1F615}', label: 'CSAT_STATISTICS.RATINGS.BAD' },
  terrible: { emoji: '\u{1F621}', label: 'CSAT_STATISTICS.RATINGS.TERRIBLE' },
};

const getRatingLabel = rating => {
  const config = RATING_CONFIG[rating];
  return config ? `${config.emoji} ${t(config.label)}` : rating;
};

const getAgentName = operatorId => {
  const agent = agentsMap.value.get(String(operatorId));
  if (agent) {
    return (
      agent.name ||
      agent.email ||
      t('CSAT_STATISTICS.OPERATOR_ID', { id: operatorId })
    );
  }
  return t('CSAT_STATISTICS.OPERATOR_ID', { id: operatorId });
};

const operatorOptions = computed(() => {
  return agents.value.map(agent => ({
    value: agent.id,
    label:
      agent.name ||
      agent.email ||
      t('CSAT_STATISTICS.OPERATOR_ID', { id: agent.id }),
  }));
});

const ratingOptions = computed(() => [
  {
    value: 'awesome',
    label: `\u{1F604} ${t('CSAT_STATISTICS.RATINGS.AWESOME')}`,
  },
  { value: 'good', label: `\u{1F642} ${t('CSAT_STATISTICS.RATINGS.GOOD')}` },
  { value: 'bad', label: `\u{1F615} ${t('CSAT_STATISTICS.RATINGS.BAD')}` },
  {
    value: 'terrible',
    label: `\u{1F621} ${t('CSAT_STATISTICS.RATINGS.TERRIBLE')}`,
  },
]);

const overviewMetrics = computed(() => {
  if (!aggregatedData.value) return null;
  const { overview } = aggregatedData.value;
  return {
    totalResponses: overview.totalResponses,
    uniqueConversations: overview.uniqueConversations,
    uniqueOperators: overview.uniqueOperators,
    satisfactionScore: `${overview.satisfactionScore}%`,
  };
});

const RATING_ORDER = [
  {
    key: 'awesome',
    color: 'rgba(16, 185, 129, 0.7)',
    borderColor: 'rgba(16, 185, 129, 1)',
  },
  {
    key: 'good',
    color: 'rgba(59, 130, 246, 0.7)',
    borderColor: 'rgba(59, 130, 246, 1)',
  },
  {
    key: 'bad',
    color: 'rgba(245, 158, 11, 0.7)',
    borderColor: 'rgba(245, 158, 11, 1)',
  },
  {
    key: 'terrible',
    color: 'rgba(239, 68, 68, 0.7)',
    borderColor: 'rgba(239, 68, 68, 1)',
  },
];

const ratingChartData = computed(() => {
  if (!aggregatedData.value?.ratingChart?.length) return null;

  const countByRating = new Map(
    aggregatedData.value.ratingChart.map(r => [r.rating, r.count])
  );

  return {
    labels: RATING_ORDER.map(r => getRatingLabel(r.key)),
    datasets: [
      {
        label: t('CSAT_STATISTICS.CHARTS.RATINGS_LABEL'),
        data: RATING_ORDER.map(r => countByRating.get(r.key) || 0),
        backgroundColor: RATING_ORDER.map(r => r.color),
        borderColor: RATING_ORDER.map(r => r.borderColor),
        borderWidth: 1,
      },
    ],
  };
});

const trendChartData = computed(() => {
  if (!aggregatedData.value?.trendChart?.length) return null;

  return {
    labels: aggregatedData.value.trendChart.map(d =>
      format(new Date(d.date), 'MMM dd')
    ),
    datasets: [
      {
        label: t('CSAT_STATISTICS.CHARTS.TREND_LABEL'),
        data: aggregatedData.value.trendChart.map(d => d.count),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const operatorChartData = computed(() => {
  if (!aggregatedData.value?.operatorChart?.length) return null;

  return {
    labels: aggregatedData.value.operatorChart.map(o =>
      getAgentName(o.operatorId)
    ),
    datasets: [
      {
        label: t('CSAT_STATISTICS.CHARTS.OPERATORS_RESPONSES'),
        data: aggregatedData.value.operatorChart.map(o => o.count),
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top' },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    y: { beginAtZero: true },
  },
};

const formatDateTime = value => {
  if (!value) return t('CSAT_STATISTICS.EMPTY_VALUE');
  return format(new Date(value), 'MMM dd, yyyy HH:mm');
};

const tableRows = computed(() => {
  if (!aggregatedData.value?.tableRows?.length) return [];

  return aggregatedData.value.tableRows.map(row => ({
    id: row.id,
    conversationId: row.conversationId,
    operator: getAgentName(row.operatorChatwootId),
    rating: getRatingLabel(row.rating),
    comment: row.comment || t('CSAT_STATISTICS.EMPTY_VALUE'),
    resolutionDate: formatDateTime(row.resolutionDate),
  }));
});

const handleDateRangeChange = ({ field, value }) => {
  dateRange.value[field] = value;
};

const fetchData = async () => {
  isLoading.value = true;
  try {
    const params = {
      startDate: dateRange.value.start,
      endDate: dateRange.value.end,
    };

    if (selectedOperators.value.length > 0) {
      params.operatorIds = selectedOperators.value.map(option =>
        String(option.value || option)
      );
    }

    if (selectedRating.value?.value) {
      params.rating = selectedRating.value.value;
    }

    const res = await csatStatisticsAPI.getAggregatedReport(params);
    aggregatedData.value = res?.data || null;
  } catch (error) {
    aggregatedData.value = null;
  } finally {
    isLoading.value = false;
  }
};

const applyFilters = () => {
  fetchData();
};

const updateSelectedOperators = value => {
  selectedOperators.value = value;
};

const updateSelectedRating = value => {
  selectedRating.value = value;
};

onMounted(() => {
  store.dispatch('agents/get');
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('CSAT_STATISTICS.HEADER')"
      :header-description="t('CSAT_STATISTICS.DESCRIPTION')"
    />

    <CsatStatsFilters
      :date-range="dateRange"
      :operator-options="operatorOptions"
      :selected-operators="selectedOperators"
      :rating-options="ratingOptions"
      :selected-rating="selectedRating"
      :t="t"
      @update-date-range="handleDateRangeChange"
      @update-selected-operators="updateSelectedOperators"
      @update-selected-rating="updateSelectedRating"
      @apply="applyFilters"
    />

    <CsatStatsOverview
      v-if="!isLoading && overviewMetrics"
      :metrics="overviewMetrics"
      :t="t"
    />

    <CsatStatsCharts
      :rating-chart-data="ratingChartData"
      :trend-chart-data="trendChartData"
      :operator-chart-data="operatorChartData"
      :chart-options="chartOptions"
      :is-loading="isLoading"
      :t="t"
    />

    <CsatStatsTable :rows="tableRows" :is-loading="isLoading" :t="t" />
  </div>
</template>

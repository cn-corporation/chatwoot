<!-- eslint-disable no-plusplus -->
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
import ResolutionStatsFilters from './components/ResolutionStatsFilters.vue';
import ResolutionStatsOverview from './components/ResolutionStatsOverview.vue';
import ResolutionStatsCharts from './components/ResolutionStatsCharts.vue';
import ResolutionStatsTable from './components/ResolutionStatsTable.vue';
import resolutionStatisticsAPI from 'dashboard/api/resolutionStatistics';

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
const conversationId = ref('');
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

const resolutionTopicLabels = {
  deposits: () => t('CLOSE_TOPICS.TOPIC_DEPOSITS'),
  withdrawals: () => t('CLOSE_TOPICS.TOPIC_WITHDRAWALS'),
  deposits_withdrawals: () => t('CLOSE_TOPICS.TOPIC_DEPOSITS_WITHDRAWALS'),
  registration_login: () => t('CLOSE_TOPICS.TOPIC_REGISTRATION_LOGIN'),
  bonuses_rakeback: () => t('CLOSE_TOPICS.TOPIC_BONUSES_RAKEBACK'),
  service_complaint: () => t('CLOSE_TOPICS.TOPIC_SERVICE_COMPLAINT'),
  violation: () => t('CLOSE_TOPICS.TOPIC_VIOLATION'),
  complaint: () => t('CLOSE_TOPICS.TOPIC_COMPLAINT'),
  other: () => t('CLOSE_TOPICS.TOPIC_OTHER'),
  registration_funnel: () => 'Registration Funnel',
  statistics_rake_rakeback: () => 'Statistics / Rake / Rakeback',
  bonuses_promotions: () => 'Bonuses & Promotions',
  lobby_game: () => 'Lobby / Game',
  clubgg: () => 'ClubGG',
};

const getTopicLabel = topic => {
  const resolver = resolutionTopicLabels[topic];
  return resolver ? resolver() : topic;
};

const formatTopics = topicsArray => {
  if (!topicsArray || !Array.isArray(topicsArray) || topicsArray.length === 0) {
    return t('RESOLUTION_STATISTICS.EMPTY_VALUE');
  }
  return topicsArray.map(getTopicLabel).join(', ');
};

const getAgentName = operatorId => {
  if (operatorId === null || operatorId === undefined) {
    return t('RESOLUTION_STATISTICS.BOT');
  }
  const agent = agentsMap.value.get(String(operatorId));
  if (agent) {
    return (
      agent.name ||
      agent.email ||
      t('RESOLUTION_STATISTICS.OPERATOR_ID', {
        id: operatorId,
      })
    );
  }
  return t('RESOLUTION_STATISTICS.OPERATOR_ID', { id: operatorId });
};

const operatorOptions = computed(() => {
  return agents.value.map(agent => ({
    value: agent.id,
    label:
      agent.name ||
      agent.email ||
      t('RESOLUTION_STATISTICS.OPERATOR_ID', { id: agent.id }),
  }));
});

const overviewMetrics = computed(() => {
  if (!aggregatedData.value) return null;

  const { overview } = aggregatedData.value;

  return {
    totalResolutions: overview.totalResolutions,
    measurableResolutions: overview.measurableResolutions,
    avgResolutionTimeMs: overview.avgResolutionTimeMs,
    uniqueConversations: overview.uniqueConversations,
    uniqueOperators: overview.uniqueOperators,
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
        label: t('RESOLUTION_STATISTICS.CHARTS.TREND_LABEL'),
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
        label: t('RESOLUTION_STATISTICS.CHARTS.OPERATORS_LABEL'),
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
    legend: {
      display: true,
      position: 'top',
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
};

const formatDateTime = value => {
  if (!value) return t('RESOLUTION_STATISTICS.EMPTY_VALUE');
  return format(new Date(value), 'MMM dd, yyyy HH:mm');
};

const tableRows = computed(() => {
  if (!aggregatedData.value?.tableRows?.length) return [];

  return aggregatedData.value.tableRows.map(stat => ({
    id: stat.id,
    conversationId: stat.conversationId,
    operator: getAgentName(stat.operatorChatwootId ?? stat.operatorId),
    topics: formatTopics(stat.topics),
    createdAt: formatDateTime(stat.createdAt),
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

    const normalizedConversationId = String(conversationId.value || '').trim();
    if (normalizedConversationId) {
      params.conversationId = normalizedConversationId;
    }

    const statsRes =
      await resolutionStatisticsAPI.getAggregatedStatistics(params);
    aggregatedData.value = statsRes?.data || null;
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

const updateConversationId = value => {
  conversationId.value = value;
};

onMounted(() => {
  store.dispatch('agents/get');
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('RESOLUTION_STATISTICS.HEADER')"
      :header-description="t('RESOLUTION_STATISTICS.DESCRIPTION')"
    />

    <ResolutionStatsFilters
      :date-range="dateRange"
      :operator-options="operatorOptions"
      :selected-operators="selectedOperators"
      :conversation-id="conversationId"
      :t="t"
      @update-date-range="handleDateRangeChange"
      @update-selected-operators="updateSelectedOperators"
      @update-conversation-id="updateConversationId"
      @apply="applyFilters"
    />

    <ResolutionStatsOverview
      v-if="!isLoading && overviewMetrics"
      :metrics="overviewMetrics"
      :t="t"
    />

    <ResolutionStatsCharts
      :trend-chart-data="trendChartData"
      :operator-chart-data="operatorChartData"
      :chart-options="chartOptions"
      :is-loading="isLoading"
      :t="t"
    />

    <ResolutionStatsTable :rows="tableRows" :is-loading="isLoading" :t="t" />
  </div>
</template>

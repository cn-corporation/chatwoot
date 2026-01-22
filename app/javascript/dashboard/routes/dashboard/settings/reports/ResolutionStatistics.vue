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
const statistics = ref([]);
const reasons = ref([]);
const topics = ref([]);
const selectedOperators = ref([]);
const selectedReason = ref(null);
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

const resolutionReasonLabels = {
  resolved_success: () => t('CLOSE_REASON.RESOLVED_SUCCESS'),
  resolved_compensation: () => t('CLOSE_REASON.RESOLVED_COMPENSATION'),
  partially_resolved: () => t('CLOSE_REASON.PARTIALLY_RESOLVED'),
  waiting_client: () => t('CLOSE_REASON.WAITING_CLIENT'),
  escalated: () => t('CLOSE_REASON.ESCALATED'),
  conflict: () => t('CLOSE_REASON.CONFLICT'),
  custom: () => t('CLOSE_REASON.CUSTOM'),
  other: () => t('CLOSE_REASON.CUSTOM'),
};

const getResolutionReasonLabel = reason => {
  if (!reason || reason === 'empty') {
    return t('RESOLUTION_STATISTICS.UNKNOWN');
  }
  const resolver = resolutionReasonLabels[reason];
  return resolver ? resolver() : reason;
};

const resolutionTopicLabels = {
  registration_funnel: () => t('CLOSE_REASON.TOPIC_REGISTRATION_FUNNEL'),
  deposits_withdrawals: () => t('CLOSE_REASON.TOPIC_DEPOSITS_WITHDRAWALS'),
  statistics_rake_rakeback: () =>
    t('CLOSE_REASON.TOPIC_STATISTICS_RAKE_RAKEBACK'),
  bonuses_promotions: () => t('CLOSE_REASON.TOPIC_BONUSES_PROMOTIONS'),
  lobby_game: () => t('CLOSE_REASON.TOPIC_LOBBY_GAME'),
  clubgg: () => t('CLOSE_REASON.TOPIC_CLUBGG'),
  other: () => t('CLOSE_REASON.TOPIC_OTHER'),
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
const reasonOptions = computed(() =>
  reasons.value.map(reason => ({
    value: reason,
    label: getResolutionReasonLabel(reason),
  }))
);

const overviewMetrics = computed(() => {
  if (statistics.value.length === 0) {
    return null;
  }

  const uniqueConversations = new Set(
    statistics.value.map(stat => stat.conversationId)
  ).size;

  const uniqueOperators = new Set(
    statistics.value.map(stat =>
      String(stat.operatorChatwootId ?? stat.operatorId)
    )
  ).size;

  const reasonCounts = new Map();
  statistics.value.forEach(stat => {
    const reason = getResolutionReasonLabel(stat.resolutionReason);
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });

  const topReasonEntry = [...reasonCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];

  return {
    totalResolutions: statistics.value.length,
    uniqueConversations,
    uniqueOperators,
    topReason: topReasonEntry
      ? `${topReasonEntry[0]} (${topReasonEntry[1]})`
      : t('RESOLUTION_STATISTICS.NO_TOP_REASON'),
  };
});

const reasonChartData = computed(() => {
  if (statistics.value.length === 0) return null;

  const reasonCounts = new Map();
  statistics.value.forEach(stat => {
    const reason = getResolutionReasonLabel(stat.resolutionReason);
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });

  const sortedReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    labels: sortedReasons.map(([reason]) => reason),
    datasets: [
      {
        label: t('RESOLUTION_STATISTICS.CHARTS.REASONS_LABEL'),
        data: sortedReasons.map(([, count]) => count),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };
});

const trendChartData = computed(() => {
  if (statistics.value.length === 0) return null;

  const countsByDate = new Map();
  statistics.value.forEach(stat => {
    const key = format(new Date(stat.createdAt), 'yyyy-MM-dd');
    countsByDate.set(key, (countsByDate.get(key) || 0) + 1);
  });

  const sortedDates = [...countsByDate.entries()].sort(
    (a, b) => new Date(a[0]) - new Date(b[0])
  );

  return {
    labels: sortedDates.map(([date]) => format(new Date(date), 'MMM dd')),
    datasets: [
      {
        label: t('RESOLUTION_STATISTICS.CHARTS.TREND_LABEL'),
        data: sortedDates.map(([, count]) => count),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const operatorChartData = computed(() => {
  if (statistics.value.length === 0) return null;

  const operatorCounts = new Map();
  statistics.value.forEach(stat => {
    const operatorKey = String(stat.operatorChatwootId ?? stat.operatorId);
    operatorCounts.set(operatorKey, (operatorCounts.get(operatorKey) || 0) + 1);
  });

  const sortedOperators = [...operatorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    labels: sortedOperators.map(([operatorId]) => getAgentName(operatorId)),
    datasets: [
      {
        label: t('RESOLUTION_STATISTICS.CHARTS.OPERATORS_LABEL'),
        data: sortedOperators.map(([, count]) => count),
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

const tableRows = computed(() =>
  statistics.value.map(stat => {
    // Topics can be in different places depending on API response format
    // Check camelCase, snake_case, and direct properties
    let topicsArray = [];

    if (stat.customAttributes?.close_topics) {
      topicsArray = stat.customAttributes.close_topics;
    } else if (stat.custom_attributes?.close_topics) {
      topicsArray = stat.custom_attributes.close_topics;
    } else if (stat.closeTopics) {
      topicsArray = stat.closeTopics;
    } else if (stat.topics) {
      topicsArray = stat.topics;
    } else if (
      stat.customAttributes &&
      Array.isArray(stat.customAttributes.close_topics)
    ) {
      topicsArray = stat.customAttributes.close_topics;
    } else if (
      stat.custom_attributes &&
      Array.isArray(stat.custom_attributes.close_topics)
    ) {
      topicsArray = stat.custom_attributes.close_topics;
    }

    // Ensure it's an array
    if (!Array.isArray(topicsArray)) {
      topicsArray = [];
    }

    return {
      id: stat.id,
      conversationId: stat.conversationId,
      operator: getAgentName(stat.operatorChatwootId ?? stat.operatorId),
      reason: getResolutionReasonLabel(stat.resolutionReason),
      details: stat.resolutionDetails || t('RESOLUTION_STATISTICS.EMPTY_VALUE'),
      topics: formatTopics(topicsArray),
      createdAt: formatDateTime(stat.createdAt),
    };
  })
);

const handleDateRangeChange = ({ field, value }) => {
  dateRange.value[field] = value;
};

const fetchReasons = async () => {
  try {
    const response = await resolutionStatisticsAPI.getResolutionReasons();
    reasons.value = response?.data || [];
  } catch (error) {
    reasons.value = [];
  }
};

const fetchTopics = async () => {
  try {
    const response = await resolutionStatisticsAPI.getResolutionTopics();
    topics.value = response?.data || [];
  } catch (error) {
    topics.value = [];
  }
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

    if (selectedReason.value?.value) {
      params.resolutionReason = selectedReason.value.value;
    }

    const normalizedConversationId = String(conversationId.value || '').trim();
    if (normalizedConversationId) {
      params.conversationId = normalizedConversationId;
    }

    const statsRes = await resolutionStatisticsAPI.getStatistics(params);
    statistics.value = statsRes?.data || [];
  } catch (error) {
    statistics.value = [];
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

const updateSelectedReason = value => {
  selectedReason.value = value;
};

const updateConversationId = value => {
  conversationId.value = value;
};

onMounted(() => {
  store.dispatch('agents/get');
  fetchReasons();
  fetchTopics();
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
      :reason-options="reasonOptions"
      :selected-reason="selectedReason"
      :conversation-id="conversationId"
      :t="t"
      @update-date-range="handleDateRangeChange"
      @update-selected-operators="updateSelectedOperators"
      @update-selected-reason="updateSelectedReason"
      @update-conversation-id="updateConversationId"
      @apply="applyFilters"
    />

    <ResolutionStatsOverview
      v-if="!isLoading && overviewMetrics"
      :metrics="overviewMetrics"
      :t="t"
    />

    <ResolutionStatsCharts
      :reason-chart-data="reasonChartData"
      :trend-chart-data="trendChartData"
      :operator-chart-data="operatorChartData"
      :chart-options="chartOptions"
      :is-loading="isLoading"
      :t="t"
    />

    <ResolutionStatsTable :rows="tableRows" :is-loading="isLoading" :t="t" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'vue-chartjs';
import { format, subDays } from 'date-fns';
import ReportHeader from './components/ReportHeader.vue';
import CsatStatsFilters from './components/CsatStatsFilters.vue';
import qualityReviewStatisticsAPI from 'dashboard/api/qualityReviewStatistics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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
  awesome: {
    emoji: '\u{1F604}',
    color: 'rgba(16, 185, 129, 0.7)',
    border: 'rgba(16, 185, 129, 1)',
  },
  good: {
    emoji: '\u{1F642}',
    color: 'rgba(59, 130, 246, 0.7)',
    border: 'rgba(59, 130, 246, 1)',
  },
  bad: {
    emoji: '\u{1F615}',
    color: 'rgba(245, 158, 11, 0.7)',
    border: 'rgba(245, 158, 11, 1)',
  },
  terrible: {
    emoji: '\u{1F621}',
    color: 'rgba(239, 68, 68, 0.7)',
    border: 'rgba(239, 68, 68, 1)',
  },
};

const RATING_KEYS = ['awesome', 'good', 'bad', 'terrible'];

const getRatingLabel = rating => {
  const config = RATING_CONFIG[rating];
  return config
    ? `${config.emoji} ${t(`QUALITY_REVIEW.RATINGS.${rating.toUpperCase()}`)}`
    : rating;
};

const getAgentName = operatorId => {
  const agent = agentsMap.value.get(String(operatorId));
  return agent?.name || agent?.email || `Operator #${operatorId}`;
};

const operatorOptions = computed(() =>
  agents.value.map(agent => ({
    value: agent.id,
    label: agent.name || agent.email || `Operator #${agent.id}`,
  }))
);

const ratingOptions = computed(() =>
  RATING_KEYS.map(key => ({
    value: key,
    label: getRatingLabel(key),
  }))
);

const overviewMetrics = computed(() => {
  if (!aggregatedData.value) return null;
  const { overview } = aggregatedData.value;
  return [
    {
      label: t('QUALITY_REVIEW.OVERVIEW.TOTAL_REVIEWS'),
      value: overview.totalReviews,
    },
    {
      label: t('QUALITY_REVIEW.OVERVIEW.UNIQUE_CONVERSATIONS'),
      value: overview.uniqueConversations,
    },
    {
      label: t('QUALITY_REVIEW.OVERVIEW.UNIQUE_OPERATORS'),
      value: overview.uniqueOperators,
    },
    {
      label: t('QUALITY_REVIEW.OVERVIEW.POSITIVE_SCORE'),
      value: `${overview.positiveScore}%`,
    },
  ];
});

const ratingChartData = computed(() => {
  if (!aggregatedData.value?.ratingChart?.length) return null;
  const countByRating = new Map(
    aggregatedData.value.ratingChart.map(r => [r.rating, r.count])
  );
  return {
    labels: RATING_KEYS.map(k => getRatingLabel(k)),
    datasets: [
      {
        label: t('QUALITY_REVIEW.CHARTS.AI_RATINGS'),
        data: RATING_KEYS.map(k => countByRating.get(k) || 0),
        backgroundColor: RATING_KEYS.map(k => RATING_CONFIG[k].color),
        borderColor: RATING_KEYS.map(k => RATING_CONFIG[k].border),
        borderWidth: 1,
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
        label: t('QUALITY_REVIEW.CHARTS.POSITIVE_RATE'),
        data: aggregatedData.value.operatorChart.map(o => o.avgPositive),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgba(16, 185, 129, 1)',
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
  },
  scales: {
    y: { beginAtZero: true },
  },
};

const formatDateTime = value => {
  if (!value) return '-';
  return format(new Date(value), 'MMM dd, yyyy HH:mm');
};

const tableRows = computed(() => {
  if (!aggregatedData.value?.tableRows?.length) return [];
  return aggregatedData.value.tableRows.map(row => ({
    id: row.id,
    conversationId: row.conversationId,
    operator: getAgentName(row.operatorChatwootId),
    aiRating: getRatingLabel(row.aiRating),
    csatRating: row.csatRating ? getRatingLabel(row.csatRating) : '-',
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
      params.operatorIds = selectedOperators.value.map(o =>
        String(o.value || o)
      );
    }
    if (selectedRating.value?.value) {
      params.aiRating = selectedRating.value.value;
    }
    const res = await qualityReviewStatisticsAPI.getAggregatedReport(params);
    aggregatedData.value = res?.data || null;
  } catch {
    aggregatedData.value = null;
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  store.dispatch('agents/get');
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('QUALITY_REVIEW.HEADER')"
      :header-description="t('QUALITY_REVIEW.DESCRIPTION')"
    />

    <CsatStatsFilters
      :date-range="dateRange"
      :operator-options="operatorOptions"
      :selected-operators="selectedOperators"
      :rating-options="ratingOptions"
      :selected-rating="selectedRating"
      :t="t"
      @update-date-range="handleDateRangeChange"
      @update-selected-operators="v => (selectedOperators = v)"
      @update-selected-rating="v => (selectedRating = v)"
      @apply="fetchData"
    />

    <div v-if="!isLoading && overviewMetrics" class="grid grid-cols-4 gap-4">
      <div
        v-for="metric in overviewMetrics"
        :key="metric.label"
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ metric.label }}
        </p>
        <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
          {{ metric.value }}
        </p>
      </div>
    </div>

    <div
      v-if="!isLoading && (ratingChartData || operatorChartData)"
      class="grid grid-cols-2 gap-4"
    >
      <div
        v-if="ratingChartData"
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <h3 class="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ t('QUALITY_REVIEW.CHARTS.RATING_DISTRIBUTION') }}
        </h3>
        <div class="h-64">
          <Bar :data="ratingChartData" :options="chartOptions" />
        </div>
      </div>
      <div
        v-if="operatorChartData"
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <h3 class="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ t('QUALITY_REVIEW.CHARTS.OPERATOR_POSITIVE_RATE') }}
        </h3>
        <div class="h-64">
          <Bar :data="operatorChartData" :options="chartOptions" />
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <span class="text-slate-500">{{ t('QUALITY_REVIEW.LOADING') }}</span>
    </div>

    <div
      v-if="!isLoading && tableRows.length > 0"
      class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"
    >
      <table class="w-full text-left text-sm">
        <thead
          class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
        >
          <tr>
            <th
              class="px-4 py-3 font-medium text-slate-600 dark:text-slate-300"
            >
              {{ t('QUALITY_REVIEW.TABLE.CONVERSATION') }}
            </th>
            <th
              class="px-4 py-3 font-medium text-slate-600 dark:text-slate-300"
            >
              {{ t('QUALITY_REVIEW.TABLE.OPERATOR') }}
            </th>
            <th
              class="px-4 py-3 font-medium text-slate-600 dark:text-slate-300"
            >
              {{ t('QUALITY_REVIEW.TABLE.AI_RATING') }}
            </th>
            <th
              class="px-4 py-3 font-medium text-slate-600 dark:text-slate-300"
            >
              {{ t('QUALITY_REVIEW.TABLE.CSAT_RATING') }}
            </th>
            <th
              class="px-4 py-3 font-medium text-slate-600 dark:text-slate-300"
            >
              {{ t('QUALITY_REVIEW.TABLE.DATE') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in tableRows"
            :key="row.id"
            class="border-b border-slate-100 dark:border-slate-700"
          >
            <td class="px-4 py-3 text-slate-900 dark:text-white">
              #{{ row.conversationId }}
            </td>
            <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
              {{ row.operator }}
            </td>
            <td class="px-4 py-3">{{ row.aiRating }}</td>
            <td class="px-4 py-3">{{ row.csatRating }}</td>
            <td class="px-4 py-3 text-slate-500 dark:text-slate-400">
              {{ row.resolutionDate }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!isLoading && tableRows.length === 0 && aggregatedData"
      class="py-8 text-center text-slate-500"
    >
      {{ t('QUALITY_REVIEW.NO_DATA') }}
    </div>
  </div>
</template>

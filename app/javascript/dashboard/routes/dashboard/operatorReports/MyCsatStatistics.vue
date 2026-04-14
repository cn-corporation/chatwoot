<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
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
import { Line, Bar } from 'vue-chartjs';
import { format, subDays } from 'date-fns';
import Multiselect from 'vue-multiselect';
import ReportHeader from '../settings/reports/components/ReportHeader.vue';
import MetricCard from '../settings/reports/components/overview/MetricCard.vue';
import Button from 'dashboard/components-next/button/Button.vue';
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
const selectedRating = ref(null);
const dateRange = ref({
  start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});

const currentUserId = computed(() => {
  return String(store.getters.getCurrentUser.id);
});

const RATING_CONFIG = {
  awesome: { emoji: '\u{1F604}', label: 'CSAT_STATISTICS.RATINGS.AWESOME' },
  good: { emoji: '\u{1F642}', label: 'CSAT_STATISTICS.RATINGS.GOOD' },
  bad: { emoji: '\u{1F615}', label: 'CSAT_STATISTICS.RATINGS.BAD' },
  terrible: { emoji: '\u{1F621}', label: 'CSAT_STATISTICS.RATINGS.TERRIBLE' },
};

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

const getRatingLabel = rating => {
  const config = RATING_CONFIG[rating];
  return config ? `${config.emoji} ${t(config.label)}` : rating;
};

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
    satisfactionScore: `${overview.satisfactionScore}%`,
  };
});

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
    rating: getRatingLabel(row.rating),
    comment: row.comment || t('CSAT_STATISTICS.EMPTY_VALUE'),
    resolutionDate: formatDateTime(row.resolutionDate),
  }));
});

const fetchData = async () => {
  isLoading.value = true;
  try {
    const params = {
      startDate: dateRange.value.start,
      endDate: dateRange.value.end,
      operatorIds: [currentUserId.value],
    };

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

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('MY_REPORTS.CSAT_STATISTICS.HEADER')"
      :header-description="t('MY_REPORTS.CSAT_STATISTICS.DESCRIPTION')"
    />

    <MetricCard
      :header="t('CSAT_STATISTICS.FILTERS.HEADER')"
      :is-loading="false"
    >
      <div class="flex flex-wrap gap-4 items-end">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-n-slate-12">
            {{ t('CSAT_STATISTICS.FILTERS.START_DATE') }}
          </label>
          <input
            type="date"
            :value="dateRange.start"
            class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12"
            @input="e => (dateRange.start = e.target.value)"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-n-slate-12">
            {{ t('CSAT_STATISTICS.FILTERS.END_DATE') }}
          </label>
          <input
            type="date"
            :value="dateRange.end"
            class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12"
            @input="e => (dateRange.end = e.target.value)"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-n-slate-12">
            {{ t('CSAT_STATISTICS.FILTERS.RATING') }}
          </label>
          <div class="min-w-[200px]">
            <Multiselect
              v-model="selectedRating"
              :options="ratingOptions"
              :allow-empty="true"
              placeholder="All ratings"
              label="label"
              track-by="value"
            />
          </div>
        </div>

        <Button variant="primary" size="md" @click="fetchData">
          {{ t('CSAT_STATISTICS.FILTERS.APPLY') }}
        </Button>
      </div>
    </MetricCard>

    <div
      v-if="!isLoading && overviewMetrics"
      class="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">
          {{ t('CSAT_STATISTICS.METRICS.TOTAL_RESPONSES') }}
        </div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.totalResponses }}
        </div>
      </div>

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">
          {{ t('CSAT_STATISTICS.METRICS.UNIQUE_CONVERSATIONS') }}
        </div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.uniqueConversations }}
        </div>
      </div>

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">
          {{ t('CSAT_STATISTICS.METRICS.SATISFACTION_SCORE') }}
        </div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.satisfactionScore }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MetricCard
        :header="t('CSAT_STATISTICS.CHARTS.RATINGS')"
        :is-loading="isLoading"
      >
        <div v-if="ratingChartData" class="h-[300px]">
          <Bar :data="ratingChartData" :options="chartOptions" />
        </div>
        <div
          v-else
          class="flex items-center justify-center h-[300px] text-n-slate-11"
        >
          {{ t('CSAT_STATISTICS.EMPTY_STATE') }}
        </div>
      </MetricCard>

      <MetricCard
        :header="t('CSAT_STATISTICS.CHARTS.TREND')"
        :is-loading="isLoading"
      >
        <div v-if="trendChartData" class="h-[300px]">
          <Line :data="trendChartData" :options="chartOptions" />
        </div>
        <div
          v-else
          class="flex items-center justify-center h-[300px] text-n-slate-11"
        >
          {{ t('CSAT_STATISTICS.EMPTY_STATE') }}
        </div>
      </MetricCard>
    </div>

    <MetricCard
      :header="t('CSAT_STATISTICS.TABLE.HEADER')"
      :is-loading="isLoading"
    >
      <div v-if="tableRows.length > 0" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-n-slate-6">
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('CSAT_STATISTICS.TABLE.COLUMNS.CONVERSATION') }}
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('CSAT_STATISTICS.TABLE.COLUMNS.RATING') }}
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('CSAT_STATISTICS.TABLE.COLUMNS.COMMENT') }}
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('CSAT_STATISTICS.TABLE.COLUMNS.RESOLVED_AT') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tableRows"
              :key="row.id"
              class="border-b border-n-slate-6 hover:bg-n-solid-2"
            >
              <td class="py-3 px-4 text-sm text-n-slate-12">
                #{{ row.conversationId }}
              </td>
              <td class="py-3 px-4 text-sm">{{ row.rating }}</td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ row.comment }}
              </td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ row.resolutionDate }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[200px] text-n-slate-11"
      >
        {{ t('CSAT_STATISTICS.EMPTY_STATE') }}
      </div>
    </MetricCard>
  </div>
</template>

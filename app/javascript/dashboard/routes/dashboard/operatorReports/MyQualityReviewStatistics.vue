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
import Multiselect from 'vue-multiselect';
import ReportHeader from '../settings/reports/components/ReportHeader.vue';
import MetricCard from '../settings/reports/components/overview/MetricCard.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import qualityReviewStatisticsAPI from 'dashboard/api/qualityReviewStatistics';
import { conversationUrl, frontendURL } from 'dashboard/helper/URLHelper';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { t } = useI18n();
const store = useStore();

const isLoading = ref(false);
const aggregatedData = ref(null);
const selectedRating = ref(null);
const dateRange = ref({
  start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});

const accountId = useMapGetter('getCurrentAccountId');

const currentUserId = computed(() => {
  return String(store.getters.getCurrentUser.id);
});

const conversationLink = id => {
  if (!accountId.value) return '#';
  return frontendURL(conversationUrl({ accountId: accountId.value, id }));
};

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
    aiRating: getRatingLabel(row.aiRating),
    csatRating: row.csatRating ? getRatingLabel(row.csatRating) : '-',
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
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('MY_REPORTS.QUALITY_REVIEW.HEADER')"
      :header-description="t('MY_REPORTS.QUALITY_REVIEW.DESCRIPTION')"
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

    <div v-if="!isLoading && overviewMetrics" class="grid grid-cols-3 gap-4">
      <div
        v-for="metric in overviewMetrics"
        :key="metric.label"
        class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6"
      >
        <div class="text-sm text-n-slate-11 mb-1">{{ metric.label }}</div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ metric.value }}
        </div>
      </div>
    </div>

    <MetricCard
      :header="t('QUALITY_REVIEW.CHARTS.RATING_DISTRIBUTION')"
      :is-loading="isLoading"
    >
      <div v-if="ratingChartData" class="h-[300px]">
        <Bar :data="ratingChartData" :options="chartOptions" />
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[300px] text-n-slate-11"
      >
        {{ t('QUALITY_REVIEW.NO_DATA') }}
      </div>
    </MetricCard>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <span class="text-n-slate-11">{{ t('QUALITY_REVIEW.LOADING') }}</span>
    </div>

    <div
      v-if="!isLoading && tableRows.length > 0"
      class="overflow-x-auto rounded-lg border border-n-slate-6"
    >
      <table class="w-full text-left text-sm">
        <thead class="border-b border-n-slate-6 bg-n-solid-2">
          <tr>
            <th class="px-4 py-3 font-medium text-n-slate-11">
              {{ t('QUALITY_REVIEW.TABLE.CONVERSATION') }}
            </th>
            <th class="px-4 py-3 font-medium text-n-slate-11">
              {{ t('QUALITY_REVIEW.TABLE.AI_RATING') }}
            </th>
            <th class="px-4 py-3 font-medium text-n-slate-11">
              {{ t('QUALITY_REVIEW.TABLE.CSAT_RATING') }}
            </th>
            <th class="px-4 py-3 font-medium text-n-slate-11">
              {{ t('QUALITY_REVIEW.TABLE.DATE') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in tableRows"
            :key="row.id"
            class="border-b border-n-slate-6 hover:bg-n-solid-2"
          >
            <td class="px-4 py-3">
              <a
                :href="conversationLink(row.conversationId)"
                class="text-n-primary hover:underline"
              >
                {{ '#' + row.conversationId }}
              </a>
            </td>
            <td class="px-4 py-3">{{ row.aiRating }}</td>
            <td class="px-4 py-3">{{ row.csatRating }}</td>
            <td class="px-4 py-3 text-n-slate-11">
              {{ row.resolutionDate }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!isLoading && tableRows.length === 0 && aggregatedData"
      class="py-8 text-center text-n-slate-11"
    >
      {{ t('QUALITY_REVIEW.NO_DATA') }}
    </div>
  </div>
</template>

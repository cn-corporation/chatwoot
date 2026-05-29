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
import { Line } from 'vue-chartjs';
import { format, subDays } from 'date-fns';
import ReportHeader from '../settings/reports/components/ReportHeader.vue';
import MetricCard from '../settings/reports/components/overview/MetricCard.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import resolutionStatisticsAPI from 'dashboard/api/resolutionStatistics';
import { conversationUrl, frontendURL } from 'dashboard/helper/URLHelper';

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
const conversationId = ref('');
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

const resolutionTopicLabels = {
  deposits: () => t('CLOSE_TOPICS.TOPIC_DEPOSITS'),
  withdrawals: () => t('CLOSE_TOPICS.TOPIC_WITHDRAWALS'),
  deposits_withdrawals: () => t('CLOSE_TOPICS.TOPIC_DEPOSITS_WITHDRAWALS'),
  registration_login: () => t('CLOSE_TOPICS.TOPIC_REGISTRATION_LOGIN'),
  bonuses_rakeback: () => t('CLOSE_TOPICS.TOPIC_BONUSES_RAKEBACK'),
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

const overviewMetrics = computed(() => {
  if (!aggregatedData.value) return null;
  const { overview } = aggregatedData.value;
  return {
    totalResolutions: overview.totalResolutions,
    uniqueConversations: overview.uniqueConversations,
    uniqueOperators: 1,
    avgResolutionTimeMs: overview.avgResolutionTimeMs,
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
  if (!value) return t('RESOLUTION_STATISTICS.EMPTY_VALUE');
  return format(new Date(value), 'MMM dd, yyyy HH:mm');
};

const formatTime = ms => {
  if (!ms) return '--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const tableRows = computed(() => {
  if (!aggregatedData.value?.tableRows?.length) return [];

  return aggregatedData.value.tableRows.map(stat => ({
    id: stat.id,
    conversationId: stat.conversationId,
    topics: formatTopics(stat.topics),
    createdAt: formatDateTime(stat.createdAt),
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

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('MY_REPORTS.RESOLUTION_STATISTICS.HEADER')"
      :header-description="t('MY_REPORTS.RESOLUTION_STATISTICS.DESCRIPTION')"
    />

    <MetricCard
      :header="t('RESOLUTION_STATISTICS.FILTERS.HEADER')"
      :is-loading="false"
    >
      <div class="flex flex-wrap gap-4 items-end">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-n-slate-12">
            {{ t('RESOLUTION_STATISTICS.FILTERS.START_DATE') }}
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
            {{ t('RESOLUTION_STATISTICS.FILTERS.END_DATE') }}
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
            {{ t('RESOLUTION_STATISTICS.FILTERS.CONVERSATION') }}
          </label>
          <input
            v-model="conversationId"
            type="text"
            :placeholder="
              t('RESOLUTION_STATISTICS.FILTERS.CONVERSATION_PLACEHOLDER')
            "
            class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12 w-[160px]"
          />
        </div>

        <Button variant="primary" size="md" @click="fetchData">
          {{ t('RESOLUTION_STATISTICS.FILTERS.APPLY') }}
        </Button>
      </div>
    </MetricCard>

    <div
      v-if="!isLoading && overviewMetrics"
      class="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">
          {{ t('RESOLUTION_STATISTICS.METRICS.TOTAL') }}
        </div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.totalResolutions }}
        </div>
      </div>

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">
          {{ t('RESOLUTION_STATISTICS.METRICS.UNIQUE_CONVERSATIONS') }}
        </div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.uniqueConversations }}
        </div>
      </div>

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">
          Avg Resolution Time
        </div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ formatTime(overviewMetrics.avgResolutionTimeMs) }}
        </div>
      </div>
    </div>

    <MetricCard
      :header="t('RESOLUTION_STATISTICS.CHARTS.TREND')"
      :is-loading="isLoading"
    >
      <div v-if="trendChartData" class="h-[300px]">
        <Line :data="trendChartData" :options="chartOptions" />
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[300px] text-n-slate-11"
      >
        {{ t('RESOLUTION_STATISTICS.EMPTY_STATE') }}
      </div>
    </MetricCard>

    <MetricCard
      :header="t('RESOLUTION_STATISTICS.TABLE.HEADER')"
      :is-loading="isLoading"
    >
      <div v-if="tableRows.length > 0" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-n-slate-6">
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('RESOLUTION_STATISTICS.TABLE.COLUMNS.CONVERSATION') }}
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('RESOLUTION_STATISTICS.TABLE.COLUMNS.TOPICS') }}
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                {{ t('RESOLUTION_STATISTICS.TABLE.COLUMNS.DATE') }}
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
                <a
                  :href="conversationLink(row.conversationId)"
                  class="text-n-primary hover:underline"
                >
                  {{ '#' + row.conversationId }}
                </a>
              </td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ row.topics }}
              </td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ row.createdAt }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[200px] text-n-slate-11"
      >
        {{ t('RESOLUTION_STATISTICS.EMPTY_STATE') }}
      </div>
    </MetricCard>
  </div>
</template>

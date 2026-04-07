<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { Line, Bar } from 'vue-chartjs';
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
import ReportHeader from '../settings/reports/components/ReportHeader.vue';
import MetricCard from '../settings/reports/components/overview/MetricCard.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import responseStatisticsAPI from 'dashboard/api/responseStatistics';

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
const distributionData = ref([]);
const firstResponseDistributionData = ref([]);
const dateRangeStats = ref([]);
const dateRange = ref({
  start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});

const customBucketsInput = ref('');
const customBuckets = ref([2, 5, 15, 30, 60]);

const currentUserId = computed(() => {
  return String(store.getters.getCurrentUser.id);
});

const bucketsAsMs = computed(() => {
  return customBuckets.value.map(m => m * 60000).sort((a, b) => a - b);
});

const overviewMetrics = computed(() => {
  if (dateRangeStats.value.length === 0) return null;

  const totalResponses = dateRangeStats.value.reduce(
    (sum, stat) => sum + stat.totalResponses,
    0
  );
  const totalMs = dateRangeStats.value.reduce(
    (sum, stat) => sum + stat.averageResponseTimeMs * stat.totalResponses,
    0
  );
  const avgResponseTime =
    totalResponses > 0 ? Math.round(totalMs / totalResponses) : 0;

  return {
    totalResponses,
    avgResponseTime,
  };
});

const trendChartData = computed(() => {
  if (dateRangeStats.value.length === 0) return null;

  const sortedData = [...dateRangeStats.value].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return {
    labels: sortedData.map(stat => format(new Date(stat.date), 'MMM dd')),
    datasets: [
      {
        label: t('RESPONSE_STATISTICS.TREND_CHART'),
        data: sortedData.map(
          stat => Math.round((stat.averageResponseTimeMs / 60000) * 10) / 10
        ),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const distributionChartData = computed(() => {
  if (distributionData.value.length === 0) return null;

  return {
    labels: distributionData.value.map(b => b.label),
    datasets: [
      {
        label: t('RESPONSE_STATISTICS.DISTRIBUTION_CHART'),
        data: distributionData.value.map(b => b.count),
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  };
});

const firstResponseDistributionChartData = computed(() => {
  if (firstResponseDistributionData.value.length === 0) return null;

  return {
    labels: firstResponseDistributionData.value.map(b => b.label),
    datasets: [
      {
        label: t('RESPONSE_STATISTICS.FIRST_RESPONSE_DISTRIBUTION_CHART'),
        data: firstResponseDistributionData.value.map(b => b.count),
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
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

const formatTime = ms => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const addBucketValue = () => {
  const raw = customBucketsInput.value.trim();
  if (!raw) return;

  const values = raw
    .split(/[,\s]+/)
    .map(v => parseFloat(v.trim()))
    .filter(v => !isNaN(v) && v > 0);

  if (values.length === 0) return;

  const existing = new Set(customBuckets.value);
  values.forEach(v => existing.add(v));
  customBuckets.value = [...existing].sort((a, b) => a - b);
  customBucketsInput.value = '';
};

const removeBucket = index => {
  customBuckets.value.splice(index, 1);
};

const fetchData = async () => {
  isLoading.value = true;
  try {
    const params = {
      startDate: dateRange.value.start,
      endDate: dateRange.value.end,
      operatorIds: [currentUserId.value],
    };

    const distributionParams = {
      ...params,
      buckets: bucketsAsMs.value.map(String),
    };

    const [distributionRes, firstResponseRes, dateRangeRes] = await Promise.all(
      [
        responseStatisticsAPI.getDistribution(distributionParams),
        responseStatisticsAPI.getFirstResponseDistribution(distributionParams),
        responseStatisticsAPI.getDateRangeStatistics(params),
      ]
    );

    distributionData.value = distributionRes?.data || [];
    firstResponseDistributionData.value = firstResponseRes?.data || [];
    dateRangeStats.value = dateRangeRes?.data || [];
  } catch (error) {
    distributionData.value = [];
    firstResponseDistributionData.value = [];
    dateRangeStats.value = [];
  } finally {
    isLoading.value = false;
  }
};

const handleDateRangeChange = (field, value) => {
  dateRange.value[field] = value;
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('MY_REPORTS.RESPONSE_STATISTICS.HEADER')"
      :header-description="t('MY_REPORTS.RESPONSE_STATISTICS.DESCRIPTION')"
    />

    <MetricCard :header="t('RESPONSE_STATISTICS.FILTERS')" :is-loading="false">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-n-slate-12">
              Start Date
            </label>
            <input
              type="date"
              :value="dateRange.start"
              class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12"
              @input="e => handleDateRangeChange('start', e.target.value)"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-n-slate-12">
              End Date
            </label>
            <input
              type="date"
              :value="dateRange.end"
              class="px-3 py-2 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12"
              @input="e => handleDateRangeChange('end', e.target.value)"
            />
          </div>

          <Button variant="primary" size="md" @click="fetchData">
            Apply Filters
          </Button>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-n-slate-12">
            {{ t('RESPONSE_STATISTICS.CUSTOM_BUCKETS') }}
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-for="(bucket, index) in customBuckets"
              :key="index"
              class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-n-alpha-2 text-sm text-n-slate-12 border border-n-slate-6"
            >
              {{ bucket }} min
              <button
                class="ml-1 text-n-slate-10 hover:text-n-slate-12"
                @click="removeBucket(index)"
              >
                &times;
              </button>
            </span>
            <div class="flex items-center gap-2">
              <input
                v-model="customBucketsInput"
                type="text"
                :placeholder="
                  t('RESPONSE_STATISTICS.CUSTOM_BUCKETS_PLACEHOLDER')
                "
                class="px-3 py-1.5 border border-n-slate-7 rounded-lg bg-n-background text-n-slate-12 text-sm w-[180px]"
                @keyup.enter="addBucketValue"
              />
              <Button variant="faded" size="sm" @click="addBucketValue">
                {{ t('RESPONSE_STATISTICS.ADD_RANGE') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MetricCard>

    <div
      v-if="!isLoading && overviewMetrics"
      class="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">Total Responses</div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.totalResponses }}
        </div>
      </div>

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">Average Response Time</div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ formatTime(overviewMetrics.avgResponseTime) }}
        </div>
      </div>
    </div>

    <MetricCard
      :header="t('RESPONSE_STATISTICS.TREND_CHART')"
      :is-loading="isLoading"
    >
      <div v-if="trendChartData" class="h-[300px]">
        <Line :data="trendChartData" :options="chartOptions" />
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[300px] text-n-slate-11"
      >
        No data available
      </div>
    </MetricCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MetricCard
        :header="t('RESPONSE_STATISTICS.DISTRIBUTION_CHART')"
        :is-loading="isLoading"
      >
        <div v-if="distributionChartData" class="h-[300px]">
          <Bar :data="distributionChartData" :options="chartOptions" />
        </div>
        <div
          v-else
          class="flex items-center justify-center h-[300px] text-n-slate-11"
        >
          No data available
        </div>
      </MetricCard>

      <MetricCard
        :header="t('RESPONSE_STATISTICS.FIRST_RESPONSE_DISTRIBUTION_CHART')"
        :is-loading="isLoading"
      >
        <div v-if="firstResponseDistributionChartData" class="h-[300px]">
          <Bar
            :data="firstResponseDistributionChartData"
            :options="chartOptions"
          />
        </div>
        <div
          v-else
          class="flex items-center justify-center h-[300px] text-n-slate-11"
        >
          No data available
        </div>
      </MetricCard>
    </div>

    <MetricCard
      :header="t('RESPONSE_STATISTICS.DAILY_TABLE')"
      :is-loading="isLoading"
    >
      <div v-if="dateRangeStats.length > 0" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-n-slate-6">
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                Date
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                Total Responses
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                Avg Response Time
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-n-slate-11"
              >
                Conversations
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="stat in dateRangeStats"
              :key="stat.date"
              class="border-b border-n-slate-6 hover:bg-n-solid-2"
            >
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ format(new Date(stat.date), 'MMM dd, yyyy') }}
              </td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ stat.totalResponses }}
              </td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ formatTime(stat.averageResponseTimeMs) }}
              </td>
              <td class="py-3 px-4 text-sm text-n-slate-12">
                {{ stat.uniqueConversations }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[200px] text-n-slate-11"
      >
        No data available
      </div>
    </MetricCard>
  </div>
</template>

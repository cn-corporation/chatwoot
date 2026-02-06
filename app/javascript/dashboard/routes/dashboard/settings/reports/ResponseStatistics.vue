<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore, useMapGetter } from 'dashboard/composables/store';
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
import Multiselect from 'vue-multiselect';
import ReportHeader from './components/ReportHeader.vue';
import MetricCard from './components/overview/MetricCard.vue';
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
const operatorStats = ref([]);
const dateRangeStats = ref([]);
const selectedOperators = ref([]);
const dateRange = ref({
  start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  end: format(new Date(), 'yyyy-MM-dd'),
});

const customBucketsInput = ref('');
const customBuckets = ref([2, 5, 15, 30, 60]);

const agents = useMapGetter('agents/getAgents');

const agentsMap = computed(() => {
  const map = new Map();
  agents.value.forEach(agent => {
    map.set(String(agent.id), agent);
  });
  return map;
});

const getAgentName = operatorId => {
  const agent = agentsMap.value.get(String(operatorId));
  if (agent) {
    return agent.name || agent.email || `Agent ${operatorId}`;
  }
  return `Operator ${operatorId}`;
};

const operatorOptions = computed(() => {
  return agents.value.map(agent => ({
    value: agent.id,
    label: agent.name || agent.email || `Agent ${agent.id}`,
  }));
});

const bucketsAsMs = computed(() => {
  return customBuckets.value.map(m => m * 60000).sort((a, b) => a - b);
});

const overviewMetrics = computed(() => {
  if (operatorStats.value.length === 0) return null;

  const totalResponses = operatorStats.value.reduce(
    (sum, op) => sum + op.totalResponses,
    0
  );
  const avgResponseTime =
    operatorStats.value.reduce((sum, op) => sum + op.averageResponseTimeMs, 0) /
    operatorStats.value.length;
  const activeOperators = operatorStats.value.length;
  const fastestResponse = Math.min(
    ...operatorStats.value.map(op => op.minResponseTimeMs)
  );

  return {
    totalResponses,
    avgResponseTime: Math.round(avgResponseTime),
    activeOperators,
    fastestResponse,
  };
});

const operatorChartData = computed(() => {
  if (operatorStats.value.length === 0) return null;

  const sortedOperators = [...operatorStats.value]
    .sort((a, b) => a.averageResponseTimeMs - b.averageResponseTimeMs)
    .slice(0, 10);

  return {
    labels: sortedOperators.map(op => getAgentName(op.operatorId)),
    datasets: [
      {
        label: 'Average Response Time (minutes)',
        data: sortedOperators.map(
          op => Math.round((op.averageResponseTimeMs / 60000) * 10) / 10
        ),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
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
        label: 'Average Response Time (minutes)',
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
        label: 'Number of Responses',
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
        label: 'Number of First Responses',
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

const formatTime = ms => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
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
    };

    if (selectedOperators.value.length > 0) {
      params.operatorIds = selectedOperators.value.map(option =>
        String(option.value || option)
      );
    }

    const distributionParams = {
      ...params,
      buckets: bucketsAsMs.value.map(String),
    };

    const [distributionRes, firstResponseRes, operatorRes, dateRangeRes] =
      await Promise.all([
        responseStatisticsAPI.getDistribution(distributionParams),
        responseStatisticsAPI.getFirstResponseDistribution(distributionParams),
        responseStatisticsAPI.getOperatorStatistics(params),
        responseStatisticsAPI.getDateRangeStatistics(params),
      ]);

    distributionData.value = distributionRes?.data || [];
    firstResponseDistributionData.value = firstResponseRes?.data || [];
    operatorStats.value = operatorRes?.data || [];
    dateRangeStats.value = dateRangeRes?.data || [];
  } catch (error) {
    console.error('Failed to fetch response statistics:', error);
    distributionData.value = [];
    firstResponseDistributionData.value = [];
    operatorStats.value = [];
    dateRangeStats.value = [];
  } finally {
    isLoading.value = false;
  }
};

const handleDateRangeChange = (field, value) => {
  dateRange.value[field] = value;
};

const applyFilters = () => {
  fetchData();
};

onMounted(() => {
  store.dispatch('agents/get');
  fetchData();
});
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('RESPONSE_STATISTICS.HEADER')"
      :header-description="t('RESPONSE_STATISTICS.DESCRIPTION')"
    />

    <!-- Filters -->
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

          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-n-slate-12">
              Operators (optional)
            </label>
            <div class="min-w-[250px]">
              <Multiselect
                v-model="selectedOperators"
                :options="operatorOptions"
                :multiple="true"
                :close-on-select="false"
                :clear-on-select="false"
                :preserve-search="true"
                placeholder="Select operators..."
                label="label"
                track-by="value"
                :preselect-first="false"
              >
                <template #selection="{ values, isOpen }">
                  <span
                    v-if="values.length && !isOpen"
                    class="multiselect__single"
                  >
                    {{ values.length }} operator(s) selected
                  </span>
                </template>
              </Multiselect>
            </div>
          </div>

          <Button variant="primary" size="md" @click="applyFilters">
            Apply Filters
          </Button>
        </div>

        <!-- Custom Time Ranges -->
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

    <!-- Overview Metrics -->
    <div
      v-if="!isLoading && overviewMetrics"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
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

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">Active Operators</div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ overviewMetrics.activeOperators }}
        </div>
      </div>

      <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
        <div class="text-sm text-n-slate-11 mb-1">Fastest Response</div>
        <div class="text-3xl font-bold text-n-slate-12">
          {{ formatTime(overviewMetrics.fastestResponse) }}
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Response Time Trend -->
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

      <!-- Operator Performance -->
      <MetricCard
        :header="t('RESPONSE_STATISTICS.OPERATOR_CHART')"
        :is-loading="isLoading"
      >
        <div v-if="operatorChartData" class="h-[300px]">
          <Bar :data="operatorChartData" :options="chartOptions" />
        </div>
        <div
          v-else
          class="flex items-center justify-center h-[300px] text-n-slate-11"
        >
          No data available
        </div>
      </MetricCard>
    </div>

    <!-- Distribution Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Response Time Distribution -->
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

      <!-- First Response Time Distribution -->
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

    <!-- Daily Statistics Table -->
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
                Unique Operators
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
                {{ stat.uniqueOperators }}
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

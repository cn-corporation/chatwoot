<script setup>
import { Line, Bar } from 'vue-chartjs';
import MetricCard from './overview/MetricCard.vue';

defineProps({
  ratingChartData: {
    type: Object,
    default: null,
  },
  trendChartData: {
    type: Object,
    default: null,
  },
  operatorChartData: {
    type: Object,
    default: null,
  },
  chartOptions: {
    type: Object,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  t: {
    type: Function,
    required: true,
  },
});
</script>

<template>
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
    :header="t('CSAT_STATISTICS.CHARTS.OPERATORS')"
    :is-loading="isLoading"
  >
    <div v-if="operatorChartData" class="h-[300px]">
      <Bar :data="operatorChartData" :options="chartOptions" />
    </div>
    <div
      v-else
      class="flex items-center justify-center h-[300px] text-n-slate-11"
    >
      {{ t('CSAT_STATISTICS.EMPTY_STATE') }}
    </div>
  </MetricCard>
</template>

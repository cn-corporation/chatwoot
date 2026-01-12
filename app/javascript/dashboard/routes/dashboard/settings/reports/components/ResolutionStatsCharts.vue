<script setup>
import { Line, Bar } from 'vue-chartjs';
import MetricCard from './overview/MetricCard.vue';

defineProps({
  reasonChartData: {
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
      :header="t('RESOLUTION_STATISTICS.CHARTS.REASONS')"
      :is-loading="isLoading"
    >
      <div v-if="reasonChartData" class="h-[300px]">
        <Bar :data="reasonChartData" :options="chartOptions" />
      </div>
      <div
        v-else
        class="flex items-center justify-center h-[300px] text-n-slate-11"
      >
        {{ t('RESOLUTION_STATISTICS.EMPTY_STATE') }}
      </div>
    </MetricCard>

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
  </div>

  <MetricCard
    :header="t('RESOLUTION_STATISTICS.CHARTS.OPERATORS')"
    :is-loading="isLoading"
  >
    <div v-if="operatorChartData" class="h-[300px]">
      <Bar :data="operatorChartData" :options="chartOptions" />
    </div>
    <div
      v-else
      class="flex items-center justify-center h-[300px] text-n-slate-11"
    >
      {{ t('RESOLUTION_STATISTICS.EMPTY_STATE') }}
    </div>
  </MetricCard>
</template>

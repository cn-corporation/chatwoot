<script setup>
defineProps({
  metrics: {
    type: Object,
    default: null,
  },
  t: {
    type: Function,
    required: true,
  },
});

const formatTime = ms => {
  if (!ms) return '--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};
</script>

<template>
  <div
    v-if="metrics"
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  >
    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('RESOLUTION_STATISTICS.METRICS.TOTAL') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.totalResolutions.toLocaleString() }}
      </div>
    </div>

    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('RESOLUTION_STATISTICS.METRICS.UNIQUE_CONVERSATIONS') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.uniqueConversations.toLocaleString() }}
      </div>
    </div>

    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('RESOLUTION_STATISTICS.METRICS.UNIQUE_OPERATORS') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.uniqueOperators.toLocaleString() }}
      </div>
    </div>

    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        Avg Resolution Time
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ formatTime(metrics.avgResolutionTimeMs) }}
      </div>
    </div>
  </div>
</template>

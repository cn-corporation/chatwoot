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
</script>

<template>
  <div
    v-if="metrics"
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  >
    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('CSAT_STATISTICS.METRICS.TOTAL_RESPONSES') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.totalResponses.toLocaleString() }}
      </div>
    </div>

    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('CSAT_STATISTICS.METRICS.SATISFACTION_SCORE') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.satisfactionScore }}
      </div>
    </div>

    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('CSAT_STATISTICS.METRICS.UNIQUE_CONVERSATIONS') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.uniqueConversations.toLocaleString() }}
      </div>
    </div>

    <div class="px-6 py-5 rounded-xl bg-n-solid-2 border border-n-slate-6">
      <div class="text-sm text-n-slate-11 mb-1">
        {{ t('CSAT_STATISTICS.METRICS.UNIQUE_OPERATORS') }}
      </div>
      <div class="text-2xl font-bold text-n-slate-12">
        {{ metrics.uniqueOperators.toLocaleString() }}
      </div>
    </div>
  </div>
</template>

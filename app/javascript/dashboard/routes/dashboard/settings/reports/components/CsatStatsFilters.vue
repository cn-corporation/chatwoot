<script setup>
import Multiselect from 'vue-multiselect';
import MetricCard from './overview/MetricCard.vue';
import Button from 'dashboard/components-next/button/Button.vue';

defineProps({
  dateRange: {
    type: Object,
    required: true,
  },
  operatorOptions: {
    type: Array,
    default: () => [],
  },
  selectedOperators: {
    type: Array,
    default: () => [],
  },
  ratingOptions: {
    type: Array,
    default: () => [],
  },
  selectedRating: {
    type: Object,
    default: null,
  },
  t: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  'updateDateRange',
  'updateSelectedOperators',
  'updateSelectedRating',
  'apply',
]);

const handleDateRangeChange = (field, value) => {
  emit('updateDateRange', { field, value });
};
</script>

<template>
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
          @input="e => handleDateRangeChange('start', e.target.value)"
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
          @input="e => handleDateRangeChange('end', e.target.value)"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ t('CSAT_STATISTICS.FILTERS.OPERATORS') }}
        </label>
        <div class="min-w-[250px]">
          <Multiselect
            :model-value="selectedOperators"
            :options="operatorOptions"
            :multiple="true"
            :close-on-select="false"
            :clear-on-select="false"
            :preserve-search="true"
            :placeholder="t('CSAT_STATISTICS.FILTERS.OPERATORS_PLACEHOLDER')"
            label="label"
            track-by="value"
            :preselect-first="false"
            @update:model-value="
              value => emit('updateSelectedOperators', value)
            "
          >
            <template #selection="{ values, isOpen }">
              <span
                v-if="values.length && !isOpen"
                class="multiselect__single"
              >
                {{
                  t('CSAT_STATISTICS.FILTERS.OPERATORS_SELECTED', {
                    count: values.length,
                  })
                }}
              </span>
            </template>
          </Multiselect>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-n-slate-12">
          {{ t('CSAT_STATISTICS.FILTERS.RATING') }}
        </label>
        <div class="min-w-[200px]">
          <Multiselect
            :model-value="selectedRating"
            :options="ratingOptions"
            :multiple="false"
            :allow-empty="true"
            :close-on-select="true"
            :clear-on-select="true"
            :preserve-search="true"
            :placeholder="t('CSAT_STATISTICS.FILTERS.RATING_PLACEHOLDER')"
            label="label"
            track-by="value"
            :preselect-first="false"
            @update:model-value="value => emit('updateSelectedRating', value)"
          />
        </div>
      </div>

      <Button variant="primary" size="md" @click="emit('apply')">
        {{ t('CSAT_STATISTICS.FILTERS.APPLY') }}
      </Button>
    </div>
  </MetricCard>
</template>

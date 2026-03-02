<script setup>
import { useMapGetter } from 'dashboard/composables/store';
import { conversationUrl, frontendURL } from 'dashboard/helper/URLHelper';
import MetricCard from './overview/MetricCard.vue';

defineProps({
  rows: {
    type: Array,
    default: () => [],
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

const accountId = useMapGetter('getCurrentAccountId');

const conversationLink = id => {
  if (!accountId.value) return '#';
  return frontendURL(conversationUrl({ accountId: accountId.value, id }));
};
</script>

<template>
  <MetricCard
    :header="t('CSAT_STATISTICS.TABLE.HEADER')"
    :is-loading="isLoading"
  >
    <div v-if="rows.length" class="overflow-x-auto w-full">
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
              {{ t('CSAT_STATISTICS.TABLE.COLUMNS.OPERATOR') }}
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
            v-for="row in rows"
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
              {{ row.operator }}
            </td>
            <td class="py-3 px-4 text-sm text-n-slate-12">
              {{ row.rating }}
            </td>
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
</template>

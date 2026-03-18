<script setup>
import { ref, onMounted } from 'vue';
import chatwootExtraAPI from '../../../../../api/chatwootExtra';

const overview = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await chatwootExtraAPI.getRagOverview();
    overview.value = response.data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-if="loading" class="flex justify-center py-8">
    <span class="i-lucide-loader-2 animate-spin h-6 w-6 text-slate-400" />
  </div>
  <div
    v-else-if="overview"
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
  >
    <div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">Total Sources</p>
      <p class="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
        {{ overview.totalSources }}
      </p>
    </div>
    <div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">Total Chunks</p>
      <p class="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
        {{ overview.totalChunks }}
      </p>
    </div>
    <div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">Total Tags</p>
      <p class="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
        {{ overview.totalTags }}
      </p>
    </div>
    <div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">Last Indexed</p>
      <p class="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
        {{
          overview.lastIndexedAt
            ? new Date(overview.lastIndexedAt).toLocaleString()
            : 'Never'
        }}
      </p>
    </div>
  </div>
</template>

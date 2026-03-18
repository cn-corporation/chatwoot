<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import chatwootExtraAPI from '../../../../../api/chatwootExtra';
import Button from 'dashboard/components-next/button/Button.vue';
import SourceRow from './SourceRow.vue';

const sources = ref([]);
const tags = ref([]);
const loading = ref(true);
const uploading = ref(false);
const fileInputRef = ref(null);
let pollInterval = null;

const hasProcessing = computed(() =>
  sources.value.some(s => s.status === 'processing')
);

const sortSources = (data) =>
  data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const fetchData = async () => {
  try {
    const [sourcesData, tagsData] = await Promise.all([
      chatwootExtraAPI.getRagSources(),
      chatwootExtraAPI.getRagTags(),
    ]);
    sources.value = sortSources(sourcesData);
    tags.value = tagsData;
  } finally {
    loading.value = false;
  }
};

const startPolling = () => {
  stopPolling();
  pollInterval = setInterval(async () => {
    if (hasProcessing.value) {
      const sourcesData = await chatwootExtraAPI.getRagSources();
      sources.value = sortSources(sourcesData);
    } else {
      stopPolling();
    }
  }, 5000);
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

const triggerUpload = () => fileInputRef.value?.click();

const handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  uploading.value = true;
  try {
    await chatwootExtraAPI.uploadRagSource(file);
    await fetchData();
  } finally {
    uploading.value = false;
    event.target.value = '';
  }
};

const handleRefresh = async () => {
  await fetchData();
  if (hasProcessing.value) startPolling();
};

onMounted(async () => {
  await fetchData();
  if (hasProcessing.value) startPolling();
});

onUnmounted(() => stopPolling());
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-medium text-n-slate-12">Sources</h2>
      <div>
        <Button
          icon="i-lucide-upload"
          label="Upload Source"
          :is-loading="uploading"
          @click="triggerUpload"
        />
        <input
          ref="fileInputRef"
          type="file"
          accept=".txt"
          class="hidden"
          @change="handleFileSelect"
        />
      </div>
    </div>
    <div v-if="loading" class="flex justify-center py-8">
      <span class="i-lucide-loader-2 animate-spin h-6 w-6 text-slate-400" />
    </div>
    <p
      v-else-if="!sources.length"
      class="flex flex-col items-center justify-center text-base text-n-slate-11 py-8"
    >
      No sources uploaded yet.
    </p>
    <div v-else>
      <SourceRow
        v-for="source in sources"
        :key="source.id"
        :source="source"
        :all-tags="tags"
        :on-refresh="handleRefresh"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import chatwootExtraAPI from '../../../../../api/chatwootExtra';
import Button from 'dashboard/components-next/button/Button.vue';
import SourceRow from './SourceRow.vue';
import SettingsLayout from '../../SettingsLayout.vue';

const sources = ref([]);
const tags = ref([]);
const loading = ref(true);
const uploading = ref(false);
const fileInputRef = ref(null);
let pollInterval = null;

const hasProcessing = computed(() =>
  sources.value.some(s => s.status === 'processing')
);

const sortSources = data =>
  [...data].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

const refreshSources = async () => {
  const data = await chatwootExtraAPI.getRagSources();
  sources.value = sortSources(data);
};

const startPolling = () => {
  stopPolling();
  pollInterval = setInterval(async () => {
    if (hasProcessing.value) {
      await refreshSources();
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

const handleFileSelect = async event => {
  const file = event.target.files[0];
  if (!file) return;
  uploading.value = true;
  try {
    const result = await chatwootExtraAPI.uploadRagSource(file);
    sources.value = sortSources([...sources.value, result.data]);
    if (result.data?.status === 'processing') startPolling();
  } finally {
    uploading.value = false;
    event.target.value = '';
  }
};

const handleSourceUpdate = updatedSource => {
  const idx = sources.value.findIndex(s => s.id === updatedSource.id);
  if (idx !== -1) sources.value[idx] = updatedSource;
  if (updatedSource.status === 'processing') startPolling();
};

const handleSourceDelete = sourceId => {
  sources.value = sources.value.filter(s => s.id !== sourceId);
};

const handleStatusRefresh = async () => {
  await refreshSources();
  if (hasProcessing.value) startPolling();
};

onMounted(async () => {
  try {
    const [sourcesData, tagsData] = await Promise.all([
      chatwootExtraAPI.getRagSources(),
      chatwootExtraAPI.getRagTags(),
    ]);
    sources.value = sortSources(sourcesData);
    tags.value = tagsData;
    if (hasProcessing.value) startPolling();
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => stopPolling());
</script>

<template>
  <SettingsLayout
    :is-loading="loading"
    loading-message="Loading sources..."
    :no-records-found="!loading && !sources.length"
    no-records-message="No sources uploaded yet."
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-base font-medium text-n-slate-12">Sources</h2>
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
    </template>
    <template #body>
      <SourceRow
        v-for="source in sources"
        :key="source.id"
        :source="source"
        :all-tags="tags"
        :on-update="handleSourceUpdate"
        :on-delete="handleSourceDelete"
        :on-status-refresh="handleStatusRefresh"
      />
    </template>
  </SettingsLayout>
</template>

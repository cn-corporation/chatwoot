<script setup>
import { useAlert } from 'dashboard/composables';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import KBFileRow from './components/KBFileRow.vue';
import KBFileContentModal from './components/KBFileContentModal.vue';
import { computed, onMounted, ref, defineOptions } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import Button from 'dashboard/components-next/button/Button.vue';

defineOptions({
  name: 'KnowledgeBaseSettings',
});

const store = useStore();
const { t } = useI18n();

const searchQuery = ref('');
const deletingFileId = ref(null);
const showContentModal = ref(false);
const fileInputRef = ref(null);

const records = computed(() => store.getters['knowledgeBase/getFiles']);
const fileContent = computed(() => store.getters['knowledgeBase/getFileContent']);
const uiFlags = computed(() => store.getters['knowledgeBase/getUIFlags']);

const filteredRecords = computed(() => {
  if (!searchQuery.value) return records.value;
  const q = searchQuery.value.toLowerCase();
  return records.value.filter(f => f.name.toLowerCase().includes(q));
});

onMounted(() => {
  store.dispatch('knowledgeBase/get');
});

const triggerUpload = () => {
  fileInputRef.value?.click();
};

const handleFileSelect = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await store.dispatch('knowledgeBase/upload', file);
    useAlert(t('KNOWLEDGE_BASE.UPLOAD.SUCCESS'));
  } catch (error) {
    useAlert(t('KNOWLEDGE_BASE.UPLOAD.ERROR'));
  }
  event.target.value = '';
};

const viewFile = async file => {
  showContentModal.value = true;
  try {
    await store.dispatch('knowledgeBase/getContent', file.id);
  } catch (error) {
    useAlert(t('KNOWLEDGE_BASE.CONTENT_MODAL.ERROR'));
  }
};

const closeContentModal = () => {
  showContentModal.value = false;
};

const deleteFile = async file => {
  const confirmed = window.confirm(
    t('KNOWLEDGE_BASE.DELETE.CONFIRM', { name: file.name })
  );
  if (!confirmed) return;

  deletingFileId.value = file.id;
  try {
    await store.dispatch('knowledgeBase/delete', file.id);
    useAlert(t('KNOWLEDGE_BASE.DELETE.SUCCESS'));
  } catch (error) {
    useAlert(t('KNOWLEDGE_BASE.DELETE.ERROR'));
  }
  deletingFileId.value = null;
};
</script>

<template>
  <div class="flex-1 overflow-auto">
    <BaseSettingsHeader
      :title="$t('KNOWLEDGE_BASE.HEADER')"
      :description="$t('KNOWLEDGE_BASE.DESCRIPTION')"
    >
      <template #actions>
        <Button
          icon="i-lucide-upload"
          :label="$t('KNOWLEDGE_BASE.UPLOAD.BUTTON')"
          :is-loading="uiFlags.isUploading"
          @click="triggerUpload"
        />
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          @change="handleFileSelect"
        />
      </template>
    </BaseSettingsHeader>

    <div class="mt-4 mb-4">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="$t('KNOWLEDGE_BASE.SEARCH_PLACEHOLDER')"
        class="w-full max-w-xs px-3 py-2 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 placeholder:text-n-slate-9 focus:outline-none focus:ring-1 focus:ring-n-brand"
      />
    </div>

    <div class="flex-1">
      <woot-loading-state
        v-if="uiFlags.isFetching"
        :message="$t('KNOWLEDGE_BASE.LOADING')"
      />
      <p
        v-else-if="!filteredRecords.length"
        class="flex flex-col items-center justify-center h-full text-base text-n-slate-11 py-8"
      >
        {{ $t('KNOWLEDGE_BASE.EMPTY') }}
      </p>
      <table
        v-else
        class="min-w-full overflow-x-auto divide-y divide-n-weak"
      >
        <thead>
          <th
            v-for="header in [
              $t('KNOWLEDGE_BASE.TABLE.NAME'),
              $t('KNOWLEDGE_BASE.TABLE.SIZE'),
              $t('KNOWLEDGE_BASE.TABLE.TYPE'),
              $t('KNOWLEDGE_BASE.TABLE.STATUS'),
              $t('KNOWLEDGE_BASE.TABLE.ACTIONS'),
            ]"
            :key="header"
            class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11 last:text-right"
          >
            {{ header }}
          </th>
        </thead>
        <tbody class="divide-y divide-n-weak text-n-slate-11">
          <KBFileRow
            v-for="file in filteredRecords"
            :key="file.id"
            :file="file"
            :is-deleting="deletingFileId === file.id"
            @view="viewFile"
            @delete="deleteFile"
          />
        </tbody>
      </table>
    </div>

    <KBFileContentModal
      :show="showContentModal"
      :file-content="fileContent"
      :is-loading="uiFlags.isFetchingContent"
      @close="closeContentModal"
    />
  </div>
</template>

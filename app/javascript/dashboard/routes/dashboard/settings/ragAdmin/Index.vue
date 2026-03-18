<script setup>
import { ref } from 'vue';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SourcesTab from './components/SourcesTab.vue';
import TagsTab from './components/TagsTab.vue';
import OverviewTab from './components/OverviewTab.vue';

const activeTab = ref('sources');
const tabs = [
  { key: 'sources', label: 'Sources' },
  { key: 'tags', label: 'Tags' },
  { key: 'overview', label: 'Overview' },
];
</script>

<template>
  <div class="flex-1 overflow-auto p-6">
    <BaseSettingsHeader
      title="RAG Admin"
      description="Manage knowledge base sources, tags, and indexing for the RAG pipeline."
    />
    <div class="mt-6 border-b border-slate-100 dark:border-slate-700">
      <nav class="flex gap-4">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-woot-500 text-woot-500'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>
    <div class="mt-6">
      <SourcesTab v-if="activeTab === 'sources'" />
      <TagsTab v-else-if="activeTab === 'tags'" />
      <OverviewTab v-else-if="activeTab === 'overview'" />
    </div>
  </div>
</template>

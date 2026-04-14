<script setup>
import { ref } from 'vue';
import ReportHeader from './components/ReportHeader.vue';
import OperatorStatusOnline from './components/OperatorStatusOnline.vue';
import OperatorStatusSessions from './components/OperatorStatusSessions.vue';

const activeTab = ref('online');
const sessionsKey = ref(0);

const tabs = [
  { key: 'online', label: 'Online Now' },
  { key: 'sessions', label: 'Work Sessions' },
];
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      header-title="Operator Status"
      header-description="Track operator online status and work session history."
    />

    <div class="flex gap-1 border-b border-n-slate-3">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
        :class="
          activeTab === tab.key
            ? 'border-woot-500 text-woot-500'
            : 'border-transparent text-n-slate-11 hover:text-n-slate-12'
        "
        @click="() => { activeTab = tab.key; if (tab.key === 'sessions') sessionsKey++; }"
      >
        {{ tab.label }}
      </button>
    </div>

    <OperatorStatusOnline v-if="activeTab === 'online'" />
    <OperatorStatusSessions v-if="activeTab === 'sessions'" :key="sessionsKey" />
  </div>
</template>

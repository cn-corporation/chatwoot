<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ReportHeader from './components/ReportHeader.vue';
import OperatorBreaksLive from './components/OperatorBreaksLive.vue';
import OperatorBreaksReport from './components/OperatorBreaksReport.vue';

const { t } = useI18n();
const activeTab = ref('live');
const reportKey = ref(0);

const tabs = computed(() => [
  { key: 'live', label: t('BREAKS.REPORT.TAB_LIVE') },
  { key: 'history', label: t('BREAKS.REPORT.TAB_HISTORY') },
]);
</script>

<template>
  <div class="flex flex-col gap-6 pb-6">
    <ReportHeader
      :header-title="t('BREAKS.REPORT.HEADER')"
      :header-description="t('BREAKS.REPORT.DESCRIPTION')"
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
        @click="
          () => {
            activeTab = tab.key;
            if (tab.key === 'history') reportKey++;
          }
        "
      >
        {{ tab.label }}
      </button>
    </div>

    <OperatorBreaksLive v-if="activeTab === 'live'" />
    <OperatorBreaksReport v-if="activeTab === 'history'" :key="reportKey" />
  </div>
</template>

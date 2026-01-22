<script setup>
import { ref } from 'vue';
import ReportHeader from './components/ReportHeader.vue';
import AgentOverviewReport from './components/AgentOverviewReport.vue';
import V4Button from 'dashboard/components-next/button/Button.vue';

const agentOverviewRef = ref(null);

const onDownloadClick = () => {
  agentOverviewRef.value.downloadReports();
};
</script>

<template>
  <ReportHeader
    :header-title="$t('AGENT_REPORTS.HEADER')"
    :header-description="$t('AGENT_REPORTS.DESCRIPTION')"
  >
    <V4Button
      :label="$t('AGENT_REPORTS.DOWNLOAD_AGENT_REPORTS')"
      icon="i-ph-download-simple"
      size="sm"
      @click="onDownloadClick"
    />
  </ReportHeader>

  <AgentOverviewReport ref="agentOverviewRef" />
</template>

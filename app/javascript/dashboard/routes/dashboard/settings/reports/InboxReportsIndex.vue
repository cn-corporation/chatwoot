<script setup>
import { ref } from 'vue';
import ReportHeader from './components/ReportHeader.vue';
import InboxOverviewReport from './components/InboxOverviewReport.vue';
import V4Button from 'dashboard/components-next/button/Button.vue';

const inboxOverviewRef = ref(null);

const onDownloadClick = () => {
  inboxOverviewRef.value.downloadReports();
};
</script>

<template>
  <ReportHeader
    :header-title="$t('INBOX_REPORTS.HEADER')"
    :header-description="$t('INBOX_REPORTS.DESCRIPTION')"
  >
    <V4Button
      :label="$t('INBOX_REPORTS.DOWNLOAD_INBOX_REPORTS')"
      icon="i-ph-download-simple"
      size="sm"
      @click="onDownloadClick"
    />
  </ReportHeader>

  <InboxOverviewReport ref="inboxOverviewRef" />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="w-full h-full overflow-hidden">
    <iframe
      :title="t('SIDEBAR.CLICKUP_FORM')"
      src="https://forms.clickup.com/43322895/f/19a3gf-70672/AV5KBTNJEFO6F4BS08"
      class="w-full h-full border-0"
    />
  </div>
</template>

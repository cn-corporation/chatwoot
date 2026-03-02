<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccount } from 'dashboard/composables/useAccount';
import { useAlert } from 'dashboard/composables';
import SectionLayout from './SectionLayout.vue';
import Switch from 'next/switch/Switch.vue';

const { t } = useI18n();
const isEnabled = ref(false);

const { currentAccount, updateAccount } = useAccount();

watch(
  currentAccount,
  () => {
    const { dialogue_segregation_enabled } =
      currentAccount.value?.settings || {};
    isEnabled.value = !!dialogue_segregation_enabled;
  },
  { deep: true, immediate: true }
);

const toggle = async () => {
  try {
    await updateAccount({
      dialogue_segregation_enabled: isEnabled.value,
    });
    useAlert(t('GENERAL_SETTINGS.FORM.DIALOGUE_SEGREGATION.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.DIALOGUE_SEGREGATION.API.ERROR'));
  }
};
</script>

<template>
  <SectionLayout
    :title="t('GENERAL_SETTINGS.FORM.DIALOGUE_SEGREGATION.TITLE')"
    :description="t('GENERAL_SETTINGS.FORM.DIALOGUE_SEGREGATION.NOTE')"
    with-border
  >
    <template #headerActions>
      <div class="flex justify-end">
        <Switch v-model="isEnabled" @change="toggle" />
      </div>
    </template>
  </SectionLayout>
</template>

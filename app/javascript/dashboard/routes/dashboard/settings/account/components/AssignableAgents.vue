<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { useAccount } from 'dashboard/composables/useAccount';
import { useAlert } from 'dashboard/composables';
import { useMapGetter } from 'dashboard/composables/store';
import SectionLayout from './SectionLayout.vue';
import Multiselect from 'vue-multiselect';

const { t } = useI18n();
const store = useStore();
const { currentAccount, updateAccount } = useAccount();

onMounted(() => {
  store.dispatch('agents/get');
});
const verifiedAgents = useMapGetter('agents/getVerifiedAgents');

const selectedAgents = ref([]);

const agentOptions = computed(() => verifiedAgents.value || []);

watch(
  [currentAccount, agentOptions],
  () => {
    const ids = currentAccount.value?.settings?.assignable_agent_ids || [];
    if (ids.length && agentOptions.value.length) {
      selectedAgents.value = agentOptions.value.filter(a => ids.includes(a.id));
    } else {
      selectedAgents.value = [];
    }
  },
  { deep: true, immediate: true }
);

const onUpdate = async updatedAgents => {
  selectedAgents.value = updatedAgents;
  const ids = updatedAgents.map(a => a.id);
  try {
    await updateAccount({ assignable_agent_ids: ids });
    useAlert(t('GENERAL_SETTINGS.FORM.ASSIGNABLE_AGENTS.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.ASSIGNABLE_AGENTS.API.ERROR'));
  }
};
</script>

<template>
  <SectionLayout
    :title="t('GENERAL_SETTINGS.FORM.ASSIGNABLE_AGENTS.TITLE')"
    :description="t('GENERAL_SETTINGS.FORM.ASSIGNABLE_AGENTS.NOTE')"
    with-border
  >
    <Multiselect
      :model-value="selectedAgents"
      :options="agentOptions"
      multiple
      :close-on-select="false"
      :clear-on-select="false"
      preserve-search
      :placeholder="t('FORMS.MULTISELECT.SELECT')"
      label="name"
      track-by="id"
      :preselect-first="false"
      @update:model-value="onUpdate"
    />
  </SectionLayout>
</template>

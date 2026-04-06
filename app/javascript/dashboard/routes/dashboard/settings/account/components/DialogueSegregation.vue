<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccount } from 'dashboard/composables/useAccount';
import { useAlert } from 'dashboard/composables';
import { useMapGetter } from 'dashboard/composables/store';
import SectionLayout from './SectionLayout.vue';
import Switch from 'next/switch/Switch.vue';
import SingleSelect from 'dashboard/components-next/filter/inputs/SingleSelect.vue';

const { t } = useI18n();
const isEnabled = ref(false);
const selectedTeam = ref(null);

const { currentAccount, updateAccount } = useAccount();
const teams = useMapGetter('teams/getTeams');

const teamOptions = computed(() =>
  (teams.value || []).map(team => ({
    id: team.id,
    name: team.name,
  }))
);

watch(
  [currentAccount, teamOptions],
  () => {
    const settings = currentAccount.value?.settings || {};
    isEnabled.value = !!settings.dialogue_segregation_enabled;
    const teamId = settings.support_247_team_id;
    selectedTeam.value = teamId
      ? teamOptions.value.find(t => t.id === teamId) || null
      : null;
  },
  { deep: true, immediate: true }
);

const toggleSegregation = async () => {
  try {
    await updateAccount({
      dialogue_segregation_enabled: isEnabled.value,
    });
    useAlert(t('GENERAL_SETTINGS.FORM.DIALOGUE_SEGREGATION.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.DIALOGUE_SEGREGATION.API.ERROR'));
  }
};

const updateSupportTeam = async team => {
  selectedTeam.value = team;
  try {
    await updateAccount({
      support_247_team_id: team?.id || null,
    });
    useAlert(t('GENERAL_SETTINGS.FORM.SUPPORT_247_TEAM.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.SUPPORT_247_TEAM.API.ERROR'));
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
        <Switch v-model="isEnabled" @change="toggleSegregation" />
      </div>
    </template>
  </SectionLayout>
  <SectionLayout
    :title="t('GENERAL_SETTINGS.FORM.SUPPORT_247_TEAM.TITLE')"
    :description="t('GENERAL_SETTINGS.FORM.SUPPORT_247_TEAM.NOTE')"
    with-border
  >
    <template #headerActions>
      <div class="flex justify-end w-full max-w-[220px]">
        <SingleSelect
          :model-value="selectedTeam"
          :options="teamOptions"
          :placeholder="t('GENERAL_SETTINGS.FORM.SUPPORT_247_TEAM.PLACEHOLDER')"
          placeholder-icon="i-lucide-users"
          @update:model-value="updateSupportTeam"
        />
      </div>
    </template>
  </SectionLayout>
</template>

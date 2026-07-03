<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccount } from 'dashboard/composables/useAccount';
import { useAlert } from 'dashboard/composables';
import { useMapGetter } from 'dashboard/composables/store';
import SectionLayout from './SectionLayout.vue';
import SingleSelect from 'dashboard/components-next/filter/inputs/SingleSelect.vue';
import Switch from 'next/switch/Switch.vue';

const { t } = useI18n();
const selectedTeam = ref(null);
const selectedAmlTeam = ref(null);
const supportL1Enabled = ref(false);

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
    const teamId = settings.support_247_team_id;
    selectedTeam.value = teamId
      ? teamOptions.value.find(opt => opt.id === teamId) || null
      : null;
    const amlTeamId = settings.aml_team_id;
    selectedAmlTeam.value = amlTeamId
      ? teamOptions.value.find(opt => opt.id === amlTeamId) || null
      : null;
    supportL1Enabled.value = !!settings.support_l1_enabled;
  },
  { deep: true, immediate: true }
);

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

const updateAmlTeam = async team => {
  selectedAmlTeam.value = team;
  try {
    await updateAccount({
      aml_team_id: team?.id || null,
    });
    useAlert(t('GENERAL_SETTINGS.FORM.AML_TEAM.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.AML_TEAM.API.ERROR'));
  }
};

const updateSupportL1Enabled = async value => {
  supportL1Enabled.value = value;
  try {
    await updateAccount({ support_l1_enabled: value });
    useAlert(t('GENERAL_SETTINGS.FORM.SUPPORT_L1_ENABLED.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.SUPPORT_L1_ENABLED.API.ERROR'));
  }
};
</script>

<template>
  <div>
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
            :placeholder="
              t('GENERAL_SETTINGS.FORM.SUPPORT_247_TEAM.PLACEHOLDER')
            "
            placeholder-icon="i-lucide-users"
            @update:model-value="updateSupportTeam"
          />
        </div>
      </template>
    </SectionLayout>
    <SectionLayout
      :title="t('GENERAL_SETTINGS.FORM.AML_TEAM.TITLE')"
      :description="t('GENERAL_SETTINGS.FORM.AML_TEAM.NOTE')"
      with-border
    >
      <template #headerActions>
        <div class="flex justify-end w-full max-w-[220px]">
          <SingleSelect
            :model-value="selectedAmlTeam"
            :options="teamOptions"
            :placeholder="t('GENERAL_SETTINGS.FORM.AML_TEAM.PLACEHOLDER')"
            placeholder-icon="i-lucide-shield"
            @update:model-value="updateAmlTeam"
          />
        </div>
      </template>
    </SectionLayout>
    <SectionLayout
      :title="t('GENERAL_SETTINGS.FORM.SUPPORT_L1_ENABLED.TITLE')"
      :description="t('GENERAL_SETTINGS.FORM.SUPPORT_L1_ENABLED.NOTE')"
      with-border
    >
      <template #headerActions>
        <Switch
          :model-value="supportL1Enabled"
          @update:model-value="updateSupportL1Enabled"
        />
      </template>
    </SectionLayout>
  </div>
</template>

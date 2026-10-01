<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Multiselect from 'vue-multiselect';
import { useAccount } from 'dashboard/composables/useAccount';
import { useAlert } from 'dashboard/composables';
import RetentionAPI from 'dashboard/api/retention';
import NextButton from 'dashboard/components-next/button/Button.vue';
import SectionLayout from './SectionLayout.vue';
import { publishRetentionMembership } from 'dashboard/composables/useRetentionAccess';

const { t } = useI18n();
const { accountId } = useAccount();
const agents = ref([]);
const selectedAgents = ref([]);
const savedUserIds = ref([]);
const revision = ref(null);
const isLoading = ref(true);
const isSaving = ref(false);
const errorKey = ref('');
const serverError = ref('');
const hasConflict = ref(false);
let requestSequence = 0;

const errorMessage = computed(() => {
  const messages = {
    load: t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.API.LOAD_ERROR'),
    save: t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.API.SAVE_ERROR'),
    conflict: t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.API.CONFLICT'),
  };
  return serverError.value || messages[errorKey.value] || '';
});

const isDirty = computed(() => {
  const selectedIds = selectedAgents.value.map(agent => agent.id);
  return (
    selectedIds.length !== savedUserIds.value.length ||
    selectedIds.some(id => !savedUserIds.value.includes(id))
  );
});

const applyResponse = data => {
  agents.value = data.agents;
  savedUserIds.value = data.user_ids;
  selectedAgents.value = data.agents.filter(agent =>
    data.user_ids.includes(agent.id)
  );
  revision.value = data.revision;
};

const load = async () => {
  requestSequence += 1;
  const requestId = requestSequence;
  isLoading.value = true;
  isSaving.value = false;
  errorKey.value = '';
  serverError.value = '';
  hasConflict.value = false;
  revision.value = null;
  agents.value = [];
  selectedAgents.value = [];
  savedUserIds.value = [];
  try {
    const { data } = await RetentionAPI.get();
    if (requestSequence === requestId) applyResponse(data);
  } catch {
    if (requestSequence === requestId) errorKey.value = 'load';
  } finally {
    if (requestSequence === requestId) isLoading.value = false;
  }
};

const save = async () => {
  if (
    isSaving.value ||
    !isDirty.value ||
    !revision.value ||
    hasConflict.value
  ) {
    return;
  }
  const requestId = requestSequence;
  const savedAccountId = accountId.value;
  isSaving.value = true;
  errorKey.value = '';
  serverError.value = '';
  try {
    const { data } = await RetentionAPI.updateMembers({
      userIds: selectedAgents.value.map(agent => agent.id),
      revision: revision.value,
    });
    if (requestSequence !== requestId) return;
    applyResponse(data);
    publishRetentionMembership({
      account_id: savedAccountId,
      user_ids: data.user_ids,
    });
    useAlert(t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.API.SUCCESS'));
  } catch (error) {
    if (requestSequence !== requestId) return;
    hasConflict.value = error.response?.status === 409;
    serverError.value = error.response?.data?.message || '';
    errorKey.value = hasConflict.value ? 'conflict' : 'save';
  } finally {
    if (requestSequence === requestId) isSaving.value = false;
  }
};

watch(accountId, load, { immediate: true });
onBeforeUnmount(() => {
  requestSequence += 1;
});
</script>

<template>
  <SectionLayout
    :title="t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.TITLE')"
    :description="t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.NOTE')"
    with-border
  >
    <div class="flex flex-col gap-3" :aria-busy="isLoading || isSaving">
      <p v-if="isLoading" role="status" class="text-sm text-n-slate-11">
        {{ t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.LOADING') }}
      </p>
      <template v-else-if="revision">
        <label for="retention-specialists" class="text-sm font-medium">
          {{ t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.LABEL') }}
        </label>
        <Multiselect
          id="retention-specialists"
          v-model="selectedAgents"
          :options="agents"
          :disabled="isSaving || hasConflict"
          multiple
          :close-on-select="false"
          :clear-on-select="false"
          preserve-search
          :placeholder="
            t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.PLACEHOLDER')
          "
          label="name"
          track-by="id"
          :preselect-first="false"
          :select-label="
            t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.SELECT')
          "
          :selected-label="
            t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.SELECTED')
          "
          :deselect-label="
            t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.REMOVE')
          "
        >
          <template #noResult>
            {{ t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.NO_RESULTS') }}
          </template>
          <template #noOptions>
            {{ t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.NO_AGENTS') }}
          </template>
        </Multiselect>
        <div>
          <NextButton
            blue
            :disabled="!isDirty || isSaving || hasConflict"
            :is-loading="isSaving"
            @click="save"
          >
            {{ t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.SAVE') }}
          </NextButton>
        </div>
      </template>
      <p v-if="errorKey" role="alert" class="text-sm text-n-ruby-11">
        {{ errorMessage }}
      </p>
      <div v-if="!isLoading && (!revision || hasConflict)">
        <NextButton outline @click="load">
          {{ t('GENERAL_SETTINGS.FORM.RETENTION_SPECIALISTS.RELOAD') }}
        </NextButton>
      </div>
    </div>
  </SectionLayout>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter, useStore } from 'dashboard/composables/store.js';
import DatePicker from 'vue-datepicker-next';
import Avatar from 'next/avatar/Avatar.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['filtersChanged', 'search']);

const { t } = useI18n();
const store = useStore();

const agents = useMapGetter('agents/getAgents');

const selectedAgent = ref(null);
const selectedParticipatedAgent = ref(null);
const selectedResolvedAgent = ref(null);
const dateFrom = ref(null);
const dateTo = ref(null);

const agentOptions = computed(() => {
  const allAgentsOption = {
    id: null,
    name: t('SEARCH.FILTERS.AGENT_PLACEHOLDER'),
  };
  return [allAgentsOption, ...agents.value];
});

const emitFilters = async () => {
  const filters = {
    userId: selectedAgent.value?.id || null,
    participatedByUserId: selectedParticipatedAgent.value?.id || null,
    resolvedByUserId: selectedResolvedAgent.value?.id || null,
    dateFrom: dateFrom.value ? dateFrom.value.getTime() : null,
    dateTo: dateTo.value ? dateTo.value.getTime() : null,
  };
  await store.dispatch('conversationSearch/setMessageFilters', filters);
  emit('filtersChanged', filters);
};

const onAgentChange = () => {
  emitFilters();
};

const onSearchClick = async () => {
  await emitFilters();
  emit('search');
};

const onDateFromChange = value => {
  dateFrom.value = value;
  emitFilters();
};

const onDateToChange = value => {
  dateTo.value = value;
  emitFilters();
};

watch(
  () => props.visible,
  newVisible => {
    if (newVisible && agents.value.length === 0) {
      store.dispatch('agents/get');
    }
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="visible" class="relative z-[60] flex flex-wrap gap-12 mt-3 mb-2 items-end">
    <div class="w-48">
      <p class="mb-1 text-xs font-medium text-n-slate-11">
        {{ t('SEARCH.FILTERS.AGENT_LABEL') }}
      </p>
      <multiselect
        v-model="selectedAgent"
        :placeholder="t('SEARCH.FILTERS.AGENT_PLACEHOLDER')"
        label="name"
        track-by="id"
        :options="agentOptions"
        :option-height="24"
        :show-labels="false"
        :allow-empty="true"
        @update:model-value="onAgentChange"
      >
        <template #singleLabel="{ option }">
          <div class="flex items-center gap-2 min-w-0">
            <Avatar
              v-if="option.id"
              :src="option.thumbnail"
              :status="option.availability_status"
              :name="option.name"
              :size="20"
              hide-offline-status
              rounded-full
            />
            <span class="text-n-slate-12 truncate">{{ option.name }}</span>
          </div>
        </template>
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <Avatar
              v-if="option.id"
              :src="option.thumbnail"
              :status="option.availability_status"
              :name="option.name"
              :size="20"
              hide-offline-status
              rounded-full
            />
            <span class="text-n-slate-12">{{ option.name }}</span>
          </div>
        </template>
      </multiselect>
    </div>

    <div class="w-48">
      <p class="mb-1 text-xs font-medium text-n-slate-11">
        {{ t('SEARCH.FILTERS.PARTICIPATED_BY_LABEL') }}
      </p>
      <multiselect
        v-model="selectedParticipatedAgent"
        :placeholder="t('SEARCH.FILTERS.PARTICIPATED_BY_PLACEHOLDER')"
        label="name"
        track-by="id"
        :options="agentOptions"
        :option-height="24"
        :show-labels="false"
        :allow-empty="true"
        @update:model-value="emitFilters"
      >
        <template #singleLabel="{ option }">
          <div class="flex items-center gap-2 min-w-0">
            <Avatar
              v-if="option.id"
              :src="option.thumbnail"
              :status="option.availability_status"
              :name="option.name"
              :size="20"
              hide-offline-status
              rounded-full
            />
            <span class="text-n-slate-12 truncate">{{ option.name }}</span>
          </div>
        </template>
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <Avatar
              v-if="option.id"
              :src="option.thumbnail"
              :status="option.availability_status"
              :name="option.name"
              :size="20"
              hide-offline-status
              rounded-full
            />
            <span class="text-n-slate-12">{{ option.name }}</span>
          </div>
        </template>
      </multiselect>
    </div>

    <div class="w-48">
      <p class="mb-1 text-xs font-medium text-n-slate-11">
        {{ t('SEARCH.FILTERS.RESOLVED_BY_LABEL') }}
      </p>
      <multiselect
        v-model="selectedResolvedAgent"
        :placeholder="t('SEARCH.FILTERS.RESOLVED_BY_PLACEHOLDER')"
        label="name"
        track-by="id"
        :options="agentOptions"
        :option-height="24"
        :show-labels="false"
        :allow-empty="true"
        @update:model-value="emitFilters"
      >
        <template #singleLabel="{ option }">
          <div class="flex items-center gap-2 min-w-0">
            <Avatar
              v-if="option.id"
              :src="option.thumbnail"
              :status="option.availability_status"
              :name="option.name"
              :size="20"
              hide-offline-status
              rounded-full
            />
            <span class="text-n-slate-12 truncate">{{ option.name }}</span>
          </div>
        </template>
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <Avatar
              v-if="option.id"
              :src="option.thumbnail"
              :status="option.availability_status"
              :name="option.name"
              :size="20"
              hide-offline-status
              rounded-full
            />
            <span class="text-n-slate-12">{{ option.name }}</span>
          </div>
        </template>
      </multiselect>
    </div>

    <div class="w-48 text-sm">
      <p class="mb-1 text-xs font-medium text-n-slate-11">
        {{ t('SEARCH.FILTERS.DATE_FROM_LABEL') }}
      </p>
      <DatePicker
        v-model:value="dateFrom"
        type="datetime"
        format="YYYY-MM-DD HH:mm"
        :placeholder="t('SEARCH.FILTERS.DATE_FROM_PLACEHOLDER')"
        :clearable="true"
        @change="onDateFromChange"
      />
    </div>

    <div class="w-48 text-sm">
      <p class="mb-1 text-xs font-medium text-n-slate-11">
        {{ t('SEARCH.FILTERS.DATE_TO_LABEL') }}
      </p>
      <DatePicker
        v-model:value="dateTo"
        type="datetime"
        format="YYYY-MM-DD HH:mm"
        :placeholder="t('SEARCH.FILTERS.DATE_TO_PLACEHOLDER')"
        :clearable="true"
        @change="onDateToChange"
      />
    </div>

    <NextButton
      :label="t('SEARCH.FILTERS.SEARCH_BUTTON')"
      icon="i-lucide-search"
      solid
      blue
      sm
      @click="onSearchClick"
    />
  </div>
</template>

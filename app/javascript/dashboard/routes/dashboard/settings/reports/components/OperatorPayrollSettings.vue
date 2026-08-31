<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';
import TagMultiSelectComboBox from 'dashboard/components-next/combobox/TagMultiSelectComboBox.vue';

const { t } = useI18n();
const settings = ref([]);
const profiles = ref([]);
const operatorOptions = ref([]);
const selectedOperatorIds = ref([]);
const selectedProfileId = ref(null);
const groupName = ref('');
const isLoading = ref(true);
const isSaving = ref(false);
const loadError = ref(false);

const createDefaultSettings = () => [
  {
    period: 'morning',
    startMinute: 360,
    endMinute: 720,
    eightHourRate: 0,
    twelveHourRate: 0,
  },
  {
    period: 'noon',
    startMinute: 720,
    endMinute: 1080,
    eightHourRate: 0,
    twelveHourRate: 0,
  },
  {
    period: 'evening',
    startMinute: 1080,
    endMinute: 1320,
    eightHourRate: 0,
    twelveHourRate: 0,
  },
  {
    period: 'night',
    startMinute: 1320,
    endMinute: 360,
    eightHourRate: 0,
    twelveHourRate: 0,
  },
];

const visibleProfiles = computed(() => profiles.value);

const availableOperatorOptions = computed(() => {
  const assignedElsewhere = new Set(
    visibleProfiles.value
      .filter(profile => profile.id !== selectedProfileId.value)
      .flatMap(profile => profile.operatorIds)
  );
  return operatorOptions.value.filter(
    operator => !assignedElsewhere.has(operator.value)
  );
});

const operatorEmptyState = computed(() =>
  operatorOptions.value.length
    ? t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.ALL_OPERATORS_ASSIGNED')
    : t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPERATORS_EMPTY')
);

const minuteToTime = minute => {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const timeToMinute = value => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const updateTime = (setting, field, value) => {
  setting[field] = timeToMinute(value);
};

const fetchSettings = async () => {
  isLoading.value = true;
  loadError.value = false;
  const [settingsResult, operatorsResult] = await Promise.allSettled([
    ChatwootExtraAPI.getOperatorPayrollSettings(),
    ChatwootExtraAPI.getOperatorsList(),
  ]);

  if (operatorsResult.status === 'fulfilled') {
    const operatorsResponse = operatorsResult.value;
    operatorOptions.value = (operatorsResponse?.data || []).map(operator => ({
      value: operator.operatorId,
      label: operator.name,
    }));
  }

  if (settingsResult.status === 'fulfilled') {
    const settingsResponse = settingsResult.value;
    profiles.value = settingsResponse?.data || [];
  } else {
    loadError.value = true;
    useAlert(t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.LOAD_ERROR'));
  }
  createProfile();
  isLoading.value = false;
};

const createProfile = () => {
  selectedProfileId.value = null;
  groupName.value = '';
  selectedOperatorIds.value = [];
  settings.value = createDefaultSettings();
};

const selectProfile = profile => {
  selectedProfileId.value = profile.id;
  groupName.value = profile.name;
  selectedOperatorIds.value = [...profile.operatorIds];
  settings.value = profile.settings.map(setting => ({ ...setting }));
};

const saveSettings = async () => {
  isSaving.value = true;
  try {
    const response = await ChatwootExtraAPI.updateOperatorPayrollSettings({
      profileId: selectedProfileId.value || undefined,
      name: groupName.value.trim(),
      operatorIds: selectedOperatorIds.value.map(Number),
      settings: settings.value.map(setting => ({
        ...setting,
        eightHourRate: Number(setting.eightHourRate),
        twelveHourRate: Number(setting.twelveHourRate),
      })),
    });
    const profile = response?.data;
    if (profile) {
      const index = profiles.value.findIndex(item => item.id === profile.id);
      if (index === -1) profiles.value = [profile, ...profiles.value];
      else profiles.value.splice(index, 1, profile);
      selectProfile(profile);
    }
    useAlert(t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.SAVED'));
  } catch {
    useAlert(t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.SAVE_ERROR'));
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchSettings);
</script>

<template>
  <div class="max-w-5xl">
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-n-slate-12">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.TITLE') }}
      </h2>
      <p class="mt-1 text-sm text-n-slate-11">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.DESCRIPTION') }}
      </p>
    </div>

    <div class="mb-6 border-b border-n-slate-3 pb-5">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          class="h-8 rounded-md px-3 text-sm font-medium"
          :class="
            !selectedProfileId
              ? 'bg-woot-500 text-white'
              : 'bg-n-slate-2 text-n-slate-12 hover:bg-n-slate-3'
          "
          @click="createProfile"
        >
          {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.NEW_GROUP') }}
        </button>
        <button
          v-for="profile in visibleProfiles"
          :key="profile.id"
          class="h-8 max-w-[240px] truncate rounded-md px-3 text-sm font-medium"
          :class="
            selectedProfileId === profile.id
              ? 'bg-woot-500 text-white'
              : 'bg-n-slate-2 text-n-slate-12 hover:bg-n-slate-3'
          "
          :title="profile.name"
          @click="selectProfile(profile)"
        >
          <span class="truncate">{{ profile.name }}</span>
          <span
            class="ml-1.5 rounded px-1.5 py-0.5 text-xs"
            :class="
              selectedProfileId === profile.id
                ? 'bg-white/20 text-white'
                : 'bg-n-slate-3 text-n-slate-10'
            "
          >
            {{ profile.operatorIds.length }}
          </span>
        </button>
      </div>

      <div class="mb-4 max-w-xl">
        <label
          class="mb-1 block text-xs font-medium text-n-slate-11"
          for="payroll-group-name"
        >
          {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.GROUP_NAME') }}
        </label>
        <input
          id="payroll-group-name"
          v-model.trim="groupName"
          type="text"
          maxlength="100"
          required
          :placeholder="
            t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.GROUP_NAME_PLACEHOLDER')
          "
          class="no-margin block h-10 w-full rounded-md border border-n-slate-4 bg-n-background px-3 text-sm text-n-slate-12"
        />
      </div>

      <label class="mb-1 block text-xs font-medium text-n-slate-11">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPERATORS') }}
      </label>
      <TagMultiSelectComboBox
        v-model="selectedOperatorIds"
        class="max-w-xl"
        :options="availableOperatorOptions"
        :placeholder="
          t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPERATORS_PLACEHOLDER')
        "
        :search-placeholder="
          t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPERATORS_SEARCH')
        "
        :empty-state="operatorEmptyState"
      />
      <p class="mt-1 text-xs text-n-slate-10">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPERATORS_HINT') }}
      </p>
      <p v-if="!operatorOptions.length" class="mt-2 text-sm text-red-600">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.OPERATORS_EMPTY') }}
      </p>
      <p v-else-if="loadError" class="mt-2 text-sm text-red-600">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.RATES_UNAVAILABLE') }}
      </p>
    </div>

    <div class="mb-6 grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg border border-n-slate-4 bg-n-slate-2 p-4">
        <p class="text-sm font-medium text-n-slate-12">
          {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.EIGHT_HOUR_RULE') }}
        </p>
        <p class="mt-1 text-sm text-n-slate-11">
          {{
            t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.EIGHT_HOUR_RULE_DESCRIPTION')
          }}
        </p>
      </div>
      <div class="rounded-lg border border-n-slate-4 bg-n-slate-2 p-4">
        <p class="text-sm font-medium text-n-slate-12">
          {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.TWELVE_HOUR_RULE') }}
        </p>
        <p class="mt-1 text-sm text-n-slate-11">
          {{
            t(
              'REPORT.OPERATOR_STATUS_PAGE.PAYROLL.TWELVE_HOUR_RULE_DESCRIPTION'
            )
          }}
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="py-12 text-sm text-n-slate-11">
      {{ t('REPORT.OPERATOR_STATUS_PAGE.LOADING') }}
    </div>

    <div v-else class="overflow-x-auto border border-n-slate-4 rounded-lg">
      <table class="w-full min-w-[720px] text-left">
        <thead class="bg-n-slate-2">
          <tr class="border-b border-n-slate-4">
            <th class="px-4 py-3 text-sm font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.PERIOD') }}
            </th>
            <th class="px-4 py-3 text-sm font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.START') }}
            </th>
            <th class="px-4 py-3 text-sm font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.END') }}
            </th>
            <th class="px-4 py-3 text-sm font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.EIGHT_HOUR_RATE') }}
            </th>
            <th class="px-4 py-3 text-sm font-medium text-n-slate-11">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.TWELVE_HOUR_RATE') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="setting in settings"
            :key="setting.period"
            class="border-b last:border-b-0 border-n-slate-3"
          >
            <td
              class="px-4 py-3 text-sm font-medium capitalize text-n-slate-12"
            >
              {{
                t(
                  `REPORT.OPERATOR_STATUS_PAGE.PAYROLL.PERIODS.${setting.period}`
                )
              }}
            </td>
            <td class="px-4 py-3">
              <input
                :value="minuteToTime(setting.startMinute)"
                type="time"
                class="no-margin h-9 rounded-md border border-n-slate-4 bg-n-background px-2 text-sm text-n-slate-12"
                @input="updateTime(setting, 'startMinute', $event.target.value)"
              />
            </td>
            <td class="px-4 py-3">
              <input
                :value="minuteToTime(setting.endMinute)"
                type="time"
                class="no-margin h-9 rounded-md border border-n-slate-4 bg-n-background px-2 text-sm text-n-slate-12"
                @input="updateTime(setting, 'endMinute', $event.target.value)"
              />
            </td>
            <td class="px-4 py-3">
              <label class="sr-only" :for="`${setting.period}-eight-rate`">
                {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.EIGHT_HOUR_RATE') }}
              </label>
              <input
                :id="`${setting.period}-eight-rate`"
                v-model.number="setting.eightHourRate"
                type="number"
                min="0"
                step="0.01"
                class="no-margin h-9 w-28 rounded-md border border-n-slate-4 bg-n-background px-2 text-sm text-n-slate-12"
              />
            </td>
            <td class="px-4 py-3">
              <label class="sr-only" :for="`${setting.period}-twelve-rate`">
                {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.TWELVE_HOUR_RATE') }}
              </label>
              <input
                :id="`${setting.period}-twelve-rate`"
                v-model.number="setting.twelveHourRate"
                type="number"
                min="0"
                step="0.01"
                class="no-margin h-9 w-28 rounded-md border border-n-slate-4 bg-n-background px-2 text-sm text-n-slate-12"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between gap-4">
      <p class="text-xs text-n-slate-10">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.COVERAGE_HINT') }}
      </p>
      <button
        class="h-9 shrink-0 rounded-md bg-woot-500 px-4 text-sm font-medium text-white hover:bg-woot-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSaving || !settings.length || !groupName.trim()"
        @click="saveSettings"
      >
        {{
          isSaving
            ? t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.SAVING')
            : t('REPORT.OPERATOR_STATUS_PAGE.PAYROLL.SAVE')
        }}
      </button>
    </div>
  </div>
</template>

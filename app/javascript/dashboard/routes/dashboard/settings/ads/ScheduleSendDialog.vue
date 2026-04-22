<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore, useStoreGetters } from 'dashboard/composables/store';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  show: { type: Boolean, required: true },
  ad: { type: Object, default: null },
  existingSchedule: { type: Object, default: null },
});
const emit = defineEmits(['close']);

const { t } = useI18n();
const store = useStore();
const getters = useStoreGetters();

const uiFlags = computed(() => getters['ads/getUIFlags'].value);
const busy = computed(
  () =>
    uiFlags.value.isSchedulingSend ||
    uiFlags.value.isReschedulingSend ||
    uiFlags.value.isCancellingSchedule
);

const isEdit = computed(() => !!props.existingSchedule);
const inputValue = ref('');
const errorText = ref('');

const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

const toLocalInputValue = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

watch(
  () => [props.show, props.existingSchedule],
  () => {
    if (props.existingSchedule?.scheduledAt) {
      inputValue.value = toLocalInputValue(props.existingSchedule.scheduledAt);
    } else if (props.show) {
      inputValue.value = '';
    }
    errorText.value = '';
  },
  { immediate: true }
);

const validate = () => {
  if (!inputValue.value) {
    errorText.value = t('ADS.SCHEDULE.PAST_TIME_ERROR');
    return null;
  }
  const d = new Date(inputValue.value);
  if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 10_000) {
    errorText.value = t('ADS.SCHEDULE.PAST_TIME_ERROR');
    return null;
  }
  errorText.value = '';
  return d;
};

const submit = async () => {
  const d = validate();
  if (!d) return;
  const scheduledAt = d.toISOString();
  const scheduledTz = viewerTz;

  const result = isEdit.value
    ? await store.dispatch('ads/rescheduleSend', {
        adId: props.ad.id,
        scheduleId: props.existingSchedule.id,
        scheduledAt,
        scheduledTz,
      })
    : await store.dispatch('ads/scheduleSend', {
        adId: props.ad.id,
        scheduledAt,
        scheduledTz,
      });

  if (result) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: isEdit.value
        ? t('ADS.SCHEDULE.API.SUCCESS_UPDATE')
        : t('ADS.SCHEDULE.API.SUCCESS_CREATE'),
    });
    emit('close');
  } else {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: isEdit.value
        ? t('ADS.SCHEDULE.API.ERROR_UPDATE')
        : t('ADS.SCHEDULE.API.ERROR_CREATE'),
    });
  }
};

const cancelSchedule = async () => {
  if (!isEdit.value) return;
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('ADS.SCHEDULE.CANCEL_CONFIRM'))) return;
  const result = await store.dispatch('ads/cancelScheduledSend', {
    adId: props.ad.id,
    scheduleId: props.existingSchedule.id,
  });
  if (result !== null) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.SCHEDULE.API.SUCCESS_CANCEL'),
    });
    emit('close');
  } else {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.SCHEDULE.API.ERROR_CANCEL'),
    });
  }
};
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
  >
    <div
      class="bg-white dark:bg-n-slate-2 rounded-lg p-6 w-full max-w-xl shadow-xl"
    >
      <h2 class="text-lg font-semibold mb-4 text-n-slate-12">
        {{ isEdit ? t('ADS.SCHEDULE.EDIT_TITLE') : t('ADS.SCHEDULE.TITLE') }}
      </h2>

      <label class="block text-sm font-medium mb-1 text-n-slate-12">
        {{ t('ADS.SCHEDULE.PICKER_LABEL') }}
      </label>
      <input
        v-model="inputValue"
        type="datetime-local"
        class="w-full border rounded px-3 py-2 mb-1 bg-transparent text-n-slate-12 border-n-slate-6"
      />
      <p class="text-xs text-n-slate-10 mb-3">
        {{ t('ADS.SCHEDULE.TIMEZONE_NOTE') }} ({{ viewerTz }})
      </p>
      <p v-if="errorText" class="text-sm text-red-600 mb-3">{{ errorText }}</p>

      <div class="flex justify-between gap-2">
        <Button
          v-if="isEdit"
          variant="outline"
          color-scheme="alert"
          :disabled="busy"
          :label="t('ADS.SCHEDULE.CANCEL_BTN')"
          @click="cancelSchedule"
        />
        <div class="flex gap-2 ml-auto">
          <Button
            variant="ghost"
            :disabled="busy"
            :label="t('ADS.SCHEDULE.CLOSE')"
            @click="emit('close')"
          />
          <Button
            variant="solid"
            color-scheme="primary"
            :disabled="busy"
            :label="
              isEdit ? t('ADS.SCHEDULE.UPDATE') : t('ADS.SCHEDULE.SUBMIT')
            "
            @click="submit"
          />
        </div>
      </div>
    </div>
  </div>
</template>

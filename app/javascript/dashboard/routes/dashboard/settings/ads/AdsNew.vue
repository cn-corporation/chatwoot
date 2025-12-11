<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import AdsForm from './AdsForm.vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const router = useRouter();
const store = useStore();
const { t } = useI18n();

onMounted(async () => {
  await store.dispatch('inboxes/get');
});

const handleSubmit = async (formData) => {
  try {
    const ad = await store.dispatch('ads/create', formData);
    if (ad) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.CREATE.API.SUCCESS_MESSAGE'),
      });
      router.push({ name: 'ads_wrapper' });
    } else {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.CREATE.API.ERROR_MESSAGE'),
      });
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.CREATE.API.ERROR_MESSAGE'),
    });
  }
};

const handleCancel = () => {
  router.push({ name: 'ads_wrapper' });
};
</script>

<template>
  <div class="p-6">
    <div class="max-w-3xl">
      <h2 class="text-2xl font-semibold text-n-slate-12 mb-6">
        {{ $t('ADS.CREATE.TITLE') }}
      </h2>
      <AdsForm @submit="handleSubmit" @cancel="handleCancel" />
    </div>
  </div>
</template>

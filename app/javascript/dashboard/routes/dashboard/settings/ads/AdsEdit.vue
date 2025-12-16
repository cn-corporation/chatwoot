<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useStoreGetters, useStore } from 'dashboard/composables/store';
import AdsForm from './AdsForm.vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const router = useRouter();
const route = useRoute();
const store = useStore();
const getters = useStoreGetters();
const { t } = useI18n();

const adData = ref(null);
const isLoading = ref(true);

const uiFlags = computed(() => getters['ads/getUIFlags'].value);

onMounted(async () => {
  const adId = route.params.adId;
  try {
    const ad = await store.dispatch('ads/getSingleAd', adId);
    if (ad) {
      adData.value = ad;
    } else {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.EDIT.API.ERROR_MESSAGE'),
      });
      router.push({ name: 'ads_wrapper' });
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.EDIT.API.ERROR_MESSAGE'),
    });
    router.push({ name: 'ads_wrapper' });
  } finally {
    isLoading.value = false;
  }
});

const handleSubmit = async (formData) => {
  const adId = route.params.adId;
  try {
    const ad = await store.dispatch('ads/update', { id: adId, ...formData });
    if (ad) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.EDIT.API.SUCCESS_MESSAGE'),
      });
      router.push({ name: 'ads_wrapper' });
    } else {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.EDIT.API.ERROR_MESSAGE'),
      });
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.EDIT.API.ERROR_MESSAGE'),
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
        {{ $t('ADS.EDIT.TITLE') }}
      </h2>
      <div v-if="isLoading || uiFlags.isFetchingItem" class="flex justify-center py-8">
        <p class="text-n-slate-10">{{ $t('ADS.LOADING') }}</p>
      </div>
      <AdsForm
        v-else-if="adData"
        :ad-data="adData"
        :is-edit="true"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

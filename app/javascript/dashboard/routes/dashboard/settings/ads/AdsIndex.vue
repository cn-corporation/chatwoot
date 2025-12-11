<script setup>
import { useAlert } from 'dashboard/composables';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SettingsLayout from '../SettingsLayout.vue';
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStoreGetters, useStore } from 'dashboard/composables/store';
import { useRouter } from 'vue-router';
import Button from 'dashboard/components-next/button/Button.vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const getters = useStoreGetters();
const store = useStore();
const router = useRouter();
const { t } = useI18n();

const showDeleteConfirmationPopup = ref(false);
const selectedAd = ref({});

const records = computed(() => getters['ads/getAds'].value);
const uiFlags = computed(() => getters['ads/getUIFlags'].value);

const deleteMessage = computed(() => ` ${selectedAd.value.name}?`);

onMounted(async () => {
  await store.dispatch('ads/get');
});

const deleteAd = async id => {
  try {
    await store.dispatch('ads/delete', id);
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.DELETE.API.SUCCESS_MESSAGE'),
    });
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.DELETE.API.ERROR_MESSAGE'),
    });
  }
};

const openDeletePopup = ad => {
  showDeleteConfirmationPopup.value = true;
  selectedAd.value = ad;
};

const closeDeletePopup = () => {
  showDeleteConfirmationPopup.value = false;
};

const confirmDeletion = () => {
  closeDeletePopup();
  deleteAd(selectedAd.value.id);
};

const editAd = id => {
  router.push({ name: 'ads_edit', params: { adId: id } });
};

const tableHeaders = computed(() => {
  return [
    t('ADS.LIST.TABLE_HEADER.NAME'),
    t('ADS.LIST.TABLE_HEADER.CREATED_AT'),
    t('ADS.LIST.TABLE_HEADER.ACTIONS'),
  ];
});

const formatDate = dateString => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};
</script>

<template>
  <SettingsLayout
    :no-records-message="$t('ADS.LIST.404')"
    :no-records-found="!records.length"
    :is-loading="uiFlags.isFetching"
    :loading-message="$t('ADS.LOADING')"
    feature-name="ads"
  >
    <template #header>
      <BaseSettingsHeader
        :title="$t('ADS.HEADER')"
        :description="$t('ADS.DESCRIPTION')"
        :link-text="$t('ADS.LEARN_MORE')"
        feature-name="ads"
      >
        <template #actions>
          <router-link :to="{ name: 'ads_new' }">
            <Button icon="i-lucide-circle-plus" :label="$t('ADS.HEADER_BTN_TXT')" />
          </router-link>
        </template>
      </BaseSettingsHeader>
    </template>
    <template #body>
      <table class="min-w-full divide-y divide-n-weak">
        <thead>
          <th
            v-for="thHeader in tableHeaders"
            :key="thHeader"
            class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11"
          >
            {{ thHeader }}
          </th>
        </thead>
        <tbody class="divide-y divide-n-weak text-n-slate-11">
          <tr
            v-for="ad in records"
            :key="ad.id"
            class="hover:bg-n-slate-2"
          >
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <span class="font-medium">{{ ad.name }}</span>
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              {{ formatDate(ad.createdAt) }}
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <div class="flex gap-2">
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-pencil"
                  @click="editAd(ad.id)"
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-trash-2"
                  color-scheme="alert"
                  @click="openDeletePopup(ad)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <woot-delete-modal
        v-model:show="showDeleteConfirmationPopup"
        :on-close="closeDeletePopup"
        :on-confirm="confirmDeletion"
        :title="$t('ADS.DELETE.CONFIRM.TITLE')"
        :message="$t('ADS.DELETE.CONFIRM.MESSAGE')"
        :message-value="deleteMessage"
        :confirm-text="$t('ADS.DELETE.CONFIRM.YES')"
        :reject-text="$t('ADS.DELETE.CONFIRM.NO')"
      />
    </template>
  </SettingsLayout>
</template>

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
const showTestAdDialog = ref(false);
const showDeleteSentMessagesDialog = ref(false);
const showStatusDialog = ref(false);
const showOperationsHistoryDialog = ref(false);
const selectedAd = ref({});
const testTelegramId = ref('');

const records = computed(() => getters['ads/getAds'].value);
const uiFlags = computed(() => getters['ads/getUIFlags'].value);

const deleteMessage = computed(() => ` ${selectedAd.value.name}?`);

const getSendOperation = adId => {
  return getters['ads/getSendOperation'].value(adId);
};

const loadLatestOperationForAd = async adId => {
  try {
    const operations = await store.dispatch('ads/getSendOperations', adId);
    if (operations && operations.length > 0) {
      const latestOperation = operations[0];
      await store.commit('ads/SET_SEND_OPERATION', {
        adId,
        operation: latestOperation,
      });
    }
  } catch (error) {
    console.error(`Failed to load operation for ad ${adId}:`, error);
  }
};

onMounted(async () => {
  await store.dispatch('ads/get');

  if (records.value && records.value.length > 0) {
    await Promise.all(
      records.value.map(ad => loadLatestOperationForAd(ad.id))
    );
  }
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

const startSendAd = async ad => {
  try {
    const result = await store.dispatch('ads/startSend', ad.id);
    if (result) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.SEND.START.SUCCESS_MESSAGE'),
      });
      await store.dispatch('ads/getStatus', {
        adId: ad.id,
        sendOpId: result.id,
      });
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.SEND.START.ERROR_MESSAGE'),
    });
  }
};

const openTestAdDialog = ad => {
  selectedAd.value = ad;
  testTelegramId.value = '';
  showTestAdDialog.value = true;
};

const closeTestAdDialog = () => {
  showTestAdDialog.value = false;
  testTelegramId.value = '';
};

const testSendAd = async () => {
  const telegramId = parseInt(testTelegramId.value, 10);
  if (!telegramId || telegramId < 1) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.SEND.TEST.INVALID_TELEGRAM_ID'),
    });
    return;
  }

  try {
    const result = await store.dispatch('ads/testSend', {
      adId: selectedAd.value.id,
      telegramId,
    });
    if (result) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.SEND.TEST.SUCCESS_MESSAGE'),
      });
      closeTestAdDialog();
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.SEND.TEST.ERROR_MESSAGE'),
    });
  }
};

const stopSendAd = async ad => {
  const operation = getSendOperation(ad.id);
  if (!operation) return;

  try {
    const result = await store.dispatch('ads/stopSend', {
      adId: ad.id,
      sendOpId: operation.id,
    });
    if (result) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('ADS.SEND.STOP.SUCCESS_MESSAGE'),
      });
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.SEND.STOP.ERROR_MESSAGE'),
    });
  }
};

const openDeleteSentMessagesDialog = ad => {
  selectedAd.value = ad;
  showDeleteSentMessagesDialog.value = true;
};

const closeDeleteSentMessagesDialog = () => {
  showDeleteSentMessagesDialog.value = false;
};

const deleteSentMessages = async () => {
  try {
    const result = await store.dispatch(
      'ads/deleteSentMessages',
      selectedAd.value.id
    );
    if (result) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: result.message || t('ADS.DELETE_SENT.SUCCESS_MESSAGE'),
      });
      closeDeleteSentMessagesDialog();
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.DELETE_SENT.ERROR_MESSAGE'),
    });
  }
};

const openStatusDialog = ad => {
  selectedAd.value = ad;
  const operation = getSendOperation(ad.id);
  if (operation) {
    showStatusDialog.value = true;
  }
};

const closeStatusDialog = () => {
  showStatusDialog.value = false;
};

const refreshStatus = async () => {
  const operation = getSendOperation(selectedAd.value.id);
  if (operation) {
    await store.dispatch('ads/getStatus', {
      adId: selectedAd.value.id,
      sendOpId: operation.id,
    });
  }
};

const openOperationsHistoryDialog = async ad => {
  selectedAd.value = ad;
  await store.dispatch('ads/getSendOperations', ad.id);
  showOperationsHistoryDialog.value = true;
};

const closeOperationsHistoryDialog = () => {
  showOperationsHistoryDialog.value = false;
};

const getSendOperationsHistory = computed(() => {
  if (!selectedAd.value.id) return [];
  return getters['ads/getSendOperationsHistory'].value(selectedAd.value.id);
});

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
              <div class="flex gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-eye"
                  @click="openStatusDialog(ad)"
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-send"
                  color-scheme="primary"
                  :disabled="uiFlags.isStartingSend"
                  @click="startSendAd(ad)"
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-square"
                  color-scheme="warning"
                  :disabled="uiFlags.isStoppingSend"
                  @click="stopSendAd(ad)"
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-flask-conical"
                  @click="openTestAdDialog(ad)"
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon="i-lucide-mail-x"
                  color-scheme="warning"
                  @click="openDeleteSentMessagesDialog(ad)"
                />
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
      <woot-modal
        v-model:show="showTestAdDialog"
        :on-close="closeTestAdDialog"
      >
        <div class="flex flex-col gap-4 p-6">
          <h2 class="text-lg font-semibold">
            {{ $t('ADS.SEND.TEST.TITLE') }}
          </h2>
          <p class="text-sm text-n-slate-11">
            {{ $t('ADS.SEND.TEST.DESCRIPTION') }}
          </p>
          <input
            v-model="testTelegramId"
            type="number"
            :placeholder="$t('ADS.SEND.TEST.TELEGRAM_ID_PLACEHOLDER')"
            class="px-3 py-2 border border-n-weak rounded-md"
          />
          <div class="flex gap-2 justify-end">
            <Button
              variant="ghost"
              :label="$t('ADS.SEND.TEST.CANCEL')"
              @click="closeTestAdDialog"
            />
            <Button
              :label="$t('ADS.SEND.TEST.SEND')"
              :disabled="uiFlags.isTestingSend"
              @click="testSendAd"
            />
          </div>
        </div>
      </woot-modal>
      <woot-delete-modal
        v-model:show="showDeleteSentMessagesDialog"
        :on-close="closeDeleteSentMessagesDialog"
        :on-confirm="deleteSentMessages"
        :title="$t('ADS.DELETE_SENT.CONFIRM.TITLE')"
        :message="$t('ADS.DELETE_SENT.CONFIRM.MESSAGE')"
        :confirm-text="$t('ADS.DELETE_SENT.CONFIRM.YES')"
        :reject-text="$t('ADS.DELETE_SENT.CONFIRM.NO')"
      />
      <woot-modal
        v-model:show="showStatusDialog"
        :on-close="closeStatusDialog"
      >
        <div
          v-if="getSendOperation(selectedAd.id)"
          class="flex flex-col gap-4 p-6"
        >
          <h2 class="text-lg font-semibold">
            {{ $t('ADS.STATUS.TITLE') }}
          </h2>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.TOTAL') }}
              </p>
              <p class="text-lg font-semibold">
                {{ getSendOperation(selectedAd.id).totalCount }}
              </p>
            </div>
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.SENT') }}
              </p>
              <p class="text-lg font-semibold">
                {{ getSendOperation(selectedAd.id).sentCount }}
              </p>
            </div>
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.SUCCESS') }}
              </p>
              <p class="text-lg font-semibold text-green-600">
                {{ getSendOperation(selectedAd.id).successCount }}
              </p>
            </div>
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.FAILED') }}
              </p>
              <p class="text-lg font-semibold text-red-600">
                {{ getSendOperation(selectedAd.id).failedCount }}
              </p>
            </div>
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.DELETED') }}
              </p>
              <p class="text-lg font-semibold text-orange-600">
                {{ getSendOperation(selectedAd.id).deletedCount }}
              </p>
            </div>
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.LEFT') }}
              </p>
              <p class="text-lg font-semibold">
                {{ getSendOperation(selectedAd.id).leftCount }}
              </p>
            </div>
            <div>
              <p class="text-sm text-n-slate-11">
                {{ $t('ADS.STATUS.STATE') }}
              </p>
              <p
                class="text-lg font-semibold"
                :class="{
                  'text-green-600': getSendOperation(selectedAd.id).isRunning,
                  'text-orange-600': getSendOperation(selectedAd.id).cancelled,
                  'text-gray-600': !getSendOperation(selectedAd.id).isRunning && !getSendOperation(selectedAd.id).cancelled,
                }"
              >
                {{
                  getSendOperation(selectedAd.id).isRunning
                    ? $t('ADS.STATUS.RUNNING')
                    : getSendOperation(selectedAd.id).cancelled
                      ? $t('ADS.STATUS.CANCELLED')
                      : $t('ADS.STATUS.COMPLETED')
                }}
              </p>
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <Button
              variant="ghost"
              :label="$t('ADS.STATUS.REFRESH')"
              icon="i-lucide-refresh-cw"
              :disabled="uiFlags.isFetchingStatus"
              @click="refreshStatus"
            />
            <Button
              variant="ghost"
              :label="$t('ADS.STATUS.VIEW_HISTORY')"
              icon="i-lucide-history"
              @click="openOperationsHistoryDialog(selectedAd)"
            />
            <Button
              :label="$t('ADS.STATUS.CLOSE')"
              @click="closeStatusDialog"
            />
          </div>
        </div>
      </woot-modal>
      <woot-modal
        v-model:show="showOperationsHistoryDialog"
        :on-close="closeOperationsHistoryDialog"
        size="large"
      >
        <div class="flex flex-col gap-4 p-6">
          <h2 class="text-lg font-semibold">
            {{ $t('ADS.OPERATIONS_HISTORY.TITLE') }}
          </h2>
          <div v-if="uiFlags.isFetchingOperations" class="flex justify-center py-8">
            <p class="text-sm text-n-slate-11">{{ $t('ADS.OPERATIONS_HISTORY.LOADING') }}</p>
          </div>
          <div v-else-if="!getSendOperationsHistory.length" class="flex justify-center py-8">
            <p class="text-sm text-n-slate-11">{{ $t('ADS.OPERATIONS_HISTORY.EMPTY') }}</p>
          </div>
          <div v-else class="max-h-96 overflow-y-auto space-y-4">
            <div
              v-for="operation in getSendOperationsHistory"
              :key="operation.id"
              class="border border-n-weak rounded-lg p-4"
            >
              <div class="flex justify-between items-start mb-3">
                <div>
                  <p class="text-sm font-semibold">
                    {{ formatDate(operation.createdAt) }}
                  </p>
                  <p
                    class="text-xs mt-1"
                    :class="{
                      'text-green-600': operation.isRunning,
                      'text-orange-600': operation.cancelled,
                      'text-gray-600': !operation.isRunning && !operation.cancelled,
                    }"
                  >
                    {{
                      operation.isRunning
                        ? $t('ADS.STATUS.RUNNING')
                        : operation.cancelled
                          ? $t('ADS.STATUS.CANCELLED')
                          : $t('ADS.STATUS.COMPLETED')
                    }}
                  </p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <p class="text-xs text-n-slate-11">{{ $t('ADS.STATUS.TOTAL') }}</p>
                  <p class="text-sm font-semibold">{{ operation.totalCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">{{ $t('ADS.STATUS.SENT') }}</p>
                  <p class="text-sm font-semibold">{{ operation.sentCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">{{ $t('ADS.STATUS.SUCCESS') }}</p>
                  <p class="text-sm font-semibold text-green-600">{{ operation.successCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">{{ $t('ADS.STATUS.FAILED') }}</p>
                  <p class="text-sm font-semibold text-red-600">{{ operation.failedCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">{{ $t('ADS.STATUS.DELETED') }}</p>
                  <p class="text-sm font-semibold text-orange-600">{{ operation.deletedCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">{{ $t('ADS.STATUS.LEFT') }}</p>
                  <p class="text-sm font-semibold">{{ operation.leftCount }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <Button
              :label="$t('ADS.OPERATIONS_HISTORY.CLOSE')"
              @click="closeOperationsHistoryDialog"
            />
          </div>
        </div>
      </woot-modal>
    </template>
  </SettingsLayout>
</template>

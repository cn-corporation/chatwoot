<script setup>
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
const showErrorLogsDialog = ref(false);
const selectedAd = ref({});
const testTelegramId = ref('');

const records = computed(() => getters['ads/getAds'].value);
const uiFlags = computed(() => getters['ads/getUIFlags'].value);
const inboxes = computed(() => getters['inboxes/getInboxes'].value);

const deleteMessage = computed(() => ` ${selectedAd.value.name}?`);

const getSendOperation = adId => {
  return getters['ads/getSendOperation'].value(adId);
};

onMounted(async () => {
  await Promise.all([store.dispatch('inboxes/get'), store.dispatch('ads/get')]);
  await store.dispatch('ads/getLatestSendOperations');
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

const getErrorLogs = computed(() => {
  if (!selectedAd.value.id) return [];
  return getters['ads/getErrorLogs'].value(selectedAd.value.id);
});

const tableHeaders = computed(() => {
  return [
    t('ADS.LIST.TABLE_HEADER.NAME'),
    t('ADS.LIST.TABLE_HEADER.SOURCE_CHANNEL'),
    t('ADS.LIST.TABLE_HEADER.FILTER'),
    t('ADS.LIST.TABLE_HEADER.CREATED_AT'),
    t('ADS.LIST.TABLE_HEADER.ACTIONS'),
  ];
});

const getFilterSummary = ad => {
  if (!ad.jsonFilter) return null;

  const parts = [];
  const { categories, contact_attributes } = ad.jsonFilter;

  if (categories && categories.length > 0) {
    parts.push(`${categories.length} ${t('ADS.FILTER_SUMMARY.LABELS')}`);
  }

  if (contact_attributes) {
    const attrCount = Object.values(contact_attributes).filter(
      v => (Array.isArray(v) && v.length > 0) || v === true
    ).length;
    if (attrCount > 0) {
      parts.push(`${attrCount} ${t('ADS.FILTER_SUMMARY.ATTRIBUTES')}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : null;
};

const getSourceChannelName = adSourceId => {
  if (!adSourceId) return '-';
  const inbox = inboxes.value.find(i => i.id === adSourceId);
  return inbox ? inbox.name : '-';
};

const formatDate = dateString => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const formatDateTime = dateString => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const openErrorLogsDialog = async ad => {
  selectedAd.value = ad;
  await store.dispatch('ads/getErrorLogs', ad.id);
  showErrorLogsDialog.value = true;
};

const closeErrorLogsDialog = () => {
  showErrorLogsDialog.value = false;
};

const exportErrorLogsToExcel = () => {
  const errorLogs = getErrorLogs.value;
  if (!errorLogs || errorLogs.length === 0) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('ADS.ERROR_LOGS.EMPTY'),
    });
    return;
  }

  const csvContent = [
    ['Telegram ID', 'Error Message', 'Timestamp'].join(','),
    ...errorLogs.map(log =>
      [
        log.tgid,
        `"${(log.tgErrorText || '').replace(/"/g, '""')}"`,
        formatDateTime(log.createdAt),
      ].join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `ad-errors-${selectedAd.value.name}-${Date.now()}.csv`
  );
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
            <Button
              icon="i-lucide-circle-plus"
              :label="$t('ADS.HEADER_BTN_TXT')"
            />
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
          <tr v-for="ad in records" :key="ad.id" class="hover:bg-n-slate-2">
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <span class="font-medium">{{ ad.name }}</span>
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              {{ getSourceChannelName(ad.chatwootSourceId || ad.sourceId) }}
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <span
                v-if="getFilterSummary(ad)"
                class="px-2 py-1 text-xs bg-woot-50 text-woot-600 rounded"
              >
                {{ getFilterSummary(ad) }}
              </span>
              <span v-else class="text-xs text-n-slate-10">
                {{ $t('ADS.FILTER_SUMMARY.ALL_CONTACTS') }}
              </span>
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              {{ formatDate(ad.createdAt) }}
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <div class="flex gap-2 flex-wrap">
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.VIEW_STATUS')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-eye"
                  @click="openStatusDialog(ad)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.START_SEND')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-send"
                  color-scheme="primary"
                  :disabled="uiFlags.isStartingSend"
                  @click="startSendAd(ad)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.STOP_SEND')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-square"
                  color-scheme="warning"
                  :disabled="uiFlags.isStoppingSend"
                  @click="stopSendAd(ad)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.TEST_AD')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-flask-conical"
                  @click="openTestAdDialog(ad)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.DELETE_SENT')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-mail-x"
                  color-scheme="warning"
                  @click="openDeleteSentMessagesDialog(ad)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.VIEW_ERRORS')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-alert-circle"
                  color-scheme="alert"
                  @click="openErrorLogsDialog(ad)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.EDIT')"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-pencil"
                  @click="editAd(ad.id)"
                />
                <Button
                  v-tooltip.top="$t('ADS.ACTIONS.DELETE')"
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
      <woot-modal v-model:show="showTestAdDialog" :on-close="closeTestAdDialog">
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
      <woot-modal v-model:show="showStatusDialog" :on-close="closeStatusDialog">
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
                  'text-gray-600':
                    !getSendOperation(selectedAd.id).isRunning &&
                    !getSendOperation(selectedAd.id).cancelled,
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
          <div
            v-if="uiFlags.isFetchingOperations"
            class="flex justify-center py-8"
          >
            <p class="text-sm text-n-slate-11">
              {{ $t('ADS.OPERATIONS_HISTORY.LOADING') }}
            </p>
          </div>
          <div
            v-else-if="!getSendOperationsHistory.length"
            class="flex justify-center py-8"
          >
            <p class="text-sm text-n-slate-11">
              {{ $t('ADS.OPERATIONS_HISTORY.EMPTY') }}
            </p>
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
                      'text-gray-600':
                        !operation.isRunning && !operation.cancelled,
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
                  <p class="text-xs text-n-slate-11">
                    {{ $t('ADS.STATUS.TOTAL') }}
                  </p>
                  <p class="text-sm font-semibold">
                    {{ operation.totalCount }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">
                    {{ $t('ADS.STATUS.SENT') }}
                  </p>
                  <p class="text-sm font-semibold">{{ operation.sentCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">
                    {{ $t('ADS.STATUS.SUCCESS') }}
                  </p>
                  <p class="text-sm font-semibold text-green-600">
                    {{ operation.successCount }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">
                    {{ $t('ADS.STATUS.FAILED') }}
                  </p>
                  <p class="text-sm font-semibold text-red-600">
                    {{ operation.failedCount }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">
                    {{ $t('ADS.STATUS.DELETED') }}
                  </p>
                  <p class="text-sm font-semibold text-orange-600">
                    {{ operation.deletedCount }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-n-slate-11">
                    {{ $t('ADS.STATUS.LEFT') }}
                  </p>
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
      <woot-modal
        v-model:show="showErrorLogsDialog"
        :on-close="closeErrorLogsDialog"
        size="large"
      >
        <div class="flex flex-col gap-4 p-6">
          <h2 class="text-lg font-semibold">
            {{ $t('ADS.ERROR_LOGS.TITLE') }}
          </h2>
          <div
            v-if="uiFlags.isFetchingErrorLogs"
            class="flex justify-center py-8"
          >
            <p class="text-sm text-n-slate-11">
              {{ $t('ADS.ERROR_LOGS.LOADING') }}
            </p>
          </div>
          <div
            v-else-if="!getErrorLogs.length"
            class="flex justify-center py-8"
          >
            <p class="text-sm text-n-slate-11">
              {{ $t('ADS.ERROR_LOGS.EMPTY') }}
            </p>
          </div>
          <div v-else class="max-h-96 overflow-y-auto">
            <table class="min-w-full divide-y divide-n-weak">
              <thead class="sticky top-0 bg-white">
                <tr>
                  <th
                    class="py-3 px-4 text-left text-xs font-semibold text-n-slate-11 bg-n-slate-2"
                  >
                    {{ $t('ADS.ERROR_LOGS.TABLE_HEADER.TELEGRAM_ID') }}
                  </th>
                  <th
                    class="py-3 px-4 text-left text-xs font-semibold text-n-slate-11 bg-n-slate-2"
                  >
                    {{ $t('ADS.ERROR_LOGS.TABLE_HEADER.ERROR_TEXT') }}
                  </th>
                  <th
                    class="py-3 px-4 text-left text-xs font-semibold text-n-slate-11 bg-n-slate-2"
                  >
                    {{ $t('ADS.ERROR_LOGS.TABLE_HEADER.TIMESTAMP') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-n-weak">
                <tr
                  v-for="log in getErrorLogs"
                  :key="`${log.tgid}-${log.createdAt}`"
                  class="hover:bg-n-slate-2"
                >
                  <td class="py-3 px-4 text-sm">
                    {{ log.tgid }}
                  </td>
                  <td class="py-3 px-4 text-sm">
                    {{ log.tgErrorText }}
                  </td>
                  <td class="py-3 px-4 text-sm">
                    {{ formatDateTime(log.createdAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex gap-2 justify-end">
            <Button
              v-if="getErrorLogs.length > 0"
              variant="ghost"
              icon="i-lucide-download"
              :label="$t('ADS.ERROR_LOGS.EXPORT_EXCEL')"
              @click="exportErrorLogsToExcel"
            />
            <Button
              :label="$t('ADS.ERROR_LOGS.CLOSE')"
              @click="closeErrorLogsDialog"
            />
          </div>
        </div>
      </woot-modal>
    </template>
  </SettingsLayout>
</template>

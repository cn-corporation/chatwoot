<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore, useStoreGetters } from 'dashboard/composables/store';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SettingsLayout from '../SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import chatwootExtraAPI from 'dashboard/api/chatwootExtra';

const store = useStore();
const getters = useStoreGetters();
const { t } = useI18n();

const dateFrom = ref('');
const dateTo = ref('');
const pollTimer = ref(null);

const records = computed(
  () => getters['conversationExport/getConversationExports'].value
);
const activeExport = computed(
  () => getters['conversationExport/getActiveExport'].value
);
const uiFlags = computed(() => getters['conversationExport/getUIFlags'].value);

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const dashOffset = computed(() => {
  const percent = activeExport.value ? activeExport.value.progress : 0;
  return CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
});

const stopPolling = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
};

const startPolling = () => {
  if (pollTimer.value) return;
  pollTimer.value = setInterval(async () => {
    const active = activeExport.value;
    if (!active) {
      stopPolling();
      return;
    }
    await store.dispatch('conversationExport/getStatus', active.id);
    if (!activeExport.value) {
      stopPolling();
      await store.dispatch('conversationExport/get');
    }
  }, 2000);
};

onMounted(async () => {
  await store.dispatch('conversationExport/get');
  if (activeExport.value) startPolling();
});

onBeforeUnmount(stopPolling);

const toIsoStart = value => `${value}T00:00:00.000Z`;
const toIsoEnd = value => `${value}T23:59:59.999Z`;

const startExport = async () => {
  if (!dateFrom.value || !dateTo.value || dateFrom.value > dateTo.value) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, {
      message: t('CONVERSATION_EXPORT.VALIDATION'),
    });
    return;
  }
  try {
    const result = await store.dispatch('conversationExport/create', {
      dateFrom: toIsoStart(dateFrom.value),
      dateTo: toIsoEnd(dateTo.value),
    });
    if (result) {
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('CONVERSATION_EXPORT.STARTED'),
      });
      startPolling();
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, { message: error.message });
  }
};

const stopExport = async () => {
  const active = activeExport.value;
  if (!active) return;
  try {
    const result = await store.dispatch('conversationExport/stop', active.id);
    if (result) {
      stopPolling();
      emitter.emit(BUS_EVENTS.SHOW_TOAST, {
        message: t('CONVERSATION_EXPORT.STOPPED'),
      });
      await store.dispatch('conversationExport/get');
    }
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, { message: error.message });
  }
};

const downloadExport = async record => {
  const url = chatwootExtraAPI.getConversationExportDownloadUrl(record.id);
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversations_export_${record.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    emitter.emit(BUS_EVENTS.SHOW_TOAST, { message: error.message });
  }
};

const formatDateTime = value => (value ? new Date(value).toLocaleString() : '');
const formatRange = record =>
  `${new Date(record.dateFrom).toLocaleDateString()} – ${new Date(
    record.dateTo
  ).toLocaleDateString()}`;

const stageLabel = stage => {
  switch (stage) {
    case 'preprocessing':
      return t('CONVERSATION_EXPORT.STAGE.preprocessing');
    case 'loading':
      return t('CONVERSATION_EXPORT.STAGE.loading');
    case 'finalizing':
      return t('CONVERSATION_EXPORT.STAGE.finalizing');
    default:
      return stage;
  }
};

const statusLabel = status => {
  switch (status) {
    case 'processing':
      return t('CONVERSATION_EXPORT.STATUS.processing');
    case 'completed':
      return t('CONVERSATION_EXPORT.STATUS.completed');
    case 'cancelled':
      return t('CONVERSATION_EXPORT.STATUS.cancelled');
    case 'failed':
      return t('CONVERSATION_EXPORT.STATUS.failed');
    default:
      return status;
  }
};
</script>

<template>
  <SettingsLayout>
    <template #header>
      <BaseSettingsHeader
        :title="$t('CONVERSATION_EXPORT.HEADER')"
        :description="$t('CONVERSATION_EXPORT.DESCRIPTION')"
      />
    </template>
    <template #body>
      <div class="flex flex-col gap-6">
        <div class="flex flex-wrap items-end gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-n-slate-12">
              {{ $t('CONVERSATION_EXPORT.DATE_FROM') }}
            </label>
            <input
              v-model="dateFrom"
              type="date"
              class="px-3 py-2 border border-n-slate-6 rounded-lg"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-n-slate-12">
              {{ $t('CONVERSATION_EXPORT.DATE_TO') }}
            </label>
            <input
              v-model="dateTo"
              type="date"
              class="px-3 py-2 border border-n-slate-6 rounded-lg"
            />
          </div>
          <Button
            :label="$t('CONVERSATION_EXPORT.START')"
            icon="i-lucide-download"
            :is-disabled="!!activeExport || uiFlags.isCreating"
            @click="startExport"
          />
        </div>

        <div
          v-if="activeExport"
          class="flex items-center gap-6 p-4 border border-n-weak rounded-lg"
        >
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              :r="RADIUS"
              fill="none"
              stroke="currentColor"
              class="text-n-slate-4"
              stroke-width="10"
            />
            <circle
              cx="60"
              cy="60"
              :r="RADIUS"
              fill="none"
              stroke="currentColor"
              class="text-woot-500"
              stroke-width="10"
              stroke-linecap="round"
              :stroke-dasharray="CIRCUMFERENCE"
              :stroke-dashoffset="dashOffset"
              transform="rotate(-90 60 60)"
            />
            <text
              x="60"
              y="64"
              text-anchor="middle"
              font-size="18"
              font-weight="600"
              class="fill-n-slate-12"
            >
              {{ `${activeExport.progress}%` }}
            </text>
          </svg>
          <div class="flex flex-col gap-2">
            <p class="text-sm text-n-slate-11">
              {{ stageLabel(activeExport.stage) }}
            </p>
            <p
              v-if="activeExport.conversationsTotal !== null"
              class="text-sm text-n-slate-11"
            >
              {{
                `${activeExport.conversationsProcessed} / ${activeExport.conversationsTotal}`
              }}
            </p>
            <Button
              :label="$t('CONVERSATION_EXPORT.STOP')"
              color-scheme="warning"
              variant="ghost"
              icon="i-lucide-square"
              :is-disabled="uiFlags.isStopping"
              @click="stopExport"
            />
          </div>
        </div>

        <table class="w-full divide-y divide-n-weak text-n-slate-11">
          <thead>
            <tr>
              <th class="py-3 text-left text-sm font-semibold">
                {{ $t('CONVERSATION_EXPORT.TABLE.RANGE') }}
              </th>
              <th class="py-3 text-left text-sm font-semibold">
                {{ $t('CONVERSATION_EXPORT.TABLE.CREATED_AT') }}
              </th>
              <th class="py-3 text-left text-sm font-semibold">
                {{ $t('CONVERSATION_EXPORT.TABLE.STATUS') }}
              </th>
              <th class="py-3 text-left text-sm font-semibold">
                {{ $t('CONVERSATION_EXPORT.TABLE.MESSAGES') }}
              </th>
              <th class="py-3 text-left text-sm font-semibold">
                {{ $t('CONVERSATION_EXPORT.TABLE.ACTIONS') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-n-weak">
            <tr
              v-for="record in records"
              :key="record.id"
              class="hover:bg-n-slate-2"
            >
              <td class="py-3 text-sm">{{ formatRange(record) }}</td>
              <td class="py-3 text-sm">
                {{ formatDateTime(record.createdAt) }}
              </td>
              <td class="py-3 text-sm">
                {{ statusLabel(record.status) }}
              </td>
              <td class="py-3 text-sm">{{ record.messageCount }}</td>
              <td class="py-3 text-sm">
                <Button
                  v-if="record.status === 'completed'"
                  variant="ghost"
                  size="small"
                  icon="i-lucide-download"
                  :label="$t('CONVERSATION_EXPORT.DOWNLOAD')"
                  @click="downloadExport(record)"
                />
              </td>
            </tr>
            <tr v-if="!records.length">
              <td colspan="5" class="py-8 text-center text-sm text-n-slate-10">
                {{ $t('CONVERSATION_EXPORT.EMPTY') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </SettingsLayout>
</template>

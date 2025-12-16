<script setup>
import { ref, watch, onMounted } from 'vue';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { useAlert } from 'dashboard/composables';
import NextButton from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  telegramId: {
    type: Number,
    required: true,
  },
  chatwootChannelId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(['close']);

const adsLogs = ref([]);
const isLoading = ref(false);

const loadAdsLogs = async () => {
  if (!props.telegramId) {
    return;
  }

  isLoading.value = true;
  try {
    const response = await ChatwootExtraAPI.getAdLogsByUser(
      props.telegramId,
      props.chatwootChannelId
    );
    if (response.success && response.data) {
      adsLogs.value = response.data;
    }
  } catch (error) {
    useAlert('Failed to load ads logs');
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.show,
  newValue => {
    if (newValue) {
      loadAdsLogs();
    }
  }
);

onMounted(() => {
  if (props.show) {
    loadAdsLogs();
  }
});

const formatDate = date => {
  if (!date) return '-';
  return new Date(date).toLocaleString();
};

const getDeliveryStatus = log => {
  if (log.isDeleted) {
    return { text: 'Deleted', class: 'text-red-600' };
  }
  if (log.isDelivered) {
    return { text: 'Delivered', class: 'text-green-600' };
  }
  return { text: 'Failed', class: 'text-orange-600' };
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <woot-modal :show="show" :on-close="handleClose">
    <div class="flex flex-col max-h-[80vh]">
      <woot-modal-header
        :header-title="`Ads History for Telegram ID: ${telegramId}`"
        header-content="List of all ads sent to this user"
      />

      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="isLoading" class="flex items-center justify-center h-32">
          <span class="text-n-slate-11">Loading...</span>
        </div>

        <div
          v-else-if="!adsLogs.length"
          class="flex items-center justify-center h-32"
        >
          <span class="text-n-slate-11">No ads logs found for this user</span>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="log in adsLogs"
            :key="log.id"
            class="border border-n-slate-6 rounded-lg p-4 bg-n-slate-1"
          >
            <div class="flex justify-between items-start mb-2">
              <h4 class="text-base font-semibold text-n-slate-12">
                {{ log.adName }}
              </h4>
              <span
                class="text-sm font-medium"
                :class="[getDeliveryStatus(log).class]"
              >
                {{ getDeliveryStatus(log).text }}
              </span>
            </div>

            <div class="space-y-1 text-sm text-n-slate-11">
              <div class="flex justify-between">
                <span>Delivery Date:</span>
                <span class="text-n-slate-12">{{
                  formatDate(log.createdAt)
                }}</span>
              </div>

              <div v-if="log.messageId" class="flex justify-between">
                <span>Message ID:</span>
                <span class="text-n-slate-12">{{ log.messageId }}</span>
              </div>

              <div v-if="log.tgErrorText" class="flex flex-col mt-2">
                <span class="text-red-600 font-medium">Error:</span>
                <span class="text-red-600 text-xs mt-1">{{
                  log.tgErrorText
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 p-4 border-t border-n-slate-6">
        <NextButton @click="handleClose"> Close </NextButton>
      </div>
    </div>
  </woot-modal>
</template>

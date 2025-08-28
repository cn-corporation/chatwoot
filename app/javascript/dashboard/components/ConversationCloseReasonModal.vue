<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import Modal from 'dashboard/components/Modal.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  conversationId: {
    type: Number,
    required: true,
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'success']);

const { t } = useI18n();
const store = useStore();

const isOpen = ref(props.show);
const selectedReason = ref('');
const customReason = ref('');
const isSubmitting = ref(false);
const successResolution = ref(true); // true = Успешно, false = Не успешно

// Watch for prop changes
import { watch } from 'vue';
watch(
  () => props.show,
  newVal => {
    isOpen.value = newVal;
    // Reset form when modal opens
    if (newVal) {
      selectedReason.value = '';
      customReason.value = '';
      successResolution.value = true;
    }
  }
);

// Predefined reasons for unsuccessful resolution
const unsuccessfulReasons = computed(() => [
  { value: 'no_reason', label: t('CLOSE_REASON.NO_REASON') },
  { value: 'client_block_bot', label: t('CLOSE_REASON.CLIENT_BLOCK_BOT') },
  { value: 'no_answer', label: t('CLOSE_REASON.NO_ANSWER') },
  { value: 'better_offers', label: t('CLOSE_REASON.BETTER_OFFERS') },
  { value: 'no_deposit', label: t('CLOSE_REASON.NO_DEPOSIT') },
  { value: 'no_games', label: t('CLOSE_REASON.NO_GAMES') },
  { value: 'bad_reputation', label: t('CLOSE_REASON.BAD_REPUTATION') },
  { value: 'bad_ui', label: t('CLOSE_REASON.BAD_UI') },
  { value: 'custom', label: t('CLOSE_REASON.CUSTOM') },
]);

const canSubmit = computed(() => {
  if (successResolution.value) {
    return true; // Can always submit successful resolution
  }
  // For unsuccessful, need a reason
  if (selectedReason.value === 'custom') {
    return customReason.value.trim().length > 0;
  }
  return selectedReason.value !== '';
});

const closeModal = () => {
  isOpen.value = false;
  emit('close');
};

const submitReason = async () => {
  if (!canSubmit.value) return;

  isSubmitting.value = true;

  try {
    // Prepare the reason data
    let reason = '';
    let resolutionStatus = '';

    if (successResolution.value) {
      resolutionStatus = 'successful';
      reason = 'Successful resolution';
    } else {
      resolutionStatus = 'unsuccessful';
      if (selectedReason.value === 'custom') {
        reason = customReason.value;
      } else {
        const reasonObj = unsuccessfulReasons.value.find(
          r => r.value === selectedReason.value
        );
        reason = reasonObj ? reasonObj.label : selectedReason.value;
      }
    }

    // Save resolution reason to conversation custom attributes
    await store.dispatch('updateCustomAttributes', {
      conversationId: props.conversationId,
      customAttributes: {
        resolution_status: resolutionStatus,
        resolution_reason: reason,
        resolved_at: new Date().toISOString(),
      },
    });

    // Mark conversation as resolved
    await store.dispatch('toggleStatus', {
      conversationId: props.conversationId,
      status: 'resolved',
    });

    useAlert(t('CLOSE_REASON.SUCCESS_MESSAGE'));
    emit('success', { status: resolutionStatus, reason });
    closeModal();
  } catch (error) {
    useAlert(t('CLOSE_REASON.ERROR_MESSAGE'));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Modal v-model:show="isOpen" :on-close="closeModal" @close="closeModal">
    <div class="flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-n-slate-5">
        <h1 class="text-n-slate-12 text-lg font-semibold">
          {{ $t('CLOSE_REASON.TITLE') }}
        </h1>
      </div>

      <!-- Body -->
      <div class="flex flex-col gap-4 p-4">
        <!-- Resolution type selector -->
        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium text-n-slate-11">
            {{ $t('CLOSE_REASON.RESOLUTION_TYPE') }}
          </p>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="successResolution"
                type="radio"
                :value="true"
                class="text-blue-600"
              />
              <span class="text-sm">{{ $t('CLOSE_REASON.SUCCESSFUL') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="successResolution"
                type="radio"
                :value="false"
                class="text-blue-600"
              />
              <span class="text-sm">{{ $t('CLOSE_REASON.UNSUCCESSFUL') }}</span>
            </label>
          </div>
        </div>

        <!-- Reason selector (only for unsuccessful) -->
        <div v-if="!successResolution" class="flex flex-col gap-2">
          <p class="text-sm font-medium text-n-slate-11">
            {{ $t('CLOSE_REASON.SELECT_REASON') }}
          </p>

          <!-- Predefined reasons -->
          <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
            <label
              v-for="reason in unsuccessfulReasons"
              :key="reason.value"
              class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-n-slate-3 transition-colors"
              :class="{ 'bg-n-slate-3': selectedReason === reason.value }"
            >
              <input
                v-model="selectedReason"
                type="radio"
                :value="reason.value"
                class="text-blue-600"
              />
              <span class="text-sm">{{ reason.label }}</span>
            </label>
          </div>

          <!-- Custom reason input -->
          <div v-if="selectedReason === 'custom'" class="mt-2">
            <textarea
              v-model="customReason"
              :placeholder="$t('CLOSE_REASON.CUSTOM_PLACEHOLDER')"
              class="w-full p-2 border border-n-slate-5 rounded-lg resize-none"
              rows="3"
            />
          </div>
        </div>

        <!-- Info message -->
        <div
          v-if="successResolution"
          class="p-3 bg-green-50 border border-green-200 rounded-lg"
        >
          <p class="text-sm text-green-800">
            {{ $t('CLOSE_REASON.SUCCESS_INFO') }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-2 p-4 border-t border-n-slate-5">
        <Button
          faded
          slate
          :label="$t('CLOSE_REASON.CANCEL')"
          @click="closeModal"
        />
        <Button
          :label="$t('CLOSE_REASON.SAVE')"
          :is-loading="isSubmitting"
          :disabled="!canSubmit"
          @click="submitReason"
        />
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.max-h-64 {
  max-height: 16rem;
}
</style>

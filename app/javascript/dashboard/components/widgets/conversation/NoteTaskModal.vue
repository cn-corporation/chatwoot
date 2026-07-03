<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import Modal from 'dashboard/components/Modal.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  currentChat: {
    type: Object,
    default: () => ({}),
  },
  type: {
    type: String,
    default: 'note',
  },
});

const emit = defineEmits(['close']);

const store = useStore();
const { t } = useI18n();

const isOpen = ref(props.show);
const message = ref('');
const isSaving = ref(false);
const textareaRef = ref(null);

const isTask = computed(() => props.type === 'task');

const title = computed(() =>
  isTask.value ? t('TODO.ADD_TASK') : t('TODO.ADD_NOTE')
);

const currentUser = computed(() => store.getters.getCurrentUser);

const sender = computed(() => ({
  name: currentUser.value.name,
  thumbnail: currentUser.value.avatar_url,
}));

const isSaveDisabled = computed(() => !message.value.trim() || isSaving.value);

watch(
  () => props.show,
  newVal => {
    isOpen.value = newVal;
    if (newVal) {
      message.value = '';
      nextTick(() => textareaRef.value?.focus());
    }
  }
);

const closeModal = () => {
  isOpen.value = false;
  emit('close');
};

const sendNote = async () => {
  await store.dispatch('createPendingMessageAndSend', {
    conversationId: props.currentChat.id,
    message: message.value,
    private: true,
    sender: sender.value,
  });
};

const sendTask = async () => {
  const taskResponse = await store.dispatch('tasks/createTask', {
    conversationId: props.currentChat.id,
    accountId: props.currentChat.account_id,
    message: message.value,
    operatorId: currentUser.value.id,
    operatorName: currentUser.value.name || currentUser.value.available_name,
  });

  if (!taskResponse?.success || !taskResponse?.data) {
    throw new Error(t('CONVERSATION.REPLYBOX.TASK_CREATE_ERROR'));
  }

  await store.dispatch('createPendingMessageAndSend', {
    conversationId: props.currentChat.id,
    message: message.value,
    private: true,
    sender: sender.value,
    content_attributes: { task_id: taskResponse.data.id },
  });
};

const onSave = async () => {
  if (isSaveDisabled.value) return;
  isSaving.value = true;
  try {
    if (isTask.value) {
      await sendTask();
      useAlert(t('TODO.TASK_ADDED'));
    } else {
      await sendNote();
      useAlert(t('TODO.NOTE_ADDED'));
    }
    closeModal();
  } catch (error) {
    const errorMessage =
      error?.response?.data?.error ||
      error?.message ||
      t('CONVERSATION.MESSAGE_ERROR');
    useAlert(errorMessage);
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <Modal v-model:show="isOpen" :on-close="closeModal" @close="closeModal">
    <div class="flex flex-col">
      <div class="p-4 border-b border-n-slate-5">
        <h1 class="text-n-slate-12 text-lg font-semibold">
          {{ title }}
        </h1>
      </div>

      <div class="flex flex-col gap-4 p-4">
        <textarea
          ref="textareaRef"
          v-model="message"
          rows="4"
          class="w-full p-2 text-sm rounded-lg resize-none outline-none bg-n-alpha-black2 text-n-slate-12 border border-n-weak focus:border-n-brand"
          :placeholder="$t('TODO.NOTE_TASK_PLACEHOLDER')"
          @keydown.meta.enter="onSave"
          @keydown.ctrl.enter="onSave"
        />
      </div>

      <div class="flex justify-end gap-2 p-4 border-t border-n-slate-5">
        <button class="button button--light" @click="closeModal">
          {{ $t('TODO.CLOSE') }}
        </button>
        <button class="button" :disabled="isSaveDisabled" @click="onSave">
          {{ $t('TODO.SAVE') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

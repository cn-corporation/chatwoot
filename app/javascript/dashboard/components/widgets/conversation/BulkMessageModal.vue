<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import MessageApi from 'dashboard/api/inbox/message';

const props = defineProps({
  selectedConversations: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['close', 'sendComplete']);

const { t } = useI18n();

const dialogRef = ref(null);
const message = ref('');
const attachment = ref(null);
const isSending = ref(false);
const sendProgress = ref(0);

const canSend = computed(() => {
  return message.value.trim().length > 0 || attachment.value;
});

const progressText = computed(() => {
  return t('BULK_ACTION.BULK_MESSAGE_MODE.SEND_PROGRESS', {
    current: sendProgress.value,
    total: props.selectedConversations.length,
  });
});

function onFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    attachment.value = file;
  }
}

function removeAttachment() {
  attachment.value = null;
}

async function sendMessages() {
  if (!canSend.value || isSending.value) return;

  isSending.value = true;
  sendProgress.value = 0;

  const sendToConversation = conversationId =>
    MessageApi.create({
      conversationId,
      message: message.value,
      private: false,
      files: attachment.value ? [attachment.value] : undefined,
    });

  const results = await Promise.allSettled(
    props.selectedConversations.map(async conversationId => {
      const result = await sendToConversation(conversationId);
      sendProgress.value += 1;
      return result;
    })
  );

  const failures = results.filter(r => r.status === 'rejected');

  isSending.value = false;

  if (failures.length === 0) {
    useAlert(t('BULK_ACTION.BULK_MESSAGE_MODE.SEND_SUCCESS'));
    emit('sendComplete');
  } else {
    useAlert(
      t('BULK_ACTION.BULK_MESSAGE_MODE.SEND_PARTIAL_FAILURE', {
        failCount: failures.length,
      })
    );
    emit('close');
  }
}

function close() {
  if (!isSending.value) {
    emit('close');
  }
}

onMounted(() => {
  dialogRef.value?.open();
});
</script>

<template>
  <Dialog
    ref="dialogRef"
    type="edit"
    :title="$t('BULK_ACTION.BULK_MESSAGE_MODE.MODAL_TITLE')"
    :description="
      $t('BULK_ACTION.BULK_MESSAGE_MODE.MODAL_DESCRIPTION', {
        count: selectedConversations.length,
      })
    "
    :confirm-button-label="$t('BULK_ACTION.BULK_MESSAGE_MODE.SEND_BUTTON')"
    :is-loading="isSending"
    :disable-confirm-button="!canSend"
    @confirm="sendMessages"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <textarea
        v-model="message"
        :placeholder="$t('BULK_ACTION.BULK_MESSAGE_MODE.MESSAGE_PLACEHOLDER')"
        :disabled="isSending"
        rows="4"
        class="w-full p-3 border rounded-lg resize-none border-n-weak bg-n-solid-1 text-n-slate-12 focus:ring-2 focus:ring-n-brand focus:border-transparent"
      />

      <div class="flex items-center gap-2">
        <label
          class="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-lg border border-n-weak hover:bg-n-alpha-1"
          :class="{ 'opacity-50 cursor-not-allowed': isSending }"
        >
          <span class="i-lucide-paperclip" />
          {{ $t('BULK_ACTION.BULK_MESSAGE_MODE.ATTACH_FILE') }}
          <input
            type="file"
            class="hidden"
            :disabled="isSending"
            @change="onFileSelect"
          />
        </label>

        <div
          v-if="attachment"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-n-alpha-1"
        >
          <span class="text-sm truncate max-w-[200px]">{{
            attachment.name
          }}</span>
          <button
            type="button"
            class="i-lucide-x text-n-slate-11 hover:text-n-ruby-9"
            :disabled="isSending"
            @click="removeAttachment"
          />
        </div>
      </div>

      <p v-if="isSending" class="text-sm text-n-slate-11">
        {{ progressText }}
      </p>
    </div>
  </Dialog>
</template>

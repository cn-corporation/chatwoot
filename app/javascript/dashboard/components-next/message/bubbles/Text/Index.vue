<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseBubble from 'next/message/bubbles/Base.vue';
import FormattedContent from './FormattedContent.vue';
import AttachmentChips from 'next/message/chips/AttachmentChips.vue';
import TranslationToggle from 'dashboard/components-next/message/TranslationToggle.vue';
import VoiceIndicator from 'dashboard/components-next/message/VoiceIndicator.vue';
import Checkbox from 'dashboard/components-next/checkbox/Checkbox.vue';
import { MESSAGE_TYPES } from '../../constants';
import { useMessageContext } from '../../provider.js';
import { useEmitter } from 'dashboard/composables/emitter';
import { useTranslations } from 'dashboard/composables/useTranslations';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { useAlert } from 'dashboard/composables';
import { useStore } from 'vuex';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const {
  id,
  content,
  attachments,
  contentAttributes,
  messageType,
  conversationId,
} = useMessageContext();

const { hasTranslations, translationContent } =
  useTranslations(contentAttributes);

const store = useStore();
const { t } = useI18n();
const renderOriginal = ref(true);
const isTranslating = ref(false);
const localTranslation = ref(null);
const taskData = ref(null);
const isLoadingTask = ref(false);
const isCompletingTask = ref(false);

const taskId = computed(() => {
  return contentAttributes.value?.task_id || contentAttributes.value?.taskId;
});

const hasTask = computed(() => {
  return !!taskId.value;
});

const isTaskCompleted = computed(() => {
  return taskData.value?.completed || false;
});

const completedByName = computed(() => {
  return taskData.value?.completedByName || null;
});

const effectiveTranslation = computed(
  () => localTranslation.value || translationContent.value
);

const hasAnyTranslation = computed(
  () => !!localTranslation.value || hasTranslations.value
);

const renderContent = computed(() => {
  if (!renderOriginal.value && effectiveTranslation.value) {
    return effectiveTranslation.value;
  }
  return content.value;
});

const hasContent = computed(() => !!content.value);

const isTemplate = computed(() => {
  return messageType.value === MESSAGE_TYPES.TEMPLATE;
});

const isEmpty = computed(() => {
  return !content.value && !attachments.value?.length;
});

const voiceStatus = computed(() => {
  return contentAttributes.value?.voice_transcription?.status ?? null;
});

const handleSeeOriginal = async () => {
  if (renderOriginal.value && !hasAnyTranslation.value) {
    if (isTranslating.value || !content.value) return;
    isTranslating.value = true;
    try {
      const accountId = store.getters.getCurrentAccountId;
      const account = store.getters['accounts/getAccount'](accountId);
      const supported = ['ru', 'kk', 'uk'];
      const targetLang = supported.includes(account?.locale)
        ? account.locale
        : 'ru';
      const result = await ChatwootExtraAPI.translateText({
        text: content.value,
        targetLang,
      });
      if (result?.translatedText) {
        localTranslation.value = result.translatedText;
      } else {
        return;
      }
    } catch (error) {
      return;
    } finally {
      isTranslating.value = false;
    }
  }
  renderOriginal.value = !renderOriginal.value;
};

const loadTask = async () => {
  if (!taskId.value || isLoadingTask.value) return;

  isLoadingTask.value = true;
  try {
    const response = await ChatwootExtraAPI.getTask(taskId.value);
    if (response?.success && response?.data) {
      taskData.value = response.data;
      emitter.emit(BUS_EVENTS.TASK_STATUS_LOADED, {
        taskId: taskId.value,
        messageId: id.value,
        conversationId: conversationId.value,
        completed: response.data.completed ?? false,
      });
    }
  } catch (error) {
    // Silently fail if task not found
  } finally {
    isLoadingTask.value = false;
  }
};

const handleTaskComplete = async checked => {
  if (!checked || isTaskCompleted.value || isCompletingTask.value) return;

  isCompletingTask.value = true;
  try {
    const currentUser = store.getters.getCurrentUser;
    const response = await store.dispatch('tasks/completeTask', {
      taskId: taskId.value,
      completed: true,
      completedBy: currentUser.id,
      completedByName: currentUser.name || currentUser.available_name,
    });

    if (response?.success && response?.data) {
      taskData.value = response.data;
      emitter.emit(BUS_EVENTS.TASK_COMPLETED, {
        taskId: taskId.value,
        messageId: id.value,
        conversationId: conversationId.value,
      });
      useAlert(t('CONVERSATION.REPLYBOX.TASK_COMPLETED'));
    } else {
      useAlert(t('CONVERSATION.REPLYBOX.TASK_COMPLETE_ERROR'));
    }
  } catch (error) {
    const errorMessage =
      error?.response?.data?.error ||
      t('CONVERSATION.REPLYBOX.TASK_COMPLETE_ERROR');
    useAlert(errorMessage);
  } finally {
    isCompletingTask.value = false;
  }
};

// Reflect completions made by other users, delivered over SSE with the full
// task attached. Our own local completion sets taskData directly and emits
// without a task payload, so it is ignored here.
useEmitter(BUS_EVENTS.TASK_COMPLETED, payload => {
  if (!payload?.task || String(payload.taskId) !== String(taskId.value)) {
    return;
  }
  taskData.value = payload.task;
});

onMounted(() => {
  if (hasTask.value) {
    loadTask();
  }
});

watch(taskId, () => {
  if (hasTask.value) {
    loadTask();
  }
});
</script>

<template>
  <BaseBubble class="px-4 py-3" data-bubble-name="text">
    <div class="gap-3 flex flex-col">
      <VoiceIndicator v-if="voiceStatus" :status="voiceStatus" />
      <span v-if="isEmpty" class="text-n-slate-11">
        {{ $t('CONVERSATION.NO_CONTENT') }}
      </span>
      <AttachmentChips :attachments="attachments" class="gap-2" />
      <div v-if="hasTask && renderContent" class="flex items-start gap-2">
        <div class="flex-1">
          <FormattedContent :content="renderContent" />
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 pt-1">
          <Checkbox
            :model-value="isTaskCompleted"
            :disabled="isTaskCompleted || isCompletingTask"
            @change="e => handleTaskComplete(e.target.checked)"
          />
          <span
            v-if="isTaskCompleted && completedByName"
            class="text-xs text-n-slate-11"
            :title="
              $t('CONVERSATION.REPLYBOX.TASK_COMPLETED_BY', {
                name: completedByName,
              })
            "
          >
            {{ completedByName }}
          </span>
        </div>
      </div>
      <FormattedContent v-else-if="renderContent" :content="renderContent" />
      <TranslationToggle
        v-if="hasContent"
        class="-mt-3"
        :showing-original="renderOriginal"
        :is-loading="isTranslating"
        @toggle="handleSeeOriginal"
      />
      <template v-if="isTemplate">
        <div
          v-if="contentAttributes.submittedEmail"
          class="px-2 py-1 rounded-lg bg-n-alpha-3"
        >
          {{ contentAttributes.submittedEmail }}
        </div>
      </template>
    </div>
  </BaseBubble>
</template>

<style>
p:last-child {
  margin-bottom: 0;
}
</style>

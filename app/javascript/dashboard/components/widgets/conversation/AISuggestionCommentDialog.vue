<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import { isCommentDetailedEnough } from 'dashboard/composables/useAISuggestions';

const props = defineProps({
  suggestion: {
    type: Object,
    default: null,
  },
  mode: {
    type: String,
    default: 'send',
    validator: value => ['send', 'dismiss'].includes(value),
  },
  isSending: {
    type: Boolean,
    default: false,
  },
  hasError: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
});
const emit = defineEmits(['submit', 'cancel']);
const COMMENT_MAX_LENGTH = 2000;

const { t } = useI18n();

const dialogRef = ref(null);
const commentInput = ref(null);
const comment = ref('');
const isTooShort = ref(false);

const isDismiss = computed(() => props.mode === 'dismiss');

const canSubmit = computed(() => !!comment.value.trim());

const confidencePercent = computed(() => {
  const confidence = props.suggestion?.metadata?.confidence;
  return typeof confidence === 'number' ? Math.round(confidence * 100) : null;
});

/**
 * Opens the dialog with an empty comment and focuses it.
 */
const open = () => {
  comment.value = '';
  isTooShort.value = false;
  dialogRef.value?.open();
  nextTick(() => commentInput.value?.focus());
};

const close = () => {
  dialogRef.value?.close();
};

/**
 * Emits the trimmed comment, or asks for more detail when it has too few letters.
 */
const submit = () => {
  const text = comment.value.trim();
  if (!text || props.isSending) return;
  if (!isCommentDetailedEnough(text)) {
    isTooShort.value = true;
    return;
  }
  emit('submit', text);
};

watch(comment, () => {
  isTooShort.value = false;
});

const onKeydown = event => {
  if (event.isComposing) return;
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    submit();
  }
};

defineExpose({ open, close });
</script>

<template>
  <Dialog
    ref="dialogRef"
    :title="t('AI_SUGGESTION.REQUIRED_COMMENT.TITLE')"
    :description="
      isDismiss
        ? t('AI_SUGGESTION.REQUIRED_COMMENT.DISMISS_DESCRIPTION')
        : t('AI_SUGGESTION.REQUIRED_COMMENT.SEND_DESCRIPTION')
    "
    :confirm-button-label="
      isDismiss
        ? t('AI_SUGGESTION.REQUIRED_COMMENT.DISMISS_BUTTON')
        : t('AI_SUGGESTION.REQUIRED_COMMENT.SEND_BUTTON')
    "
    :disable-confirm-button="!canSubmit"
    :is-loading="isSending"
    @confirm="submit"
    @close="emit('cancel')"
  >
    <div class="flex flex-col gap-3">
      <div
        v-if="suggestion"
        class="px-3 py-2 rounded-lg border border-n-iris-6 bg-n-iris-3"
      >
        <div
          class="flex items-center justify-between gap-2 mb-1 text-xs font-medium text-n-iris-11"
        >
          <span>{{ t('AI_SUGGESTION.TITLE') }}</span>
          <span v-if="confidencePercent !== null">
            {{
              t('AI_SUGGESTION.REQUIRED_COMMENT.CONFIDENCE', {
                confidence: confidencePercent,
              })
            }}
          </span>
        </div>
        <p
          class="mb-0 text-sm text-n-slate-12 whitespace-pre-wrap overflow-y-auto max-h-32"
        >
          {{ suggestion.content }}
        </p>
      </div>

      <div
        class="px-3 py-2 rounded-lg border border-n-weak bg-n-solid-1 transition-colors duration-200 focus-within:border-n-iris-9"
      >
        <textarea
          ref="commentInput"
          v-model="comment"
          rows="3"
          :maxlength="COMMENT_MAX_LENGTH"
          :placeholder="t('AI_SUGGESTION.REQUIRED_COMMENT.PLACEHOLDER')"
          :aria-label="t('AI_SUGGESTION.REQUIRED_COMMENT.LABEL')"
          :readonly="isSending"
          class="block w-full h-auto max-h-40 p-0 !mb-0 text-sm leading-5 resize-none !rounded-none !bg-transparent !border-0 !outline-0 text-n-slate-12 placeholder:text-n-slate-10"
          @keydown.stop="onKeydown"
        />
      </div>

      <div
        v-if="isTooShort || hasError"
        role="alert"
        class="flex items-center gap-2 px-3 py-1.5 text-xs text-n-ruby-11 bg-n-ruby-9/10 rounded border border-n-ruby-9/20"
      >
        <span class="i-ph-warning-circle size-4 flex-shrink-0" />
        <span>{{
          isTooShort
            ? t('AI_SUGGESTION.COMMENT_TOO_SHORT')
            : errorMessage || t('AI_SUGGESTION.REQUIRED_COMMENT.ERROR')
        }}</span>
      </div>
      <span v-else class="text-xs text-n-slate-10">
        {{ t('AI_SUGGESTION.COMMENT_HINT') }}
      </span>
    </div>
  </Dialog>
</template>

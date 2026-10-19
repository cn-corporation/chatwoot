<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

const props = defineProps({
  suggestion: {
    type: Object,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: Object,
    default: null,
  },
  isEmpty: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: String,
    default: null,
  },
  comment: {
    type: Object,
    default: null,
  },
});
const emit = defineEmits([
  'useSuggestion',
  'dismiss',
  'reload',
  'disable',
  'rate',
  'comment',
]);
const COMMENT_MAX_LENGTH = 2000;
const COMMENT_THANKS_MS = 2500;

const { t } = useI18n();

const commentBoxId = useId();
const commentButton = ref(null);
const commentInput = ref(null);
const isCommentOpen = ref(false);
const commentDraft = ref('');
const isAwaitingComment = ref(false);
const hasCommentError = ref(false);
const showCommentThanks = ref(false);
let commentThanksTimer = null;

const ratingOptions = computed(() => [
  {
    value: 'up',
    icon: 'i-ph-thumbs-up',
    selectedIcon: 'i-ph-thumbs-up-fill',
    selectedClass: 'text-n-teal-11 bg-n-teal-9/10',
    tooltip: t('AI_SUGGESTION.RATE_UP_TOOLTIP'),
  },
  {
    value: 'down',
    icon: 'i-ph-thumbs-down',
    selectedIcon: 'i-ph-thumbs-down-fill',
    selectedClass: 'text-n-ruby-11 bg-n-ruby-9/10',
    tooltip: t('AI_SUGGESTION.RATE_DOWN_TOOLTIP'),
  },
]);

const hasSuggestion = computed(() => {
  return props.suggestion && props.suggestion.content;
});

const suggestionContent = computed(() => {
  return props.suggestion?.content || '';
});

const hasError = computed(() => {
  return props.error !== null;
});

const useSuggestion = () => {
  emit('useSuggestion', suggestionContent.value);
};

const dismiss = () => {
  emit('dismiss');
};

const reload = () => {
  emit('reload');
};

const disable = () => {
  emit('disable');
};

const isRated = value => props.rating === value;

const sentComment = computed(() => props.comment?.text || '');

const hasSentComment = computed(() => !!sentComment.value);

const isSendingComment = computed(() => props.comment?.status === 'sending');

const canSendComment = computed(
  () => !!commentDraft.value.trim() && !isSendingComment.value
);

const commentTooltip = computed(() =>
  hasSentComment.value
    ? t('AI_SUGGESTION.COMMENT_SENT_TOOLTIP', { comment: sentComment.value })
    : t('AI_SUGGESTION.COMMENT_TOOLTIP')
);

/**
 * Opens the comment box with the last sent comment to edit, and focuses it without scrolling.
 */
const openComment = () => {
  isCommentOpen.value = true;
  hasCommentError.value = false;
  commentDraft.value = sentComment.value;
  nextTick(() => commentInput.value?.focus({ preventScroll: true }));
};

const closeComment = () => {
  isCommentOpen.value = false;
  hasCommentError.value = false;
  commentDraft.value = '';
};

const focusCommentButton = () => {
  commentButton.value?.focus({ preventScroll: true });
};

const cancelComment = () => {
  closeComment();
  focusCommentButton();
};

const toggleComment = () => {
  if (isCommentOpen.value) {
    closeComment();
  } else {
    openComment();
  }
};

const flashCommentThanks = () => {
  clearTimeout(commentThanksTimer);
  showCommentThanks.value = true;
  commentThanksTimer = setTimeout(() => {
    showCommentThanks.value = false;
  }, COMMENT_THANKS_MS);
};

/**
 * Emits the trimmed draft; an unchanged comment just closes the box. The box stays open until
 * the `comment` prop reports the request as sent or failed.
 */
const sendComment = () => {
  const comment = commentDraft.value.trim();
  if (!comment || isSendingComment.value) return;
  if (comment === sentComment.value) {
    cancelComment();
    return;
  }
  hasCommentError.value = false;
  isAwaitingComment.value = true;
  emit('comment', comment);
};

const onCommentKeydown = event => {
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelComment();
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendComment();
  }
};

/**
 * Rates the suggestion; a thumbs down also offers the comment box, which stays optional.
 */
const rate = value => {
  if (isRated(value)) return;
  emit('rate', value);
  if (value === 'down' && !hasSentComment.value && !isCommentOpen.value) {
    openComment();
  }
};

watch(
  () => props.comment,
  comment => {
    if (!isAwaitingComment.value || !comment || comment.status === 'sending') {
      return;
    }
    isAwaitingComment.value = false;
    if (comment.status === 'sent') {
      closeComment();
      flashCommentThanks();
      focusCommentButton();
    } else {
      hasCommentError.value = true;
    }
  }
);

watch(
  () => props.suggestion?.metadata?.suggestionId,
  () => {
    closeComment();
    isAwaitingComment.value = false;
    showCommentThanks.value = false;
  }
);

onBeforeUnmount(() => {
  clearTimeout(commentThanksTimer);
});
</script>

<template>
  <div class="ai-suggestion-container mb-2 max-h-[50vh]">
    <div v-if="isLoading" class="ai-suggestion-banner">
      <div
        class="flex items-center justify-between gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
      >
        <div class="flex items-center gap-2">
          <Spinner :size="16" />
          <span class="text-sm text-slate-700 dark:text-slate-300">{{
            t('AI_SUGGESTION.LOADING')
          }}</span>
        </div>
        <button
          class="flex p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg transition-colors"
          :title="t('AI_SUGGESTION.DISABLE_TOOLTIP')"
          :aria-label="t('AI_SUGGESTION.DISABLE_TOOLTIP')"
          @click="disable"
        >
          <span class="i-ph-eye-slash size-4" />
        </button>
      </div>
    </div>

    <div v-else-if="hasSuggestion" class="ai-suggestion-banner">
      <div
        class="bg-gradient-to-r from-n-iris-3 to-n-blue-3 dark:from-n-iris-2 dark:to-n-blue-2 rounded-lg border border-n-iris-6 dark:border-n-iris-5 p-4"
      >
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <div
              class="w-8 h-8 bg-gradient-to-br from-n-iris-9 to-n-blue-9 rounded-lg flex items-center justify-center shadow-sm"
            >
              <span class="i-ph-sparkle-fill size-4 text-white" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <h4
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {{ t('AI_SUGGESTION.TITLE') }}
              </h4>
              <span
                class="text-xs text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-200/50 dark:border-slate-700/50"
              >
                {{ t('AI_SUGGESTION.BADGE') }}
              </span>
            </div>

            <p
              class="text-sm text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap overflow-y-auto max-h-[40vh]"
            >
              {{ suggestionContent }}
            </p>

            <div class="flex items-center gap-2 flex-wrap">
              <button
                class="px-4 py-2 text-sm font-medium text-white bg-n-iris-9 hover:bg-n-iris-10 rounded-lg border border-n-iris-9 hover:border-n-iris-10 transition-all duration-200 shadow-sm"
                @click="useSuggestion"
              >
                {{ t('AI_SUGGESTION.USE_BUTTON') }}
              </button>

              <button
                class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600 transition-all duration-200"
                @click="dismiss"
              >
                {{ t('AI_SUGGESTION.DISMISS_BUTTON') }}
              </button>

              <div class="flex items-center gap-1 ltr:ml-auto rtl:mr-auto">
                <button
                  v-for="option in ratingOptions"
                  :key="option.value"
                  class="flex p-2 rounded-lg transition-all duration-200"
                  :class="
                    isRated(option.value)
                      ? option.selectedClass
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-n-iris-9/10'
                  "
                  :title="option.tooltip"
                  :aria-label="option.tooltip"
                  :aria-pressed="isRated(option.value)"
                  @click="rate(option.value)"
                >
                  <span
                    class="size-4"
                    :class="
                      isRated(option.value) ? option.selectedIcon : option.icon
                    "
                  />
                </button>

                <button
                  ref="commentButton"
                  class="flex p-2 rounded-lg transition-all duration-200"
                  :class="
                    hasSentComment || isCommentOpen
                      ? 'text-n-iris-11 bg-n-iris-9/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-n-iris-9/10'
                  "
                  :title="commentTooltip"
                  :aria-label="commentTooltip"
                  :aria-expanded="isCommentOpen"
                  :aria-controls="commentBoxId"
                  @click="toggleComment"
                >
                  <span
                    class="size-4"
                    :class="
                      hasSentComment ? 'i-ph-chat-text-fill' : 'i-ph-chat-text'
                    "
                  />
                </button>
              </div>

              <button
                class="flex p-2 text-n-iris-11 hover:text-n-iris-12 hover:bg-n-iris-9/10 rounded-lg transition-all duration-200"
                :title="t('AI_SUGGESTION.RELOAD_TOOLTIP')"
                :aria-label="t('AI_SUGGESTION.RELOAD_TOOLTIP')"
                @click="reload"
              >
                <span class="i-ph-arrow-clockwise size-4" />
              </button>

              <button
                class="flex p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-n-iris-9/10 rounded-lg transition-all duration-200"
                :title="t('AI_SUGGESTION.DISABLE_TOOLTIP')"
                :aria-label="t('AI_SUGGESTION.DISABLE_TOOLTIP')"
                @click="disable"
              >
                <span class="i-ph-eye-slash size-4" />
              </button>
            </div>

            <Transition name="ai-comment" mode="out-in">
              <div
                v-if="isCommentOpen"
                :id="commentBoxId"
                key="comment-box"
                class="mt-3 flex flex-col gap-2"
              >
                <div
                  class="px-3 py-2 rounded-lg border border-n-iris-6 bg-n-solid-1 transition-colors duration-200 focus-within:border-n-iris-9"
                >
                  <textarea
                    ref="commentInput"
                    v-model="commentDraft"
                    rows="2"
                    :maxlength="COMMENT_MAX_LENGTH"
                    :placeholder="t('AI_SUGGESTION.COMMENT_PLACEHOLDER')"
                    :aria-label="t('AI_SUGGESTION.COMMENT_LABEL')"
                    :readonly="isSendingComment"
                    class="block w-full h-auto max-h-40 p-0 !mb-0 text-sm leading-5 resize-none !rounded-none !bg-transparent !border-0 !outline-0 text-n-slate-12 placeholder:text-n-slate-10"
                    @keydown.stop="onCommentKeydown"
                  />
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                  <div
                    v-if="hasCommentError"
                    role="alert"
                    class="flex items-center gap-2 px-3 py-1.5 text-xs text-n-ruby-11 bg-n-ruby-9/10 rounded border border-n-ruby-9/20"
                  >
                    <span class="i-ph-warning-circle size-4 flex-shrink-0" />
                    <span>{{ t('AI_SUGGESTION.COMMENT_ERROR') }}</span>
                  </div>
                  <span
                    v-else
                    class="text-xs text-slate-500 dark:text-slate-400"
                  >
                    {{ t('AI_SUGGESTION.COMMENT_HINT') }}
                  </span>

                  <div class="flex items-center gap-2 ltr:ml-auto rtl:mr-auto">
                    <button
                      class="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-n-iris-9/10 rounded-lg transition-all duration-200"
                      @click="cancelComment"
                    >
                      {{ t('AI_SUGGESTION.COMMENT_CANCEL') }}
                    </button>
                    <button
                      class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-n-iris-9 hover:bg-n-iris-10 rounded-lg transition-all duration-200 shadow-sm disabled:cursor-not-allowed disabled:hover:bg-n-iris-9"
                      :disabled="!canSendComment"
                      @click="sendComment"
                    >
                      <Spinner v-if="isSendingComment" :size="12" />
                      <span>{{ t('AI_SUGGESTION.COMMENT_SEND') }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <p
                v-else-if="showCommentThanks"
                key="comment-thanks"
                role="status"
                class="mt-3 mb-0 flex items-center gap-1.5 text-xs font-medium text-n-teal-11"
              >
                <span class="i-ph-check-circle size-4 flex-shrink-0" />
                <span>{{ t('AI_SUGGESTION.COMMENT_THANKS') }}</span>
              </p>
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex items-center gap-2 flex-wrap">
      <button
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-n-iris-11 bg-n-iris-3 hover:bg-n-iris-4 rounded-lg border border-n-iris-6 transition-all duration-200 shadow-sm hover:shadow"
        @click="reload"
      >
        <span class="i-ph-arrow-clockwise size-4" />
        <span>{{ t('AI_SUGGESTION.GET_BUTTON') }}</span>
      </button>

      <div
        v-if="hasError"
        class="flex items-center gap-2 px-3 py-1.5 text-xs text-n-ruby-11 bg-n-ruby-9/10 rounded border border-n-ruby-9/20"
        :title="error.message"
      >
        <span class="i-ph-warning-circle size-4 flex-shrink-0" />
        <span>{{ t('AI_SUGGESTION.ERROR') }}</span>
      </div>
      <span
        v-else-if="isEmpty"
        class="text-xs text-slate-500 dark:text-slate-400"
      >
        {{ t('AI_SUGGESTION.EMPTY') }}
      </span>

      <button
        class="flex items-center gap-1 ltr:ml-auto rtl:mr-auto px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
        @click="disable"
      >
        <span class="i-ph-eye-slash size-3.5" />
        <span>{{ t('AI_SUGGESTION.HIDE_BUTTON') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-suggestion-banner {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-comment-enter-active,
.ai-comment-leave-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.18s ease-out;
}

.ai-comment-enter-from,
.ai-comment-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .ai-comment-enter-active,
  .ai-comment-leave-active {
    transition: none;
  }
}
</style>

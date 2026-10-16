<script setup>
import { computed } from 'vue';
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
});

const emit = defineEmits([
  'useSuggestion',
  'dismiss',
  'reload',
  'disable',
  'rate',
]);

const { t } = useI18n();

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

const rate = value => {
  if (isRated(value)) return;
  emit('rate', value);
};
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
</style>

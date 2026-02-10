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
});

const emit = defineEmits(['useSuggestion', 'dismiss', 'reload']);

const { t } = useI18n();

const hasSuggestion = computed(() => {
  return props.suggestion && props.suggestion.content;
});

const suggestionContent = computed(() => {
  return props.suggestion?.content || '';
});

const hasError = computed(() => {
  return props.error !== null;
});

const errorMessage = computed(() => {
  if (!props.error) return '';
  return props.error.message || 'Failed to load AI suggestion';
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
</script>

<template>
  <!-- Always visible container for AI suggestions -->
  <div class="ai-suggestion-container mb-2 max-h-[50vh]">
    <!-- Loading State -->
    <div v-if="isLoading" class="ai-suggestion-banner">
      <div
        class="flex items-center justify-between gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
      >
        <div class="flex items-center gap-2">
          <Spinner size="small" />
          <span class="text-sm text-slate-700 dark:text-slate-300">{{
            t('AI_SUGGESTION.LOADING')
          }}</span>
        </div>
        <button
          class="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="true"
          :title="t('AI_SUGGESTION.RELOAD_TOOLTIP')"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Suggestion Available State -->
    <div v-else-if="hasSuggestion" class="ai-suggestion-banner">
      <div
        class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 rounded-lg border border-purple-200 dark:border-purple-800/50 p-4"
      >
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <div
              class="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 dark:from-purple-600 dark:to-blue-600 rounded-lg flex items-center justify-center shadow-sm"
            >
              <span class="text-white text-sm font-semibold">AI</span>
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
                class="px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg border border-purple-300 dark:border-purple-600 transition-all duration-200 shadow-sm"
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

              <button
                class="ml-auto p-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-all duration-200"
                :title="t('AI_SUGGESTION.RELOAD_TOOLTIP')"
                @click="reload"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Suggestion State - Compact Reload Button -->
    <div v-else class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800/50 transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isLoading"
          @click="reload"
        >
          <svg
            class="w-4 h-4"
            :class="{ 'animate-spin': isLoading }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{{ t('AI_SUGGESTION.GET_BUTTON') }}</span>
        </button>

        <!-- Error message -->
        <div
          v-if="hasError"
          class="flex items-center gap-2 px-3 py-1.5 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800/50"
        >
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
      </div>
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

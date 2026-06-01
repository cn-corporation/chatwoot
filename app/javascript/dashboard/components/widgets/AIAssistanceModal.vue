<script>
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';
import { useAlert } from 'dashboard/composables';
import { useAI } from 'dashboard/composables/useAI';
import { useExtraAIAssist } from 'dashboard/composables/useExtraAIAssist';
import AILoader from './AILoader.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';

const TRANSFORM_ACTIONS = [
  'rephrase',
  'fix_spelling_grammar',
  'shorten',
  'expand',
  'make_friendly',
  'make_formal',
  'simplify',
  'custom',
];

export default {
  components: {
    AILoader,
    NextButton,
  },
  props: {
    aiOption: {
      type: String,
      required: true,
    },
  },
  emits: ['close', 'applyText'],
  setup() {
    const { formatMessage } = useMessageFormatter();
    const { processEvent, recordAnalytics } = useAI();
    const { draftMessage, streamAssist } = useExtraAIAssist();
    return {
      draftMessage,
      processEvent,
      streamAssist,
      recordAnalytics,
      formatMessage,
    };
  },
  data() {
    return {
      generatedContent: '',
      isGenerating: false,
      hasStarted: false,
      instruction: '',
      abortController: null,
    };
  },
  computed: {
    isCustom() {
      return this.aiOption === 'custom';
    },
    isTransform() {
      return TRANSFORM_ACTIONS.includes(this.aiOption);
    },
    headerTitle() {
      const translationKey = this.aiOption?.toUpperCase();
      return translationKey
        ? this.$t(`INTEGRATION_SETTINGS.OPEN_AI.WITH_AI`, {
            option: this.$t(
              `INTEGRATION_SETTINGS.OPEN_AI.OPTIONS.${translationKey}`
            ),
          })
        : '';
    },
    canApply() {
      return !!this.generatedContent && !this.isGenerating;
    },
  },
  mounted() {
    if (!this.isCustom) {
      this.generate();
    }
  },
  beforeUnmount() {
    if (this.abortController) {
      this.abortController.abort();
    }
  },
  methods: {
    onClose() {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.$emit('close');
    },
    async generate() {
      this.generatedContent = '';
      this.hasStarted = true;
      this.isGenerating = true;
      try {
        if (this.isTransform) {
          this.abortController = new AbortController();
          await this.streamAssist({
            action: this.aiOption,
            instruction: this.instruction,
            signal: this.abortController.signal,
            onChunk: text => {
              this.generatedContent = text;
            },
          });
        } else {
          this.generatedContent = await this.processEvent(this.aiOption);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          useAlert(
            error.message ||
              this.$t('INTEGRATION_SETTINGS.OPEN_AI.GENERATE_ERROR')
          );
        }
      } finally {
        this.isGenerating = false;
      }
    },
    submitInstruction() {
      if (!this.instruction.trim()) return;
      this.generate();
    },
    applyText() {
      this.recordAnalytics(this.aiOption);
      this.$emit('applyText', this.generatedContent);
      this.onClose();
    },
  },
};
</script>

<template>
  <div class="flex flex-col">
    <woot-modal-header :header-title="headerTitle" />
    <form
      class="flex flex-col w-full modal-content"
      @submit.prevent="applyText"
    >
      <div v-if="isCustom && !hasStarted" class="flex flex-col w-full gap-2">
        <input
          v-model="instruction"
          type="text"
          class="w-full"
          :placeholder="
            $t(
              'INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.CUSTOM_PLACEHOLDER'
            )
          "
          @keydown.enter.prevent="submitInstruction"
        />
        <div class="flex flex-row justify-end w-full gap-2 px-0 py-2">
          <NextButton
            faded
            slate
            type="button"
            :label="
              $t('INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.BUTTONS.CANCEL')
            "
            @click="onClose"
          />
          <NextButton
            type="button"
            :disabled="!instruction.trim()"
            :label="
              $t(
                'INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.CUSTOM_GENERATE'
              )
            "
            @click="submitInstruction"
          />
        </div>
      </div>

      <template v-else>
        <div v-if="draftMessage" class="w-full">
          <h4 class="mt-1 text-base text-n-slate-12">
            {{
              $t('INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.DRAFT_TITLE')
            }}
          </h4>
          <p v-dompurify-html="formatMessage(draftMessage, false)" />
          <h4 class="mt-1 text-base text-n-slate-12">
            {{
              $t(
                'INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.GENERATED_TITLE'
              )
            }}
          </h4>
        </div>
        <div>
          <AILoader v-if="isGenerating && !generatedContent" />
          <p v-else v-dompurify-html="formatMessage(generatedContent, false)" />
        </div>

        <div class="flex flex-row justify-end w-full gap-2 px-0 py-2">
          <NextButton
            faded
            slate
            type="reset"
            :label="
              $t('INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.BUTTONS.CANCEL')
            "
            @click.prevent="onClose"
          />
          <NextButton
            type="submit"
            :disabled="!canApply"
            :label="
              $t('INTEGRATION_SETTINGS.OPEN_AI.ASSISTANCE_MODAL.BUTTONS.APPLY')
            "
          />
        </div>
      </template>
    </form>
  </div>
</template>

<style lang="scss" scoped>
.modal-content {
  @apply pt-2 px-8 pb-8;
}

.container {
  width: 100%;
}
</style>

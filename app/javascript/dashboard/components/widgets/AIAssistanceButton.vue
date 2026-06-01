<script>
import { ref } from 'vue';
import { useAI } from 'dashboard/composables/useAI';
import { useExtraAIAssist } from 'dashboard/composables/useExtraAIAssist';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import AIAssistanceModal from './AIAssistanceModal.vue';
import { CMD_AI_ASSIST } from 'dashboard/helper/commandbar/events';
import { emitter } from 'shared/helpers/mitt';
import NextButton from 'dashboard/components-next/button/Button.vue';

export default {
  components: {
    NextButton,
    AIAssistanceModal,
  },
  emits: ['replaceText'],
  setup(props, { emit }) {
    const { isAIIntegrationEnabled, draftMessage, recordAnalytics } = useAI();
    const { isExtraAIEnabled } = useExtraAIAssist();

    const initialMessage = ref('');

    const initializeMessage = draftMsg => {
      initialMessage.value = draftMsg;
    };
    const keyboardEvents = {
      '$mod+KeyZ': {
        action: () => {
          if (initialMessage.value) {
            emit('replaceText', initialMessage.value);
            initialMessage.value = '';
          }
        },
        allowOnFocusedInput: true,
      },
    };
    useKeyboardEvents(keyboardEvents);

    return {
      initialMessage,
      initializeMessage,
      recordAnalytics,
      isAIIntegrationEnabled,
      isExtraAIEnabled,
      draftMessage,
    };
  },
  data: () => ({
    showAIAssistanceModal: false,
    aiOption: '',
  }),
  computed: {
    isAIAssistEnabled() {
      return this.isExtraAIEnabled || this.isAIIntegrationEnabled;
    },
  },
  mounted() {
    emitter.on(CMD_AI_ASSIST, this.onAIAssist);
    this.initializeMessage(this.draftMessage);
  },
  methods: {
    hideAIAssistanceModal() {
      this.recordAnalytics('DISMISS_AI_SUGGESTION', {
        aiOption: this.aiOption,
      });
      this.showAIAssistanceModal = false;
    },
    openAIAssist() {
      this.initializeMessage(this.draftMessage);
      const ninja = document.querySelector('ninja-keys');
      ninja.open({ parent: 'ai_assist' });
    },
    onAIAssist(option) {
      this.aiOption = option;
      this.showAIAssistanceModal = true;
    },
    insertText(message) {
      this.$emit('replaceText', message);
    },
  },
};
</script>

<template>
  <div>
    <div v-if="isAIAssistEnabled" class="relative">
      <NextButton
        v-tooltip.top-end="$t('INTEGRATION_SETTINGS.OPEN_AI.AI_ASSIST')"
        icon="i-ph-magic-wand"
        slate
        faded
        sm
        @click="openAIAssist"
      />
      <woot-modal
        v-model:show="showAIAssistanceModal"
        :on-close="hideAIAssistanceModal"
      >
        <AIAssistanceModal
          :ai-option="aiOption"
          @apply-text="insertText"
          @close="hideAIAssistanceModal"
        />
      </woot-modal>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAI } from 'dashboard/composables/useAI';
import { useExtraAIAssist } from 'dashboard/composables/useExtraAIAssist';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import { useMapGetter } from 'dashboard/composables/store';
import { REPLY_EDITOR_MODES } from './WootWriter/constants';
import { CMD_AI_ASSIST } from 'dashboard/helper/commandbar/events';
import { emitter } from 'shared/helpers/mitt';
import AIAssistanceModal from './AIAssistanceModal.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  message: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['replaceText']);

const { isAIIntegrationEnabled, draftMessage, recordAnalytics } = useAI();
const { isExtraAIEnabled } = useExtraAIAssist();
const replyMode = useMapGetter('draftMessages/getReplyEditorMode');

const showAIAssistanceModal = ref(false);
const aiOption = ref('');
const initialMessage = ref('');

const isAIAssistEnabled = computed(
  () => isExtraAIEnabled.value || isAIIntegrationEnabled.value
);

const isTranslateMode = computed(
  () => replyMode.value === REPLY_EDITOR_MODES.TRANSLATE
);

const hasTypedText = computed(() => Boolean(props.message?.trim()));

const showAIAssist = computed(
  () => isAIAssistEnabled.value && !isTranslateMode.value
);

const onAIAssist = option => {
  aiOption.value = option;
  showAIAssistanceModal.value = true;
};

const openAIAssist = () => {
  initialMessage.value = draftMessage.value;
  const ninja = document.querySelector('ninja-keys');
  ninja.classList.add('ai-assist-popup');
  const onClosed = () => {
    ninja.classList.remove('ai-assist-popup');
    ninja.removeEventListener('closed', onClosed);
  };
  ninja.addEventListener('closed', onClosed);
  ninja.open({ parent: 'ai_assist' });
};

const hideAIAssistanceModal = () => {
  recordAnalytics('DISMISS_AI_SUGGESTION', { aiOption: aiOption.value });
  showAIAssistanceModal.value = false;
};

const insertText = message => {
  emit('replaceText', message);
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

onMounted(() => {
  emitter.on(CMD_AI_ASSIST, onAIAssist);
  initialMessage.value = draftMessage.value;
});

onUnmounted(() => {
  emitter.off(CMD_AI_ASSIST, onAIAssist);
});
</script>

<template>
  <div>
    <div v-if="showAIAssist" class="relative">
      <NextButton
        v-tooltip.top-end="$t('INTEGRATION_SETTINGS.OPEN_AI.AI_ASSIST')"
        icon="i-ph-magic-wand"
        slate
        faded
        sm
        :disabled="disabled || !hasTypedText"
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

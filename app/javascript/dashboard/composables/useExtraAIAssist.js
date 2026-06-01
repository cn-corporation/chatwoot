import { computed } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

/**
 * Provides AI draft-transform helpers powered by the chatwoot-extra service.
 * @returns {Object} draftMessage, isExtraAIEnabled, and streamAssist.
 */
export function useExtraAIAssist() {
  const currentChat = useMapGetter('getSelectedChat');
  const replyMode = useMapGetter('draftMessages/getReplyEditorMode');
  const getDraftMessage = useMapGetter('draftMessages/get');

  const conversationId = computed(() => currentChat.value?.id);
  const draftKey = computed(
    () => `draft-${conversationId.value}-${replyMode.value}`
  );
  const draftMessage = computed(() => getDraftMessage.value(draftKey.value));

  const isExtraAIEnabled = computed(
    () => !!window.chatwootConfig?.chatwootExtraApiUrl
  );

  /**
   * Streams an AI transform of the current draft message.
   * @param {Object} params
   * @param {string} params.action - The transform action key.
   * @param {string} [params.instruction] - Free-form instruction for the custom action.
   * @param {AbortSignal} [params.signal] - Abort signal to cancel the stream.
   * @param {Function} [params.onChunk] - Called with the accumulated text on each chunk.
   * @returns {Promise<string>} The full generated text.
   */
  const streamAssist = async ({ action, instruction, signal, onChunk }) => {
    let accumulated = '';
    let streamError = null;
    await ChatwootExtraAPI.streamMessageAssist({
      content: draftMessage.value,
      action,
      instruction,
      signal,
      onEvent: ({ event, data }) => {
        if (event === 'chunk') {
          accumulated += data.delta;
          if (onChunk) onChunk(accumulated);
        } else if (event === 'error') {
          streamError = data.error || 'AI request failed';
        }
      },
    });
    if (streamError) throw new Error(streamError);
    return accumulated;
  };

  return { draftMessage, isExtraAIEnabled, streamAssist };
}

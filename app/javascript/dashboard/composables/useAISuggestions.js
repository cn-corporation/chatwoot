import { ref, computed, reactive } from 'vue';
import chatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { LocalStorage } from 'shared/helpers/localStorage';
import { LOCAL_STORAGE_KEYS } from 'dashboard/constants/localStorage';
import { MESSAGE_TYPE, MESSAGE_STATUS } from 'shared/constants/messages';

export const AI_SUGGESTION_POLL_INTERVAL_MS = 1000;
export const AI_SUGGESTION_MAX_WAIT_MS = 40000;
const AI_SUGGESTION_FIRST_CHECK_DELAY_MS = 1000;
const RECENT_MESSAGE_AGE_MS = 60000;

const isAISuggestionsEnabled = ref(
  LocalStorage.get(LOCAL_STORAGE_KEYS.AI_SUGGESTIONS_ENABLED) !== false
);

const suggestionRatings = reactive({});

const restoreRating = (suggestionId, rating) => {
  if (rating) {
    suggestionRatings[suggestionId] = rating;
  } else {
    delete suggestionRatings[suggestionId];
  }
};

const persistEnabledSetting = value => {
  try {
    LocalStorage.set(LOCAL_STORAGE_KEYS.AI_SUGGESTIONS_ENABLED, value);
    return true;
  } catch {
    return false;
  }
};

const wait = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

const normalizeText = text => (text || '').replace(/\s+/g, ' ').trim();

const isAgentReply = message =>
  message.message_type === MESSAGE_TYPE.OUTGOING &&
  !message.private &&
  !message.content_attributes?.bot_system_message &&
  (message.sender_type === 'User' ||
    message.sender?.type === 'user' ||
    message.status === MESSAGE_STATUS.PROGRESS);

/**
 * Returns the latest customer message that no agent has replied to yet, or null when the
 * conversation is not waiting for an agent reply. Bot and private messages are ignored.
 */
export const findMessageAwaitingReply = (messages = []) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.message_type === MESSAGE_TYPE.INCOMING) return message;
    if (isAgentReply(message)) return null;
  }
  return null;
};

/**
 * Whether a stored suggestion answers the given customer message (or a newer one).
 */
export const isSuggestionFor = (suggestion, messageId) => {
  if (!suggestion?.content) return false;
  if (suggestion.triggerMessageId === undefined) return true;
  return suggestion.triggerMessageId >= messageId;
};

/**
 * Per-agent on/off switch for AI reply suggestions, stored in localStorage and shared by
 * every component that uses it.
 */
export function useAISuggestionsToggle() {
  const setAISuggestionsEnabled = value => {
    isAISuggestionsEnabled.value = value;
    persistEnabledSetting(value);
  };

  const toggleAISuggestions = () =>
    setAISuggestionsEnabled(!isAISuggestionsEnabled.value);

  return {
    isAISuggestionsEnabled,
    setAISuggestionsEnabled,
    toggleAISuggestions,
  };
}

export function useAISuggestions() {
  const aiSuggestion = ref(null);
  const isLoadingSuggestion = ref(false);
  const suggestionError = ref(null);
  const hasCheckedSuggestion = ref(false);
  const usedSuggestion = ref(null);
  let pollToken = 0;

  const { isAISuggestionsEnabled: isEnabled, setAISuggestionsEnabled } =
    useAISuggestionsToggle();

  const hasSuggestion = computed(() => {
    return aiSuggestion.value && aiSuggestion.value.content;
  });

  const suggestionContent = computed(() => {
    return aiSuggestion.value?.content || '';
  });

  const clearSuggestion = () => {
    pollToken += 1;
    aiSuggestion.value = null;
    suggestionError.value = null;
    hasCheckedSuggestion.value = false;
    isLoadingSuggestion.value = false;
  };

  const fetchStoredSuggestion = async conversationId => {
    try {
      return await chatwootExtraAPI.getAISuggestion(conversationId);
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  };

  /**
   * Shows the loading state and polls the stored suggestion until one answering
   * `messageId` arrives or `waitMs` elapses. A newer call or clearSuggestion cancels it.
   */
  const waitForSuggestion = async (
    conversationId,
    {
      messageId = 0,
      waitMs = AI_SUGGESTION_MAX_WAIT_MS,
      initialDelayMs = 0,
      intervalMs = AI_SUGGESTION_POLL_INTERVAL_MS,
    } = {}
  ) => {
    clearSuggestion();
    if (!conversationId || !isEnabled.value) return null;

    const token = pollToken;
    const deadline = Date.now() + waitMs;
    const isCurrent = () => token === pollToken && isEnabled.value;
    isLoadingSuggestion.value = true;

    const poll = async () => {
      const suggestion = await fetchStoredSuggestion(conversationId);
      if (!isCurrent()) return null;
      if (isSuggestionFor(suggestion, messageId)) return suggestion;
      if (Date.now() + intervalMs > deadline) return null;
      await wait(intervalMs);
      return isCurrent() ? poll() : null;
    };

    try {
      if (initialDelayMs > 0) await wait(initialDelayMs);
      const suggestion = isCurrent() ? await poll() : null;
      if (isCurrent()) {
        aiSuggestion.value = suggestion;
        hasCheckedSuggestion.value = true;
      }
      return suggestion;
    } catch (error) {
      if (isCurrent()) {
        suggestionError.value = {
          message: error.response?.data?.error || error.message,
        };
      }
      return null;
    } finally {
      if (token === pollToken) isLoadingSuggestion.value = false;
    }
  };

  /**
   * Loads the suggestion for the customer message the conversation is waiting on. Recent
   * messages are polled while the suggestion is generated; older ones are checked once.
   */
  const refreshSuggestionForMessage = (conversationId, message) => {
    if (!message) {
      clearSuggestion();
      return Promise.resolve(null);
    }
    const ageMs = Date.now() - (message.created_at || 0) * 1000;
    return waitForSuggestion(conversationId, {
      messageId: message.id,
      waitMs: ageMs < RECENT_MESSAGE_AGE_MS ? AI_SUGGESTION_MAX_WAIT_MS : 0,
      initialDelayMs:
        ageMs < AI_SUGGESTION_FIRST_CHECK_DELAY_MS
          ? AI_SUGGESTION_FIRST_CHECK_DELAY_MS - Math.max(ageMs, 0)
          : 0,
    });
  };

  const sendFeedback = (conversationId, feedback) =>
    chatwootExtraAPI
      .sendAISuggestionFeedback(conversationId, feedback)
      .catch(() => null);

  /**
   * Remembers the suggestion the agent inserted into the reply box, so the next message
   * the agent sends in that conversation is reported as accepted or edited.
   */
  const rememberUsedSuggestion = (conversationId, suggestion) => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    usedSuggestion.value = suggestionId
      ? { conversationId, suggestionId, text: suggestion.content }
      : null;
  };

  const rejectSuggestion = (conversationId, suggestion) => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    if (!suggestionId) return Promise.resolve(null);
    return sendFeedback(conversationId, { suggestionId, action: 'rejected' });
  };

  /**
   * The agent's rating ('up' or 'down') of a suggestion in this session, or null when unrated.
   */
  const getSuggestionRating = suggestion => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    return (suggestionId && suggestionRatings[suggestionId]) || null;
  };

  /**
   * Rates a suggestion 'up' or 'down' without using or dismissing it. The rating is shown
   * immediately, kept per suggestion for the session and rolled back if the request fails.
   */
  const rateSuggestion = async (conversationId, suggestion, rating) => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    const previousRating = getSuggestionRating(suggestion);
    if (!suggestionId || previousRating === rating) return null;

    suggestionRatings[suggestionId] = rating;
    try {
      return await chatwootExtraAPI.sendAISuggestionFeedback(conversationId, {
        suggestionId,
        rating,
      });
    } catch {
      if (suggestionRatings[suggestionId] === rating) {
        restoreRating(suggestionId, previousRating);
      }
      return null;
    }
  };

  /**
   * Reports the outcome of a used suggestion once the agent sends a public reply.
   */
  const reportSentMessage = ({
    conversationId,
    message,
    private: isPrivate,
  } = {}) => {
    const used = usedSuggestion.value;
    if (!used || used.conversationId !== conversationId) return null;
    if (isPrivate || !normalizeText(message)) return null;

    usedSuggestion.value = null;
    const isUnchanged = normalizeText(message) === normalizeText(used.text);
    return sendFeedback(
      conversationId,
      isUnchanged
        ? { suggestionId: used.suggestionId, action: 'accepted' }
        : {
            suggestionId: used.suggestionId,
            action: 'edited',
            finalText: message.trim(),
          }
    );
  };

  return {
    aiSuggestion,
    isLoadingSuggestion,
    suggestionError,
    hasCheckedSuggestion,
    hasSuggestion,
    suggestionContent,
    isAISuggestionsEnabled: isEnabled,
    setAISuggestionsEnabled,
    waitForSuggestion,
    refreshSuggestionForMessage,
    clearSuggestion,
    rememberUsedSuggestion,
    rejectSuggestion,
    getSuggestionRating,
    rateSuggestion,
    reportSentMessage,
  };
}

import { ref, computed, reactive } from 'vue';
import chatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { LocalStorage } from 'shared/helpers/localStorage';
import { LOCAL_STORAGE_KEYS } from 'dashboard/constants/localStorage';
import { MESSAGE_TYPE, MESSAGE_STATUS } from 'shared/constants/messages';

export const AI_SUGGESTION_POLL_INTERVAL_MS = 1000;
export const AI_SUGGESTION_MAX_WAIT_MS = 45000;
export const AI_SUGGESTION_UNSEEN_LOCK_MS = 5000;
export const AI_SUGGESTION_COMMENT_MIN_LETTERS = 4;
const AI_SUGGESTION_FIRST_CHECK_DELAY_MS = 1000;

const isAISuggestionsEnabled = ref(
  LocalStorage.get(LOCAL_STORAGE_KEYS.AI_SUGGESTIONS_ENABLED) !== false
);

const suggestionPolicy = ref(null);

let policyConversationId = null;

const isAISuggestionsForced = computed(() => !!suggestionPolicy.value?.forced);

const isAISuggestionsActive = computed(
  () => isAISuggestionsEnabled.value || isAISuggestionsForced.value
);

const suggestionRatings = reactive({});

const suggestionComments = reactive({});

const reportedUsedSuggestionIds = new Set();

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

/**
 * Makes the policy follow the conversation; switching to another one forgets the previous policy.
 */
const focusPolicyOn = conversationId => {
  if (policyConversationId === String(conversationId)) return;
  policyConversationId = String(conversationId);
  suggestionPolicy.value = null;
};

/**
 * Keeps the forced-mode policy from a suggestion state (none when `state` is null) for the open conversation; answers
 * for a conversation the agent has left are ignored.
 */
const applyPolicy = (conversationId, state) => {
  if (String(conversationId) !== policyConversationId) return;
  suggestionPolicy.value = {
    forced: !!state?.forced,
    commentFromConfidence: state?.forced ? state.commentFromConfidence : null,
  };
};

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
 * Whether a comment explains enough: at least AI_SUGGESTION_COMMENT_MIN_LETTERS letters of any
 * alphabet. Digits, spaces, punctuation and other symbols do not count.
 */
export const isCommentDetailedEnough = text =>
  ((text || '').match(/\p{L}/gu) || []).length >=
  AI_SUGGESTION_COMMENT_MIN_LETTERS;

/**
 * Whether forced mode asks for a comment before the agent sends `text` instead of `suggestion`, or
 * dismisses it when `text` is undefined: its confidence (0 when unknown) is at least
 * `commentFromConfidence`, the agent has not commented on it yet and the text differs from it.
 */
export const needsSuggestionComment = ({
  suggestion,
  commentFromConfidence,
  comment,
  text,
}) => {
  if (
    !suggestion?.metadata?.suggestionId ||
    typeof commentFromConfidence !== 'number'
  ) {
    return false;
  }
  const { confidence } = suggestion.metadata;
  if (
    (typeof confidence === 'number' ? confidence : 0) < commentFromConfidence
  ) {
    return false;
  }
  if (comment?.text) return false;
  return (
    text === undefined ||
    normalizeText(text) !== normalizeText(suggestion.content)
  );
};

/**
 * Per-agent on/off switch for AI reply suggestions, stored in localStorage and shared by
 * every component that uses it. Forced mode (the brand policy of the open conversation) keeps
 * suggestions on whatever the switch says, and the switch cannot be flipped meanwhile.
 */
export function useAISuggestionsToggle() {
  const setAISuggestionsEnabled = value => {
    isAISuggestionsEnabled.value = value;
    persistEnabledSetting(value);
  };

  const toggleAISuggestions = () => {
    if (isAISuggestionsForced.value) return;
    setAISuggestionsEnabled(!isAISuggestionsEnabled.value);
  };

  return {
    isAISuggestionsEnabled,
    isAISuggestionsForced,
    isAISuggestionsActive,
    setAISuggestionsEnabled,
    toggleAISuggestions,
  };
}

export function useAISuggestions() {
  const aiSuggestion = ref(null);
  const shownSuggestion = ref(null);
  const isLoadingSuggestion = ref(false);
  const isGeneratingSuggestion = ref(false);
  const suggestionDeadline = ref(0);
  const suggestionError = ref(null);
  const hasCheckedSuggestion = ref(false);
  const usedSuggestion = ref(null);
  let pollToken = 0;

  const { isAISuggestionsEnabled: isEnabled, setAISuggestionsEnabled } =
    useAISuggestionsToggle();

  const isReplyLocked = computed(
    () =>
      isAISuggestionsForced.value &&
      isLoadingSuggestion.value &&
      isGeneratingSuggestion.value
  );

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
    isGeneratingSuggestion.value = false;
  };

  /**
   * Polls the suggestion state until a suggestion answering `messageId` arrives, the service has
   * seen the message and is no longer generating, or `waitMs` elapses; every answer updates the
   * forced-mode policy. The loading state is shown while suggestions are on (by the agent or by
   * forced mode), and the message counts as generating while the service says so or, for up to
   * `unseenLockMs`, until the service has seen it. A failed request drops forced mode. A newer
   * call or clearSuggestion cancels it.
   */
  const waitForSuggestion = async (
    conversationId,
    {
      inboxId,
      messageId = 0,
      waitMs = AI_SUGGESTION_MAX_WAIT_MS,
      unseenLockMs = 0,
      initialDelayMs = 0,
      intervalMs = AI_SUGGESTION_POLL_INTERVAL_MS,
    } = {}
  ) => {
    clearSuggestion();
    if (!conversationId) return null;
    focusPolicyOn(conversationId);

    const token = pollToken;
    const startedAt = Date.now();
    const deadline = startedAt + waitMs;
    const isCurrent = () => token === pollToken;
    suggestionDeadline.value = deadline;
    isLoadingSuggestion.value = isAISuggestionsActive.value;
    isGeneratingSuggestion.value = true;

    const poll = async () => {
      const state = await chatwootExtraAPI.getAISuggestionState(
        conversationId,
        inboxId
      );
      if (!isCurrent()) return null;
      applyPolicy(conversationId, state);
      if (!isAISuggestionsActive.value) return null;
      isLoadingSuggestion.value = true;
      if (isSuggestionFor(state.suggestion, messageId)) return state.suggestion;
      const isSeen = (state.latestMessageId ?? 0) >= messageId;
      if (isSeen && !state.generating) return null;
      isGeneratingSuggestion.value =
        state.generating || Date.now() < startedAt + unseenLockMs;
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
        if (suggestion) shownSuggestion.value = suggestion;
      }
      return suggestion;
    } catch (error) {
      if (isCurrent()) {
        applyPolicy(conversationId, null);
        suggestionError.value = {
          message: error.response?.data?.error || error.message,
        };
      }
      return null;
    } finally {
      if (isCurrent()) {
        isLoadingSuggestion.value = false;
        isGeneratingSuggestion.value = false;
      }
    }
  };

  /**
   * Re-reads whether forced mode applies to the conversation; a failed request drops it. Resolves
   * to whether it applies.
   */
  const refreshSuggestionPolicy = async (conversationId, inboxId) => {
    focusPolicyOn(conversationId);
    try {
      applyPolicy(
        conversationId,
        await chatwootExtraAPI.getAISuggestionState(conversationId, inboxId)
      );
    } catch {
      applyPolicy(conversationId, null);
    }
    return isAISuggestionsForced.value;
  };

  /**
   * Loads the suggestion for the customer message the conversation is waiting on, polling until
   * 45 s after the message was sent, so every agent and tab waits (and in forced mode stays locked)
   * until the same moment. Older messages are checked once. Without a message waiting, only the
   * forced-mode policy is read.
   */
  const refreshSuggestionForMessage = (conversationId, message, inboxId) => {
    if (!message) {
      clearSuggestion();
      if (!conversationId) return Promise.resolve(null);
      return refreshSuggestionPolicy(conversationId, inboxId).then(() => null);
    }
    const createdAtMs = (message.created_at || 0) * 1000;
    const ageMs = Date.now() - createdAtMs;
    return waitForSuggestion(conversationId, {
      inboxId,
      messageId: message.id,
      waitMs: Math.max(0, AI_SUGGESTION_MAX_WAIT_MS - ageMs),
      unseenLockMs: Math.max(0, AI_SUGGESTION_UNSEEN_LOCK_MS - ageMs),
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

  /**
   * Tells the engine the agent inserted a suggestion into the reply box, once per suggestion
   * per session. Fire-and-forget: it never throws, and a failed request is retried on the next
   * use of the same suggestion.
   */
  const reportUsedSuggestion = (conversationId, suggestion) => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    if (!suggestionId || reportedUsedSuggestionIds.has(suggestionId)) {
      return Promise.resolve(null);
    }
    reportedUsedSuggestionIds.add(suggestionId);
    return chatwootExtraAPI
      .sendAISuggestionFeedback(conversationId, { suggestionId, used: true })
      .catch(() => {
        reportedUsedSuggestionIds.delete(suggestionId);
        return null;
      });
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
   * The agent's comment on a suggestion in this session as `{ text, status, error }`, or null when
   * they have not commented. `text` is the last comment that was sent (null until one is), `status`
   * is 'sending', 'sent' or 'error' for the latest request, and `error` is the server's reason when
   * it refused the comment (e.g. "Ваш коментар незрозумілий").
   */
  const getSuggestionComment = suggestion => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    return (suggestionId && suggestionComments[suggestionId]) || null;
  };

  /**
   * Sends a free-text comment on a suggestion, independent of its rating; a later comment
   * replaces the earlier one. Resolves to true once it is sent, and to false when the comment has
   * too few letters (see isCommentDetailedEnough), the suggestion has no id or the request fails,
   * keeping the earlier comment.
   */
  const commentOnSuggestion = async (conversationId, suggestion, comment) => {
    const suggestionId = suggestion?.metadata?.suggestionId;
    const text = (comment || '').trim();
    if (!suggestionId || !isCommentDetailedEnough(text)) return false;

    const previousText = suggestionComments[suggestionId]?.text || null;
    suggestionComments[suggestionId] = {
      text: previousText,
      status: 'sending',
    };
    const request = suggestionComments[suggestionId];
    const settle = state => {
      if (suggestionComments[suggestionId] === request) {
        suggestionComments[suggestionId] = state;
      }
    };
    try {
      await chatwootExtraAPI.sendAISuggestionFeedback(conversationId, {
        suggestionId,
        comment: text,
      });
      settle({ text, status: 'sent' });
      return true;
    } catch (error) {
      settle({
        text: previousText,
        status: 'error',
        error:
          error.response?.status === 400
            ? error.response.data?.error || null
            : null,
      });
      return false;
    }
  };

  /**
   * The suggestion forced mode asks the agent to comment on before sending `text` in the
   * conversation, or before dismissing it when `text` is undefined: the latest one shown, while it
   * still answers the message awaiting reply (`messageId`). Null when forced mode is off or no
   * comment is needed.
   */
  const getSuggestionNeedingComment = (conversationId, messageId, text) => {
    const suggestion = shownSuggestion.value;
    if (
      !isAISuggestionsForced.value ||
      String(suggestion?.conversationId) !== String(conversationId) ||
      !isSuggestionFor(suggestion, messageId)
    ) {
      return null;
    }
    return needsSuggestionComment({
      suggestion,
      commentFromConfidence: suggestionPolicy.value.commentFromConfidence,
      comment: getSuggestionComment(suggestion),
      text,
    })
      ? suggestion
      : null;
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
    isAISuggestionsForced,
    isAISuggestionsActive,
    isReplyLocked,
    suggestionDeadline,
    setAISuggestionsEnabled,
    waitForSuggestion,
    refreshSuggestionPolicy,
    refreshSuggestionForMessage,
    clearSuggestion,
    rememberUsedSuggestion,
    reportUsedSuggestion,
    rejectSuggestion,
    getSuggestionRating,
    rateSuggestion,
    getSuggestionComment,
    commentOnSuggestion,
    getSuggestionNeedingComment,
    reportSentMessage,
  };
}

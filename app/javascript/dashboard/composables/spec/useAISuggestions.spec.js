import chatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { LOCAL_STORAGE_KEYS } from 'dashboard/constants/localStorage';
import {
  AI_SUGGESTION_POLL_INTERVAL_MS,
  findMessageAwaitingReply,
  isCommentDetailedEnough,
  isSuggestionFor,
  needsSuggestionComment,
  useAISuggestions,
  useAISuggestionsToggle,
} from '../useAISuggestions';

vi.mock('dashboard/api/chatwootExtra', () => ({
  default: {
    getAISuggestionState: vi.fn(),
    sendAISuggestionFeedback: vi.fn(),
  },
}));

const suggestion = (
  triggerMessageId,
  content = `for ${triggerMessageId}`,
  confidence = undefined
) => ({
  conversationId: '55',
  content,
  triggerMessageId,
  metadata: { suggestionId: `sug-${triggerMessageId}`, confidence },
});

const state = (overrides = {}) => ({
  forced: false,
  commentFromConfidence: null,
  generating: false,
  latestMessageId: null,
  suggestion: null,
  ...overrides,
});

const forcedState = (overrides = {}) =>
  state({ forced: true, commentFromConfidence: 0.9, ...overrides });

const incoming = id => ({ id, message_type: 0, private: false });
const agentReply = (id, extra = {}) => ({
  id,
  message_type: 1,
  private: false,
  sender_type: 'User',
  ...extra,
});

beforeEach(async () => {
  vi.clearAllMocks();
  chatwootExtraAPI.sendAISuggestionFeedback.mockResolvedValue({
    success: true,
  });
  useAISuggestionsToggle().setAISuggestionsEnabled(true);
  chatwootExtraAPI.getAISuggestionState.mockResolvedValue(state());
  await useAISuggestions().refreshSuggestionPolicy(0, 7);
  vi.clearAllMocks();
  chatwootExtraAPI.sendAISuggestionFeedback.mockResolvedValue({
    success: true,
  });
  chatwootExtraAPI.getAISuggestionState.mockResolvedValue(state());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('findMessageAwaitingReply', () => {
  it('returns the latest customer message when no agent replied after it', () => {
    const messages = [incoming(1), agentReply(2), incoming(3), incoming(4)];
    expect(findMessageAwaitingReply(messages).id).toBe(4);
  });

  it('returns null once an agent replied, including pending replies', () => {
    expect(findMessageAwaitingReply([incoming(1), agentReply(2)])).toBeNull();
    expect(
      findMessageAwaitingReply([
        incoming(1),
        { id: 'tmp', message_type: 1, private: false, status: 'progress' },
      ])
    ).toBeNull();
  });

  it('ignores private notes, bot messages and activity', () => {
    const messages = [
      incoming(1),
      agentReply(2, { private: true }),
      agentReply(3, { sender_type: 'AgentBot', sender: { type: 'agent_bot' } }),
      agentReply(4, { content_attributes: { bot_system_message: true } }),
      { id: 5, message_type: 2 },
    ];
    expect(findMessageAwaitingReply(messages).id).toBe(1);
  });
});

describe('isSuggestionFor', () => {
  it('accepts suggestions generated for the message or a newer one', () => {
    expect(isSuggestionFor(suggestion(10), 10)).toBe(true);
    expect(isSuggestionFor(suggestion(11), 10)).toBe(true);
    expect(isSuggestionFor(suggestion(9), 10)).toBe(false);
    expect(isSuggestionFor(null, 10)).toBe(false);
  });
});

describe('useAISuggestionsToggle', () => {
  it('persists the setting in localStorage and shares it', () => {
    const first = useAISuggestionsToggle();
    const second = useAISuggestionsToggle();

    first.toggleAISuggestions();

    expect(second.isAISuggestionsEnabled.value).toBe(false);
    expect(
      window.localStorage.getItem(LOCAL_STORAGE_KEYS.AI_SUGGESTIONS_ENABLED)
    ).toBe('false');
  });
});

describe('useAISuggestions.waitForSuggestion', () => {
  it('polls until a suggestion for the awaited message arrives', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestionState
      .mockResolvedValueOnce(state({ generating: true, latestMessageId: 10 }))
      .mockResolvedValueOnce(
        state({
          generating: true,
          latestMessageId: 10,
          suggestion: suggestion(9),
        })
      )
      .mockResolvedValueOnce(
        state({ latestMessageId: 10, suggestion: suggestion(10) })
      );
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { inboxId: 7, messageId: 10 });
    expect(ai.isLoadingSuggestion.value).toBe(true);
    await vi.advanceTimersByTimeAsync(AI_SUGGESTION_POLL_INTERVAL_MS * 2);

    expect(await result).toEqual(suggestion(10));
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(3);
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledWith(55, 7);
    expect(ai.aiSuggestion.value).toEqual(suggestion(10));
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('stops once the service saw the message and is no longer generating', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestionState
      .mockResolvedValueOnce(state({ generating: true, latestMessageId: 10 }))
      .mockResolvedValueOnce(state({ latestMessageId: 10 }));
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(10000);

    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(2);
    expect(ai.hasCheckedSuggestion.value).toBe(true);
  });

  it('gives up after the wait window and reports that nothing was found', async () => {
    vi.useFakeTimers();
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10, waitMs: 5000 });
    await vi.advanceTimersByTimeAsync(10000);

    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(6);
    expect(ai.hasCheckedSuggestion.value).toBe(true);
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('keeps polling every second for up to 45 s by default', async () => {
    vi.useFakeTimers();
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(ai.isLoadingSuggestion.value).toBe(true);
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(31);

    await vi.advanceTimersByTimeAsync(20000);
    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(46);
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('stops polling when cleared', async () => {
    vi.useFakeTimers();
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(0);
    ai.clearSuggestion();
    await vi.advanceTimersByTimeAsync(30000);

    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(1);
  });

  it('only checks forced mode while suggestions are turned off', async () => {
    useAISuggestionsToggle().setAISuggestionsEnabled(false);
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue(
      state({ generating: true, latestMessageId: 10 })
    );
    const ai = useAISuggestions();

    expect(await ai.waitForSuggestion(55, { messageId: 10 })).toBeNull();
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(1);
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('surfaces errors and drops forced mode', async () => {
    chatwootExtraAPI.getAISuggestionState.mockResolvedValueOnce(forcedState());
    const ai = useAISuggestions();
    await ai.refreshSuggestionPolicy(55, 7);
    expect(ai.isAISuggestionsForced.value).toBe(true);

    chatwootExtraAPI.getAISuggestionState.mockRejectedValue(
      new Error('Network')
    );
    await ai.waitForSuggestion(55, { messageId: 10 });

    expect(ai.suggestionError.value).toEqual({ message: 'Network' });
    expect(ai.isAISuggestionsForced.value).toBe(false);
  });
});

describe('useAISuggestions forced mode', () => {
  it('keeps suggestions on and the switch locked while forced', async () => {
    const toggle = useAISuggestionsToggle();
    toggle.setAISuggestionsEnabled(false);
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue(
      forcedState({ latestMessageId: 10, suggestion: suggestion(10) })
    );
    const ai = useAISuggestions();

    expect(await ai.waitForSuggestion(55, { messageId: 10 })).toEqual(
      suggestion(10)
    );
    expect(ai.isAISuggestionsActive.value).toBe(true);

    toggle.toggleAISuggestions();
    expect(toggle.isAISuggestionsEnabled.value).toBe(false);
    expect(toggle.isAISuggestionsForced.value).toBe(true);
  });

  it('locks the reply while the suggestion is generated', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestionState
      .mockResolvedValueOnce(
        forcedState({ generating: true, latestMessageId: 10 })
      )
      .mockResolvedValueOnce(
        forcedState({ latestMessageId: 10, suggestion: suggestion(10) })
      );
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(0);
    expect(ai.isReplyLocked.value).toBe(true);
    expect(ai.suggestionDeadline.value).toBe(Date.now() + 45000);

    await vi.advanceTimersByTimeAsync(AI_SUGGESTION_POLL_INTERVAL_MS);
    await result;
    expect(ai.isReplyLocked.value).toBe(false);
  });

  it('does not lock without forced mode', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue(
      state({ generating: true, latestMessageId: 10 })
    );
    const ai = useAISuggestions();

    ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(0);

    expect(ai.isLoadingSuggestion.value).toBe(true);
    expect(ai.isReplyLocked.value).toBe(false);
    ai.clearSuggestion();
  });

  it('unlocks a message the service has not seen once the grace period ends', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue(
      forcedState({ latestMessageId: 9 })
    );
    const ai = useAISuggestions();

    ai.waitForSuggestion(55, { messageId: 10, unseenLockMs: 2000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(ai.isReplyLocked.value).toBe(true);

    await vi.advanceTimersByTimeAsync(3000);
    expect(ai.isLoadingSuggestion.value).toBe(true);
    expect(ai.isReplyLocked.value).toBe(false);
    ai.clearSuggestion();
  });

  it('waits until 45 s after the customer message, whoever opens it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T10:00:30Z'));
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue(
      forcedState({ generating: true, latestMessageId: 10 })
    );
    const ai = useAISuggestions();
    const message = {
      id: 10,
      created_at: Date.parse('2026-10-26T10:00:00Z') / 1000,
    };

    const result = ai.refreshSuggestionForMessage(55, message, 7);
    await vi.advanceTimersByTimeAsync(0);
    expect(ai.suggestionDeadline.value).toBe(
      Date.parse('2026-10-26T10:00:45Z')
    );
    await vi.advanceTimersByTimeAsync(16000);

    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledTimes(16);
    expect(ai.isReplyLocked.value).toBe(false);
  });

  it('reads only the policy when no message awaits a reply', async () => {
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue(forcedState());
    const ai = useAISuggestions();

    await ai.refreshSuggestionForMessage(55, null, 7);

    expect(chatwootExtraAPI.getAISuggestionState).toHaveBeenCalledWith(55, 7);
    expect(ai.isAISuggestionsForced.value).toBe(true);
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('ignores the policy of a conversation the agent has left', async () => {
    let resolveLate;
    chatwootExtraAPI.getAISuggestionState.mockReturnValueOnce(
      new Promise(resolve => {
        resolveLate = resolve;
      })
    );
    const ai = useAISuggestions();

    const late = ai.refreshSuggestionPolicy(55, 7);
    await ai.refreshSuggestionPolicy(56, 7);
    resolveLate(forcedState());
    await late;

    expect(ai.isAISuggestionsForced.value).toBe(false);
  });
});

describe('isCommentDetailedEnough', () => {
  it('needs at least four letters of any alphabet', () => {
    expect(isCommentDetailedEnough('Ціна')).toBe(true);
    expect(isCommentDetailedEnough('Wrong')).toBe(true);
    expect(isCommentDetailedEnough(' сума, не та! ')).toBe(true);
  });

  it('does not count digits, spaces, punctuation or other symbols', () => {
    ['', 'ок', 'Ні!!!', '...,,,', '12345', 'а, б, в.', '🙏🙏🙏🙏'].forEach(
      text => {
        expect(isCommentDetailedEnough(text)).toBe(false);
      }
    );
  });
});

describe('needsSuggestionComment', () => {
  const confident = suggestion(10, 'Hello there', 0.95);

  it('asks for a comment when a confident suggestion is not sent as is', () => {
    expect(
      needsSuggestionComment({
        suggestion: confident,
        commentFromConfidence: 0.9,
        text: 'Something else',
      })
    ).toBe(true);
    expect(
      needsSuggestionComment({
        suggestion: confident,
        commentFromConfidence: 0.9,
      })
    ).toBe(true);
  });

  it('does not ask when the suggestion is sent as is or was commented on', () => {
    expect(
      needsSuggestionComment({
        suggestion: confident,
        commentFromConfidence: 0.9,
        text: ' Hello  there\n',
      })
    ).toBe(false);
    expect(
      needsSuggestionComment({
        suggestion: confident,
        commentFromConfidence: 0.9,
        comment: { text: 'Wrong amount', status: 'sent' },
        text: 'Something else',
      })
    ).toBe(false);
  });

  it('asks only from the confidence threshold, treating unknown confidence as 0', () => {
    const unsure = suggestion(10, 'Hello there', 0.89);
    const unknown = suggestion(10, 'Hello there');
    const ask = (s, commentFromConfidence) =>
      needsSuggestionComment({
        suggestion: s,
        commentFromConfidence,
        text: 'Other',
      });

    expect(ask(unsure, 0.9)).toBe(false);
    expect(ask(unknown, 0.9)).toBe(false);
    expect(ask(unknown, 0)).toBe(true);
    expect(ask(confident, null)).toBe(false);
  });
});

describe('useAISuggestions.getSuggestionNeedingComment', () => {
  const show = async (policy, shown = suggestion(10, 'Hello there', 0.95)) => {
    chatwootExtraAPI.getAISuggestionState.mockResolvedValue({
      ...policy,
      latestMessageId: 10,
      suggestion: shown,
    });
    const ai = useAISuggestions();
    await ai.waitForSuggestion(55, { messageId: 10 });
    return ai;
  };

  it('returns the shown suggestion when forced mode needs a comment', async () => {
    const ai = await show(forcedState());

    expect(ai.getSuggestionNeedingComment(55, 10, 'Other')).toEqual(
      suggestion(10, 'Hello there', 0.95)
    );
    expect(ai.getSuggestionNeedingComment(55, 10)).not.toBeNull();
    expect(ai.getSuggestionNeedingComment(55, 10, 'Hello there')).toBeNull();
  });

  it('keeps asking after the suggestion was used or dismissed', async () => {
    const ai = await show(forcedState());
    ai.clearSuggestion();

    expect(ai.getSuggestionNeedingComment(55, 10, 'Other')).not.toBeNull();
  });

  it('stops asking once the agent commented', async () => {
    const shown = suggestion(11, 'Hello there', 0.95);
    const ai = await show(forcedState(), shown);
    await ai.commentOnSuggestion(55, shown, 'Wrong amount');

    expect(ai.getSuggestionNeedingComment(55, 11, 'Other')).toBeNull();
  });

  it('does not ask without forced mode, for other conversations or newer messages', async () => {
    expect(
      (await show(state())).getSuggestionNeedingComment(55, 10, 'Other')
    ).toBeNull();

    const ai = await show(forcedState());
    expect(ai.getSuggestionNeedingComment(56, 10, 'Other')).toBeNull();
    expect(ai.getSuggestionNeedingComment(55, 12, 'Other')).toBeNull();
  });
});

describe('useAISuggestions feedback', () => {
  it('reports an unchanged used suggestion as accepted', async () => {
    const ai = useAISuggestions();
    ai.rememberUsedSuggestion(55, suggestion(10, 'Hello  there'));

    await ai.reportSentMessage({
      conversationId: 55,
      message: 'Hello there\n',
      private: false,
    });

    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledWith(55, {
      suggestionId: 'sug-10',
      action: 'accepted',
    });
  });

  it('reports a changed used suggestion as edited with the final text', async () => {
    const ai = useAISuggestions();
    ai.rememberUsedSuggestion(55, suggestion(10, 'Hello there'));

    await ai.reportSentMessage({
      conversationId: 55,
      message: 'Hello there, Olena! ',
      private: false,
    });
    await ai.reportSentMessage({
      conversationId: 55,
      message: 'Another reply',
      private: false,
    });

    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledTimes(1);
    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledWith(55, {
      suggestionId: 'sug-10',
      action: 'edited',
      finalText: 'Hello there, Olena!',
    });
  });

  it('ignores private notes, empty messages and other conversations', async () => {
    const ai = useAISuggestions();
    ai.rememberUsedSuggestion(55, suggestion(10, 'Hello there'));

    await ai.reportSentMessage({
      conversationId: 55,
      message: 'note',
      private: true,
    });
    await ai.reportSentMessage({ conversationId: 55, message: '' });
    await ai.reportSentMessage({ conversationId: 56, message: 'Hello there' });

    expect(chatwootExtraAPI.sendAISuggestionFeedback).not.toHaveBeenCalled();
  });

  it('reports a dismissed suggestion as rejected', async () => {
    const ai = useAISuggestions();

    await ai.rejectSuggestion(55, suggestion(10));

    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledWith(55, {
      suggestionId: 'sug-10',
      action: 'rejected',
    });
  });

  it('swallows feedback errors', async () => {
    chatwootExtraAPI.sendAISuggestionFeedback.mockRejectedValue(
      new Error('down')
    );
    const ai = useAISuggestions();

    await expect(ai.rejectSuggestion(55, suggestion(10))).resolves.toBeNull();
  });
});

describe('useAISuggestions rating', () => {
  it('sends the rating with the suggestion id and shows it right away', async () => {
    const ai = useAISuggestions();
    const rated = suggestion(20);

    const request = ai.rateSuggestion(55, rated, 'up');
    expect(ai.getSuggestionRating(rated)).toBe('up');
    await request;

    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledWith(55, {
      suggestionId: 'sug-20',
      rating: 'up',
    });
  });

  it('switches the rating and ignores repeating the current one', async () => {
    const ai = useAISuggestions();
    const rated = suggestion(21);

    await ai.rateSuggestion(55, rated, 'up');
    await ai.rateSuggestion(55, rated, 'up');
    await ai.rateSuggestion(55, rated, 'down');

    expect(ai.getSuggestionRating(rated)).toBe('down');
    expect(chatwootExtraAPI.sendAISuggestionFeedback.mock.calls).toEqual([
      [55, { suggestionId: 'sug-21', rating: 'up' }],
      [55, { suggestionId: 'sug-21', rating: 'down' }],
    ]);
  });

  it('keeps the rating per suggestion for the session', async () => {
    await useAISuggestions().rateSuggestion(55, suggestion(22), 'down');
    const ai = useAISuggestions();

    expect(ai.getSuggestionRating(suggestion(22))).toBe('down');
    expect(ai.getSuggestionRating(suggestion(23))).toBeNull();
  });

  it('reverts the rating when the request fails', async () => {
    const ai = useAISuggestions();
    await ai.rateSuggestion(55, suggestion(24), 'up');
    chatwootExtraAPI.sendAISuggestionFeedback.mockRejectedValue(
      new Error('down')
    );

    await expect(
      ai.rateSuggestion(55, suggestion(24), 'down')
    ).resolves.toBeNull();
    await ai.rateSuggestion(55, suggestion(25), 'up');

    expect(ai.getSuggestionRating(suggestion(24))).toBe('up');
    expect(ai.getSuggestionRating(suggestion(25))).toBeNull();
  });

  it('ignores suggestions without an id', async () => {
    const ai = useAISuggestions();

    expect(await ai.rateSuggestion(55, { content: 'Hi' }, 'up')).toBeNull();
    expect(ai.getSuggestionRating({ content: 'Hi' })).toBeNull();
    expect(chatwootExtraAPI.sendAISuggestionFeedback).not.toHaveBeenCalled();
  });

  it('leaves the shown suggestion and the used-suggestion feedback alone', async () => {
    const ai = useAISuggestions();
    const rated = suggestion(26, 'Hello there');
    ai.aiSuggestion.value = rated;

    await ai.rateSuggestion(55, rated, 'up');
    ai.rememberUsedSuggestion(55, rated);
    await ai.reportSentMessage({ conversationId: 55, message: 'Hello there' });

    expect(ai.aiSuggestion.value).toEqual(rated);
    expect(chatwootExtraAPI.sendAISuggestionFeedback.mock.calls).toEqual([
      [55, { suggestionId: 'sug-26', rating: 'up' }],
      [55, { suggestionId: 'sug-26', action: 'accepted' }],
    ]);
  });
});

describe('useAISuggestions comment', () => {
  it('sends the trimmed comment with the suggestion id and marks it sent', async () => {
    const ai = useAISuggestions();
    const commented = suggestion(40);

    const request = ai.commentOnSuggestion(55, commented, '  Wrong amount  ');
    expect(ai.getSuggestionComment(commented)).toEqual({
      text: null,
      status: 'sending',
    });

    await expect(request).resolves.toBe(true);
    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledWith(55, {
      suggestionId: 'sug-40',
      comment: 'Wrong amount',
    });
    expect(ai.getSuggestionComment(commented)).toEqual({
      text: 'Wrong amount',
      status: 'sent',
    });
  });

  it('does not send comments with fewer than four letters', async () => {
    const ai = useAISuggestions();

    expect(await ai.commentOnSuggestion(55, suggestion(45), 'ок...')).toBe(
      false
    );
    expect(chatwootExtraAPI.sendAISuggestionFeedback).not.toHaveBeenCalled();
  });

  it('does not send blank comments or comments for suggestions without an id', async () => {
    const ai = useAISuggestions();

    expect(await ai.commentOnSuggestion(55, suggestion(41), '   ')).toBe(false);
    expect(await ai.commentOnSuggestion(55, suggestion(41), '')).toBe(false);
    expect(await ai.commentOnSuggestion(55, { content: 'Hi' }, 'Nope')).toBe(
      false
    );
    expect(chatwootExtraAPI.sendAISuggestionFeedback).not.toHaveBeenCalled();
    expect(ai.getSuggestionComment(suggestion(41))).toBeNull();
    expect(ai.getSuggestionComment({ content: 'Hi' })).toBeNull();
  });

  it('replaces the earlier comment with a later one', async () => {
    const ai = useAISuggestions();
    const commented = suggestion(42);

    await ai.commentOnSuggestion(55, commented, 'First');
    await ai.commentOnSuggestion(55, commented, 'Second');

    expect(ai.getSuggestionComment(commented).text).toBe('Second');
    expect(chatwootExtraAPI.sendAISuggestionFeedback.mock.calls).toEqual([
      [55, { suggestionId: 'sug-42', comment: 'First' }],
      [55, { suggestionId: 'sug-42', comment: 'Second' }],
    ]);
  });

  it('reports a failure and keeps the earlier comment', async () => {
    const ai = useAISuggestions();
    const commented = suggestion(43);
    await ai.commentOnSuggestion(55, commented, 'First');
    chatwootExtraAPI.sendAISuggestionFeedback.mockRejectedValue(
      new Error('down')
    );

    await expect(ai.commentOnSuggestion(55, commented, 'Second')).resolves.toBe(
      false
    );

    expect(ai.getSuggestionComment(commented)).toEqual({
      text: 'First',
      status: 'error',
    });
  });

  it('keeps the comment per suggestion and independent of the rating', async () => {
    const ai = useAISuggestions();
    const commented = suggestion(44);

    await ai.rateSuggestion(55, commented, 'down');
    await ai.commentOnSuggestion(55, commented, 'Too formal');
    const another = useAISuggestions();

    expect(another.getSuggestionComment(commented).text).toBe('Too formal');
    expect(another.getSuggestionComment(suggestion(45))).toBeNull();
    expect(another.getSuggestionRating(commented)).toBe('down');
    expect(chatwootExtraAPI.sendAISuggestionFeedback.mock.calls).toEqual([
      [55, { suggestionId: 'sug-44', rating: 'down' }],
      [55, { suggestionId: 'sug-44', comment: 'Too formal' }],
    ]);
  });
});

describe('useAISuggestions used', () => {
  it('sends used once per suggestion per session', async () => {
    const ai = useAISuggestions();
    const used = suggestion(50);

    await ai.reportUsedSuggestion(55, used);
    await ai.reportUsedSuggestion(55, used);
    await useAISuggestions().reportUsedSuggestion(55, used);
    await ai.reportUsedSuggestion(55, suggestion(51));

    expect(chatwootExtraAPI.sendAISuggestionFeedback.mock.calls).toEqual([
      [55, { suggestionId: 'sug-50', used: true }],
      [55, { suggestionId: 'sug-51', used: true }],
    ]);
  });

  it('ignores suggestions without an id', async () => {
    const ai = useAISuggestions();

    expect(await ai.reportUsedSuggestion(55, { content: 'Hi' })).toBeNull();
    expect(await ai.reportUsedSuggestion(55, null)).toBeNull();
    expect(chatwootExtraAPI.sendAISuggestionFeedback).not.toHaveBeenCalled();
  });

  it('swallows failures and retries on the next use', async () => {
    const ai = useAISuggestions();
    chatwootExtraAPI.sendAISuggestionFeedback.mockRejectedValueOnce(
      new Error('down')
    );

    await expect(
      ai.reportUsedSuggestion(55, suggestion(52))
    ).resolves.toBeNull();
    await ai.reportUsedSuggestion(55, suggestion(52));

    expect(chatwootExtraAPI.sendAISuggestionFeedback).toHaveBeenCalledTimes(2);
  });

  it('does not change the accepted / edited reporting on send', async () => {
    const ai = useAISuggestions();
    const used = suggestion(53, 'Hello there');

    ai.rememberUsedSuggestion(55, used);
    await ai.reportUsedSuggestion(55, used);
    await ai.reportSentMessage({ conversationId: 55, message: 'Hello there' });

    expect(chatwootExtraAPI.sendAISuggestionFeedback.mock.calls).toEqual([
      [55, { suggestionId: 'sug-53', used: true }],
      [55, { suggestionId: 'sug-53', action: 'accepted' }],
    ]);
  });
});

import chatwootExtraAPI from 'dashboard/api/chatwootExtra';
import { LOCAL_STORAGE_KEYS } from 'dashboard/constants/localStorage';
import {
  AI_SUGGESTION_POLL_INTERVAL_MS,
  findMessageAwaitingReply,
  isSuggestionFor,
  useAISuggestions,
  useAISuggestionsToggle,
} from '../useAISuggestions';

vi.mock('dashboard/api/chatwootExtra', () => ({
  default: {
    getAISuggestion: vi.fn(),
    sendAISuggestionFeedback: vi.fn(),
  },
}));

const notFound = () =>
  Object.assign(new Error('Not found'), { response: { status: 404 } });

const suggestion = (triggerMessageId, content = `for ${triggerMessageId}`) => ({
  conversationId: '55',
  content,
  triggerMessageId,
  metadata: { suggestionId: `sug-${triggerMessageId}` },
});

const incoming = id => ({ id, message_type: 0, private: false });
const agentReply = (id, extra = {}) => ({
  id,
  message_type: 1,
  private: false,
  sender_type: 'User',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  chatwootExtraAPI.sendAISuggestionFeedback.mockResolvedValue({
    success: true,
  });
  useAISuggestionsToggle().setAISuggestionsEnabled(true);
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
    chatwootExtraAPI.getAISuggestion
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(suggestion(9))
      .mockResolvedValueOnce(suggestion(10));
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    expect(ai.isLoadingSuggestion.value).toBe(true);
    await vi.advanceTimersByTimeAsync(AI_SUGGESTION_POLL_INTERVAL_MS * 2);

    expect(await result).toEqual(suggestion(10));
    expect(chatwootExtraAPI.getAISuggestion).toHaveBeenCalledTimes(3);
    expect(ai.aiSuggestion.value).toEqual(suggestion(10));
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('gives up after the wait window and reports that nothing was found', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestion.mockRejectedValue(notFound());
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10, waitMs: 5000 });
    await vi.advanceTimersByTimeAsync(10000);

    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestion).toHaveBeenCalledTimes(6);
    expect(ai.hasCheckedSuggestion.value).toBe(true);
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('keeps polling every second for up to 40 s by default', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestion.mockRejectedValue(notFound());
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(30000);
    expect(ai.isLoadingSuggestion.value).toBe(true);
    expect(chatwootExtraAPI.getAISuggestion).toHaveBeenCalledTimes(31);

    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestion).toHaveBeenCalledTimes(41);
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('stops polling when cleared', async () => {
    vi.useFakeTimers();
    chatwootExtraAPI.getAISuggestion.mockRejectedValue(notFound());
    const ai = useAISuggestions();

    const result = ai.waitForSuggestion(55, { messageId: 10 });
    await vi.advanceTimersByTimeAsync(0);
    ai.clearSuggestion();
    await vi.advanceTimersByTimeAsync(30000);

    expect(await result).toBeNull();
    expect(chatwootExtraAPI.getAISuggestion).toHaveBeenCalledTimes(1);
  });

  it('makes no requests while suggestions are turned off', async () => {
    useAISuggestionsToggle().setAISuggestionsEnabled(false);
    const ai = useAISuggestions();

    expect(await ai.waitForSuggestion(55, { messageId: 10 })).toBeNull();
    expect(chatwootExtraAPI.getAISuggestion).not.toHaveBeenCalled();
    expect(ai.isLoadingSuggestion.value).toBe(false);
  });

  it('surfaces non-404 errors', async () => {
    chatwootExtraAPI.getAISuggestion.mockRejectedValue(new Error('Network'));
    const ai = useAISuggestions();

    await ai.waitForSuggestion(55, { messageId: 10 });

    expect(ai.suggestionError.value).toEqual({ message: 'Network' });
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

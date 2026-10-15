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

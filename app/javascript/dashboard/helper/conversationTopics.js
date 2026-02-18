import ChatwootExtraAPI from '../api/chatwootExtra';
import types from '../store/mutation-types';

let initialized = false;

export const initializeConversationTopics = store => {
  if (initialized) return;
  initialized = true;

  let eventSource = null;
  let currentOperatorId = null;
  let reconnectTimer = null;

  const cleanup = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connectSSE = operatorId => {
    if (!operatorId) return;
    cleanup();

    const streamUrl =
      ChatwootExtraAPI.getConversationTopicStreamURL(operatorId);
    eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('initial-state', event => {
      try {
        const data = JSON.parse(event.data);
        const topics = data?.topics || [];
        topics.forEach(item => {
          if (!item) return;
          store.commit(types.SET_CONVERSATION_TOPIC, {
            conversationId: item.conversationId,
            topic: item.topic,
            labelColor: item.labelColor,
          });
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ConversationTopics] Failed to parse initial-state',
          error
        );
      }
    });

    eventSource.addEventListener('topic-selected', event => {
      try {
        const payload = JSON.parse(event.data);
        store.commit(types.SET_CONVERSATION_TOPIC, {
          conversationId: payload.conversationId,
          topic: payload.topic,
          labelColor: payload.labelColor,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ConversationTopics] Failed to parse topic-selected',
          error
        );
      }
    });

    eventSource.onerror = () => {
      cleanup();
      reconnectTimer = setTimeout(() => {
        connectSSE(operatorId);
      }, 3000);
    };
  };

  store.watch(
    () => store.getters.getCurrentUser,
    user => {
      const operatorId = user?.id;
      if (!operatorId || operatorId === currentOperatorId) return;

      currentOperatorId = operatorId;
      store.commit(types.CLEAR_CONVERSATION_TOPICS);
      connectSSE(operatorId);
    },
    { immediate: true }
  );

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      cleanup();
      store.commit(types.CLEAR_CONVERSATION_TOPICS);
    });
  }
};

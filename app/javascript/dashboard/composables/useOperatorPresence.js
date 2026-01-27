import { ref, onUnmounted, watch } from 'vue';
import ChatwootExtraAPI from '../api/chatwootExtra';

export const useOperatorPresence = (conversationId, operatorId) => {
  const operators = ref([]);
  const isConnected = ref(false);
  const error = ref(null);
  const isTransitioning = ref(false);

  let eventSource = null;
  let heartbeatInterval = null;
  const hasJoined = ref(false);
  const currentConversationId = ref(null);
  let debounceTimer = null;
  let reconnectTimeout = null;
  let heartbeatFailCount = 0;
  const MAX_HEARTBEAT_FAILURES = 3;
  const isTabVisible = ref(true);
  let focusHandler = null;
  let beforeUnloadHandler = null;
  let isUnmounted = false;
  let isTransitionInProgress = false;

  const cleanupConnections = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const sendHeartbeat = async () => {
    if (hasJoined.value && conversationId.value) {
      try {
        await ChatwootExtraAPI.sendHeartbeat(
          conversationId.value,
          operatorId.value
        );
        heartbeatFailCount = 0;
      } catch {
        heartbeatFailCount += 1;
        error.value = 'Connection unstable';
        if (heartbeatFailCount >= MAX_HEARTBEAT_FAILURES) {
          cleanupConnections();
        }
      }
    }
  };

  const startHeartbeat = (interval = 15000) => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatFailCount = 0;

    sendHeartbeat();

    heartbeatInterval = setInterval(sendHeartbeat, interval);
  };

  const connectSSE = () => {
    if (!conversationId.value || !operatorId.value || isUnmounted) return;

    cleanupConnections();

    try {
      const streamUrl = ChatwootExtraAPI.getOperatorPresenceStreamURL(
        conversationId.value,
        operatorId.value
      );

      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('initial-state', event => {
        const data = JSON.parse(event.data);
        operators.value = data.operators || [];
        isConnected.value = true;
        error.value = null;
        isTransitioning.value = false;
      });

      eventSource.addEventListener('operator-joined', event => {
        const data = JSON.parse(event.data);
        const exists = operators.value.some(
          op => op.operatorId === data.operator.operatorId
        );
        if (!exists) {
          operators.value.push(data.operator);
        }
      });

      eventSource.addEventListener('operator-left', event => {
        const data = JSON.parse(event.data);
        operators.value = operators.value.filter(
          op => op.operatorId !== data.operator.operatorId
        );
      });

      eventSource.onerror = () => {
        if (isUnmounted || isTransitionInProgress) {
          cleanupConnections();
          return;
        }

        isConnected.value = false;
        error.value = 'Connection lost';

        cleanupConnections();

        reconnectTimeout = setTimeout(() => {
          if (hasJoined.value && !isUnmounted && !isTransitionInProgress) {
            connectSSE();
          }
        }, 3000);
      };
    } catch {
      error.value = 'Failed to connect';
    }
  };

  const joinConversation = async () => {
    if (!conversationId.value || !operatorId.value || isUnmounted) return;

    if (
      hasJoined.value &&
      currentConversationId.value === conversationId.value
    ) {
      return;
    }

    isTransitioning.value = true;

    try {
      await ChatwootExtraAPI.joinConversation(
        conversationId.value,
        operatorId.value
      );

      if (isUnmounted) return;

      hasJoined.value = true;
      currentConversationId.value = conversationId.value;
      connectSSE();
      startHeartbeat();
      isTransitioning.value = false;
    } catch {
      if (!isUnmounted) {
        error.value = 'Failed to join';
        isTransitioning.value = false;
      }
    }
  };

  const leaveConversation = async () => {
    if (!currentConversationId.value || !operatorId.value || !hasJoined.value)
      return;

    cleanupConnections();

    const convId = currentConversationId.value;
    const opId = operatorId.value;

    hasJoined.value = false;
    currentConversationId.value = null;
    isConnected.value = false;
    operators.value = [];

    try {
      await ChatwootExtraAPI.leaveConversation(convId, opId);
    } catch {
      // Silently handle leave failures
    }
  };

  const handleWindowFocus = async () => {
    if (isUnmounted) return;
    isTabVisible.value = true;
    if (!hasJoined.value && conversationId.value) {
      await joinConversation();
    }
  };

  watch(
    conversationId,
    (newId, oldId) => {
      if (!isTabVisible.value) {
        isTransitioning.value = false;
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (isTransitionInProgress) {
        return;
      }

      isTransitioning.value = true;

      debounceTimer = setTimeout(async () => {
        if (isUnmounted || isTransitionInProgress) return;

        isTransitionInProgress = true;

        try {
          if (oldId && oldId !== newId) {
            await leaveConversation();
          }

          if (newId && !isUnmounted) {
            await joinConversation();
          }
        } finally {
          isTransitionInProgress = false;
        }
      }, 300);
    },
    { immediate: true }
  );

  if (typeof window !== 'undefined') {
    isTabVisible.value = !document.hidden;

    focusHandler = handleWindowFocus;
    window.addEventListener('focus', focusHandler);

    beforeUnloadHandler = () => {
      if (hasJoined.value) {
        const baseURL =
          window.chatwootConfig?.chatwootExtraApiUrl || 'http://localhost:3001';
        navigator.sendBeacon(
          `${baseURL}/api/operator-presence/conversations/${currentConversationId.value}/leave`,
          JSON.stringify({ operatorId: operatorId.value })
        );
      }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
  }

  onUnmounted(() => {
    isUnmounted = true;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    cleanupConnections();

    if (typeof window !== 'undefined') {
      if (focusHandler) {
        window.removeEventListener('focus', focusHandler);
        focusHandler = null;
      }
      if (beforeUnloadHandler) {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        beforeUnloadHandler = null;
      }
    }

    leaveConversation();
  });

  return {
    operators,
    isConnected,
    error,
    isTransitioning,
    joinConversation,
    leaveConversation,
  };
};

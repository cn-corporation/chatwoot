import { ref, onUnmounted, watch } from 'vue';
import ChatwootExtraAPI from '../api/chatwootExtra';

export const useOperatorPresence = (conversationId, operatorId) => {
  const operators = ref([]);
  const isConnected = ref(false);
  const error = ref(null);
  const isTransitioning = ref(false);

  let eventSource = null;
  let heartbeatInterval = null;
  let hasJoined = ref(false);
  let debounceTimer = null;
  let lastSwitchTime = 0;

  const startHeartbeat = (interval = 30000) => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(async () => {
      if (hasJoined.value && conversationId.value) {
        try {
          await ChatwootExtraAPI.sendHeartbeat(
            conversationId.value,
            operatorId.value
          );
        } catch {
          error.value = 'Connection unstable';
        }
      }
    }, interval);
  };

  const connectSSE = () => {
    if (!conversationId.value || !operatorId.value) return;

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
        isConnected.value = false;
        error.value = 'Connection lost. Reconnecting...';
        isTransitioning.value = true;

        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        setTimeout(() => {
          if (hasJoined.value) connectSSE();
        }, 3000);
      };
    } catch {
      error.value = 'Failed to connect';
    }
  };

  const joinConversation = async () => {
    if (!conversationId.value || !operatorId.value || hasJoined.value) return;
    isTransitioning.value = true;

    try {
      await ChatwootExtraAPI.joinConversation(
        conversationId.value,
        operatorId.value
      );
      hasJoined.value = true;
      connectSSE();
      startHeartbeat();
    } catch {
      error.value = 'Failed to join';
      isTransitioning.value = false;
    }
  };

  const leaveConversation = async () => {
    if (!conversationId.value || !operatorId.value || !hasJoined.value) return;

    try {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      await ChatwootExtraAPI.leaveConversation(
        conversationId.value,
        operatorId.value
      );

      hasJoined.value = false;
      isConnected.value = false;
      operators.value = [];
    } catch {
      // Silently handle leave failures
    }
  };

  // ✅ Hybrid debounce logic with immediate loader
  watch(conversationId, (newId, oldId) => {
    isTransitioning.value = true; // show loader right away
    if (debounceTimer) clearTimeout(debounceTimer);

    const now = Date.now();
    const diff = now - lastSwitchTime;
    lastSwitchTime = now;

    if (diff > 2000) {
      // first or normal switch → do immediately
      (async () => {
        if (oldId && oldId !== newId) await leaveConversation();
        if (newId) await joinConversation();
      })();
    } else {
      // user spamming → debounce to last action
      debounceTimer = setTimeout(async () => {
        if (oldId && oldId !== newId) await leaveConversation();
        if (newId) await joinConversation();
      }, 2000);
    }
  });

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    leaveConversation();
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (hasJoined.value) {
        const baseURL =
          window.chatwootConfig?.chatwootExtraApiUrl || 'http://localhost:3001';
        navigator.sendBeacon(
          `${baseURL}/api/operator-presence/conversations/${conversationId.value}/leave`,
          JSON.stringify({ operatorId: operatorId.value })
        );
      }
    });
  }

  return {
    operators,
    isConnected,
    error,
    isTransitioning,
    joinConversation,
    leaveConversation,
  };
};

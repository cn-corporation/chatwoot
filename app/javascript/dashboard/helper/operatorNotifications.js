import ChatwootExtraAPI from '../api/chatwootExtra';
import types from '../store/mutation-types';

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const initializeOperatorNotifications = store => {
  let eventSource = null;
  let currentOperatorId = null;
  let unreadCounts = new Map();
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

  const syncToVuex = () => {
    unreadCounts.forEach((count, conversationId) => {
      store.commit(types.SET_OPERATOR_NOTIFICATION_COUNT, {
        conversationId,
        unreadCount: count,
      });
    });
    store.commit(types.SET_OPERATOR_NOTIFICATIONS_READY, true);
  };

  const applyCounts = (label, items) => {
    items.forEach(item => {
      if (!item) return;
      const conversationId = String(item.conversationId);
      const count = toNumber(item.unreadCount);
      if (count > 0) {
        unreadCounts.set(conversationId, count);
      } else {
        unreadCounts.delete(conversationId);
      }
    });
  };

  const updateCount = (label, payload) => {
    if (!payload?.conversationId) return;
    const conversationId = String(payload.conversationId);
    const count = toNumber(payload.unreadCount);
    if (count > 0) {
      unreadCounts.set(conversationId, count);
    } else {
      unreadCounts.delete(conversationId);
    }
  };

  const connectSSE = operatorId => {
    if (!operatorId) return;
    cleanup();

    const streamUrl =
      ChatwootExtraAPI.getOperatorNotificationStreamURL(operatorId);
    eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('initial-state', event => {
      try {
        const data = JSON.parse(event.data);
        applyCounts('initial-state', data?.notifications || []);
        syncToVuex();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[OperatorNotifications] Failed to parse initial-state', {
          error,
          dataLength: event?.data?.length,
        });
      }
    });

    eventSource.addEventListener('message_created', event => {
      try {
        const payload = JSON.parse(event.data);
        updateCount('message_created', payload);
        store.commit(types.SET_OPERATOR_NOTIFICATION_COUNT, {
          conversationId: payload.conversationId,
          unreadCount: toNumber(payload.unreadCount),
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          '[OperatorNotifications] Failed to parse message_created',
          {
            error,
            dataLength: event?.data?.length,
          }
        );
      }
    });

    eventSource.addEventListener('marked_read', event => {
      try {
        const payload = JSON.parse(event.data);
        updateCount('marked_read', payload);
        store.commit(types.SET_OPERATOR_NOTIFICATION_COUNT, {
          conversationId: payload.conversationId,
          unreadCount: toNumber(payload.unreadCount),
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[OperatorNotifications] Failed to parse marked_read', {
          error,
          dataLength: event?.data?.length,
        });
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
      unreadCounts = new Map();
      store.commit(types.CLEAR_OPERATOR_NOTIFICATIONS);
      connectSSE(operatorId);
    },
    { immediate: true }
  );

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      cleanup();
      store.commit(types.CLEAR_OPERATOR_NOTIFICATIONS);
    });
  }
};

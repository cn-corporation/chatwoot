import ChatwootExtraAPI from '../api/chatwootExtra';

export const initializeTaskEvents = store => {
  let eventSource = null;
  let reconnectTimer = null;
  let currentAccountId = null;

  const cleanup = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const connectSSE = accountId => {
    if (!accountId) return;
    cleanup();

    const streamUrl = ChatwootExtraAPI.getTasksStreamURL(accountId);
    eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      // Reconcile whatever happened while we were disconnected.
      store.dispatch('tasks/fetchPending');
    };

    eventSource.addEventListener('task_created', event => {
      try {
        store.dispatch('tasks/applyTaskCreated', JSON.parse(event.data));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[TaskEvents] Failed to parse task_created', { error });
      }
    });

    eventSource.addEventListener('task_completed', event => {
      try {
        store.dispatch('tasks/applyTaskCompleted', JSON.parse(event.data));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[TaskEvents] Failed to parse task_completed', { error });
      }
    });

    eventSource.onerror = () => {
      cleanup();
      reconnectTimer = setTimeout(() => {
        connectSSE(currentAccountId);
      }, 3000);
    };
  };

  store.watch(
    (state, getters) => getters.getCurrentAccountId,
    accountId => {
      if (!accountId || accountId === currentAccountId) return;
      currentAccountId = accountId;
      connectSSE(accountId);
    },
    { immediate: true }
  );
};

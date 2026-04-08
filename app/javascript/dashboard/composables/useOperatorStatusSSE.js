import { onUnmounted, watch } from 'vue';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import ChatwootExtraAPI from '../api/chatwootExtra';

const STATUS_MAP = {
  online: 'online',
  degraded: 'busy',
  offline: 'offline',
};

export const useOperatorStatusSSE = () => {
  const store = useStore();
  let eventSource = null;

  const currentUser = useMapGetter('getCurrentUser');

  const updateAgentStatus = (operatorId, status) => {
    const mappedStatus = STATUS_MAP[status] || 'offline';
    store.dispatch('agents/updateSingleAgentPresence', {
      id: operatorId,
      availabilityStatus: mappedStatus,
    });
  };

  const connectSSE = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const streamUrl = ChatwootExtraAPI.getOperatorStatusStreamURL();
    eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('initial-state', event => {
      const data = JSON.parse(event.data);
      if (data.operators) {
        data.operators.forEach(op => {
          updateAgentStatus(op.operatorId, op.status);
        });
      }
    });

    eventSource.addEventListener('operator-online', event => {
      const data = JSON.parse(event.data);
      updateAgentStatus(data.operatorId, 'online');
    });

    eventSource.addEventListener('operator-degraded', event => {
      const data = JSON.parse(event.data);
      updateAgentStatus(data.operatorId, 'degraded');
    });

    eventSource.addEventListener('operator-offline', event => {
      const data = JSON.parse(event.data);
      updateAgentStatus(data.operatorId, 'offline');
    });

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setTimeout(() => {
        if (currentUser.value?.id) {
          connectSSE();
        }
      }, 5000);
    };
  };

  const disconnectSSE = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  watch(
    () => currentUser.value?.id,
    newId => {
      if (newId) {
        connectSSE();
      } else {
        disconnectSSE();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    disconnectSSE();
  });
};

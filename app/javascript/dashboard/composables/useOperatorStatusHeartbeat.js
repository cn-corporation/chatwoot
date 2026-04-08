import { onUnmounted, watch } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';
import ChatwootExtraAPI from '../api/chatwootExtra';

const HEARTBEAT_INTERVAL_MS = 30000;

export const useOperatorStatusHeartbeat = () => {
  let heartbeatInterval = null;

  const currentUser = useMapGetter('getCurrentUser');

  const sendHeartbeat = async () => {
    const user = currentUser.value;
    if (!user?.id) return;

    try {
      await ChatwootExtraAPI.sendOperatorStatusHeartbeat(user.id, user.name);
    } catch {
      // Silently handle heartbeat failures
    }
  };

  const startHeartbeat = () => {
    if (heartbeatInterval) return;
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  watch(
    () => currentUser.value?.id,
    newId => {
      if (newId) {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    stopHeartbeat();
  });
};

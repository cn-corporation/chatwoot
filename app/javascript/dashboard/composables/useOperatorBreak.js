import { ref, computed, watch } from 'vue';
import { useMapGetter, useStore } from 'dashboard/composables/store';
import ChatwootExtraAPI from '../api/chatwootExtra';

const REHYDRATE_POLL_MS = 30000;

const activeBreak = ref(null);
const isLoading = ref(false);

let pollInterval = null;
let watchedUserId = null;

const refreshActiveBreak = async userId => {
  if (!userId) {
    activeBreak.value = null;
    return;
  }
  const data = await ChatwootExtraAPI.getMyActiveOperatorBreak(userId);
  activeBreak.value = data;
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

const startPolling = userId => {
  stopPolling();
  watchedUserId = userId;
  refreshActiveBreak(userId);
  pollInterval = setInterval(
    () => refreshActiveBreak(watchedUserId),
    REHYDRATE_POLL_MS
  );
};

export const useOperatorBreak = () => {
  const currentUser = useMapGetter('getCurrentUser');
  const store = useStore();

  const startBreak = async breakType => {
    const user = currentUser.value;
    if (!user?.id) return;
    isLoading.value = true;
    try {
      const response = await ChatwootExtraAPI.startOperatorBreak({
        chatwootUserId: user.id,
        operatorName: user.name,
        breakType,
      });
      activeBreak.value = response?.data || null;
    } finally {
      isLoading.value = false;
    }
  };

  const endBreak = async () => {
    const user = currentUser.value;
    if (!user?.id) return;
    isLoading.value = true;
    try {
      await ChatwootExtraAPI.endOperatorBreak(user.id);
      activeBreak.value = null;
      store.dispatch('revalidateConversationCounts');
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    () => currentUser.value?.id,
    newId => {
      if (newId) {
        startPolling(newId);
      } else {
        stopPolling();
        activeBreak.value = null;
      }
    },
    { immediate: true }
  );

  return {
    activeBreak: computed(() => activeBreak.value),
    isOnBreak: computed(() => !!activeBreak.value),
    isLoading: computed(() => isLoading.value),
    startBreak,
    endBreak,
  };
};

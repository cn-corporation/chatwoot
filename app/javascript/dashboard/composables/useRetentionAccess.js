import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useAccount } from './useAccount';
import { useMapGetter } from './store';
import RetentionAPI from 'dashboard/api/retention';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const MEMBERSHIP_CHANNEL = 'chatwoot-retention-membership';

export function publishRetentionMembership(data) {
  emitter.emit('retention.changed', data);
  if (window.BroadcastChannel) {
    const channel = new window.BroadcastChannel(MEMBERSHIP_CHANNEL);
    channel.postMessage(data);
    channel.close();
  }
}

export function useRetentionAccess() {
  const { accountId } = useAccount();
  const userId = useMapGetter('getCurrentUserID');
  const member = ref(false);
  const loaded = ref(false);
  const unreadConversationIds = ref([]);
  const unreadCount = computed(() => unreadConversationIds.value.length);
  let sequence = 0;
  let timer;
  let channel;

  const setMembership = value => {
    sequence += 1;
    member.value = value;
    if (!value) unreadConversationIds.value = [];
    loaded.value = true;
  };

  const revoke = () => {
    publishRetentionMembership({
      account_id: accountId.value,
      user_id: userId.value,
      member: false,
    });
  };

  const refresh = async () => {
    sequence += 1;
    const request = sequence;
    try {
      const { data } = await RetentionAPI.capabilities();
      if (request === sequence) {
        const wasMember = member.value;
        member.value = data.member;
        unreadConversationIds.value = data.member
          ? data.unread_conversation_ids || []
          : [];
        if (wasMember && !data.member) revoke();
      }
    } catch {
      if (request === sequence) {
        member.value = false;
        unreadConversationIds.value = [];
      }
    } finally {
      if (request === sequence) loaded.value = true;
    }
  };

  const onChange = data => {
    if (data?.account_id && Number(data.account_id) !== accountId.value) return;
    if (Array.isArray(data?.user_ids)) {
      setMembership(data.user_ids.includes(userId.value));
      if (member.value) refresh();
      return;
    }
    if (data?.user_id) {
      if (Number(data.user_id) !== userId.value) return;
      if (!data.member) setMembership(false);
      // Verify grants and queued events against current server membership.
      refresh();
      return;
    }
    refresh();
  };

  watch(
    [accountId, userId],
    () => {
      loaded.value = false;
      member.value = false;
      unreadConversationIds.value = [];
      refresh();
    },
    { immediate: true, flush: 'sync' }
  );

  onMounted(() => {
    emitter.on('retention.changed', onChange);
    emitter.on('retention.notifications_changed', onChange);
    emitter.on(BUS_EVENTS.WEBSOCKET_RECONNECT, refresh);
    window.addEventListener('focus', refresh);
    if (window.BroadcastChannel) {
      channel = new window.BroadcastChannel(MEMBERSHIP_CHANNEL);
      channel.onmessage = event => onChange(event.data);
    }
    timer = setInterval(refresh, 30000);
  });
  onUnmounted(() => {
    sequence += 1;
    clearInterval(timer);
    emitter.off('retention.changed', onChange);
    emitter.off('retention.notifications_changed', onChange);
    emitter.off(BUS_EVENTS.WEBSOCKET_RECONNECT, refresh);
    window.removeEventListener('focus', refresh);
    channel?.close();
  });

  return {
    member,
    loaded,
    unreadConversationIds,
    unreadCount,
    refresh,
    revoke,
  };
}

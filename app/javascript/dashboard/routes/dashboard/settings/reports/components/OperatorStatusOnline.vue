<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';
import AgentsAPI from 'dashboard/api/agents';

const { t } = useI18n();
const store = useStore();
const currentUserId = computed(() => store.getters.getCurrentUserID);

const operators = ref([]);
const isLoading = ref(true);
const kickingIds = ref(new Set());
let refreshInterval = null;
let eventSource = null;

const STATUS_ORDER = { online: 0, degraded: 1, offline: 2 };

const sortedOperators = computed(() => {
  return [...operators.value].sort((a, b) => {
    const statusDiff =
      (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    return (a.name || '').localeCompare(b.name || '');
  });
});

const statusColor = status => {
  if (status === 'online') return 'bg-green-500';
  if (status === 'degraded') return 'bg-yellow-500';
  return 'bg-n-slate-6';
};

const statusLabel = status => {
  if (status === 'online') return t('REPORT.OPERATOR_STATUS_PAGE.STATE.ONLINE');
  if (status === 'degraded')
    return t('REPORT.OPERATOR_STATUS_PAGE.STATE.DEGRADED');
  return t('REPORT.OPERATOR_STATUS_PAGE.STATE.OFFLINE');
};

const formatLastSeen = lastHeartbeat => {
  if (!lastHeartbeat) return '';
  return formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true });
};

const actionLabel = status =>
  status === 'offline'
    ? t('REPORT.OPERATOR_STATUS_PAGE.KICK.ACTION_OFFLINE')
    : t('REPORT.OPERATOR_STATUS_PAGE.KICK.ACTION_ONLINE');

const isSelf = op => op.operatorId === currentUserId.value;

const kickOperator = async op => {
  if (isSelf(op)) return;
  // eslint-disable-next-line no-alert
  const confirmed = window.confirm(
    t('REPORT.OPERATOR_STATUS_PAGE.KICK.CONFIRM', { name: op.name })
  );
  if (!confirmed) return;

  kickingIds.value.add(op.operatorId);
  try {
    await AgentsAPI.forceLogout(op.operatorId);
    if (op.status !== 'offline') {
      try {
        await ChatwootExtraAPI.kickOperator(op.operatorId);
        useAlert(
          t('REPORT.OPERATOR_STATUS_PAGE.KICK.SUCCESS', { name: op.name })
        );
      } catch {
        useAlert(
          t('REPORT.OPERATOR_STATUS_PAGE.KICK.PARTIAL', { name: op.name })
        );
      }
    } else {
      useAlert(
        t('REPORT.OPERATOR_STATUS_PAGE.KICK.SUCCESS', { name: op.name })
      );
    }
  } catch {
    useAlert(t('REPORT.OPERATOR_STATUS_PAGE.KICK.ERROR_GENERIC'));
  } finally {
    kickingIds.value.delete(op.operatorId);
  }
};

const fetchOperators = async () => {
  try {
    const [onlineRes, listRes] = await Promise.all([
      ChatwootExtraAPI.getOnlineOperators(),
      ChatwootExtraAPI.getOperatorsList(),
    ]);

    const onlineMap = new Map();
    if (onlineRes?.data) {
      onlineRes.data.forEach(op => {
        onlineMap.set(op.operatorId, op);
      });
    }

    if (listRes?.data) {
      operators.value = listRes.data.map(op => {
        const online = onlineMap.get(op.operatorId);
        return {
          operatorId: op.operatorId,
          name: op.name,
          status: online ? online.status : 'offline',
          lastHeartbeat: online ? online.lastHeartbeat : op.lastSeen || null,
        };
      });
    }
  } catch {
    // Silently handle errors
  } finally {
    isLoading.value = false;
  }
};

const connectSSE = () => {
  const streamUrl = ChatwootExtraAPI.getOperatorStatusStreamURL();
  eventSource = new EventSource(streamUrl);

  eventSource.addEventListener('initial-state', event => {
    const data = JSON.parse(event.data);
    if (data.operators) {
      const onlineMap = new Map();
      data.operators.forEach(op => {
        onlineMap.set(op.operatorId, op);
      });
      operators.value = operators.value.map(op => {
        const online = onlineMap.get(op.operatorId);
        return {
          ...op,
          status: online ? online.status : 'offline',
          lastHeartbeat: online ? online.lastHeartbeat : op.lastHeartbeat,
        };
      });
    }
  });

  const handleStatusChange = status => event => {
    const data = JSON.parse(event.data);
    operators.value = operators.value.map(op =>
      op.operatorId === data.operatorId
        ? { ...op, status, lastHeartbeat: data.timestamp }
        : op
    );
  };

  eventSource.addEventListener('operator-online', handleStatusChange('online'));
  eventSource.addEventListener(
    'operator-degraded',
    handleStatusChange('degraded')
  );
  eventSource.addEventListener(
    'operator-offline',
    handleStatusChange('offline')
  );

  eventSource.onerror = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    setTimeout(connectSSE, 5000);
  };
};

onMounted(async () => {
  await fetchOperators();
  connectSSE();
  refreshInterval = setInterval(fetchOperators, 60000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
});
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <span class="text-n-slate-11">
        {{ t('REPORT.OPERATOR_STATUS_PAGE.LOADING') }}
      </span>
    </div>
    <table v-else class="w-full text-left">
      <thead>
        <tr class="border-b border-n-slate-3">
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.ONLINE_TABLE.STATUS') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.ONLINE_TABLE.OPERATOR') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.ONLINE_TABLE.STATE') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.ONLINE_TABLE.LAST_SEEN') }}
          </th>
          <th class="py-3 px-4 text-sm font-medium text-n-slate-11 text-right">
            {{ t('REPORT.OPERATOR_STATUS_PAGE.ONLINE_TABLE.ACTION') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="op in sortedOperators"
          :key="op.operatorId"
          class="border-b border-n-slate-2"
          :class="{ 'opacity-40': op.status === 'offline' }"
        >
          <td class="py-3 px-4">
            <span
              class="inline-block w-2.5 h-2.5 rounded-full"
              :class="statusColor(op.status)"
            />
          </td>
          <td class="py-3 px-4 text-sm font-medium text-n-slate-12">
            {{ op.name }}
          </td>
          <td class="py-3 px-4 text-sm text-n-slate-11">
            {{ statusLabel(op.status) }}
          </td>
          <td class="py-3 px-4 text-sm text-n-slate-11">
            <template v-if="op.status === 'online'">
              {{ t('REPORT.OPERATOR_STATUS_PAGE.ONLINE_TABLE.NOW') }}
            </template>
            <template v-else-if="op.lastHeartbeat">
              {{ formatLastSeen(op.lastHeartbeat) }}
            </template>
            <template v-else>—</template>
          </td>
          <td class="py-3 px-4 text-right">
            <button
              v-if="!isSelf(op)"
              class="px-3 py-1.5 text-xs font-medium rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :class="
                op.status === 'offline'
                  ? 'border-n-slate-6 text-n-slate-11 hover:bg-n-slate-3'
                  : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
              "
              :disabled="kickingIds.has(op.operatorId)"
              @click="kickOperator(op)"
            >
              {{ actionLabel(op.status) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

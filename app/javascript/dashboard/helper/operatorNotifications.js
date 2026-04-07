import ChatwootExtraAPI from '../api/chatwootExtra';
import types from '../store/mutation-types';

const ALERT_AUDIO_PATH = '/audio/dashboard/ding.mp3';

const shouldNotify = (store, conversationId) => {
  const currentUser = store.getters.getCurrentUser;
  if (currentUser?.role === 'administrator') return true;
  const allConversations = store.getters.getAllConversations;
  const conversation = allConversations.find(
    c => c.id === Number(conversationId)
  );
  if (!conversation) return true;
  const myTeams = store.getters['teams/getMyTeams'] || [];
  const myTeamIds = myTeams.map(t => t.id);
  const teamId = conversation.team_id || conversation.meta?.team?.id || null;
  if (myTeamIds.length) return myTeamIds.includes(teamId);
  return teamId === null;
};

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createAudioElement = () => {
  const audio = new Audio(ALERT_AUDIO_PATH);
  audio.load();
  return audio;
};

const playSound = audio => {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

const FAVICON_SIZE = 32;
let cachedFaviconImg = null;
let originalFaviconHrefs = null;
let faviconVersion = 0;

const getFaviconImage = () => {
  if (cachedFaviconImg) return Promise.resolve(cachedFaviconImg);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedFaviconImg = img;
      resolve(img);
    };
    img.src = '/favicon-32x32.png';
  });
};

const captureOriginalFavicons = () => {
  if (originalFaviconHrefs) return;
  originalFaviconHrefs = [];
  document.querySelectorAll('.favicon').forEach(link => {
    originalFaviconHrefs.push({ link, href: link.href });
  });
};

const setFaviconHrefs = href => {
  document.querySelectorAll('.favicon').forEach(link => {
    link.href = href;
  });
};

const updateTitle = count => {
  const clean = document.title.replace(/^\(\d+\+?\)\s*/, '');
  document.title =
    count > 0 ? `(${count > 99 ? '99+' : count}) ${clean}` : clean;
};

const updateFavicon = async totalCount => {
  captureOriginalFavicons();
  const version = ++faviconVersion;

  updateTitle(totalCount);

  if (totalCount <= 0) {
    if (originalFaviconHrefs) {
      originalFaviconHrefs.forEach(({ link, href }) => {
        link.href = href;
      });
    }
    return;
  }

  const img = await getFaviconImage();
  if (version !== faviconVersion) return;

  const canvas = document.createElement('canvas');
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, FAVICON_SIZE, FAVICON_SIZE);

  const badgeRadius = 10;
  const badgeX = FAVICON_SIZE - badgeRadius;
  const badgeY = badgeRadius;

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
  ctx.fillStyle = '#e53e3e';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = totalCount > 99 ? '99+' : String(totalCount);
  ctx.fillText(label, badgeX, badgeY);

  if (version !== faviconVersion) return;
  setFaviconHrefs(canvas.toDataURL('image/png'));
};

let initialized = false;

export const initializeOperatorNotifications = store => {
  if (initialized) return;
  initialized = true;

  const audio = createAudioElement();
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
        if (!shouldNotify(store, payload.conversationId)) return;
        updateCount('message_created', payload);
        store.commit(types.SET_OPERATOR_NOTIFICATION_COUNT, {
          conversationId: payload.conversationId,
          unreadCount: toNumber(payload.unreadCount),
        });
        playSound(audio);
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

  store.watch(
    () => store.getters.getTotalOperatorUnreadCount,
    count => {
      updateFavicon(count);
    }
  );

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      cleanup();
      store.commit(types.CLEAR_OPERATOR_NOTIFICATIONS);
    });
  }
};

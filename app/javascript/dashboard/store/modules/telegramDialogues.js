import ChatwootExtraAPI from '../../api/chatwootExtra';

const CHATS_PAGE_SIZE = 50;
const MESSAGES_PAGE_SIZE = 50;

function handleSSEEvent(commit, s, eventType, data, dispatch) {
  if (eventType === 'new_message') {
    const chatExists = s.chats.some(c => c.id === data.chatDbId);
    if (chatExists) {
      commit('UPDATE_CHAT_WITH_LAST_MESSAGE', {
        chatDbId: data.chatDbId,
        text: data.text,
        createdAt: data.createdAt,
      });
    } else {
      dispatch('fetchChats');
    }

    if (s.activeChatId && s.activeChatId === data.chatDbId) {
      commit('APPEND_MESSAGE', {
        id: data.messageDbId,
        chatId: data.chatDbId,
        direction: data.direction,
        text: data.text,
        telegramMessageId: data.telegramMessageId,
        telegramUserId: String(data.telegramUserId),
        telegramUsername: data.telegramUsername,
        telegramName: data.telegramName || data.senderName,
        createdAt: data.createdAt,
        mediaType: data.mediaType || null,
        mediaPath: data.mediaPath || null,
        mediaMimeType: data.mediaMimeType || null,
        mediaFileName: data.mediaFileName || null,
        mediaSize: data.mediaSize || null,
      });
      if (data.direction === 'incoming') {
        ChatwootExtraAPI.markTelegramChatRead(
          s.activeSourceId,
          data.chatDbId
        ).catch(() => {});
      }
    } else if (data.direction === 'incoming') {
      commit('SET_CHAT_UNREAD', {
        chatDbId: data.chatDbId,
        count: data.unreadCount,
      });
    }
  } else if (eventType === 'chat_read' || eventType === 'unread_update') {
    commit('SET_CHAT_UNREAD', {
      chatDbId: data.chatDbId,
      count: data.unreadCount ?? 0,
    });
  }
}

const state = {
  sources: [],
  activeSourceId: null,
  chats: [],
  chatsLoading: false,
  chatsHasMore: true,
  chatsOffset: 0,
  activeChatId: null,
  activeGroupChatId: null,
  messages: [],
  messagesLoading: false,
  messagesHasMore: true,
  messagesOffset: 0,
  sendingMessage: false,
  sseConnection: null,
  sseInitialized: false,
  unreadCounts: {},
};

const getters = {
  getSources: s => s.sources,
  getActiveSourceId: s => s.activeSourceId,
  getActiveSource: s => s.sources.find(src => src.id === s.activeSourceId),
  getChats: s =>
    [...s.chats].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    }),
  getGroupedChats: (s, g) => {
    const sorted = g.getChats;
    const groups = new Map();
    sorted.forEach(chat => {
      const key = chat.chatId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(chat);
    });
    const result = [];
    groups.forEach(chats => {
      const hasTopics = chats.some(c => c.topicId);
      if (hasTopics) {
        const mostRecent = chats.reduce((a, b) => {
          const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dA > dB ? a : b;
        });
        const totalUnread = chats.reduce(
          (sum, c) => sum + (s.unreadCounts[c.id] || 0),
          0
        );
        result.push({
          id: `group_${mostRecent.chatId}`,
          chatId: mostRecent.chatId,
          name: mostRecent.name || 'Group',
          type: mostRecent.type,
          isForumGroup: true,
          topicCount: chats.filter(c => c.topicId).length,
          totalUnread: totalUnread,
          updatedAt: mostRecent.updatedAt,
          lastMessageText: mostRecent.lastMessageText,
        });
      } else {
        chats.forEach(c => result.push(c));
      }
    });
    return result.sort((a, b) => {
      const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dB - dA;
    });
  },
  getTopicsForGroup: s => chatId =>
    s.chats
      .filter(c => String(c.chatId) === String(chatId))
      .sort((a, b) => {
        const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dB - dA;
      }),
  getActiveGroupChatId: s => s.activeGroupChatId,
  getChatsLoading: s => s.chatsLoading,
  getChatsHasMore: s => s.chatsHasMore,
  getActiveChatId: s => s.activeChatId,
  getActiveChat: s => s.chats.find(c => c.id === s.activeChatId),
  getMessages: s => s.messages,
  getMessagesLoading: s => s.messagesLoading,
  getMessagesHasMore: s => s.messagesHasMore,
  getSendingMessage: s => s.sendingMessage,
  getUnreadCounts: s => s.unreadCounts,
  getUnreadCountForChat: s => chatId => s.unreadCounts[chatId] || 0,
  getTotalUnreadCount: s =>
    Object.values(s.unreadCounts).reduce((sum, c) => sum + c, 0),
};

const mutations = {
  SET_SOURCES(s, sources) {
    s.sources = sources;
  },
  SET_ACTIVE_SOURCE_ID(s, id) {
    s.activeSourceId = id;
  },
  SET_CHATS(s, chats) {
    s.chats = chats;
  },
  APPEND_CHATS(s, chats) {
    const existingIds = new Set(s.chats.map(c => c.id));
    const newChats = chats.filter(c => !existingIds.has(c.id));
    s.chats = [...s.chats, ...newChats];
  },
  SET_CHATS_LOADING(s, loading) {
    s.chatsLoading = loading;
  },
  SET_CHATS_HAS_MORE(s, hasMore) {
    s.chatsHasMore = hasMore;
  },
  SET_CHATS_OFFSET(s, offset) {
    s.chatsOffset = offset;
  },
  SET_ACTIVE_CHAT_ID(s, id) {
    s.activeChatId = id;
  },
  SET_ACTIVE_GROUP_CHAT_ID(s, chatId) {
    s.activeGroupChatId = chatId;
  },
  SET_MESSAGES(s, messages) {
    s.messages = messages;
  },
  PREPEND_MESSAGES(s, messages) {
    const existingIds = new Set(s.messages.map(m => m.id));
    const newMsgs = messages.filter(m => !existingIds.has(m.id));
    s.messages = [...newMsgs, ...s.messages];
  },
  APPEND_MESSAGE(s, message) {
    const exists = s.messages.some(
      m =>
        m.id === message.id ||
        (m.telegramMessageId &&
          m.telegramMessageId === message.telegramMessageId)
    );
    if (!exists) {
      s.messages = [...s.messages, message];
    }
  },
  SET_MESSAGES_LOADING(s, loading) {
    s.messagesLoading = loading;
  },
  SET_MESSAGES_HAS_MORE(s, hasMore) {
    s.messagesHasMore = hasMore;
  },
  SET_MESSAGES_OFFSET(s, offset) {
    s.messagesOffset = offset;
  },
  SET_SENDING_MESSAGE(s, sending) {
    s.sendingMessage = sending;
  },
  SET_SSE_CONNECTION(s, connection) {
    s.sseConnection = connection;
  },
  SET_SSE_INITIALIZED(s, val) {
    s.sseInitialized = val;
  },
  SET_UNREAD_COUNTS(s, counts) {
    s.unreadCounts = counts;
  },
  SET_CHAT_UNREAD(s, { chatDbId, count }) {
    if (count > 0) {
      s.unreadCounts = { ...s.unreadCounts, [chatDbId]: count };
    } else {
      const { [chatDbId]: _, ...rest } = s.unreadCounts;
      s.unreadCounts = rest;
    }
  },
  UPDATE_CHAT_WITH_LAST_MESSAGE(s, { chatDbId, text, createdAt }) {
    const idx = s.chats.findIndex(c => c.id === chatDbId);
    if (idx === -1) return;
    const updated = {
      ...s.chats[idx],
      lastMessageText: text,
      updatedAt: createdAt,
    };
    const newChats = [...s.chats];
    newChats.splice(idx, 1);
    newChats.unshift(updated);
    s.chats = newChats;
  },
};

const actions = {
  async fetchSources({ commit }) {
    try {
      const sources = await ChatwootExtraAPI.getTelegramSources();
      commit('SET_SOURCES', sources);
      return sources;
    } catch {
      return [];
    }
  },

  async setActiveSource({ commit, dispatch, state: s }, sourceId) {
    commit('SET_ACTIVE_SOURCE_ID', sourceId);
    commit('SET_CHATS', []);
    commit('SET_CHATS_OFFSET', 0);
    commit('SET_CHATS_HAS_MORE', true);
    commit('SET_ACTIVE_CHAT_ID', null);
    commit('SET_ACTIVE_GROUP_CHAT_ID', null);
    commit('SET_MESSAGES', []);
    await dispatch('fetchChats');
    if (!s.sseInitialized) {
      dispatch('connectSSE', sourceId);
    }
  },

  async fetchChats({ commit, state: s }) {
    if (s.chatsLoading || !s.activeSourceId) return;
    commit('SET_CHATS_LOADING', true);
    try {
      const chats = await ChatwootExtraAPI.getTelegramChats(s.activeSourceId, {
        limit: CHATS_PAGE_SIZE,
        offset: 0,
      });
      commit('SET_CHATS', chats);
      commit('SET_CHATS_OFFSET', chats.length);
      commit('SET_CHATS_HAS_MORE', chats.length >= CHATS_PAGE_SIZE);

      const counts = {};
      chats.forEach(c => {
        if (c.unreadCount > 0) counts[c.id] = c.unreadCount;
      });
      commit('SET_UNREAD_COUNTS', counts);
    } catch (error) {
      console.error('[TelegramDialogues] Failed to fetch chats:', error);
    } finally {
      commit('SET_CHATS_LOADING', false);
    }
  },

  async fetchMoreChats({ commit, state: s }) {
    if (s.chatsLoading || !s.chatsHasMore || !s.activeSourceId) return;
    commit('SET_CHATS_LOADING', true);
    try {
      const chats = await ChatwootExtraAPI.getTelegramChats(s.activeSourceId, {
        limit: CHATS_PAGE_SIZE,
        offset: s.chatsOffset,
      });
      commit('APPEND_CHATS', chats);
      commit('SET_CHATS_OFFSET', s.chatsOffset + chats.length);
      commit('SET_CHATS_HAS_MORE', chats.length >= CHATS_PAGE_SIZE);

      chats.forEach(c => {
        if (c.unreadCount > 0) {
          commit('SET_CHAT_UNREAD', { chatDbId: c.id, count: c.unreadCount });
        }
      });
    } catch (error) {
      console.error('[TelegramDialogues] Failed to fetch more chats:', error);
    } finally {
      commit('SET_CHATS_LOADING', false);
    }
  },

  async setActiveChat({ commit, dispatch, state: s }, chatId) {
    commit('SET_ACTIVE_CHAT_ID', chatId);
    commit('SET_CHAT_UNREAD', { chatDbId: chatId, count: 0 });
    commit('SET_MESSAGES', []);
    commit('SET_MESSAGES_OFFSET', 0);
    commit('SET_MESSAGES_HAS_MORE', true);
    if (s.activeSourceId) {
      ChatwootExtraAPI.markTelegramChatRead(s.activeSourceId, chatId).catch(
        () => {}
      );
    }
    await dispatch('fetchMessages');
  },

  async fetchMessages({ commit, state: s }) {
    if (s.messagesLoading || !s.activeSourceId || !s.activeChatId) return;
    commit('SET_MESSAGES_LOADING', true);
    try {
      const messages = await ChatwootExtraAPI.getTelegramMessages(
        s.activeSourceId,
        s.activeChatId,
        { limit: MESSAGES_PAGE_SIZE, offset: 0 }
      );
      commit('SET_MESSAGES', [...messages].reverse());
      commit('SET_MESSAGES_OFFSET', messages.length);
      commit('SET_MESSAGES_HAS_MORE', messages.length >= MESSAGES_PAGE_SIZE);
    } catch (error) {
      console.error('[TelegramDialogues] Failed to fetch messages:', error);
    } finally {
      commit('SET_MESSAGES_LOADING', false);
    }
  },

  async fetchMoreMessages({ commit, state: s }) {
    if (
      s.messagesLoading ||
      !s.messagesHasMore ||
      !s.activeSourceId ||
      !s.activeChatId
    )
      return;
    commit('SET_MESSAGES_LOADING', true);
    try {
      const messages = await ChatwootExtraAPI.getTelegramMessages(
        s.activeSourceId,
        s.activeChatId,
        { limit: MESSAGES_PAGE_SIZE, offset: s.messagesOffset }
      );
      commit('PREPEND_MESSAGES', [...messages].reverse());
      commit('SET_MESSAGES_OFFSET', s.messagesOffset + messages.length);
      commit('SET_MESSAGES_HAS_MORE', messages.length >= MESSAGES_PAGE_SIZE);
    } catch (error) {
      console.error(
        '[TelegramDialogues] Failed to fetch more messages:',
        error
      );
    } finally {
      commit('SET_MESSAGES_LOADING', false);
    }
  },

  async sendMessage({ commit, state: s }, { text, replyToMsgId }) {
    if (s.sendingMessage || !s.activeSourceId || !s.activeChatId) return;
    commit('SET_SENDING_MESSAGE', true);
    try {
      const activeChat = s.chats.find(c => c.id === s.activeChatId);
      if (!activeChat) return;
      await ChatwootExtraAPI.sendTelegramMessage(s.activeSourceId, {
        chatId: Number(activeChat.chatId),
        text,
        replyToMsgId,
        topicId: activeChat.topicId || undefined,
      });
    } catch (error) {
      console.error('[TelegramDialogues] Failed to send message:', error);
    } finally {
      commit('SET_SENDING_MESSAGE', false);
    }
  },

  async sendMedia({ commit, state: s }, { file, caption, replyToMsgId }) {
    if (s.sendingMessage || !s.activeSourceId || !s.activeChatId) return;
    commit('SET_SENDING_MESSAGE', true);
    try {
      const activeChat = s.chats.find(c => c.id === s.activeChatId);
      if (!activeChat) return;
      await ChatwootExtraAPI.sendTelegramMedia(s.activeSourceId, {
        chatId: Number(activeChat.chatId),
        file,
        caption,
        replyToMsgId,
        topicId: activeChat.topicId || undefined,
      });
    } catch (error) {
      console.error('[TelegramDialogues] Failed to send media:', error);
    } finally {
      commit('SET_SENDING_MESSAGE', false);
    }
  },

  async initGlobalSSE({ commit, dispatch, state: s }) {
    if (s.sseInitialized) return;
    try {
      const sources = await dispatch('fetchSources');
      if (sources.length > 0) {
        commit('SET_ACTIVE_SOURCE_ID', sources[0].id);
        dispatch('connectSSE', sources[0].id);
        dispatch('fetchChats');
      }
    } catch (_) {
      /* noop */
    }
  },

  connectSSE({ commit, dispatch, state: s }, sourceId) {
    if (s.sseInitialized) return;

    if (s.sseConnection) {
      s.sseConnection.close();
      commit('SET_SSE_CONNECTION', null);
    }

    const url = ChatwootExtraAPI.getTelegramSSEUrl(sourceId);
    const eventSource = new EventSource(url);

    eventSource.addEventListener('new_message', event => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(commit, s, 'new_message', data, dispatch);
      } catch (_) {
        /* noop */
      }
    });

    eventSource.addEventListener('chat_read', event => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(commit, s, 'chat_read', data, dispatch);
      } catch (_) {
        /* noop */
      }
    });

    eventSource.addEventListener('unread_update', event => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(commit, s, 'unread_update', data, dispatch);
      } catch (_) {
        /* noop */
      }
    });

    eventSource.onerror = () => {
      console.error(
        '[TelegramDialogues SSE] Connection error, will auto-reconnect'
      );
    };

    commit('SET_SSE_CONNECTION', eventSource);
    commit('SET_SSE_INITIALIZED', true);
  },

  disconnectSSE({ commit, state: s }) {
    if (s.sseConnection) {
      s.sseConnection.close();
      commit('SET_SSE_CONNECTION', null);
    }
    commit('SET_SSE_INITIALIZED', false);
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};

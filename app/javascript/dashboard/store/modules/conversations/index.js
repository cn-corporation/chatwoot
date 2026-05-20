import types from '../../mutation-types';
import getters, { getSelectedChatConversation } from './getters';
import actions from './actions';
import { findPendingMessageIndex } from './helpers';
import { MESSAGE_STATUS } from 'shared/constants/messages';
import wootConstants from 'dashboard/constants/globals';
import { BUS_EVENTS } from '../../../../shared/constants/busEvents';
import { emitter } from 'shared/helpers/mitt';

const recalculateUnreadCounts = _state => {
  const source =
    _state.sidebarCountsData.length > 0
      ? _state.sidebarCountsData
      : _state.allConversations;

  const counts = {
    total: 0,
    byInbox: {},
    byLabel: {},
    byTeam: {},
  };

  source.forEach(conversation => {
    const isOpenOrPending =
      conversation.status === 'open' || conversation.status === 'pending';
    if (!isOpenOrPending) return;

    const unreadCount = conversation.unread_count || 0;
    counts.total += unreadCount;

    const inboxId = conversation.inbox_id;
    if (inboxId) {
      counts.byInbox[inboxId] = (counts.byInbox[inboxId] || 0) + unreadCount;
    }

    const teamId = conversation.team_id || conversation.meta?.team?.id;
    if (teamId) {
      counts.byTeam[teamId] = (counts.byTeam[teamId] || 0) + unreadCount;
    }

    const labels = conversation.labels || [];
    labels.forEach(label => {
      const labelTitle = typeof label === 'string' ? label : label.title;
      if (labelTitle) {
        counts.byLabel[labelTitle] =
          (counts.byLabel[labelTitle] || 0) + unreadCount;
      }
    });
  });

  _state.cachedUnreadCounts = counts;
};

const state = {
  allConversations: [],
  attachments: {},
  listLoadingStatus: true,
  chatStatusFilter: wootConstants.STATUS_TYPE.OPEN,
  chatSortFilter: wootConstants.SORT_BY_TYPE.PRIORITY_DESC,
  currentInbox: null,
  selectedChatId: null,
  appliedFilters: [],
  contextMenuChatId: null,
  conversationParticipants: [],
  conversationLastSeen: null,
  syncConversationsMessages: {},
  conversationFilters: {},
  copilotAssistant: {},
  // Separate storage for sidebar counts
  sidebarCountsData: [],
  operatorNotifications: new Map(),
  operatorNotificationsReady: false,
  conversationTopics: new Map(),
  // Cached computations to avoid expensive recalculations
  // Cached unread counts
  cachedUnreadCounts: {
    total: 0,
    byInbox: {},
    byLabel: {},
    byTeam: {},
  },
};

// mutations
export const mutations = {
  [types.SET_ALL_CONVERSATION](_state, payload) {
    // Handle both old format (array) and new format (object with conversations and replace flag)
    const conversationList = Array.isArray(payload)
      ? payload
      : payload.conversations;
    const shouldReplace = payload.replace === true;

    if (shouldReplace && conversationList.length > 0) {
      if (_state.selectedChatId) {
        const existingSelectedConv = _state.allConversations.find(
          c => c.id === _state.selectedChatId
        );
        if (existingSelectedConv) {
          const newSelectedIndex = conversationList.findIndex(
            c => c.id === _state.selectedChatId
          );
          if (newSelectedIndex >= 0) {
            conversationList[newSelectedIndex] = {
              ...conversationList[newSelectedIndex],
              allMessagesLoaded: existingSelectedConv.allMessagesLoaded,
              messages: existingSelectedConv.messages,
              dataFetched: existingSelectedConv.dataFetched,
            };
          } else {
            conversationList.push(existingSelectedConv);
          }
        }
      }
      _state.allConversations = conversationList;
    } else if (!shouldReplace) {
      // Add/update conversations (for pagination or updates)
      const newAllConversations = [..._state.allConversations];
      conversationList.forEach(conversation => {
        const indexInCurrentList = newAllConversations.findIndex(
          c => c.id === conversation.id
        );
        if (indexInCurrentList < 0) {
          newAllConversations.push(conversation);
        } else if (conversation.id !== _state.selectedChatId) {
          newAllConversations[indexInCurrentList] = conversation;
        } else {
          const existingConversation = newAllConversations[indexInCurrentList];
          newAllConversations[indexInCurrentList] = {
            ...conversation,
            allMessagesLoaded: existingConversation.allMessagesLoaded,
            messages: existingConversation.messages,
            dataFetched: existingConversation.dataFetched,
          };
        }
      });
      _state.allConversations = newAllConversations;
    }

    recalculateUnreadCounts(_state);
  },
  [types.EMPTY_ALL_CONVERSATION](_state) {
    // Don't clear conversations immediately to avoid flickering
    // They will be replaced when new data arrives
    _state.selectedChatId = null;
  },

  [types.UPDATE_CONVERSATIONS_FOR_COUNTS](_state, conversations) {
    const apiIds = new Set();
    const result = [];
    conversations.forEach(conv => {
      if (apiIds.has(conv.id)) return;
      apiIds.add(conv.id);
      const liveConv = _state.allConversations.find(c => c.id === conv.id);
      const src = liveConv || conv;
      result.push({
        id: conv.id,
        unread_count: conv.unread_count || 0,
        labels: conv.labels || [],
        inbox_id: conv.inbox_id,
        team_id: conv.meta?.team?.id || conv.team_id,
        status: liveConv ? liveConv.status : conv.status,
        assignee_id: liveConv
          ? liveConv.meta?.assignee?.id || liveConv.assignee_id
          : conv.meta?.assignee?.id || conv.assignee_id,
        waiting_since: src.waiting_since,
        first_reply_created_at: src.first_reply_created_at,
      });
    });

    _state.sidebarCountsData.forEach(existing => {
      if (apiIds.has(existing.id)) return;
      const liveConv = _state.allConversations.find(c => c.id === existing.id);
      if (!liveConv) return;
      result.push({
        id: existing.id,
        unread_count: liveConv.unread_count || 0,
        labels: liveConv.labels || [],
        inbox_id: liveConv.inbox_id,
        team_id: liveConv.meta?.team?.id || liveConv.team_id,
        status: liveConv.status,
        assignee_id: liveConv.meta?.assignee?.id || liveConv.assignee_id,
        waiting_since: liveConv.waiting_since,
        first_reply_created_at: liveConv.first_reply_created_at,
      });
    });

    _state.sidebarCountsData = result;
    recalculateUnreadCounts(_state);
  },
  [types.CLEAR_CONVERSATIONS_FOR_COUNTS](_state) {
    _state.sidebarCountsData = [];
    recalculateUnreadCounts(_state);
  },
  [types.SET_ALL_MESSAGES_LOADED](_state) {
    const [chat] = getSelectedChatConversation(_state);
    chat.allMessagesLoaded = true;
  },

  [types.CLEAR_ALL_MESSAGES_LOADED](_state) {
    const [chat] = getSelectedChatConversation(_state);
    chat.allMessagesLoaded = false;
  },
  [types.CLEAR_CURRENT_CHAT_WINDOW](_state) {
    _state.selectedChatId = null;
  },

  [types.SET_PREVIOUS_CONVERSATIONS](_state, { id, data }) {
    if (data.length) {
      const [chat] = _state.allConversations.filter(c => c.id === id);
      if (!chat) return;
      const existingIds = new Set((chat.messages || []).map(m => m.id));
      const newMessages = data.filter(m => !existingIds.has(m.id));
      if (newMessages.length) {
        chat.messages.unshift(...newMessages);
      }
    }
  },
  [types.SET_ALL_ATTACHMENTS](_state, { id, data }) {
    _state.attachments[id] = [...data];
  },
  [types.SET_MISSING_MESSAGES](_state, { id, data }) {
    const [chat] = _state.allConversations.filter(c => c.id === id);
    if (!chat) return;
    chat.messages = data;
  },

  [types.SET_CURRENT_CHAT_WINDOW](_state, activeChat) {
    if (activeChat) {
      _state.selectedChatId = activeChat.id;
    }
  },

  [types.ASSIGN_AGENT](_state, assignee) {
    const [chat] = getSelectedChatConversation(_state);
    chat.meta.assignee = assignee;
  },

  [types.ASSIGN_TEAM](_state, { team, conversationId }) {
    const [chat] = _state.allConversations.filter(c => c.id === conversationId);
    chat.meta.team = team;
  },

  [types.UPDATE_CONVERSATION_LAST_ACTIVITY](
    _state,
    { lastActivityAt, conversationId }
  ) {
    const [chat] = _state.allConversations.filter(c => c.id === conversationId);
    if (chat) {
      chat.last_activity_at = lastActivityAt;
    }
  },
  [types.ASSIGN_PRIORITY](_state, { priority, conversationId }) {
    const [chat] = _state.allConversations.filter(c => c.id === conversationId);
    chat.priority = priority;
  },

  [types.UPDATE_CONVERSATION_CUSTOM_ATTRIBUTES](_state, custom_attributes) {
    const [chat] = getSelectedChatConversation(_state);
    chat.custom_attributes = custom_attributes;
  },

  [types.CHANGE_CONVERSATION_STATUS](
    _state,
    { conversationId, status, snoozedUntil, resolutionReason }
  ) {
    const conversation =
      getters.getConversationById(_state)(conversationId) || {};
    conversation.snoozed_until = snoozedUntil;
    conversation.status = status;
    if (resolutionReason !== undefined) {
      conversation.resolution_reason = resolutionReason;
    }
  },

  [types.MUTE_CONVERSATION](_state) {
    const [chat] = getSelectedChatConversation(_state);
    chat.muted = true;
  },

  [types.UNMUTE_CONVERSATION](_state) {
    const [chat] = getSelectedChatConversation(_state);
    chat.muted = false;
  },

  [types.ADD_CONVERSATION_ATTACHMENTS](_state, message) {
    // early return if the message has not been sent, or has no attachments
    if (
      message.status !== MESSAGE_STATUS.SENT ||
      !message.attachments?.length
    ) {
      return;
    }

    const id = message.conversation_id;
    const existingAttachments = _state.attachments[id] || [];

    const attachmentsToAdd = message.attachments.filter(attachment => {
      // if the attachment is not already in the store, add it
      // this is to prevent duplicates
      return !existingAttachments.some(
        existingAttachment => existingAttachment.id === attachment.id
      );
    });

    // replace the attachments in the store
    _state.attachments[id] = [...existingAttachments, ...attachmentsToAdd];
  },

  [types.DELETE_CONVERSATION_ATTACHMENTS](_state, message) {
    if (message.status !== MESSAGE_STATUS.SENT) return;

    const { conversation_id: id } = message;
    const existingAttachments = _state.attachments[id] || [];
    if (!existingAttachments.length) return;

    _state.attachments[id] = existingAttachments.filter(attachment => {
      return attachment.message_id !== message.id;
    });
  },

  [types.ADD_MESSAGE](_state, message) {
    const { conversation_id: conversationId } = message;
    const [chat] = getSelectedChatConversation({
      allConversations: _state.allConversations,
      selectedChatId: conversationId,
    });
    if (!chat) return;

    const pendingMessageIndex = findPendingMessageIndex(chat, message);
    if (pendingMessageIndex !== -1) {
      chat.messages[pendingMessageIndex] = message;
    } else {
      chat.messages.push(message);
      chat.timestamp = message.created_at;
      const {
        conversation: {
          unread_count: unreadCount = 0,
          unread_count_full: unreadCountFull,
        } = {},
      } = message;
      chat.unread_count = unreadCount;
      if (unreadCountFull !== undefined) {
        chat.unread_count_full = unreadCountFull;
      }
      // Update sidebar counts if conversation exists there
      const sidebarItem = _state.sidebarCountsData.find(
        c => c.id === conversationId
      );
      if (sidebarItem) {
        sidebarItem.unread_count = unreadCount;
      }
      if (_state.selectedChatId === conversationId) {
        emitter.emit(BUS_EVENTS.FETCH_LABEL_SUGGESTIONS);
        emitter.emit(BUS_EVENTS.SCROLL_TO_MESSAGE);
      }
    }
  },

  [types.ADD_CONVERSATION](_state, conversation) {
    const exists = _state.allConversations.some(c => c.id === conversation.id);
    if (!exists) {
      _state.allConversations.push(conversation);
    }
    if (
      _state.sidebarCountsData.length > 0 &&
      !_state.sidebarCountsData.some(c => c.id === conversation.id)
    ) {
      _state.sidebarCountsData.push({
        id: conversation.id,
        unread_count: conversation.unread_count || 0,
        labels: conversation.labels || [],
        inbox_id: conversation.inbox_id,
        team_id: conversation.meta?.team?.id || conversation.team_id,
        status: conversation.status,
        assignee_id:
          conversation.meta?.assignee?.id || conversation.assignee_id,
        waiting_since: conversation.waiting_since,
        first_reply_created_at: conversation.first_reply_created_at,
      });
      recalculateUnreadCounts(_state);
    }
  },

  [types.DELETE_CONVERSATION](_state, conversationId) {
    _state.allConversations = _state.allConversations.filter(
      c => c.id !== conversationId
    );
    // Also remove from sidebar counts data
    _state.sidebarCountsData = _state.sidebarCountsData.filter(
      c => c.id !== conversationId
    );
  },

  [types.UPDATE_CONVERSATION](_state, conversation) {
    const { allConversations } = _state;
    const index = allConversations.findIndex(c => c.id === conversation.id);

    if (index > -1) {
      const selectedConversation = allConversations[index];

      // ignore out of order events
      if (conversation.updated_at < selectedConversation.updated_at) {
        return;
      }

      const { messages, ...updates } = conversation;
      allConversations[index] = { ...selectedConversation, ...updates };

      if (_state.sidebarCountsData.length > 0) {
        const sidebarItem = _state.sidebarCountsData.find(
          c => c.id === conversation.id
        );
        if (sidebarItem) {
          sidebarItem.unread_count = conversation.unread_count || 0;
          sidebarItem.labels = conversation.labels || [];
          sidebarItem.team_id = conversation.meta?.team?.id;
          sidebarItem.status = conversation.status;
          sidebarItem.assignee_id = conversation.meta?.assignee?.id;
          sidebarItem.waiting_since = conversation.waiting_since;
          sidebarItem.first_reply_created_at =
            conversation.first_reply_created_at;
        } else {
          _state.sidebarCountsData.push({
            id: conversation.id,
            unread_count: conversation.unread_count || 0,
            labels: conversation.labels || [],
            inbox_id: conversation.inbox_id,
            team_id: conversation.meta?.team?.id || conversation.team_id,
            status: conversation.status,
            assignee_id:
              conversation.meta?.assignee?.id || conversation.assignee_id,
            waiting_since: conversation.waiting_since,
            first_reply_created_at: conversation.first_reply_created_at,
          });
        }
        recalculateUnreadCounts(_state);
      }
      if (_state.selectedChatId === conversation.id) {
        emitter.emit(BUS_EVENTS.FETCH_LABEL_SUGGESTIONS);
        emitter.emit(BUS_EVENTS.SCROLL_TO_MESSAGE);
      }
    } else {
      if (!_state.allConversations.some(c => c.id === conversation.id)) {
        _state.allConversations.push(conversation);
      }
      if (
        _state.sidebarCountsData.length > 0 &&
        !_state.sidebarCountsData.some(c => c.id === conversation.id)
      ) {
        _state.sidebarCountsData.push({
          id: conversation.id,
          unread_count: conversation.unread_count || 0,
          labels: conversation.labels || [],
          inbox_id: conversation.inbox_id,
          team_id: conversation.meta?.team?.id || conversation.team_id,
          status: conversation.status,
          assignee_id:
            conversation.meta?.assignee?.id || conversation.assignee_id,
          waiting_since: conversation.waiting_since,
          first_reply_created_at: conversation.first_reply_created_at,
        });
        recalculateUnreadCounts(_state);
      }
    }
  },

  [types.SET_LIST_LOADING_STATUS](_state) {
    _state.listLoadingStatus = true;
  },

  [types.CLEAR_LIST_LOADING_STATUS](_state) {
    _state.listLoadingStatus = false;
  },

  [types.UPDATE_MESSAGE_UNREAD_COUNT](
    _state,
    { id, lastSeen, unreadCount = 0, unreadCountFull }
  ) {
    const [chat] = _state.allConversations.filter(c => c.id === id);
    if (chat) {
      chat.agent_last_seen_at = lastSeen;
      chat.unread_count = unreadCount;
      if (unreadCountFull !== undefined) {
        chat.unread_count_full = unreadCountFull;
      }
    }
    const sidebarItem = _state.sidebarCountsData.find(c => c.id === id);
    if (sidebarItem) {
      sidebarItem.unread_count = unreadCount;
      recalculateUnreadCounts(_state);
    }
  },
  [types.CHANGE_CHAT_STATUS_FILTER](_state, data) {
    _state.chatStatusFilter = data;
  },

  [types.CHANGE_CHAT_SORT_FILTER](_state, data) {
    _state.chatSortFilter = data;
  },

  // Update assignee on action cable message
  [types.UPDATE_ASSIGNEE](_state, payload) {
    const [chat] = _state.allConversations.filter(c => c.id === payload.id);
    chat.meta.assignee = payload.assignee;
  },

  [types.UPDATE_CONVERSATION_CONTACT](_state, { conversationId, ...payload }) {
    const [chat] = _state.allConversations.filter(c => c.id === conversationId);
    if (chat) {
      chat.meta.sender = payload;
    }
  },

  [types.SET_ACTIVE_INBOX](_state, inboxId) {
    _state.currentInbox = inboxId ? parseInt(inboxId, 10) : null;
  },

  [types.SET_CONVERSATION_CAN_REPLY](_state, { conversationId, canReply }) {
    const [chat] = _state.allConversations.filter(c => c.id === conversationId);
    if (chat) {
      chat.can_reply = canReply;
    }
  },

  [types.CLEAR_CONTACT_CONVERSATIONS](_state, contactId) {
    const chats = _state.allConversations.filter(
      c => c.meta.sender.id !== contactId
    );
    _state.allConversations = chats;
  },

  [types.SET_CONVERSATION_FILTERS](_state, data) {
    _state.appliedFilters = data;
  },

  [types.CLEAR_CONVERSATION_FILTERS](_state) {
    _state.appliedFilters = [];
  },

  [types.SET_LAST_MESSAGE_ID_IN_SYNC_CONVERSATION](
    _state,
    { conversationId, messageId }
  ) {
    _state.syncConversationsMessages[conversationId] = messageId;
  },

  [types.SET_CONTEXT_MENU_CHAT_ID](_state, chatId) {
    _state.contextMenuChatId = chatId;
  },

  [types.SET_CHAT_LIST_FILTERS](_state, data) {
    _state.conversationFilters = data;
  },
  [types.UPDATE_CHAT_LIST_FILTERS](_state, data) {
    _state.conversationFilters = { ..._state.conversationFilters, ...data };
  },
  [types.SET_INBOX_CAPTAIN_ASSISTANT](_state, data) {
    _state.copilotAssistant = data.assistant;
  },
  [types.SET_OPERATOR_NOTIFICATION_COUNT](
    _state,
    { conversationId, unreadCount }
  ) {
    if (unreadCount > 0) {
      _state.operatorNotifications.set(String(conversationId), unreadCount);
    } else {
      _state.operatorNotifications.delete(String(conversationId));
    }
  },
  [types.SET_OPERATOR_NOTIFICATIONS_READY](_state, ready) {
    _state.operatorNotificationsReady = ready;
  },
  [types.CLEAR_OPERATOR_NOTIFICATIONS](_state) {
    _state.operatorNotifications.clear();
    _state.operatorNotificationsReady = false;
  },
  [types.SET_CONVERSATION_TOPIC](
    _state,
    { conversationId, topic, labelColor }
  ) {
    _state.conversationTopics.set(String(conversationId), {
      topic,
      labelColor,
    });

    const conversation = _state.allConversations.find(
      c => c.id === Number(conversationId)
    );
    if (conversation) {
      if (!conversation.custom_attributes) {
        conversation.custom_attributes = {};
      }
      conversation.custom_attributes.bot_topic = topic;
    }
  },
  [types.CLEAR_CONVERSATION_TOPICS](_state) {
    _state.conversationTopics.clear();
  },
};

export default {
  state,
  getters,
  actions,
  mutations,
};

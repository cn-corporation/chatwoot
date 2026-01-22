import { MESSAGE_TYPE } from 'shared/constants/messages';
import { applyPageFilters, applyRoleFilter, sortComparator } from './helpers';
import filterQueryGenerator from 'dashboard/helper/filterQueryGenerator';
import { matchesFilters } from './helpers/filterHelpers';
import {
  getUserPermissions,
  getUserRole,
} from '../../../helper/permissionsHelper';
import camelcaseKeys from 'camelcase-keys';

export const getSelectedChatConversation = ({
  allConversations,
  selectedChatId,
}) =>
  allConversations.filter(conversation => conversation.id === selectedChatId);

const isOpenOrPending = conversation =>
  conversation?.status === 'open' || conversation?.status === 'pending';

const getAssigneeId = conversation =>
  conversation?.assignee_id ?? conversation?.meta?.assignee?.id;

const isAssignedToCurrentUser = (conversation, currentUserId) => {
  const assigneeId = getAssigneeId(conversation);
  if (!assigneeId) return true;
  if (!currentUserId) return false;
  return String(assigneeId) === String(currentUserId);
};

const isOperatorUnreadEligible = (conversation, currentUserId) => {
  if (!conversation) return false;
  if (!isOpenOrPending(conversation)) return false;
  return isAssignedToCurrentUser(conversation, currentUserId);
};

const findConversation = (state, conversationId) => {
  const normalizedId = Number(conversationId);
  return (
    state.allConversations.find(conv => conv.id === normalizedId) ||
    state.sidebarCountsData.find(conv => conv.id === normalizedId)
  );
};

const getters = {
  getAllConversations: ({ allConversations, chatSortFilter: sortKey }) => {
    return allConversations.sort((a, b) => sortComparator(a, b, sortKey));
  },
  getFilteredConversations: (
    { allConversations, chatSortFilter, appliedFilters },
    _,
    __,
    rootGetters
  ) => {
    const currentUser = rootGetters.getCurrentUser;
    const currentUserId = rootGetters.getCurrentUser.id;
    const currentAccountId = rootGetters.getCurrentAccountId;

    const permissions = getUserPermissions(currentUser, currentAccountId);
    const userRole = getUserRole(currentUser, currentAccountId);

    return allConversations
      .filter(conversation => {
        const matchesFilterResult = matchesFilters(
          conversation,
          appliedFilters
        );
        const allowedForRole = applyRoleFilter(
          conversation,
          userRole,
          permissions,
          currentUserId
        );

        return matchesFilterResult && allowedForRole;
      })
      .sort((a, b) => sortComparator(a, b, chatSortFilter));
  },
  getSelectedChat: ({ selectedChatId, allConversations }) => {
    const selectedChat = allConversations.find(
      conversation => conversation.id === selectedChatId
    );
    return selectedChat || {};
  },
  getSelectedChatAttachments: ({ selectedChatId, attachments }) => {
    return attachments[selectedChatId] || [];
  },
  getChatListFilters: ({ conversationFilters }) => conversationFilters,
  getLastEmailInSelectedChat: (stage, _getters) => {
    const selectedChat = _getters.getSelectedChat;
    const { messages = [] } = selectedChat;
    const lastEmail = [...messages].reverse().find(message => {
      const { message_type: messageType } = message;
      if (message.private) return false;

      return [MESSAGE_TYPE.OUTGOING, MESSAGE_TYPE.INCOMING].includes(
        messageType
      );
    });

    return lastEmail;
  },
  getMineChats: (_state, _, __, rootGetters) => activeFilters => {
    const currentUserID = rootGetters.getCurrentUser?.id;

    return _state.allConversations.filter(conversation => {
      const { assignee } = conversation.meta;
      const isAssignedToMe = assignee && assignee.id === currentUserID;
      const shouldFilter = applyPageFilters(conversation, activeFilters);
      const isChatMine = isAssignedToMe && shouldFilter;

      return isChatMine;
    });
  },
  getAppliedConversationFiltersV2: _state => {
    // TODO: Replace existing one with V2 after migrating the filters to use camelcase
    return _state.appliedFilters.map(camelcaseKeys);
  },
  getAppliedConversationFilters: _state => {
    return _state.appliedFilters;
  },
  getAppliedConversationFiltersQuery: _state => {
    const hasAppliedFilters = _state.appliedFilters.length !== 0;
    return hasAppliedFilters ? filterQueryGenerator(_state.appliedFilters) : [];
  },
  getUnAssignedChats: _state => activeFilters => {
    return _state.allConversations.filter(conversation => {
      const { assignee } = conversation.meta;
      const isUnAssigned = !assignee || !assignee.id;
      const shouldFilter = applyPageFilters(conversation, activeFilters);
      return isUnAssigned && shouldFilter;
    });
  },
  getResolvedChats: _state => activeFilters => {
    return _state.allConversations.filter(conversation => {
      const isResolved = conversation.status === 'resolved';
      const shouldFilter = applyPageFilters(conversation, activeFilters);
      return isResolved && shouldFilter;
    });
  },
  getAllStatusChats: (_state, _, __, rootGetters) => activeFilters => {
    const currentUser = rootGetters.getCurrentUser;
    const currentUserId = rootGetters.getCurrentUser.id;
    const currentAccountId = rootGetters.getCurrentAccountId;

    const permissions = getUserPermissions(currentUser, currentAccountId);
    const userRole = getUserRole(currentUser, currentAccountId);

    return _state.allConversations.filter(conversation => {
      const shouldFilter = applyPageFilters(conversation, activeFilters);
      const allowedForRole = applyRoleFilter(
        conversation,
        userRole,
        permissions,
        currentUserId
      );

      return shouldFilter && allowedForRole;
    });
  },
  getChatListLoadingStatus: ({ listLoadingStatus }) => listLoadingStatus,
  getAllMessagesLoaded(_state) {
    const [chat] = getSelectedChatConversation(_state);
    return !chat || chat.allMessagesLoaded === undefined
      ? false
      : chat.allMessagesLoaded;
  },
  getUnreadCount(_state) {
    const [chat] = getSelectedChatConversation(_state);
    if (!chat) return [];
    return chat.messages.filter(
      chatMessage =>
        chatMessage.created_at * 1000 > chat.agent_last_seen_at * 1000 &&
        chatMessage.message_type === 0 &&
        chatMessage.private !== true
    ).length;
  },
  getChatStatusFilter: ({ chatStatusFilter }) => chatStatusFilter,
  getChatSortFilter: ({ chatSortFilter }) => chatSortFilter,
  getSelectedInbox: ({ currentInbox }) => currentInbox,
  getConversationById: _state => conversationId => {
    return _state.allConversations.find(
      value => value.id === Number(conversationId)
    );
  },
  getConversationParticipants: _state => {
    return _state.conversationParticipants;
  },
  getConversationLastSeen: _state => {
    return _state.conversationLastSeen;
  },

  getContextMenuChatId: _state => {
    return _state.contextMenuChatId;
  },

  getCopilotAssistant: _state => {
    return _state.copilotAssistant;
  },

  // Get total unread count across all conversations (uses separate counts data)
  getTotalUnreadCount: _state => {
    // Use sidebar counts data if available, fallback to allConversations
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    // Only count unread from open and pending conversations, not resolved
    return source
      .filter(
        conversation =>
          conversation.status === 'open' || conversation.status === 'pending'
      )
      .reduce((total, conversation) => {
        return total + (conversation.unread_count || 0);
      }, 0);
  },

  // Get unread count for specific inbox (uses separate counts data)
  getUnreadCountForInbox: _state => inboxId => {
    // Use sidebar counts data if available, fallback to allConversations
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    // Only count unread from open and pending conversations, not resolved
    return source
      .filter(
        conversation =>
          conversation.inbox_id === inboxId &&
          (conversation.status === 'open' || conversation.status === 'pending')
      )
      .reduce((total, conversation) => {
        return total + (conversation.unread_count || 0);
      }, 0);
  },

  // Get unread count for specific label (uses separate counts data)
  getUnreadCountForLabel: _state => labelTitle => {
    // Use sidebar counts data if available, fallback to allConversations
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    // Only count unread from open and pending conversations, not resolved
    return source
      .filter(conversation => {
        if (!conversation.labels || !Array.isArray(conversation.labels))
          return false;
        if (conversation.status !== 'open' && conversation.status !== 'pending')
          return false;
        // Labels can be either strings or objects with title property
        return conversation.labels.some(label =>
          typeof label === 'string'
            ? label === labelTitle
            : label.title === labelTitle
        );
      })
      .reduce((total, conversation) => {
        return total + (conversation.unread_count || 0);
      }, 0);
  },

  // Get unread count for specific team (uses separate counts data)
  getUnreadCountForTeam: _state => teamId => {
    // Use sidebar counts data if available, fallback to allConversations
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    // Only count unread from open and pending conversations, not resolved
    return source
      .filter(conversation => {
        const convTeamId = conversation.team_id || conversation.meta?.team?.id;
        return (
          convTeamId === teamId &&
          (conversation.status === 'open' || conversation.status === 'pending')
        );
      })
      .reduce((total, conversation) => {
        return total + (conversation.unread_count || 0);
      }, 0);
  },

  // Get conversations for tab counts in label views
  getConversationsForLabelTabs: _state => label => {
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    return source.filter(conversation => {
      if (!conversation.labels || !Array.isArray(conversation.labels)) {
        return false;
      }
      return conversation.labels.includes(label);
    });
  },

  // Get conversations for tab counts in team views
  getConversationsForTeamTabs: _state => teamId => {
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    return source.filter(conversation => {
      const convTeamId = conversation.team_id || conversation.meta?.team?.id;
      return convTeamId === Number(teamId);
    });
  },

  getConversationsForInboxTabs: _state => inboxId => {
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;

    if (!inboxId) {
      return source;
    }

    return source.filter(conversation => {
      return conversation.inbox_id === Number(inboxId);
    });
  },

  // Operator Notifications (chatwoot-extra integration)
  getOperatorUnreadCount:
    (_state, _getters, _rootState, rootGetters) => conversationId => {
      const currentUserId = rootGetters.getCurrentUser?.id;
      const conversation = findConversation(_state, conversationId);
      if (!isOperatorUnreadEligible(conversation, currentUserId)) return 0;
      return _state.operatorNotifications.get(String(conversationId)) || 0;
    },

  getTotalOperatorUnreadCount: (_state, _getters, _rootState, rootGetters) => {
    const source =
      _state.sidebarCountsData.length > 0
        ? _state.sidebarCountsData
        : _state.allConversations;
    const currentUserId = rootGetters.getCurrentUser?.id;

    return source.reduce((total, conv) => {
      if (!isOperatorUnreadEligible(conv, currentUserId)) return total;
      return total + (_state.operatorNotifications.get(String(conv.id)) || 0);
    }, 0);
  },

  getOperatorUnreadCountForInbox:
    (_state, getters, _rootState, rootGetters) => inboxId => {
      const source =
        _state.sidebarCountsData.length > 0
          ? _state.sidebarCountsData
          : _state.allConversations;
      const currentUserId = rootGetters.getCurrentUser?.id;

      return source
        .filter(conv => {
          if (conv.inbox_id !== inboxId) return false;
          return isOperatorUnreadEligible(conv, currentUserId);
        })
        .reduce((total, conv) => {
          return total + getters.getOperatorUnreadCount(conv.id);
        }, 0);
    },

  getOperatorUnreadCountForTeam:
    (_state, getters, _rootState, rootGetters) => teamId => {
      const source =
        _state.sidebarCountsData.length > 0
          ? _state.sidebarCountsData
          : _state.allConversations;
      const currentUserId = rootGetters.getCurrentUser?.id;

      return source
        .filter(conv => {
          const convTeamId = conv.team_id || conv.meta?.team?.id;
          if (convTeamId !== teamId) return false;
          return isOperatorUnreadEligible(conv, currentUserId);
        })
        .reduce((total, conv) => {
          return total + getters.getOperatorUnreadCount(conv.id);
        }, 0);
    },

  getOperatorUnreadCountForLabel:
    (_state, getters, _rootState, rootGetters) => labelTitle => {
      const source =
        _state.sidebarCountsData.length > 0
          ? _state.sidebarCountsData
          : _state.allConversations;
      const currentUserId = rootGetters.getCurrentUser?.id;

      return source
        .filter(conv => {
          if (!conv.labels || !Array.isArray(conv.labels)) return false;
          if (!isOperatorUnreadEligible(conv, currentUserId)) return false;

          return conv.labels.some(label =>
            typeof label === 'string'
              ? label === labelTitle
              : label.title === labelTitle
          );
        })
        .reduce((total, conv) => {
          return total + getters.getOperatorUnreadCount(conv.id);
        }, 0);
    },
};

export default getters;

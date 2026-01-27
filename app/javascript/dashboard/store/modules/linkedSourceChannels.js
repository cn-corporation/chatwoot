import LinkedSourceChannelsAPI from '../../api/linkedSourceChannels';
import MessageApi from '../../api/inbox/message';
import ChatwootExtraAPI from '../../api/chatwootExtra';

const state = {
  linkedChannels: {},
  linkedMessages: {},
  loadingStatus: {},
};

export const getters = {
  getLinkedChannels: $state => conversationId => {
    return $state.linkedChannels[conversationId] || [];
  },
  getLinkedContactName: $state => conversationId => {
    const channels = $state.linkedChannels[conversationId] || [];
    return channels.length > 0 ? channels[0].contact_name : null;
  },
  hasLinkedSourceChannels: $state => conversationId => {
    const channels = $state.linkedChannels[conversationId] || [];
    return channels.length > 0;
  },
  getLinkedMessages: $state => conversationId => {
    return $state.linkedMessages[conversationId] || [];
  },
  isLoadingLinkedChannels: $state => conversationId => {
    return $state.loadingStatus[conversationId] || false;
  },
};

export const actions = {
  async fetchLinkedSourceChannels({ commit, rootGetters }, { conversationId }) {
    commit('SET_LOADING_STATUS', { conversationId, status: true });
    try {
      const response = await LinkedSourceChannelsAPI.get(conversationId);
      const linkedChannels = response.data?.linked_channels || [];

      const currentChat = rootGetters.getSelectedChat;
      const currentInboxId = currentChat?.inbox_id;

      if (!currentInboxId || linkedChannels.length === 0) {
        commit('SET_LINKED_CHANNELS', { conversationId, channels: [] });
        return [];
      }

      const validatedChannels = await validateClubIds(
        linkedChannels,
        currentInboxId
      );
      commit('SET_LINKED_CHANNELS', {
        conversationId,
        channels: validatedChannels,
      });
      return validatedChannels;
    } catch (error) {
      commit('SET_LINKED_CHANNELS', { conversationId, channels: [] });
      return [];
    } finally {
      commit('SET_LOADING_STATUS', { conversationId, status: false });
    }
  },

  async fetchLinkedConversationMessages(
    { commit, state: $state },
    { conversationId, linkedConversationId, before }
  ) {
    try {
      const params = { conversationId: linkedConversationId };
      if (before) {
        params.before = before;
      }
      const response = await MessageApi.getPreviousMessages(params);
      const messages = response.data?.payload || [];

      const existingMessages = $state.linkedMessages[conversationId] || [];
      const newMessages = [...messages, ...existingMessages];

      commit('SET_LINKED_MESSAGES', { conversationId, messages: newMessages });
      return messages;
    } catch (error) {
      return [];
    }
  },

  clearLinkedMessages({ commit }, { conversationId }) {
    commit('SET_LINKED_MESSAGES', { conversationId, messages: [] });
  },

  clearLinkedChannels({ commit }, { conversationId }) {
    commit('SET_LINKED_CHANNELS', { conversationId, channels: [] });
    commit('SET_LINKED_MESSAGES', { conversationId, messages: [] });
  },
};

async function validateClubIds(linkedChannels, currentInboxId) {
  try {
    const currentSource =
      await ChatwootExtraAPI.getSourceChannel(currentInboxId);
    const currentClubId = currentSource?.data?.clubId;

    if (!currentClubId) {
      return [];
    }

    const validated = [];
    for (const channel of linkedChannels) {
      try {
        const linkedSource = await ChatwootExtraAPI.getSourceChannel(
          channel.inbox_id
        );
        if (linkedSource?.data?.clubId === currentClubId) {
          validated.push(channel);
        }
      } catch {
        continue;
      }
    }
    return validated;
  } catch {
    return linkedChannels;
  }
}

export const mutations = {
  SET_LINKED_CHANNELS($state, { conversationId, channels }) {
    $state.linkedChannels = {
      ...$state.linkedChannels,
      [conversationId]: channels,
    };
  },
  SET_LINKED_MESSAGES($state, { conversationId, messages }) {
    $state.linkedMessages = {
      ...$state.linkedMessages,
      [conversationId]: messages,
    };
  },
  SET_LOADING_STATUS($state, { conversationId, status }) {
    $state.loadingStatus = {
      ...$state.loadingStatus,
      [conversationId]: status,
    };
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

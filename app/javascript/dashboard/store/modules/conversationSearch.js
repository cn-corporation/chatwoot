import SearchAPI from '../../api/search';
import ChatwootExtraAPI from '../../api/chatwootExtra';
import types from '../mutation-types';
const MESSAGE_SEARCH_LIMIT = 15;

export const initialState = {
  records: [],
  contactRecords: [],
  conversationRecords: [],
  messageRecords: [],
  articleRecords: [],
  messageFilters: {
    userId: null,
    dateFrom: null,
    dateTo: null,
  },
  hasMoreMessages: true,
  uiFlags: {
    isFetching: false,
    isSearchCompleted: false,
    contact: { isFetching: false },
    conversation: { isFetching: false },
    message: { isFetching: false },
    article: { isFetching: false },
  },
};

export const getters = {
  getConversations(state) {
    return state.records;
  },
  getContactRecords(state) {
    return state.contactRecords;
  },
  getConversationRecords(state) {
    return state.conversationRecords;
  },
  getMessageRecords(state) {
    return state.messageRecords;
  },
  getArticleRecords(state) {
    return state.articleRecords;
  },
  getMessageFilters(state) {
    return state.messageFilters;
  },
  getHasMoreMessages(state) {
    return state.hasMoreMessages;
  },
  getUIFlags(state) {
    return state.uiFlags;
  },
};

export const actions = {
  async get({ commit }, { q }) {
    commit(types.SEARCH_CONVERSATIONS_SET, []);
    if (!q) {
      return;
    }
    commit(types.SEARCH_CONVERSATIONS_SET_UI_FLAG, { isFetching: true });
    try {
      const {
        data: { payload },
      } = await SearchAPI.get({ q });
      commit(types.SEARCH_CONVERSATIONS_SET, payload);
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.SEARCH_CONVERSATIONS_SET_UI_FLAG, {
        isFetching: false,
      });
    }
  },
  async fullSearch({ commit, dispatch }, { q }) {
    if (!q) {
      return;
    }
    commit(types.FULL_SEARCH_SET_UI_FLAG, {
      isFetching: true,
      isSearchCompleted: false,
    });
    try {
      await Promise.all([
        dispatch('contactSearch', { q }),
        dispatch('conversationSearch', { q }),
        dispatch('messageSearch', { q }),
        dispatch('articleSearch', { q }),
      ]);
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.FULL_SEARCH_SET_UI_FLAG, {
        isFetching: false,
        isSearchCompleted: true,
      });
    }
  },
  async contactSearch({ commit }, { q, page = 1 }) {
    commit(types.CONTACT_SEARCH_SET_UI_FLAG, { isFetching: true });
    try {
      const { data } = await SearchAPI.contacts({ q, page });
      commit(types.CONTACT_SEARCH_SET, data.payload.contacts);
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.CONTACT_SEARCH_SET_UI_FLAG, { isFetching: false });
    }
  },
  async conversationSearch({ commit }, { q, page = 1 }) {
    commit(types.CONVERSATION_SEARCH_SET_UI_FLAG, { isFetching: true });
    try {
      const { data } = await SearchAPI.conversations({ q, page });
      commit(types.CONVERSATION_SEARCH_SET, data.payload.conversations);
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.CONVERSATION_SEARCH_SET_UI_FLAG, { isFetching: false });
    }
  },
  async messageSearch({ commit, state, rootGetters }, { q, page = 1 }) {
    commit(types.MESSAGE_SEARCH_SET_UI_FLAG, { isFetching: true });
    try {
      const accountId = rootGetters.getCurrentAccountId;
      const { userId, dateFrom, dateTo } = state.messageFilters;

      const response = await ChatwootExtraAPI.searchMessages({
        query: q,
        userId,
        dateFrom,
        dateTo,
        accountId,
        limit: MESSAGE_SEARCH_LIMIT,
        offset: (page - 1) * MESSAGE_SEARCH_LIMIT,
      });

      const hits = response.hits || [];
      const totalHits = response.totalHits || 0;
      const currentOffset = (page - 1) * MESSAGE_SEARCH_LIMIT;
      const hasMore = currentOffset + hits.length < totalHits;
      commit('SET_HAS_MORE_MESSAGES', hasMore);

      const agents = rootGetters['agents/getAgents'];
      const messages = hits.map(hit => ({
        id: hit.messageId,
        conversation_id: hit.conversationId,
        content: hit.content,
        created_at: Math.floor(hit.timestamp / 1000),
        message_type: hit.messageType || 'message',
        sender: hit.userId
          ? { name: agents.find(a => a.id === hit.userId)?.name || 'Agent' }
          : null,
        inbox: {},
      }));

      commit(types.MESSAGE_SEARCH_SET, messages);
    } catch (error) {
      commit('SET_HAS_MORE_MESSAGES', false);
    } finally {
      commit(types.MESSAGE_SEARCH_SET_UI_FLAG, { isFetching: false });
    }
  },
  setMessageFilters({ commit }, filters) {
    commit(types.SET_MESSAGE_SEARCH_FILTERS, filters);
  },
  async articleSearch({ commit }, { q, page = 1 }) {
    commit(types.ARTICLE_SEARCH_SET_UI_FLAG, { isFetching: true });
    try {
      const { data } = await SearchAPI.articles({ q, page });
      commit(types.ARTICLE_SEARCH_SET, data.payload.articles);
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.ARTICLE_SEARCH_SET_UI_FLAG, { isFetching: false });
    }
  },
  async clearSearchResults({ commit }) {
    commit(types.CLEAR_SEARCH_RESULTS);
  },
  clearMessageResults({ commit }) {
    commit('CLEAR_MESSAGE_RESULTS');
  },
};

export const mutations = {
  [types.SEARCH_CONVERSATIONS_SET](state, records) {
    state.records = records;
  },
  [types.CONTACT_SEARCH_SET](state, records) {
    state.contactRecords = [...state.contactRecords, ...records];
  },
  [types.CONVERSATION_SEARCH_SET](state, records) {
    state.conversationRecords = [...state.conversationRecords, ...records];
  },
  [types.MESSAGE_SEARCH_SET](state, records) {
    state.messageRecords = [...state.messageRecords, ...records];
  },
  [types.ARTICLE_SEARCH_SET](state, records) {
    state.articleRecords = [...state.articleRecords, ...records];
  },
  [types.SEARCH_CONVERSATIONS_SET_UI_FLAG](state, uiFlags) {
    state.uiFlags = { ...state.uiFlags, ...uiFlags };
  },
  [types.FULL_SEARCH_SET_UI_FLAG](state, uiFlags) {
    state.uiFlags = { ...state.uiFlags, ...uiFlags };
  },
  [types.CONTACT_SEARCH_SET_UI_FLAG](state, uiFlags) {
    state.uiFlags.contact = { ...state.uiFlags.contact, ...uiFlags };
  },
  [types.CONVERSATION_SEARCH_SET_UI_FLAG](state, uiFlags) {
    state.uiFlags.conversation = { ...state.uiFlags.conversation, ...uiFlags };
  },
  [types.MESSAGE_SEARCH_SET_UI_FLAG](state, uiFlags) {
    state.uiFlags.message = { ...state.uiFlags.message, ...uiFlags };
  },
  [types.ARTICLE_SEARCH_SET_UI_FLAG](state, uiFlags) {
    state.uiFlags.article = { ...state.uiFlags.article, ...uiFlags };
  },
  [types.CLEAR_SEARCH_RESULTS](state) {
    state.contactRecords = [];
    state.conversationRecords = [];
    state.messageRecords = [];
    state.articleRecords = [];
    state.hasMoreMessages = true;
  },
  [types.SET_MESSAGE_SEARCH_FILTERS](state, filters) {
    state.messageFilters = { ...state.messageFilters, ...filters };
  },
  SET_HAS_MORE_MESSAGES(state, hasMore) {
    state.hasMoreMessages = hasMore;
  },
  CLEAR_MESSAGE_RESULTS(state) {
    state.messageRecords = [];
    state.hasMoreMessages = true;
  },
};

export default {
  namespaced: true,
  state: initialState,
  getters,
  actions,
  mutations,
};

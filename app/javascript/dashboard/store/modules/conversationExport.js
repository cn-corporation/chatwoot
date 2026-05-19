import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';
import { throwErrorMessage } from '../utils/api';
import { encrypt } from '../../helper/encryption';

export const state = {
  records: [],
  uiFlags: {
    isFetching: false,
    isCreating: false,
    isStopping: false,
  },
};

export const getters = {
  getConversationExports($state) {
    return $state.records;
  },
  getActiveExport($state) {
    return $state.records.find(record => record.status === 'processing');
  },
  getUIFlags($state) {
    return $state.uiFlags;
  },
};

export const actions = {
  get: async ({ commit, rootGetters }) => {
    commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isFetching: true });
    try {
      const accountId = rootGetters.getCurrentAccountId;
      const response = await ChatwootExtraAPI.getConversationExports(accountId);
      if (response.success) {
        commit(types.SET_CONVERSATION_EXPORTS, response.data || []);
      }
    } catch (error) {
      throwErrorMessage(error);
    } finally {
      commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isFetching: false });
    }
  },
  create: async ({ commit, rootGetters }, { dateFrom, dateTo }) => {
    commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isCreating: true });
    try {
      const accountId = rootGetters.getCurrentAccountId;
      const currentUser = rootGetters.getCurrentUser;
      if (!currentUser?.access_token) {
        throw new Error('Current user access token is not available.');
      }
      const bearerTokenHash = await encrypt(
        JSON.stringify({ bearerToken: currentUser.access_token, accountId })
      );
      const chatwootApiUrl = window.location.origin;
      const response = await ChatwootExtraAPI.createConversationExport({
        accountId,
        dateFrom,
        dateTo,
        bearerTokenHash,
        chatwootApiUrl,
        createdByUserId: currentUser.id,
      });
      if (response.success && response.data) {
        commit(types.SET_CONVERSATION_EXPORT, response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isCreating: false });
    }
  },
  getStatus: async ({ commit }, id) => {
    try {
      const response = await ChatwootExtraAPI.getConversationExportStatus(id);
      if (response.success && response.data) {
        commit(types.SET_CONVERSATION_EXPORT, response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    }
  },
  stop: async ({ commit }, id) => {
    commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isStopping: true });
    try {
      const response = await ChatwootExtraAPI.stopConversationExport(id);
      if (response.success && response.data) {
        commit(types.SET_CONVERSATION_EXPORT, response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isStopping: false });
    }
  },
  download: async (_, id) => {
    return ChatwootExtraAPI.downloadConversationExport(id);
  },
};

export const mutations = {
  [types.SET_CONVERSATION_EXPORT_UI_FLAG]($state, data) {
    $state.uiFlags = { ...$state.uiFlags, ...data };
  },
  [types.SET_CONVERSATION_EXPORTS]($state, records) {
    $state.records = records;
  },
  [types.SET_CONVERSATION_EXPORT]($state, record) {
    const index = $state.records.findIndex(item => item.id === record.id);
    if (index === -1) {
      $state.records = [record, ...$state.records];
    } else {
      const next = [...$state.records];
      next[index] = record;
      $state.records = next;
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

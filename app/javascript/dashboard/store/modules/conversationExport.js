import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';
import { throwErrorMessage } from '../utils/api';
import { encrypt } from '../../helper/encryption';

export const state = {
  records: [],
  analyses: {},
  uiFlags: {
    isFetching: false,
    isCreating: false,
    isStopping: false,
    isFetchingAnalyses: false,
    isCreatingAnalysis: false,
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
  getAnalysesByExport: $state => exportId => $state.analyses[exportId] || [],
  getActiveAnalysisByExport: $state => exportId =>
    ($state.analyses[exportId] || []).find(a => a.status === 'processing'),
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
  fetchAnalyses: async ({ commit }, exportId) => {
    commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, {
      isFetchingAnalyses: true,
    });
    try {
      const response =
        await ChatwootExtraAPI.getConversationExportAnalyses(exportId);
      if (response.success) {
        commit(types.SET_CONVERSATION_EXPORT_ANALYSES, {
          exportId,
          analyses: response.data || [],
        });
        return response.data || [];
      }
      return [];
    } catch (error) {
      throwErrorMessage(error);
      return [];
    } finally {
      commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, {
        isFetchingAnalyses: false,
      });
    }
  },
  createAnalysis: async ({ commit, rootGetters }, { exportId, userPrompt }) => {
    commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, { isCreatingAnalysis: true });
    try {
      const currentUser = rootGetters.getCurrentUser;
      const response = await ChatwootExtraAPI.createConversationExportAnalysis({
        exportId,
        userPrompt,
        createdByUserId: currentUser?.id,
      });
      if (response.success && response.data) {
        commit(types.SET_CONVERSATION_EXPORT_ANALYSIS, {
          exportId,
          analysis: response.data,
        });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_CONVERSATION_EXPORT_UI_FLAG, {
        isCreatingAnalysis: false,
      });
    }
  },
  fetchAnalysis: async ({ commit }, { exportId, id }) => {
    try {
      const response = await ChatwootExtraAPI.getConversationExportAnalysis(id);
      if (response.success && response.data) {
        commit(types.SET_CONVERSATION_EXPORT_ANALYSIS, {
          exportId,
          analysis: response.data,
        });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    }
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
  [types.SET_CONVERSATION_EXPORT_ANALYSES]($state, { exportId, analyses }) {
    $state.analyses = { ...$state.analyses, [exportId]: analyses };
  },
  [types.SET_CONVERSATION_EXPORT_ANALYSIS]($state, { exportId, analysis }) {
    const existing = $state.analyses[exportId] || [];
    const index = existing.findIndex(a => a.id === analysis.id);
    const next = [...existing];
    if (index === -1) next.unshift(analysis);
    else next[index] = analysis;
    $state.analyses = { ...$state.analyses, [exportId]: next };
  },
  [types.CLEAR_CONVERSATION_EXPORT_ANALYSES]($state) {
    $state.analyses = {};
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

import { throwErrorMessage } from 'dashboard/store/utils/api';
import * as MutationHelpers from 'shared/helpers/vuex/mutationHelpers';
import * as types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';

const state = {
  records: [],
  uiFlags: {
    fetchingList: false,
    creatingItem: false,
    updatingItem: false,
    deletingItem: false,
  },
  hasFetched: false,
};

const getters = {
  getPersonalCannedResponses(_state) {
    return _state.records;
  },
  getSortedPersonalCannedResponses(_state) {
    return sortOrder =>
      [..._state.records].sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.command.localeCompare(b.command);
        }
        return b.command.localeCompare(a.command);
      });
  },
  getPersonalCannedUIFlags(_state) {
    return _state.uiFlags;
  },
  hasPersonalCannedFetched(_state) {
    return _state.hasFetched;
  },
};

const actions = {
  getPersonalCannedResponses: async function getPersonalCannedResponses(
    { commit, rootGetters },
    { force = false } = {}
  ) {
    const hasFetched = state.hasFetched;
    if (hasFetched && !force) {
      return;
    }

    commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, { fetchingList: true });
    try {
      const currentUser = rootGetters.getCurrentUser;
      const chatwootUserId = currentUser?.id;
      if (!chatwootUserId) {
        commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
          fetchingList: false,
        });
        return;
      }

      const responses =
        await ChatwootExtraAPI.getPersonalCannedResponses(chatwootUserId);
      commit(types.default.SET_PERSONAL_CANNED, responses);
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        fetchingList: false,
      });
    } catch (error) {
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        fetchingList: false,
      });
    }
  },

  createPersonalCannedResponse: async function createPersonalCannedResponse(
    { commit, rootGetters },
    { command, text }
  ) {
    commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, { creatingItem: true });
    try {
      const currentUser = rootGetters.getCurrentUser;
      const chatwootUserId = currentUser?.id;

      const response = await ChatwootExtraAPI.createPersonalCannedResponse({
        chatwootUserId,
        command,
        text,
      });

      if (response.success && response.data) {
        commit(types.default.ADD_PERSONAL_CANNED, response.data);
      }
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        creatingItem: false,
      });
      return response.data;
    } catch (error) {
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        creatingItem: false,
      });
      return throwErrorMessage(error);
    }
  },

  updatePersonalCannedResponse: async function updatePersonalCannedResponse(
    { commit },
    { id, command, text }
  ) {
    commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, { updatingItem: true });
    try {
      const response = await ChatwootExtraAPI.updatePersonalCannedResponse(id, {
        command,
        text,
      });

      if (response.success && response.data) {
        commit(types.default.EDIT_PERSONAL_CANNED, response.data);
      }
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        updatingItem: false,
      });
      return response.data;
    } catch (error) {
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        updatingItem: false,
      });
      return throwErrorMessage(error);
    }
  },

  deletePersonalCannedResponse: async function deletePersonalCannedResponse(
    { commit },
    id
  ) {
    commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, { deletingItem: true });
    try {
      await ChatwootExtraAPI.deletePersonalCannedResponse(id);
      commit(types.default.DELETE_PERSONAL_CANNED, id);
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        deletingItem: false,
      });
      return id;
    } catch (error) {
      commit(types.default.SET_PERSONAL_CANNED_UI_FLAG, {
        deletingItem: false,
      });
      return throwErrorMessage(error);
    }
  },
};

const mutations = {
  [types.default.SET_PERSONAL_CANNED_UI_FLAG](_state, data) {
    _state.uiFlags = {
      ..._state.uiFlags,
      ...data,
    };
  },

  [types.default.SET_PERSONAL_CANNED](_state, data) {
    _state.records = data;
    _state.hasFetched = true;
  },

  [types.default.ADD_PERSONAL_CANNED]: MutationHelpers.create,
  [types.default.EDIT_PERSONAL_CANNED]: MutationHelpers.update,
  [types.default.DELETE_PERSONAL_CANNED]: MutationHelpers.destroy,
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

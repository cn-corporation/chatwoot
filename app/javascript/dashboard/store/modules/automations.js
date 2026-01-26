import * as MutationHelpers from 'shared/helpers/vuex/mutationHelpers';
import types from '../mutation-types';
import { uploadFile } from 'dashboard/helper/uploadHelper';
import AutomationAPI from '../../api/automation';
import ChatwootExtraAPI from '../../api/chatwootExtra';

export const state = {
  records: [],
  sourceMappings: {},
  extraUUIDs: {},
  uiFlags: {
    isFetching: false,
    isCreating: false,
    isDeleting: false,
    isUpdating: false,
    isFetchingSources: false,
  },
};

export const getters = {
  getAutomations(_state) {
    return _state.records.sort((a1, a2) => a1.id - a2.id);
  },
  getAutomationSourceChannels: _state => automationId => {
    return _state.sourceMappings[automationId] || [];
  },
  getAutomationExtraUUID: _state => automationId => {
    return _state.extraUUIDs[automationId] || null;
  },
  getUIFlags(_state) {
    return _state.uiFlags;
  },
};

export const actions = {
  get: async function getAutomations({ commit, dispatch }) {
    commit(types.SET_AUTOMATION_UI_FLAG, { isFetching: true });
    try {
      const response = await AutomationAPI.get();
      commit(types.SET_AUTOMATIONS, response.data.payload);
      await dispatch('fetchAutomationSources');
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.SET_AUTOMATION_UI_FLAG, { isFetching: false });
    }
  },
  fetchAutomationSources: async function fetchAutomationSources({ commit }) {
    commit(types.SET_AUTOMATION_UI_FLAG, { isFetchingSources: true });
    try {
      const automations = await ChatwootExtraAPI.getAllAutomations();
      if (automations && Array.isArray(automations)) {
        const mappings = {};
        const uuids = {};
        automations.forEach(automation => {
          mappings[automation.chatwootAutomationId] = automation.sources.map(
            s => s.chatwootChannelId
          );
          uuids[automation.chatwootAutomationId] = automation.id;
        });
        commit(types.SET_AUTOMATION_SOURCE_MAPPINGS, mappings);
        commit(types.SET_AUTOMATION_EXTRA_UUIDS, uuids);
      }
    } catch (error) {
      // Ignore error
    } finally {
      commit(types.SET_AUTOMATION_UI_FLAG, { isFetchingSources: false });
    }
  },
  create: async function createAutomation({ commit }, automationObj) {
    commit(types.SET_AUTOMATION_UI_FLAG, { isCreating: true });
    try {
      const response = await AutomationAPI.create(automationObj);
      commit(types.ADD_AUTOMATION, response.data);
    } catch (error) {
      throw new Error(error);
    } finally {
      commit(types.SET_AUTOMATION_UI_FLAG, { isCreating: false });
    }
  },
  update: async ({ commit }, { id, ...updateObj }) => {
    commit(types.SET_AUTOMATION_UI_FLAG, { isUpdating: true });
    try {
      const response = await AutomationAPI.update(id, updateObj);
      commit(types.EDIT_AUTOMATION, response.data.payload);
    } catch (error) {
      throw new Error(error);
    } finally {
      commit(types.SET_AUTOMATION_UI_FLAG, { isUpdating: false });
    }
  },
  delete: async ({ commit }, id) => {
    commit(types.SET_AUTOMATION_UI_FLAG, { isDeleting: true });
    try {
      await AutomationAPI.delete(id);
      commit(types.DELETE_AUTOMATION, id);
    } catch (error) {
      throw new Error(error);
    } finally {
      commit(types.SET_AUTOMATION_UI_FLAG, { isDeleting: false });
    }
  },
  clone: async ({ commit }, id) => {
    commit(types.SET_AUTOMATION_UI_FLAG, { isCloning: true });
    try {
      await AutomationAPI.clone(id);
    } catch (error) {
      throw new Error(error);
    } finally {
      commit(types.SET_AUTOMATION_UI_FLAG, { isCloning: false });
    }
  },
  uploadAttachment: async (_, file) => {
    const { blobId } = await uploadFile(file);
    return blobId;
  },
};

export const mutations = {
  [types.SET_AUTOMATION_UI_FLAG](_state, data) {
    _state.uiFlags = {
      ..._state.uiFlags,
      ...data,
    };
  },
  [types.ADD_AUTOMATION]: MutationHelpers.create,
  [types.SET_AUTOMATIONS]: MutationHelpers.set,
  [types.EDIT_AUTOMATION]: MutationHelpers.update,
  [types.DELETE_AUTOMATION]: MutationHelpers.destroy,
  [types.SET_AUTOMATION_SOURCE_MAPPINGS](_state, mappings) {
    _state.sourceMappings = mappings;
  },
  [types.UPDATE_AUTOMATION_SOURCES](
    _state,
    { automationId, sourceChannelIds }
  ) {
    _state.sourceMappings = {
      ..._state.sourceMappings,
      [automationId]: sourceChannelIds,
    };
  },
  [types.SET_AUTOMATION_EXTRA_UUIDS](_state, uuids) {
    _state.extraUUIDs = uuids;
  },
  [types.UPDATE_AUTOMATION_EXTRA_UUID](_state, { automationId, uuid }) {
    _state.extraUUIDs = {
      ..._state.extraUUIDs,
      [automationId]: uuid,
    };
  },
};

export default {
  namespaced: true,
  actions,
  state,
  getters,
  mutations,
};

import * as MutationHelpers from 'shared/helpers/vuex/mutationHelpers';
import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';
import { throwErrorMessage } from '../utils/api';

export const state = {
  records: [],
  uiFlags: {
    isFetchingItem: false,
    isFetching: false,
    isCreating: false,
    isDeleting: false,
    isUpdating: false,
    isUploadingMedia: false,
    isDeletingMedia: false,
  },
};

export const getters = {
  getAds($state) {
    return $state.records;
  },
  getAd: $state => id => {
    return $state.records.find(record => record.id === id);
  },
  getUIFlags($state) {
    return $state.uiFlags;
  },
};

export const actions = {
  get: async function getAds({ commit }) {
    commit(types.SET_ADS_UI_FLAG, { isFetching: true });
    try {
      const ads = await ChatwootExtraAPI.getAllAds();
      commit(types.SET_ADS, ads || []);
    } catch (error) {
      throwErrorMessage(error);
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetching: false });
    }
  },
  getSingleAd: async function getAdById({ commit }, adId) {
    commit(types.SET_ADS_UI_FLAG, { isFetchingItem: true });
    try {
      const ad = await ChatwootExtraAPI.getAd(adId);
      if (ad) {
        commit(types.ADD_AD, ad);
      }
      return ad;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetchingItem: false });
    }
  },
  create: async function createAd({ commit }, adData) {
    commit(types.SET_ADS_UI_FLAG, { isCreating: true });
    try {
      const response = await ChatwootExtraAPI.createAd(adData);
      if (response.success && response.data) {
        commit(types.ADD_AD, response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isCreating: false });
    }
  },
  update: async ({ commit }, { id, ...updateObj }) => {
    commit(types.SET_ADS_UI_FLAG, { isUpdating: true });
    try {
      const response = await ChatwootExtraAPI.updateAd(id, updateObj);
      if (response.success && response.data) {
        commit(types.EDIT_AD, response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isUpdating: false });
    }
  },
  delete: async ({ commit }, id) => {
    commit(types.SET_ADS_UI_FLAG, { isDeleting: true });
    try {
      await ChatwootExtraAPI.deleteAd(id);
      commit(types.DELETE_AD, id);
    } catch (error) {
      throwErrorMessage(error);
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isDeleting: false });
    }
  },
  uploadMedia: async ({ commit }, file) => {
    commit(types.SET_ADS_UI_FLAG, { isUploadingMedia: true });
    try {
      const response = await ChatwootExtraAPI.uploadMedia(file);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isUploadingMedia: false });
    }
  },
  deleteMedia: async ({ commit }, mediaId) => {
    commit(types.SET_ADS_UI_FLAG, { isDeletingMedia: true });
    try {
      await ChatwootExtraAPI.deleteMedia(mediaId);
    } catch (error) {
      throwErrorMessage(error);
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isDeletingMedia: false });
    }
  },
};

export const mutations = {
  [types.SET_ADS_UI_FLAG]($state, data) {
    $state.uiFlags = {
      ...$state.uiFlags,
      ...data,
    };
  },
  [types.ADD_AD]: MutationHelpers.setSingleRecord,
  [types.SET_ADS]: MutationHelpers.set,
  [types.EDIT_AD]: MutationHelpers.update,
  [types.DELETE_AD]: MutationHelpers.destroy,
};

export default {
  namespaced: true,
  actions,
  state,
  getters,
  mutations,
};

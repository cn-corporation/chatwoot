import * as MutationHelpers from 'shared/helpers/vuex/mutationHelpers';
import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';
import { throwErrorMessage } from '../utils/api';
import { encrypt } from '../../helper/encryption';
import Auth from '../../api/auth';

export const state = {
  records: [],
  sendOperations: {},
  sendOperationsHistory: {},
  uiFlags: {
    isFetchingItem: false,
    isFetching: false,
    isCreating: false,
    isDeleting: false,
    isUpdating: false,
    isUploadingMedia: false,
    isDeletingMedia: false,
    isStartingSend: false,
    isTestingSend: false,
    isStoppingSend: false,
    isFetchingStatus: false,
    isFetchingOperations: false,
    isDeletingSentMessages: false,
  },
};

export const getters = {
  getAds($state) {
    return $state.records;
  },
  getAd: $state => id => {
    return $state.records.find(record => record.id === id);
  },
  getSendOperation: $state => adId => {
    return $state.sendOperations[adId];
  },
  getSendOperationsHistory: $state => adId => {
    return $state.sendOperationsHistory[adId] || [];
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
  startSend: async ({ commit, rootGetters }, adId) => {
    commit(types.SET_ADS_UI_FLAG, { isStartingSend: true });
    try {
      const accountId = rootGetters.getCurrentAccountId;
      const authData = Auth.getAuthData();

      if (!authData || !authData['access-token']) {
        throw new Error('Authentication data not found. Please log in again.');
      }

      const bearerTokenData = {
        'access-token': authData['access-token'],
        'token-type': authData['token-type'] || 'Bearer',
        client: authData.client,
        expiry: authData.expiry,
        uid: authData.uid,
      };

      const bearerToken = btoa(JSON.stringify(bearerTokenData));

      const payload = {
        bearerToken: bearerToken,
        accountId: accountId,
      };

      const bearerTokenHash = await encrypt(JSON.stringify(payload));
      const chatwootApiUrl = window.location.origin;

      const response = await ChatwootExtraAPI.startAdSend(
        adId,
        bearerTokenHash,
        chatwootApiUrl
      );

      if (response.success && response.data) {
        commit(types.SET_SEND_OPERATION, { adId, operation: response.data });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isStartingSend: false });
    }
  },
  testSend: async ({ commit }, { adId, telegramId }) => {
    commit(types.SET_ADS_UI_FLAG, { isTestingSend: true });
    try {
      const response = await ChatwootExtraAPI.testAdSend(adId, telegramId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isTestingSend: false });
    }
  },
  stopSend: async ({ commit }, { adId, sendOpId }) => {
    commit(types.SET_ADS_UI_FLAG, { isStoppingSend: true });
    try {
      const response = await ChatwootExtraAPI.stopAdSend(sendOpId);
      if (response.success && response.data) {
        commit(types.SET_SEND_OPERATION, { adId, operation: response.data });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isStoppingSend: false });
    }
  },
  getStatus: async ({ commit }, { adId, sendOpId }) => {
    commit(types.SET_ADS_UI_FLAG, { isFetchingStatus: true });
    try {
      const response = await ChatwootExtraAPI.getAdSendStatus(sendOpId);
      if (response.success && response.data) {
        commit(types.SET_SEND_OPERATION, { adId, operation: response.data });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetchingStatus: false });
    }
  },
  getSendOperations: async ({ commit }, adId) => {
    commit(types.SET_ADS_UI_FLAG, { isFetchingOperations: true });
    try {
      const response = await ChatwootExtraAPI.getAdSendOperations(adId);
      if (response.success && response.data) {
        commit(types.SET_SEND_OPERATIONS_HISTORY, {
          adId,
          operations: response.data,
        });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetchingOperations: false });
    }
  },
  deleteSentMessages: async ({ commit }, adId) => {
    commit(types.SET_ADS_UI_FLAG, { isDeletingSentMessages: true });
    try {
      const response = await ChatwootExtraAPI.deleteSentAds(adId);
      if (response.success) {
        return response;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isDeletingSentMessages: false });
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
  [types.SET_SEND_OPERATION]($state, { adId, operation }) {
    $state.sendOperations = {
      ...$state.sendOperations,
      [adId]: operation,
    };
  },
  [types.SET_SEND_OPERATIONS_HISTORY]($state, { adId, operations }) {
    $state.sendOperationsHistory = {
      ...$state.sendOperationsHistory,
      [adId]: operations,
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

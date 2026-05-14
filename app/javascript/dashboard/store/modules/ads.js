import * as MutationHelpers from 'shared/helpers/vuex/mutationHelpers';
import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';
import { throwErrorMessage } from '../utils/api';
import { encrypt } from '../../helper/encryption';

export const state = {
  records: [],
  sendOperations: {},
  sendOperationsHistory: {},
  errorLogs: {},
  activeSchedules: {},
  scheduleHistory: {},
  uiFlags: {
    isFetchingItem: false,
    isFetching: false,
    isCreating: false,
    isDeleting: false,
    isUpdating: false,
    isUploadingMedia: false,
    isDeletingMedia: false,
    isUploadingPlayerList: false,
    isStartingSend: false,
    isTestingSend: false,
    isStoppingSend: false,
    isFetchingStatus: false,
    isFetchingOperations: false,
    isDeletingSentMessages: false,
    isFetchingErrorLogs: false,
    isSchedulingSend: false,
    isReschedulingSend: false,
    isCancellingSchedule: false,
    isFetchingSchedules: false,
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
  getErrorLogs: $state => adId => {
    return $state.errorLogs[adId] || [];
  },
  getActiveSchedule: $state => adId => $state.activeSchedules[adId],
  getScheduleHistory: $state => adId => $state.scheduleHistory[adId] || [],
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
  uploadPlayerListCsv: async ({ commit }, file) => {
    commit(types.SET_ADS_UI_FLAG, { isUploadingPlayerList: true });
    try {
      const response = await ChatwootExtraAPI.uploadPlayerListCsv(file);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isUploadingPlayerList: false });
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
      const currentUser = rootGetters.getCurrentUser;
      if (!currentUser?.access_token) {
        throw new Error('Current user access token is not available.');
      }

      const payload = {
        bearerToken: currentUser.access_token,
        accountId,
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
  getActiveScheduledSends: async ({ commit }) => {
    commit(types.SET_ADS_UI_FLAG, { isFetchingSchedules: true });
    try {
      const response = await ChatwootExtraAPI.getActiveScheduledSends();
      if (response.success && response.data) {
        commit(types.SET_ACTIVE_SCHEDULES, response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetchingSchedules: false });
    }
  },
  getScheduledSendsForAd: async ({ commit }, adId) => {
    commit(types.SET_ADS_UI_FLAG, { isFetchingSchedules: true });
    try {
      const response = await ChatwootExtraAPI.getScheduledSendsForAd(adId);
      if (response.success && response.data) {
        commit(types.SET_SCHEDULE_HISTORY, { adId, schedules: response.data });
        return response.data;
      }
      return [];
    } catch (error) {
      throwErrorMessage(error);
      return [];
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetchingSchedules: false });
    }
  },
  scheduleSend: async (
    { commit, rootGetters },
    { adId, scheduledAt, scheduledTz }
  ) => {
    commit(types.SET_ADS_UI_FLAG, { isSchedulingSend: true });
    try {
      const accountId = rootGetters.getCurrentAccountId;
      const currentUser = rootGetters.getCurrentUser;
      if (!currentUser?.access_token) {
        throw new Error('Current user access token is not available.');
      }
      const payload = {
        bearerToken: currentUser.access_token,
        accountId,
      };
      const bearerTokenHash = await encrypt(JSON.stringify(payload));
      const chatwootApiUrl = window.location.origin;

      const response = await ChatwootExtraAPI.createScheduledSend({
        adId,
        scheduledAt,
        scheduledTz,
        bearerTokenHash,
        chatwootApiUrl,
        createdByUserId: currentUser.id,
      });
      if (response.success && response.data) {
        commit(types.SET_ACTIVE_SCHEDULE_FOR_AD, {
          adId,
          schedule: response.data,
        });
        return response.data;
      }
      return null;
    } catch (error) {
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isSchedulingSend: false });
    }
  },
  rescheduleSend: async (
    { commit, dispatch },
    { adId, scheduleId, scheduledAt, scheduledTz }
  ) => {
    commit(types.SET_ADS_UI_FLAG, { isReschedulingSend: true });
    try {
      const response = await ChatwootExtraAPI.rescheduleScheduledSend(
        scheduleId,
        { scheduledAt, scheduledTz }
      );
      if (response.success && response.data) {
        commit(types.SET_ACTIVE_SCHEDULE_FOR_AD, {
          adId,
          schedule: response.data,
        });
        return response.data;
      }
      return null;
    } catch (error) {
      if (error?.response?.status === 409) {
        // Schedule already fired or was cancelled — refresh active schedules
        // to clear the stale pill and swallow the error without the generic toast.
        commit(types.REMOVE_ACTIVE_SCHEDULE_FOR_AD, adId);
        dispatch('getActiveScheduledSends');
        return null;
      }
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isReschedulingSend: false });
    }
  },
  cancelScheduledSend: async ({ commit, dispatch }, { adId, scheduleId }) => {
    commit(types.SET_ADS_UI_FLAG, { isCancellingSchedule: true });
    try {
      const response = await ChatwootExtraAPI.cancelScheduledSend(scheduleId);
      if (response.success) {
        commit(types.REMOVE_ACTIVE_SCHEDULE_FOR_AD, adId);
        return response.data;
      }
      return null;
    } catch (error) {
      if (error?.response?.status === 409) {
        commit(types.REMOVE_ACTIVE_SCHEDULE_FOR_AD, adId);
        dispatch('getActiveScheduledSends');
        return null;
      }
      throwErrorMessage(error);
      return null;
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isCancellingSchedule: false });
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
  getLatestSendOperations: async ({ commit }) => {
    commit(types.SET_ADS_UI_FLAG, { isFetchingOperations: true });
    try {
      const response = await ChatwootExtraAPI.getLatestSendOperations();
      if (response.success && response.data) {
        Object.entries(response.data).forEach(([adId, operation]) => {
          commit(types.SET_SEND_OPERATION, { adId, operation });
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
  getErrorLogs: async ({ commit }, adId) => {
    commit(types.SET_ADS_UI_FLAG, { isFetchingErrorLogs: true });
    try {
      const response = await ChatwootExtraAPI.getAdErrorLogs(adId);
      if (response.success && response.data) {
        commit(types.SET_ERROR_LOGS, { adId, errorLogs: response.data });
        return response.data;
      }
      return [];
    } catch (error) {
      throwErrorMessage(error);
      return [];
    } finally {
      commit(types.SET_ADS_UI_FLAG, { isFetchingErrorLogs: false });
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
  [types.SET_ERROR_LOGS]($state, { adId, errorLogs }) {
    $state.errorLogs = {
      ...$state.errorLogs,
      [adId]: errorLogs,
    };
  },
  [types.SET_ACTIVE_SCHEDULES]($state, map) {
    $state.activeSchedules = { ...map };
  },
  [types.SET_ACTIVE_SCHEDULE_FOR_AD]($state, { adId, schedule }) {
    $state.activeSchedules = { ...$state.activeSchedules, [adId]: schedule };
  },
  [types.REMOVE_ACTIVE_SCHEDULE_FOR_AD]($state, adId) {
    const next = { ...$state.activeSchedules };
    delete next[adId];
    $state.activeSchedules = next;
  },
  [types.SET_SCHEDULE_HISTORY]($state, { adId, schedules }) {
    $state.scheduleHistory = { ...$state.scheduleHistory, [adId]: schedules };
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

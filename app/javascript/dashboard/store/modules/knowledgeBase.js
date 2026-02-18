import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';

const state = {
  records: [],
  fileContent: null,
  uiFlags: {
    isFetching: false,
    isUploading: false,
    isDeleting: false,
    isFetchingContent: false,
  },
};

const getters = {
  getFiles: $state => $state.records,
  getFileContent: $state => $state.fileContent,
  getUIFlags: $state => $state.uiFlags,
};

const actions = {
  async get({ commit }, limit) {
    commit(types.SET_KB_FILES_UI_FLAG, { isFetching: true });
    try {
      const response = await ChatwootExtraAPI.getKBFiles(limit);
      const files = response?.data?.files || [];
      commit(types.SET_KB_FILES, files);
    } catch (error) {
      // handle silently
    } finally {
      commit(types.SET_KB_FILES_UI_FLAG, { isFetching: false });
    }
  },

  async upload({ commit }, file) {
    commit(types.SET_KB_FILES_UI_FLAG, { isUploading: true });
    try {
      const response = await ChatwootExtraAPI.uploadKBFile(file);
      const kbFile = response?.data;
      if (kbFile) {
        commit(types.ADD_KB_FILE, kbFile);
      }
      return kbFile;
    } catch (error) {
      throw error;
    } finally {
      commit(types.SET_KB_FILES_UI_FLAG, { isUploading: false });
    }
  },

  async getContent({ commit }, fileId) {
    commit(types.SET_KB_FILES_UI_FLAG, { isFetchingContent: true });
    try {
      const response = await ChatwootExtraAPI.getKBFile(fileId);
      const content = response?.data || null;
      commit(types.SET_KB_FILE_CONTENT, content);
      return content;
    } catch (error) {
      throw error;
    } finally {
      commit(types.SET_KB_FILES_UI_FLAG, { isFetchingContent: false });
    }
  },

  async delete({ commit }, fileId) {
    commit(types.SET_KB_FILES_UI_FLAG, { isDeleting: true });
    try {
      await ChatwootExtraAPI.deleteKBFile(fileId);
      commit(types.DELETE_KB_FILE, fileId);
    } catch (error) {
      throw error;
    } finally {
      commit(types.SET_KB_FILES_UI_FLAG, { isDeleting: false });
    }
  },
};

const mutations = {
  [types.SET_KB_FILES_UI_FLAG]($state, flags) {
    $state.uiFlags = { ...$state.uiFlags, ...flags };
  },
  [types.SET_KB_FILES]($state, files) {
    $state.records = files;
  },
  [types.ADD_KB_FILE]($state, file) {
    $state.records.push(file);
  },
  [types.DELETE_KB_FILE]($state, fileId) {
    $state.records = $state.records.filter(f => f.id !== fileId);
  },
  [types.SET_KB_FILE_CONTENT]($state, content) {
    $state.fileContent = content;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

import ChatwootExtraAPI from '../../api/chatwootExtra';

const state = {
  operatorIds: [],
  loaded: false,
};

const getters = {
  getOperatorIds: s => s.operatorIds,
  isLoaded: s => s.loaded,
  isCurrentUserAllowed: (s, _getters, _rootState, rootGetters) => {
    const currentUserId = rootGetters.getCurrentUserID;
    return s.operatorIds.includes(currentUserId);
  },
};

const mutations = {
  SET_OPERATOR_IDS(s, ids) {
    s.operatorIds = ids;
    s.loaded = true;
  },
};

const actions = {
  async fetchOperators({ commit }) {
    try {
      const operators = await ChatwootExtraAPI.getTelegramDialoguesOperators();
      commit(
        'SET_OPERATOR_IDS',
        operators.map(op => op.chatwootUserId)
      );
    } catch {
      commit('SET_OPERATOR_IDS', []);
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};

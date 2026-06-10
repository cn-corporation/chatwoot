import types from '../mutation-types';
import ChatwootExtraAPI from '../../api/chatwootExtra';

const state = {
  // conversationId -> uncompleted task entries ordered oldest to newest.
  // Holding the full list lets create/complete commit synchronously, without
  // asking the server which task should be shown next.
  uncompletedByConversation: {},
  // Monotonic counter guarding against out-of-order fetches: only the
  // latest-started fetch is allowed to commit its result.
  fetchSeq: 0,
  uiFlags: {
    isFetching: false,
  },
};

const getters = {
  getPendingTask: $state => conversationId => {
    const list = $state.uncompletedByConversation[conversationId];
    return list?.length ? list[list.length - 1] : null;
  },
  getUncompletedTaskIds: $state => conversationId => {
    const list = $state.uncompletedByConversation[conversationId] || [];
    return list.map(entry => String(entry.taskId));
  },
  getTasksUIFlags: $state => $state.uiFlags,
};

const toPendingEntry = task => ({
  taskId: task.id,
  text: task.message,
  createdAt: task.createdAt,
});

const actions = {
  async fetchPending({ commit, state: $state, rootGetters }) {
    const seq = $state.fetchSeq + 1;
    commit(types.SET_FETCH_SEQ, seq);
    commit(types.SET_TASKS_UI_FLAG, { isFetching: true });
    try {
      const accountId = rootGetters.getCurrentAccountId;
      const tasks = await ChatwootExtraAPI.getPendingTasks(accountId);
      // Discard the result if a newer fetch or mutation happened meanwhile.
      if ($state.fetchSeq !== seq) return;
      const uncompletedByConversation = {};
      tasks.forEach(task => {
        const list = uncompletedByConversation[task.conversationId] || [];
        list.push(toPendingEntry(task));
        uncompletedByConversation[task.conversationId] = list;
      });
      commit(types.SET_PENDING_TASKS, uncompletedByConversation);
    } finally {
      if ($state.fetchSeq === seq) {
        commit(types.SET_TASKS_UI_FLAG, { isFetching: false });
      }
    }
  },

  async createTask({ commit, state: $state }, taskData) {
    const response = await ChatwootExtraAPI.createTask(taskData);
    if (response?.success && response?.data) {
      // Bumping the seq invalidates any in-flight fetch holding stale data.
      commit(types.SET_FETCH_SEQ, $state.fetchSeq + 1);
      commit(types.ADD_PENDING_TASK, {
        conversationId: response.data.conversationId,
        task: toPendingEntry(response.data),
      });
    }
    return response;
  },

  // Apply task events pushed over SSE from other users (and echoes of our own
  // mutations — the commits below are idempotent).
  applyTaskCreated({ commit, state: $state }, task) {
    if (!task?.id || !task.conversationId) return;
    commit(types.SET_FETCH_SEQ, $state.fetchSeq + 1);
    commit(types.ADD_PENDING_TASK, {
      conversationId: task.conversationId,
      task: toPendingEntry(task),
    });
  },

  applyTaskCompleted({ commit, state: $state }, task) {
    if (!task?.id || !task.conversationId) return;
    commit(types.SET_FETCH_SEQ, $state.fetchSeq + 1);
    commit(types.REMOVE_PENDING_TASK, {
      conversationId: task.conversationId,
      taskId: task.id,
    });
  },

  async completeTask({ commit, state: $state }, { taskId, ...updateData }) {
    const response = await ChatwootExtraAPI.updateTask(taskId, updateData);
    if (response?.success && response?.data) {
      commit(types.SET_FETCH_SEQ, $state.fetchSeq + 1);
      commit(types.REMOVE_PENDING_TASK, {
        conversationId: response.data.conversationId,
        taskId: response.data.id,
      });
    }
    return response;
  },
};

const mutations = {
  [types.SET_TASKS_UI_FLAG]($state, flags) {
    $state.uiFlags = { ...$state.uiFlags, ...flags };
  },
  [types.SET_PENDING_TASKS]($state, uncompletedByConversation) {
    $state.uncompletedByConversation = uncompletedByConversation;
  },
  [types.ADD_PENDING_TASK]($state, { conversationId, task }) {
    const list = (
      $state.uncompletedByConversation[conversationId] || []
    ).filter(entry => String(entry.taskId) !== String(task.taskId));
    $state.uncompletedByConversation = {
      ...$state.uncompletedByConversation,
      [conversationId]: [...list, task],
    };
  },
  [types.SET_FETCH_SEQ]($state, seq) {
    $state.fetchSeq = seq;
  },
  [types.REMOVE_PENDING_TASK]($state, { conversationId, taskId }) {
    const list = (
      $state.uncompletedByConversation[conversationId] || []
    ).filter(entry => String(entry.taskId) !== String(taskId));
    const next = { ...$state.uncompletedByConversation };
    if (list.length) {
      next[conversationId] = list;
    } else {
      delete next[conversationId];
    }
    $state.uncompletedByConversation = next;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

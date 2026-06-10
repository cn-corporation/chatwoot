import { createStore } from 'vuex';
import tasks from '../../tasks';
import ChatwootExtraAPI from '../../../../api/chatwootExtra';

vi.mock('../../../../api/chatwootExtra', () => ({
  default: {
    getPendingTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  },
}));

const buildStore = () =>
  createStore({
    getters: {
      getCurrentAccountId: () => 7,
    },
    modules: {
      tasks: {
        ...tasks,
        state: {
          uncompletedByConversation: {},
          fetchSeq: 0,
          uiFlags: { isFetching: false },
        },
      },
    },
  });

const apiTask = (id, conversationId, message, createdAt) => ({
  id,
  conversationId,
  message,
  createdAt,
  completed: false,
});

describe('tasks store', () => {
  let store;

  beforeEach(() => {
    vi.clearAllMocks();
    store = buildStore();
  });

  describe('fetchPending', () => {
    it('groups uncompleted tasks by conversation, newest shown', async () => {
      ChatwootExtraAPI.getPendingTasks.mockResolvedValue([
        apiTask('t1', 1, 'older task', '2026-06-10T09:00:00Z'),
        apiTask('t2', 1, 'newer task', '2026-06-10T10:00:00Z'),
        apiTask('t3', 2, 'other conversation', '2026-06-10T10:30:00Z'),
      ]);
      await store.dispatch('tasks/fetchPending');
      expect(ChatwootExtraAPI.getPendingTasks).toHaveBeenCalledWith(7);
      expect(store.getters['tasks/getPendingTask'](1).text).toBe('newer task');
      expect(store.getters['tasks/getPendingTask'](2).text).toBe(
        'other conversation'
      );
      expect(store.getters['tasks/getPendingTask'](3)).toBeNull();
    });
  });

  describe('createTask', () => {
    it('shows the new task immediately as the pending one', async () => {
      ChatwootExtraAPI.createTask.mockResolvedValue({
        success: true,
        data: apiTask('t9', 1, 'fresh task', '2026-06-10T12:00:00Z'),
      });
      const response = await store.dispatch('tasks/createTask', {
        conversationId: 1,
        message: 'fresh task',
      });
      expect(response.data.id).toBe('t9');
      expect(store.getters['tasks/getPendingTask'](1).text).toBe('fresh task');
    });

    it('does not add an entry when the API fails', async () => {
      ChatwootExtraAPI.createTask.mockResolvedValue({
        success: false,
        error: 'nope',
      });
      await store.dispatch('tasks/createTask', { conversationId: 1 });
      expect(store.getters['tasks/getPendingTask'](1)).toBeNull();
    });
  });

  describe('completeTask', () => {
    beforeEach(async () => {
      ChatwootExtraAPI.getPendingTasks.mockResolvedValue([
        apiTask('t1', 1, 'older task', '2026-06-10T09:00:00Z'),
        apiTask('t2', 1, 'newer task', '2026-06-10T10:00:00Z'),
      ]);
      await store.dispatch('tasks/fetchPending');
    });

    it('falls back to the older task when the newest is completed', async () => {
      ChatwootExtraAPI.updateTask.mockResolvedValue({
        success: true,
        data: { ...apiTask('t2', 1, 'newer task'), completed: true },
      });
      await store.dispatch('tasks/completeTask', {
        taskId: 't2',
        completed: true,
      });
      expect(store.getters['tasks/getPendingTask'](1).text).toBe('older task');
    });

    it('clears the pending entry when the last task is completed', async () => {
      ChatwootExtraAPI.updateTask
        .mockResolvedValueOnce({
          success: true,
          data: { ...apiTask('t2', 1, 'newer task'), completed: true },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { ...apiTask('t1', 1, 'older task'), completed: true },
        });
      await store.dispatch('tasks/completeTask', { taskId: 't2' });
      await store.dispatch('tasks/completeTask', { taskId: 't1' });
      expect(store.getters['tasks/getPendingTask'](1)).toBeNull();
    });

    it('keeps the entry untouched when the API fails', async () => {
      ChatwootExtraAPI.updateTask.mockResolvedValue({
        success: false,
        error: 'nope',
      });
      await store.dispatch('tasks/completeTask', { taskId: 't2' });
      expect(store.getters['tasks/getPendingTask'](1).text).toBe('newer task');
    });
  });

  describe('SSE events from other users', () => {
    it('locks the card when another user creates a task', async () => {
      await store.dispatch(
        'tasks/applyTaskCreated',
        apiTask('t5', 3, 'task from teammate', '2026-06-10T12:00:00Z')
      );
      expect(store.getters['tasks/getPendingTask'](3).text).toBe(
        'task from teammate'
      );
      expect(store.getters['tasks/getUncompletedTaskIds'](3)).toEqual(['t5']);
      expect(store.getters['tasks/getUncompletedTaskIds'](99)).toEqual([]);
    });

    it('unlocks the card when another user completes the task', async () => {
      await store.dispatch(
        'tasks/applyTaskCreated',
        apiTask('t5', 3, 'task from teammate', '2026-06-10T12:00:00Z')
      );
      await store.dispatch('tasks/applyTaskCompleted', {
        ...apiTask('t5', 3, 'task from teammate'),
        completed: true,
      });
      expect(store.getters['tasks/getPendingTask'](3)).toBeNull();
    });

    it('deduplicates the echo of an own optimistic create', async () => {
      ChatwootExtraAPI.createTask.mockResolvedValue({
        success: true,
        data: apiTask('t9', 1, 'fresh task', '2026-06-10T12:00:00Z'),
      });
      await store.dispatch('tasks/createTask', { conversationId: 1 });
      await store.dispatch(
        'tasks/applyTaskCreated',
        apiTask('t9', 1, 'fresh task', '2026-06-10T12:00:00Z')
      );
      await store.dispatch('tasks/applyTaskCompleted', {
        ...apiTask('t9', 1, 'fresh task'),
        completed: true,
      });
      expect(store.getters['tasks/getPendingTask'](1)).toBeNull();
    });
  });

  describe('race protection', () => {
    it('discards a stale in-flight fetch that overlaps a completion', async () => {
      let resolveFetch;
      ChatwootExtraAPI.getPendingTasks.mockReturnValue(
        new Promise(resolve => {
          resolveFetch = resolve;
        })
      );
      const fetchPromise = store.dispatch('tasks/fetchPending');

      ChatwootExtraAPI.updateTask.mockResolvedValue({
        success: true,
        data: { ...apiTask('t1', 1, 'some task'), completed: true },
      });
      await store.dispatch('tasks/completeTask', { taskId: 't1' });

      resolveFetch([apiTask('t1', 1, 'some task', '2026-06-10T09:00:00Z')]);
      await fetchPromise;

      expect(store.getters['tasks/getPendingTask'](1)).toBeNull();
    });
  });
});

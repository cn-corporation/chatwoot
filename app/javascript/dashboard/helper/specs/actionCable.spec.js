import { describe, it, beforeEach, expect, vi } from 'vitest';
import ActionCableConnector from '../actionCable';

vi.mock('shared/helpers/mitt', () => ({
  emitter: {
    emit: vi.fn(),
  },
}));

vi.mock('dashboard/composables/useImpersonation', () => ({
  useImpersonation: () => ({
    isImpersonating: { value: false },
  }),
}));

global.chatwootConfig = {
  websocketURL: 'wss://test.chatwoot.com',
};

describe('ActionCableConnector - Copilot Tests', () => {
  let store;
  let actionCable;
  let mockDispatch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch = vi.fn();
    store = {
      $store: {
        dispatch: mockDispatch,
        getters: {
          getCurrentAccountId: 1,
        },
      },
    };

    actionCable = ActionCableConnector.init(store.$store, 'test-token');
  });
  describe('copilot event handlers', () => {
    it('should register the copilot.message.created event handler', () => {
      expect(Object.keys(actionCable.events)).toContain(
        'copilot.message.created'
      );
      expect(actionCable.events['copilot.message.created']).toBe(
        actionCable.onCopilotMessageCreated
      );
    });

    it('should handle the copilot.message.created event through the ActionCable system', () => {
      const copilotData = {
        id: 2,
        content: 'This is a copilot message from ActionCable',
        conversation_id: 456,
        created_at: '2025-05-27T15:58:04-06:00',
        account_id: 1,
      };
      actionCable.onReceived({
        event: 'copilot.message.created',
        data: copilotData,
      });
      expect(mockDispatch).toHaveBeenCalledWith(
        'copilotMessages/upsert',
        copilotData
      );
    });
  });

  describe('team change event handler', () => {
    it('should register the team.changed event handler', () => {
      expect(Object.keys(actionCable.events)).toContain('team.changed');
      expect(actionCable.events['team.changed']).toBe(
        actionCable.onTeamChanged
      );
    });

    it('should update the conversation when a team.changed event is received', () => {
      const teamChangedData = {
        id: 28,
        account_id: 1,
        status: 'open',
        meta: { team: { id: 2, name: 'aml' }, assignee: null },
      };
      actionCable.onReceived({
        event: 'team.changed',
        data: teamChangedData,
      });
      expect(mockDispatch).toHaveBeenCalledWith(
        'updateConversation',
        teamChangedData
      );
    });
  });
});

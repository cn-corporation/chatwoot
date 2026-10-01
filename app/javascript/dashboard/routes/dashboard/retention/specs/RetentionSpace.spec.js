import { ref } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import RetentionAPI from 'dashboard/api/retention';
import RetentionSpace from '../RetentionSpace.vue';
import RetentionMessage from 'dashboard/components-next/message/RetentionMessage.vue';
import { useRouter } from 'vue-router';
import { useRetentionAccess } from 'dashboard/composables/useRetentionAccess';
import { emitter } from 'shared/helpers/mitt';

let accountId;
let member;
let routeQuery;
vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: () => ({ query: routeQuery }),
}));
vi.mock('dashboard/composables/store', () => ({
  useStore: () => ({ dispatch: vi.fn() }),
}));
vi.mock('dashboard/composables/useAccount', () => ({
  useAccount: () => ({ accountId }),
}));
vi.mock('dashboard/composables/useRetentionAccess', () => ({
  useRetentionAccess: vi.fn(),
}));
vi.mock('dashboard/api/retention', () => ({
  default: {
    conversations: vi.fn(),
    conversation: vi.fn(),
    send: vi.fn(),
    complete: vi.fn(),
    history: vi.fn(),
    snapshot: vi.fn(),
    retry: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}));
const conversation = {
  id: 29,
  contact: { name: 'Customer' },
  inbox: { name: 'Telegram' },
  session_id: null,
};
const session = {
  id: '2e0d70f0-dccc-4330-8848-bbcf3dde6115',
  conversation_id: 29,
  contact: conversation.contact,
  inbox: conversation.inbox,
  completed_at: '2026-09-29T12:00:00Z',
};
const payload = (active, messages = []) => ({
  data: {
    conversation: { ...conversation, session_id: active ? 12 : null },
    messages,
    has_more: false,
  },
});
const button = (wrapper, text) =>
  wrapper.findAll('button').find(item => item.text().includes(text));
let wrapper;

beforeEach(() => {
  vi.clearAllMocks();
  accountId = ref(1);
  member = ref(true);
  routeQuery = {};
  useRouter.mockReturnValue({ replace: vi.fn() });
  useRetentionAccess.mockReturnValue({
    member,
    loaded: ref(true),
    unreadConversationIds: ref([]),
    unreadCount: ref(0),
    refresh: vi.fn(),
    revoke: vi.fn(() => {
      member.value = false;
    }),
  });
  RetentionAPI.conversations.mockResolvedValue({
    data: { conversations: [conversation], has_more: false },
  });
  RetentionAPI.conversation.mockResolvedValue(payload(false));
  RetentionAPI.history.mockResolvedValue({
    data: { sessions: [session], has_more: false },
  });
  RetentionAPI.snapshot.mockResolvedValue({
    data: { session, snapshot: { messages: [] } },
  });
  RetentionAPI.complete.mockResolvedValue({ data: { session } });
});
afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});
async function openConversation(active = false, messages = []) {
  RetentionAPI.conversation.mockResolvedValue(payload(active, messages));
  wrapper = shallowMount(RetentionSpace, {
    global: {
      stubs: {
        Button: {
          props: ['label', 'disabled', 'type'],
          emits: ['click'],
          template:
            '<button :type="type || \'button\'" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  });
  await flushPromises();
  await button(wrapper, 'Customer').trigger('click');
  await flushPromises();
}

it('edits and deletes only the active retention message through scoped APIs', async () => {
  const outgoing = {
    id: 41,
    content: 'Original',
    content_attributes: {},
    message_type: 'outgoing',
    sender_type: 'User',
    retention_session_id: 12,
    source_id: '321',
    status: 'sent',
  };
  await openConversation(true, [outgoing]);
  const message = wrapper.getComponent(RetentionMessage);
  expect(message.props('canManage')).toBe(true);

  RetentionAPI.editMessage.mockResolvedValue({
    data: { message: { ...outgoing, content: 'Edited' } },
  });
  message.vm.$emit('startEdit', 41);
  message.vm.$emit('saveEdit', 41, 'Edited');
  await flushPromises();
  expect(RetentionAPI.editMessage).toHaveBeenCalledWith(29, 41, {
    sessionId: 12,
    content: 'Edited',
    expectedContent: 'Original',
  });

  RetentionAPI.deleteMessage.mockResolvedValue({
    data: {
      message: {
        ...outgoing,
        content: null,
        content_attributes: { deleted: true },
      },
    },
  });
  message.vm.$emit('startDelete', 41);
  message.vm.$emit('confirmDelete', 41);
  await flushPromises();
  expect(RetentionAPI.deleteMessage).toHaveBeenCalledWith(29, 41, {
    sessionId: 12,
    expectedContent: 'Edited',
  });
  expect(wrapper.getComponent(RetentionMessage).props('canManage')).toBe(false);
});

it('keeps the original edit expectation when another specialist changes the message', async () => {
  const outgoing = {
    id: 41,
    content: 'Original',
    content_attributes: {},
    message_type: 'outgoing',
    sender_type: 'User',
    retention_session_id: 12,
    source_id: '321',
    status: 'sent',
  };
  await openConversation(true, [outgoing]);
  const message = wrapper.getComponent(RetentionMessage);
  message.vm.$emit('startEdit', 41);
  RetentionAPI.conversation.mockResolvedValueOnce(
    payload(true, [{ ...outgoing, content: 'Other specialist edit' }])
  );
  emitter.emit('retention.changed', { account_id: 1, conversation_id: 29 });
  await flushPromises();
  RetentionAPI.editMessage.mockResolvedValue({
    data: { message: { ...outgoing, content: 'My draft' } },
  });
  message.vm.$emit('saveEdit', 41, 'My draft');
  await flushPromises();
  expect(RetentionAPI.editMessage).toHaveBeenCalledWith(
    29,
    41,
    expect.objectContaining({ expectedContent: 'Original' })
  );
});

it('previews without starting and reuses the send key after an ambiguous network failure', async () => {
  await openConversation();
  expect(RetentionAPI.send).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain('Preview only');
  await wrapper.get('textarea').setValue('Hello');
  RetentionAPI.send
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce(payload(true));
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(wrapper.get('textarea').element.value).toBe('Hello');
  const first = RetentionAPI.send.mock.calls[0][1];
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(RetentionAPI.send.mock.calls[1][1].request_id).toBe(first.request_id);
  expect(first.session_id).toBeNull();
  expect(wrapper.get('textarea').element.value).toBe('');
  expect(wrapper.text()).toContain('Complete & archive');
});

it('opens the saved snapshot after completion and removes the live composer', async () => {
  await openConversation(true);
  await button(wrapper, 'Complete & archive').trigger('click');
  await flushPromises();
  expect(RetentionAPI.complete).toHaveBeenCalledWith(29, 12);
  expect(RetentionAPI.snapshot).toHaveBeenCalledWith(session.id);
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.text()).toContain('Saved snapshot');
});

it('sends files without text and keeps file drafts and the same request after an ambiguous failure', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:retention-preview');

      static revokeObjectURL = vi.fn();
    }
  );
  await openConversation(true);
  const file = new File(['document bytes'], 'customer.pdf', {
    type: 'application/pdf',
  });
  Object.defineProperty(wrapper.get('input[type=file]').element, 'files', {
    value: [file],
  });
  await wrapper.get('input[type=file]').trigger('change');
  expect(button(wrapper, 'Complete & archive').element.disabled).toBe(true);
  RetentionAPI.send
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce(payload(true));
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  const first = RetentionAPI.send.mock.calls[0][1];
  expect(first.attachments).toEqual([file]);
  expect(first.content).toBe('');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(RetentionAPI.send.mock.calls[1][1].request_id).toBe(first.request_id);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:retention-preview');
  expect(button(wrapper, 'Complete & archive').element.disabled).toBe(false);
});

it('clears the transcript and draft when membership is revoked', async () => {
  await openConversation();
  await wrapper.get('textarea').setValue('Confidential draft');
  member.value = false;
  await flushPromises();
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('Customer');
  expect(wrapper.text()).toContain('selected in Settings');
  expect(useRouter().replace).toHaveBeenCalledWith({
    name: 'home',
    params: { accountId: 1 },
  });
});

it('revokes access after an unauthorized response instead of waiting for a refresh', async () => {
  await openConversation();
  await wrapper.get('textarea').setValue('Confidential draft');
  RetentionAPI.send.mockRejectedValue({ response: { status: 401 } });
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(member.value).toBe(false);
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('Customer');
  expect(useRouter().replace).toHaveBeenCalled();
});

it('ignores an in-flight transcript response after membership is revoked', async () => {
  await openConversation();
  let resolveTranscript;
  RetentionAPI.conversation.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveTranscript = resolve;
      })
  );
  emitter.emit('retention.changed', { account_id: 1, conversation_id: 29 });
  member.value = false;
  resolveTranscript(payload(true));
  await flushPromises();
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('Customer');
});

it('opens an active conversation from a notification link', async () => {
  routeQuery = { conversation: '29' };
  await openConversation(true);
  expect(RetentionAPI.conversation).toHaveBeenCalledWith(29);
  expect(wrapper.find('textarea').exists()).toBe(true);
});

it('shows a saved status while a durable snapshot is awaiting publication', async () => {
  await openConversation(true);
  RetentionAPI.complete.mockResolvedValueOnce({
    data: { session, snapshot_pending: true },
  });
  RetentionAPI.history.mockResolvedValueOnce({
    data: { sessions: [], has_more: false },
  });
  await button(wrapper, 'Complete & archive').trigger('click');
  await flushPromises();
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.text()).toContain('Session saved and chat archived');
  expect(RetentionAPI.snapshot).not.toHaveBeenCalled();
});

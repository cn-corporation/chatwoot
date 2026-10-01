import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import RetentionAPI from 'dashboard/api/retention';
import { emitter } from 'shared/helpers/mitt';
import {
  publishRetentionMembership,
  useRetentionAccess,
} from '../useRetentionAccess';

let accountId;
let userId;
let wrappers;
let channels;

vi.mock('dashboard/composables/useAccount', () => ({
  useAccount: () => ({ accountId }),
}));
vi.mock('dashboard/composables/store', () => ({
  useMapGetter: () => userId,
}));
vi.mock('dashboard/api/retention', () => ({
  default: { capabilities: vi.fn() },
}));

const createAccess = () => {
  const wrapper = mount(
    defineComponent({
      setup: useRetentionAccess,
      render: () => h('div'),
    })
  );
  wrappers.push(wrapper);
  return wrapper;
};

beforeEach(() => {
  accountId = ref(1);
  userId = ref(7);
  wrappers = [];
  channels = [];
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      constructor() {
        this.postMessage = vi.fn();
        this.close = vi.fn();
        channels.push(this);
      }
    }
  );
  RetentionAPI.capabilities.mockResolvedValue({ data: { member: true } });
});

it('refreshes authoritative counters on notification changes and clears them immediately on revocation', async () => {
  RetentionAPI.capabilities.mockResolvedValue({
    data: { member: true, unread_conversation_ids: [29, 30] },
  });
  const access = createAccess();
  await flushPromises();
  expect(access.vm.unreadCount).toBe(2);
  RetentionAPI.capabilities.mockResolvedValue({
    data: { member: true, unread_conversation_ids: [30] },
  });
  emitter.emit('retention.notifications_changed', { account_id: 1 });
  await flushPromises();
  expect(access.vm.unreadConversationIds).toEqual([30]);
  publishRetentionMembership({ account_id: 1, user_ids: [] });
  expect(access.vm.unreadCount).toBe(0);
});

afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('immediately revokes every mounted consumer after a saved removal and ignores an older capability response', async () => {
  const sidebar = createAccess();
  const space = createAccess();
  await flushPromises();
  let resolveOld;
  RetentionAPI.capabilities.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      })
  );
  sidebar.vm.refresh();
  publishRetentionMembership({ account_id: 1, user_ids: [] });
  expect(sidebar.vm.member).toBe(false);
  expect(space.vm.member).toBe(false);
  expect(channels.at(-1).postMessage).toHaveBeenCalledWith({
    account_id: 1,
    user_ids: [],
  });
  expect(channels.at(-1).close).toHaveBeenCalled();
  resolveOld({ data: { member: true } });
  await flushPromises();
  expect(sidebar.vm.member).toBe(false);
});

it('applies another browser tab saved membership immediately', async () => {
  const access = createAccess();
  await flushPromises();
  channels[0].onmessage({ data: { account_id: 1, user_ids: [] } });
  expect(access.vm.member).toBe(false);
  expect(access.vm.loaded).toBe(true);
});

it('propagates server-confirmed removal to every consumer and rejects an older sidebar response', async () => {
  const sidebar = createAccess();
  const space = createAccess();
  await flushPromises();
  let resolveOld;
  RetentionAPI.capabilities.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      })
  );
  sidebar.vm.refresh();
  RetentionAPI.capabilities.mockResolvedValue({ data: { member: false } });
  await space.vm.refresh();
  expect(sidebar.vm.member).toBe(false);
  expect(space.vm.member).toBe(false);
  resolveOld({ data: { member: true, unread_conversation_ids: [29] } });
  await flushPromises();
  expect(sidebar.vm.member).toBe(false);
  expect(sidebar.vm.unreadCount).toBe(0);
});

it('clears access immediately on targeted revocation even while its server check is pending', async () => {
  const access = createAccess();
  await flushPromises();
  RetentionAPI.capabilities.mockImplementationOnce(() => new Promise(() => {}));
  emitter.emit('retention.changed', {
    account_id: 1,
    user_id: 7,
    member: false,
  });
  expect(access.vm.member).toBe(false);
});

it('does not trust an old queued grant after the member was removed', async () => {
  RetentionAPI.capabilities.mockResolvedValue({ data: { member: false } });
  const access = createAccess();
  await flushPromises();
  emitter.emit('retention.changed', {
    account_id: 1,
    user_id: 7,
    member: true,
  });
  expect(access.vm.member).toBe(false);
  await flushPromises();
  expect(access.vm.member).toBe(false);
});

it('ignores membership events for another user or account and refreshes counters on conversation lifecycle events', async () => {
  const access = createAccess();
  await flushPromises();
  RetentionAPI.capabilities.mockClear();
  emitter.emit('retention.changed', { account_id: 2, user_ids: [] });
  emitter.emit('retention.changed', {
    account_id: 1,
    user_id: 8,
    member: false,
  });
  expect(access.vm.member).toBe(true);
  expect(RetentionAPI.capabilities).not.toHaveBeenCalled();
  emitter.emit('retention.changed', { account_id: 1, conversation_id: 10 });
  expect(RetentionAPI.capabilities).toHaveBeenCalledTimes(1);
});

it('clears access when the signed-in user changes and closes its cross-tab subscription on unmount', async () => {
  const access = createAccess();
  await flushPromises();
  RetentionAPI.capabilities.mockResolvedValue({ data: { member: false } });
  userId.value = 8;
  expect(access.vm.member).toBe(false);
  await flushPromises();
  expect(access.vm.member).toBe(false);
  access.unmount();
  expect(channels[0].close).toHaveBeenCalled();
  wrappers = [];
});

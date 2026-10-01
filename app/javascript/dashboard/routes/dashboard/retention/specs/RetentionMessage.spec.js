import { shallowMount } from '@vue/test-utils';
import RetentionMessage from 'dashboard/components-next/message/RetentionMessage.vue';

const message = {
  id: 42,
  content: 'Original',
  content_attributes: {},
  created_at: '2026-09-30T12:00:00Z',
  message_type: 'outgoing',
  retention_session_id: 7,
  source_id: '72',
  status: 'sent',
  sender: { name: 'Specialist' },
  attachments: [],
};

const createWrapper = (overrides = {}, props = {}) =>
  shallowMount(RetentionMessage, {
    props: { message: { ...message, ...overrides }, canManage: true, ...props },
    global: {
      stubs: {
        BaseBubble: { template: '<div><slot /></div>' },
        Button: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  });

it('offers inline editing and a two-step delete confirmation for active messages', async () => {
  const wrapper = createWrapper();
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('startEdit')[0]).toEqual([42]);
  await wrapper.setProps({ editing: true });
  await wrapper.get('textarea').setValue('Updated');
  await wrapper.findAll('button').at(-1).trigger('click');
  expect(wrapper.emitted('saveEdit')[0]).toEqual([42, 'Updated']);

  await wrapper.setProps({ editing: false });
  await wrapper
    .findAll('button')
    .find(button => button.text() === 'Delete')
    .trigger('click');
  expect(wrapper.emitted('startDelete')[0]).toEqual([42]);
  await wrapper.setProps({ confirmingDelete: true });
  expect(wrapper.text()).toContain('Delete this message from Telegram');
  await wrapper
    .findAll('button')
    .find(button => button.text() === 'Delete message')
    .trigger('click');
  expect(wrapper.emitted('confirmDelete')[0]).toEqual([42]);
});

it('shows a tombstone without the original text or controls after deletion', () => {
  const wrapper = createWrapper({
    content: null,
    content_attributes: { deleted: true },
  });
  expect(wrapper.text()).toContain('Message deleted');
  expect(wrapper.text()).not.toContain('Original');
  expect(wrapper.findAll('button')).toHaveLength(0);
});

import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import MessageBackofficeSender from '../MessageBackofficeSender.vue';
import MessageMeta from '../MessageMeta.vue';
import { provideMessageContext } from '../provider.js';

const store = {
  getters: {
    getSelectedChatAttachments: [],
    getSelectedChat: { inbox_id: 1 },
    'inboxes/getInboxById': () => ({ id: 1, channel_type: 'Channel::Api' }),
  },
};

const mountInMessage = (component, contentAttributes) =>
  mount(
    defineComponent({
      setup() {
        provideMessageContext({
          contentAttributes: ref(contentAttributes),
          status: ref('sent'),
          isPrivate: ref(false),
          createdAt: ref(1764000000),
          sourceId: ref(null),
          messageType: ref(1),
        });
        return () => h(component);
      },
    }),
    {
      global: {
        plugins: [
          {
            install(app) {
              app.config.globalProperties.$store = store;
            },
          },
        ],
      },
    }
  );

const stamp = { monoCrm: { userId: 7, username: 'olya', name: 'Оля' } };

describe('MessageBackofficeSender', () => {
  it('names the backoffice account that sent the message', () => {
    const wrapper = mountInMessage(MessageBackofficeSender, stamp);
    const mark = wrapper.find('[data-testid="backoffice-sender"]');
    expect(mark.exists()).toBe(true);
    expect(mark.text()).toBe('Backoffice · Оля');
  });
});

describe('MessageMeta', () => {
  it('shows the backoffice mark next to the time for a message sent from the backoffice', () => {
    const wrapper = mountInMessage(MessageMeta, stamp);
    expect(wrapper.find('[data-testid="backoffice-sender"]').text()).toBe(
      'Backoffice · Оля'
    );
    expect(wrapper.find('time').exists()).toBe(true);
  });

  it('shows no mark for a message sent from Chatwoot itself', () => {
    const wrapper = mountInMessage(MessageMeta, { aiSuggestionAccepted: true });
    expect(wrapper.find('[data-testid="backoffice-sender"]').exists()).toBe(
      false
    );
    expect(wrapper.find('time').exists()).toBe(true);
  });
});

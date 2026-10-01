import { ref } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import Multiselect from 'vue-multiselect';
import RetentionAPI from 'dashboard/api/retention';
import RetentionSpecialists from '../RetentionSpecialists.vue';
import { publishRetentionMembership } from 'dashboard/composables/useRetentionAccess';

let currentAccountId;

vi.mock('dashboard/composables/useAccount', () => ({
  useAccount: () => ({ accountId: currentAccountId }),
}));
vi.mock('dashboard/composables', () => ({ useAlert: vi.fn() }));
vi.mock('dashboard/composables/useRetentionAccess', () => ({
  publishRetentionMembership: vi.fn(),
}));
vi.mock('dashboard/api/retention', () => ({
  default: { get: vi.fn(), updateMembers: vi.fn() },
}));

const agents = [
  { id: 1, name: 'Maya', confirmed: true },
  { id: 2, name: 'Alex', confirmed: true },
];
const response = (userIds = [1], revision = 'initial') => ({
  data: { agents, user_ids: userIds, revision },
});

const mountComponent = () =>
  shallowMount(RetentionSpecialists, {
    global: {
      stubs: {
        SectionLayout: {
          props: ['title'],
          template: '<section><h4>{{ title }}</h4><slot /></section>',
        },
      },
    },
  });

const buttonWithText = (wrapper, text) =>
  wrapper.findAll('button').find(button => button.text() === text);

describe('RetentionSpecialists', () => {
  let wrapper;

  beforeEach(() => {
    currentAccountId = ref(1);
    RetentionAPI.get.mockResolvedValue(response());
  });

  afterEach(() => wrapper?.unmount());

  it('loads saved members and saves edits only after an explicit click', async () => {
    RetentionAPI.updateMembers.mockResolvedValue(response([2], 'saved'));
    wrapper = mountComponent();
    await flushPromises();

    const select = wrapper.findComponent(Multiselect);
    expect(wrapper.text()).toContain('Retention specialists');
    expect(select.props('modelValue')).toEqual([agents[0]]);
    expect(
      buttonWithText(wrapper, 'Save specialists').attributes('disabled')
    ).toBeDefined();

    select.vm.$emit('update:modelValue', [agents[1]]);
    await flushPromises();
    expect(RetentionAPI.updateMembers).not.toHaveBeenCalled();
    await buttonWithText(wrapper, 'Save specialists').trigger('click');
    await flushPromises();

    expect(RetentionAPI.updateMembers).toHaveBeenCalledWith({
      userIds: [2],
      revision: 'initial',
    });
    expect(select.props('modelValue')).toEqual([agents[1]]);
    expect(publishRetentionMembership).toHaveBeenCalledWith({
      account_id: 1,
      user_ids: [2],
    });
    expect(
      buttonWithText(wrapper, 'Save specialists').attributes('disabled')
    ).toBeDefined();
  });

  it('preserves the selected members when saving fails and allows retry', async () => {
    RetentionAPI.updateMembers.mockRejectedValue(new Error('Network error'));
    wrapper = mountComponent();
    await flushPromises();
    wrapper.findComponent(Multiselect).vm.$emit('update:modelValue', []);
    await flushPromises();

    await buttonWithText(wrapper, 'Save specialists').trigger('click');
    await flushPromises();

    expect(wrapper.findComponent(Multiselect).props('modelValue')).toEqual([]);
    expect(publishRetentionMembership).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not save');
    expect(
      buttonWithText(wrapper, 'Save specialists').attributes('disabled')
    ).toBeUndefined();
  });

  it('requires a reload after a conflicting save before allowing further edits', async () => {
    RetentionAPI.updateMembers.mockRejectedValue({ response: { status: 409 } });
    wrapper = mountComponent();
    await flushPromises();
    wrapper.findComponent(Multiselect).vm.$emit('update:modelValue', []);
    await flushPromises();
    await buttonWithText(wrapper, 'Save specialists').trigger('click');
    await flushPromises();

    expect(wrapper.findComponent(Multiselect).props('disabled')).toBe(true);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'membership changed'
    );
    RetentionAPI.get.mockResolvedValue(response([2], 'other-admin'));
    await buttonWithText(wrapper, 'Reload saved selection').trigger('click');
    await flushPromises();

    expect(wrapper.findComponent(Multiselect).props('modelValue')).toEqual([
      agents[1],
    ]);
    expect(wrapper.findComponent(Multiselect).props('disabled')).toBe(false);
  });

  it('blocks editing after a load failure and offers a retry', async () => {
    RetentionAPI.get.mockRejectedValueOnce(new Error('Network error'));
    wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.findComponent(Multiselect).exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load');
    await buttonWithText(wrapper, 'Reload saved selection').trigger('click');
    await flushPromises();

    expect(wrapper.findComponent(Multiselect).props('modelValue')).toEqual([
      agents[0],
    ]);
  });

  it('ignores a delayed response from a previous account', async () => {
    let resolvePrevious;
    RetentionAPI.get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolvePrevious = resolve;
        })
    );
    wrapper = mountComponent();
    RetentionAPI.get.mockResolvedValue(response([2], 'second-account'));
    currentAccountId.value = 2;
    await flushPromises();
    resolvePrevious(response([1], 'first-account'));
    await flushPromises();

    expect(wrapper.findComponent(Multiselect).props('modelValue')).toEqual([
      agents[1],
    ]);
  });
});

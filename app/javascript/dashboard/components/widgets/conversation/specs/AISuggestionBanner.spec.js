import { mount } from '@vue/test-utils';
import AISuggestionBanner from '../AISuggestionBanner.vue';

const mountBanner = props => mount(AISuggestionBanner, { props });

const buttonWithText = (wrapper, text) =>
  wrapper.findAll('button').find(button => button.text().includes(text));

const buttonWithTitle = (wrapper, title) =>
  wrapper
    .findAll('button')
    .find(button => button.attributes('title') === title);

describe('AISuggestionBanner', () => {
  it('shows the suggestion and emits the agent actions', async () => {
    const wrapper = mountBanner({
      suggestion: { content: 'Перевіряю ваш вивід.' },
    });

    expect(wrapper.text()).toContain('AI suggestion');
    expect(wrapper.text()).toContain('Перевіряю ваш вивід.');

    await buttonWithText(wrapper, 'Use this response').trigger('click');
    await buttonWithText(wrapper, 'Dismiss').trigger('click');
    await buttonWithTitle(wrapper, 'Reload suggestion').trigger('click');
    await buttonWithTitle(wrapper, 'Turn off AI suggestions').trigger('click');

    expect(wrapper.emitted('useSuggestion')).toEqual([
      ['Перевіряю ваш вивід.'],
    ]);
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    expect(wrapper.emitted('reload')).toHaveLength(1);
    expect(wrapper.emitted('disable')).toHaveLength(1);
  });

  it('shows the loading state with a way to turn suggestions off', async () => {
    const wrapper = mountBanner({ isLoading: true });

    expect(wrapper.text()).toContain('Loading AI suggestion...');
    await buttonWithTitle(wrapper, 'Turn off AI suggestions').trigger('click');
    expect(wrapper.emitted('disable')).toHaveLength(1);
  });

  it('offers to check again when nothing was found', async () => {
    const wrapper = mountBanner({ isEmpty: true });

    expect(wrapper.text()).toContain('No suggestion for the latest message');
    await buttonWithText(wrapper, 'Get AI suggestion').trigger('click');
    await buttonWithText(wrapper, 'Hide AI suggestions').trigger('click');
    expect(wrapper.emitted('reload')).toHaveLength(1);
    expect(wrapper.emitted('disable')).toHaveLength(1);
  });

  it('shows an error message instead of the empty hint', () => {
    const wrapper = mountBanner({
      isEmpty: true,
      error: { message: 'Network Error' },
    });

    expect(wrapper.text()).toContain("Couldn't load the AI suggestion");
    expect(wrapper.text()).not.toContain(
      'No suggestion for the latest message'
    );
  });
});

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AISuggestionBanner from '../AISuggestionBanner.vue';

const mountBanner = props =>
  mount(AISuggestionBanner, {
    props,
    attachTo: document.body,
    global: { stubs: { transition: true } },
  });

const buttonWithText = (wrapper, text) =>
  wrapper.findAll('button').find(button => button.text().includes(text));

const buttonWithTitle = (wrapper, title) =>
  wrapper
    .findAll('button')
    .find(button => button.attributes('title') === title);

const commentButton = wrapper =>
  buttonWithTitle(wrapper, 'Comment on this suggestion');

const commentBox = wrapper => wrapper.find('textarea');

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

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

  it('emits a single useSuggestion with the content and nothing else when using it', async () => {
    const wrapper = mountBanner({ suggestion: { content: 'Hi' } });

    await buttonWithText(wrapper, 'Use this response').trigger('click');

    expect(wrapper.emitted('useSuggestion')).toEqual([['Hi']]);
    expect(wrapper.emitted('rate')).toBeUndefined();
    expect(wrapper.emitted('comment')).toBeUndefined();
    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });

  it('emits a rating without using, dismissing or hiding the suggestion', async () => {
    const wrapper = mountBanner({ suggestion: { content: 'Hi' } });
    const up = buttonWithTitle(wrapper, 'Good suggestion');
    const down = buttonWithTitle(wrapper, 'Bad suggestion');

    expect(up.attributes('aria-label')).toBe('Good suggestion');
    expect(down.attributes('aria-label')).toBe('Bad suggestion');
    expect(up.attributes('aria-pressed')).toBe('false');
    expect(down.attributes('aria-pressed')).toBe('false');

    await up.trigger('click');
    await down.trigger('click');

    expect(wrapper.emitted('rate')).toEqual([['up'], ['down']]);
    expect(wrapper.emitted('useSuggestion')).toBeUndefined();
    expect(wrapper.emitted('dismiss')).toBeUndefined();
    expect(wrapper.emitted('disable')).toBeUndefined();
  });

  it('shows the current rating as pressed and ignores clicking it again', async () => {
    const wrapper = mountBanner({
      suggestion: { content: 'Hi' },
      rating: 'up',
    });
    const up = () => buttonWithTitle(wrapper, 'Good suggestion');
    const down = () => buttonWithTitle(wrapper, 'Bad suggestion');

    expect(up().attributes('aria-pressed')).toBe('true');
    expect(up().find('span').classes()).toContain('i-ph-thumbs-up-fill');
    expect(down().find('span').classes()).toContain('i-ph-thumbs-down');

    await up().trigger('click');
    expect(wrapper.emitted('rate')).toBeUndefined();

    await down().trigger('click');
    expect(wrapper.emitted('rate')).toEqual([['down']]);

    await wrapper.setProps({ rating: 'down' });
    expect(up().attributes('aria-pressed')).toBe('false');
    expect(up().find('span').classes()).toContain('i-ph-thumbs-up');
    expect(down().attributes('aria-pressed')).toBe('true');
    expect(down().find('span').classes()).toContain('i-ph-thumbs-down-fill');
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

  describe('comment', () => {
    const suggestion = { content: 'Hi', metadata: { suggestionId: 'sug-1' } };

    it('toggles the comment box from the comment button', async () => {
      const wrapper = mountBanner({ suggestion });
      const button = commentButton(wrapper);

      expect(button.attributes('aria-label')).toBe(
        'Comment on this suggestion'
      );
      expect(button.attributes('aria-expanded')).toBe('false');
      expect(commentBox(wrapper).exists()).toBe(false);

      await button.trigger('click');
      expect(commentBox(wrapper).exists()).toBe(true);
      expect(commentBox(wrapper).attributes('placeholder')).toBe(
        "What's wrong or what could be better? (optional)"
      );
      expect(button.attributes('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(commentBox(wrapper).element);

      await button.trigger('click');
      expect(commentBox(wrapper).exists()).toBe(false);
      expect(wrapper.emitted('comment')).toBeUndefined();
    });

    it('keeps Send disabled until there is text and emits the trimmed comment', async () => {
      const wrapper = mountBanner({ suggestion });
      await commentButton(wrapper).trigger('click');
      const send = () => buttonWithText(wrapper, 'Send');

      expect(send().attributes('disabled')).toBeDefined();
      await commentBox(wrapper).setValue('   ');
      expect(send().attributes('disabled')).toBeDefined();

      await commentBox(wrapper).setValue('  Wrong amount  ');
      await send().trigger('click');

      expect(wrapper.emitted('comment')).toEqual([['Wrong amount']]);
      expect(wrapper.emitted('rate')).toBeUndefined();
      expect(wrapper.emitted('dismiss')).toBeUndefined();
    });

    it('sends with Ctrl/Cmd+Enter and cancels with Escape', async () => {
      const wrapper = mountBanner({ suggestion });
      await commentButton(wrapper).trigger('click');
      await commentBox(wrapper).setValue('Too formal');

      await commentBox(wrapper).trigger('keydown', { key: 'Enter' });
      expect(wrapper.emitted('comment')).toBeUndefined();

      await commentBox(wrapper).trigger('keydown', {
        key: 'Enter',
        ctrlKey: true,
      });
      await commentBox(wrapper).trigger('keydown', {
        key: 'Enter',
        metaKey: true,
      });
      expect(wrapper.emitted('comment')).toEqual([
        ['Too formal'],
        ['Too formal'],
      ]);

      await commentBox(wrapper).trigger('keydown', { key: 'Escape' });
      expect(commentBox(wrapper).exists()).toBe(false);
      expect(document.activeElement).toBe(commentButton(wrapper).element);
    });

    it('cancels with the Cancel button and drops the draft', async () => {
      const wrapper = mountBanner({ suggestion });
      await commentButton(wrapper).trigger('click');
      await commentBox(wrapper).setValue('Draft');

      await buttonWithText(wrapper, 'Cancel').trigger('click');
      expect(commentBox(wrapper).exists()).toBe(false);

      await commentButton(wrapper).trigger('click');
      expect(commentBox(wrapper).element.value).toBe('');
      expect(wrapper.emitted('comment')).toBeUndefined();
    });

    it('collapses and thanks the agent once the comment is sent', async () => {
      vi.useFakeTimers();
      const wrapper = mountBanner({ suggestion });
      await commentButton(wrapper).trigger('click');
      await commentBox(wrapper).setValue('Wrong amount');
      await buttonWithText(wrapper, 'Send').trigger('click');

      await wrapper.setProps({ comment: { text: null, status: 'sending' } });
      expect(commentBox(wrapper).exists()).toBe(true);
      expect(
        buttonWithText(wrapper, 'Send').attributes('disabled')
      ).toBeDefined();

      await wrapper.setProps({
        comment: { text: 'Wrong amount', status: 'sent' },
      });
      await nextTick();
      expect(commentBox(wrapper).exists()).toBe(false);
      expect(wrapper.text()).toContain('Thanks for the feedback');

      const done = buttonWithTitle(wrapper, 'Your comment: Wrong amount');
      expect(done.find('span').classes()).toContain('i-ph-chat-text-fill');

      vi.advanceTimersByTime(3000);
      await nextTick();
      expect(wrapper.text()).not.toContain('Thanks for the feedback');
      wrapper.unmount();
    });

    it('shows the error pill and keeps the draft when sending fails', async () => {
      const wrapper = mountBanner({ suggestion });
      await commentButton(wrapper).trigger('click');
      await commentBox(wrapper).setValue('Wrong amount');
      await buttonWithText(wrapper, 'Send').trigger('click');

      await wrapper.setProps({ comment: { text: null, status: 'sending' } });
      await wrapper.setProps({ comment: { text: null, status: 'error' } });

      const alert = wrapper.find('[role="alert"]');
      expect(alert.text()).toContain("Couldn't send the comment");
      expect(alert.classes()).toEqual(
        expect.arrayContaining([
          'text-n-ruby-11',
          'bg-n-ruby-9/10',
          'border-n-ruby-9/20',
        ])
      );
      expect(commentBox(wrapper).element.value).toBe('Wrong amount');
      expect(wrapper.text()).not.toContain('Thanks for the feedback');
    });

    it('opens the box with the sent comment to edit', async () => {
      const wrapper = mountBanner({
        suggestion,
        comment: { text: 'Wrong amount', status: 'sent' },
      });

      await buttonWithTitle(wrapper, 'Your comment: Wrong amount').trigger(
        'click'
      );
      expect(commentBox(wrapper).element.value).toBe('Wrong amount');

      await buttonWithText(wrapper, 'Send').trigger('click');
      expect(wrapper.emitted('comment')).toBeUndefined();
      expect(commentBox(wrapper).exists()).toBe(false);
    });

    it('opens and focuses the box after a thumbs down without blocking the agent', async () => {
      const wrapper = mountBanner({ suggestion });

      await buttonWithTitle(wrapper, 'Bad suggestion').trigger('click');
      expect(wrapper.emitted('rate')).toEqual([['down']]);
      expect(commentBox(wrapper).exists()).toBe(true);
      expect(document.activeElement).toBe(commentBox(wrapper).element);

      await commentBox(wrapper).trigger('keydown', { key: 'Escape' });
      expect(commentBox(wrapper).exists()).toBe(false);
      expect(wrapper.emitted('comment')).toBeUndefined();

      await buttonWithText(wrapper, 'Use this response').trigger('click');
      expect(wrapper.emitted('useSuggestion')).toEqual([['Hi']]);
    });

    it('leaves the box closed after a thumbs up or when a comment was already sent', async () => {
      const wrapper = mountBanner({ suggestion });
      await buttonWithTitle(wrapper, 'Good suggestion').trigger('click');
      expect(commentBox(wrapper).exists()).toBe(false);

      await wrapper.setProps({
        comment: { text: 'Wrong amount', status: 'sent' },
      });
      await buttonWithTitle(wrapper, 'Bad suggestion').trigger('click');
      expect(commentBox(wrapper).exists()).toBe(false);
    });

    it('closes the box when a different suggestion is shown', async () => {
      const wrapper = mountBanner({ suggestion });
      await commentButton(wrapper).trigger('click');
      expect(commentBox(wrapper).exists()).toBe(true);

      await wrapper.setProps({
        suggestion: { content: 'Next', metadata: { suggestionId: 'sug-2' } },
      });
      expect(commentBox(wrapper).exists()).toBe(false);
    });
  });
});

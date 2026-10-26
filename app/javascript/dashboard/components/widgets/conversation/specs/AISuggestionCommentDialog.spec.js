import { mount } from '@vue/test-utils';
import AISuggestionCommentDialog from '../AISuggestionCommentDialog.vue';

const mountDialog = props =>
  mount(AISuggestionCommentDialog, {
    props,
    attachTo: document.body,
    global: {
      stubs: { TeleportWithDirection: { template: '<div><slot /></div>' } },
    },
  });

const confirmButton = () => document.body.querySelector('button[type=submit]');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AISuggestionCommentDialog', () => {
  const suggestion = {
    content: 'Ваш рейкбек за сьогодні: 85 фішок.',
    metadata: { suggestionId: 'sug-1', confidence: 0.934 },
  };

  it('shows the suggestion with its confidence', () => {
    mountDialog({ suggestion });

    expect(document.body.textContent).toContain('Why not the AI suggestion?');
    expect(document.body.textContent).toContain(suggestion.content);
    expect(document.body.textContent).toContain('AI confidence: 93%');
    expect(confirmButton().textContent).toContain('Comment and send');
  });

  it('asks for a dismiss comment in dismiss mode', () => {
    mountDialog({ suggestion, mode: 'dismiss' });

    expect(document.body.textContent).toContain(
      'Leave a comment on why you are dismissing the AI suggestion.'
    );
    expect(confirmButton().textContent).toContain('Comment and dismiss');
  });

  it('submits the trimmed comment and needs a non-blank one', async () => {
    const wrapper = mountDialog({ suggestion });
    const textarea = document.body.querySelector('textarea');

    expect(confirmButton().disabled).toBe(true);
    textarea.value = '  Wrong amount  ';
    textarea.dispatchEvent(new Event('input'));
    await wrapper.vm.$nextTick();
    expect(confirmButton().disabled).toBe(false);

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })
    );
    expect(wrapper.emitted('submit')).toEqual([['Wrong amount']]);
  });

  it('asks for more detail when the comment has fewer than four letters', async () => {
    const wrapper = mountDialog({ suggestion });
    const textarea = document.body.querySelector('textarea');

    textarea.value = 'Ні!!! 123';
    textarea.dispatchEvent(new Event('input'));
    await wrapper.vm.$nextTick();
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(document.body.textContent).toContain(
      'The explanation is too short — please add more detail'
    );
  });

  it('shows the error when the comment could not be saved', () => {
    mountDialog({ suggestion, hasError: true });

    expect(document.body.textContent).toContain(
      "Couldn't save the comment. Try again."
    );
  });
});

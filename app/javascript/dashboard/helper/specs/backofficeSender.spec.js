import { backofficeAccountLabel, backofficeSender } from '../backofficeSender';

describe('backofficeSender', () => {
  it('reads the camelCased stamp the dashboard renders', () => {
    expect(
      backofficeSender({
        monoCrm: { userId: 7, username: 'olya', name: 'Оля' },
      })
    ).toEqual({ userId: 7, username: 'olya', name: 'Оля' });
  });

  it('reads the snake_case stamp as stored', () => {
    expect(
      backofficeSender({ mono_crm: { user_id: 9, username: 'max' } })
    ).toEqual({ userId: 9, username: 'max', name: 'max' });
  });

  it('falls back to the account id when there is no name', () => {
    expect(backofficeSender({ monoCrm: { userId: 5 } })).toEqual({
      userId: 5,
      username: '',
      name: '#5',
    });
  });

  it('is null for messages that did not come from the backoffice', () => {
    expect(backofficeSender({})).toBeNull();
    expect(backofficeSender(undefined)).toBeNull();
    expect(backofficeSender({ monoCrm: { userId: '7' } })).toBeNull();
    expect(backofficeSender({ aiSuggestionAccepted: true })).toBeNull();
  });
});

describe('backofficeAccountLabel', () => {
  it('names the account with login and id', () => {
    expect(
      backofficeAccountLabel({ userId: 7, username: 'olya', name: 'Оля' })
    ).toBe('Оля (@olya, #7)');
  });

  it('skips the login when it is the name', () => {
    expect(
      backofficeAccountLabel({ userId: 9, username: 'max', name: 'max' })
    ).toBe('max (#9)');
  });

  it('is empty without a sender', () => {
    expect(backofficeAccountLabel(null)).toBe('');
  });
});

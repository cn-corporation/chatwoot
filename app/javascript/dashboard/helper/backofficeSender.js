const text = value => (typeof value === 'string' ? value.trim() : '');

/**
 * The backoffice (mono-crm) account that sent a message, or null for a message sent anywhere else.
 * mono-crm stamps every reply and note a cashier sends from the backoffice CRM with
 * content_attributes.mono_crm = { user_id, username, name }; the dashboard camelCases the keys
 * (monoCrm.userId), so both spellings are read.
 */
export const backofficeSender = contentAttributes => {
  const stamp = contentAttributes?.monoCrm || contentAttributes?.mono_crm;
  const userId = stamp?.userId ?? stamp?.user_id;
  if (!Number.isInteger(userId)) return null;
  const username = text(stamp.username);
  return {
    userId,
    username,
    name: text(stamp.name) || username || `#${userId}`,
  };
};

/**
 * How the backoffice account is named in the tooltip: name, login and mono-crm account id.
 */
export const backofficeAccountLabel = sender => {
  if (!sender) return '';
  const login =
    sender.username && sender.username !== sender.name
      ? `@${sender.username}, `
      : '';
  return `${sender.name} (${login}#${sender.userId})`;
};

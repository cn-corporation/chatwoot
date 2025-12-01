export const calculateTimePriority = conversation => {
  if (!conversation) return null;

  if (['resolved', 'snoozed'].includes(conversation.status)) {
    return null;
  }

  const messages = conversation.messages || [];
  if (messages.length === 0) return null;

  let firstUnrepliedIncoming = null;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];

    if (message.message_type === 1 || message.message_type === 2) {
      break;
    }
    if (message.message_type === 0) {
      firstUnrepliedIncoming = message;
    }
  }

  if (!firstUnrepliedIncoming) {
    return null;
  }

  const now = Date.now();
  const messageTime = firstUnrepliedIncoming.created_at * 1000;
  const elapsedMinutes = (now - messageTime) / 1000 / 60;

  if (elapsedMinutes >= 5) {
    return 'high';
  }
  if (elapsedMinutes >= 4) {
    return 'medium';
  }
  if (elapsedMinutes >= 2) {
    return 'low';
  }

  return null;
};

export const getPriorityColor = priority => {
  switch (priority) {
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-green-500';
    default:
      return 'bg-n-slate-4';
  }
};

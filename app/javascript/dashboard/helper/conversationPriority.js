/**
 * Calculate automatic priority based on time elapsed since last inbound message
 * @param {Object} conversation - The conversation object
 * @returns {string|null} - 'high', 'medium', 'low', or null
 */
export const calculateTimePriority = conversation => {
  if (!conversation) return null;

  // Don't show priority for resolved/snoozed conversations
  if (['resolved', 'snoozed'].includes(conversation.status)) {
    return null;
  }

  // Check if conversation has messages and get the last message
  const messages = conversation.messages || [];
  const lastMessage = messages[messages.length - 1];

  // Don't show priority if last message is outgoing (agent already replied)
  // message_type: 0 = incoming, 1 = outgoing, 2 = activity
  if (lastMessage && lastMessage.message_type === 1) {
    return null;
  }

  // Use waiting_since timestamp (Unix timestamp)
  // This is set when customer sends a message and cleared when agent replies
  const waitingSince = conversation.waiting_since;
  if (!waitingSince) return null;

  // Calculate elapsed time in minutes
  const now = Date.now();
  const waitingTime = waitingSince * 1000; // Convert Unix timestamp to milliseconds
  const elapsedMinutes = (now - waitingTime) / 1000 / 60;

  // Apply thresholds
  if (elapsedMinutes >= 5) {
    return 'high'; // Red for 5+ minutes
  }
  if (elapsedMinutes >= 4) {
    return 'medium'; // Yellow for 4-5 minutes
  }
  if (elapsedMinutes >= 2) {
    return 'low'; // Green for 2-3 minutes
  }

  return null; // No priority for < 2 minutes
};

/**
 * Get priority color class for display
 * @param {string} priority - 'high', 'medium', or 'low'
 * @returns {string} - Tailwind color class
 */
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

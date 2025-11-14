class Messages::ContextFetcherService
  # Default number of context messages to fetch
  DEFAULT_CONTEXT_SIZE = 20

  def initialize(message)
    @message = message
    @conversation = message.conversation
  end

  def self.context_size
    ENV.fetch('WEBHOOK_CONTEXT_MESSAGE_COUNT', DEFAULT_CONTEXT_SIZE).to_i
  end

  def fetch_context_messages
    # Fetch last N messages INCLUDING the triggering message in chronological order
    # This provides proper context flow for AI processing
    @conversation
      .messages
      .where.not(message_type: :activity) # Exclude activity messages
      .where('created_at <= ?', @message.created_at) # Include the current message
      .order(created_at: :desc)
      .limit(self.class.context_size)
      .reverse_order # Returns in ascending order (oldest to newest)
      .to_a
  end

  def formatted_context_for_webhook
    fetch_context_messages.map do |msg|
      {
        id: msg.id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        sender_type: msg.sender_type,
        content_type: msg.content_type,
        private: msg.private
      }
    end
  end

  def webhook_payload_with_context
    base_payload = @message.webhook_data
    base_payload.merge({
      context_messages: formatted_context_for_webhook,
      context_size: self.class.context_size
    })
  end
end

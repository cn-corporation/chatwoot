class Conversations::ActivityMessageJob < ApplicationJob
  queue_as :high

  def perform(conversation, message_params)
    return if conversation.retention_active?
    return if conversation.retention_archived_at && enqueued_at && enqueued_at < conversation.retention_archived_at

    conversation.messages.create!(message_params)
  end
end

class Webhooks::TelegramVoiceForwardJob < ApplicationJob
  queue_as :default

  discard_on(ChatwootExtra::Client::PermanentError) do |_job, err|
    Rails.logger.error("TelegramVoiceForwardJob permanent failure: #{err.message}")
  end

  retry_on ChatwootExtra::Client::TransientError, wait: :exponentially_longer, attempts: 10
  retry_on HTTParty::Error, wait: :exponentially_longer, attempts: 10
  retry_on Net::OpenTimeout, wait: :exponentially_longer, attempts: 10
  retry_on Net::ReadTimeout, wait: :exponentially_longer, attempts: 10

  def perform(payload)
    data = payload.with_indifferent_access
    conversation = Conversation.find_by(account_id: data[:account_id], display_id: data[:conversation_id])
    return unless conversation && !conversation.retention_active? && conversation.workflow_epoch == data.fetch(:workflow_epoch, 0).to_i

    ChatwootExtra::Client.forward_voice(payload)
  end
end

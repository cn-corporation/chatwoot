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
    ChatwootExtra::Client.forward_voice(payload)
  end
end

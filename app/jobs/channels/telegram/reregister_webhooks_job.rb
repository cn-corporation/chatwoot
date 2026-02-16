class Channels::Telegram::ReregisterWebhooksJob < ApplicationJob
  queue_as :low

  def perform
    Channel::Telegram.find_each do |channel|
      channel.updated_at = Time.current
      channel.save!
    rescue StandardError => e
      Rails.logger.error "[TelegramReregisterWebhooks] channel##{channel.id} failed: #{e.message}"
    end
  end
end

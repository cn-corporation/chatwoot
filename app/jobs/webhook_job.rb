class WebhookJob < ApplicationJob
  queue_as :medium
  #  There are 3 types of webhooks, account, inbox and agent_bot
  def perform(url, payload, webhook_type = :account_webhook)
    return unless Retention::EventGuard.payload_allowed?(payload)

    Webhooks::Trigger.execute(url, payload, webhook_type)
  end
end

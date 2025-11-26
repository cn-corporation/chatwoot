# == Schema Information
#
# Table name: webhooks
#
#  id            :bigint           not null, primary key
#  name          :string
#  subscriptions :jsonb
#  url           :string
#  webhook_type  :integer          default("account_type")
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  account_id    :integer
#  inbox_id      :integer
#
# Indexes
#
#  index_webhooks_on_account_id_and_url  (account_id,url) UNIQUE
#

class Webhook < ApplicationRecord
  belongs_to :account
  belongs_to :inbox, optional: true

  validates :account_id, presence: true
  validates :url, uniqueness: { scope: [:account_id] }
  validate :validate_webhook_url
  validate :validate_webhook_subscriptions
  enum webhook_type: { account_type: 0, inbox_type: 1 }

  ALLOWED_WEBHOOK_EVENTS = %w[conversation_status_changed conversation_updated conversation_created contact_created contact_updated
                              message_created message_updated message_created_with_context inbound_message_created_with_context
                              webwidget_triggered inbox_created inbox_updated
                              conversation_typing_on conversation_typing_off].freeze

  private

  def validate_webhook_url
    return if url.blank?

    begin
      uri = URI.parse(url)

      # Check if it's http or https
      unless %w[http https].include?(uri.scheme)
        errors.add(:url, 'must be a valid HTTP or HTTPS URL')
        return
      end

      # Allow localhost and local IPs for development/testing
      # This allows: localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x, etc.
      return if uri.host.present?

      errors.add(:url, 'must have a valid host')
    rescue URI::InvalidURIError
      errors.add(:url, 'is not a valid URL')
    end
  end

  def validate_webhook_subscriptions
    invalid_subscriptions = !subscriptions.instance_of?(Array) ||
                            subscriptions.blank? ||
                            (subscriptions.uniq - ALLOWED_WEBHOOK_EVENTS).length.positive?
    errors.add(:subscriptions, I18n.t('errors.webhook.invalid')) if invalid_subscriptions
  end
end

Webhook.include_mod_with('Audit::Webhook')

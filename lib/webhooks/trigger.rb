require 'active_support/core_ext/hash/indifferent_access'

class Webhooks::Trigger
  SUPPORTED_ERROR_HANDLE_EVENTS = %w[message_created message_updated].freeze
  SUPPORTED_CHATWOOT_EXTRA_EVENTS = %w[
    message_created
    message_created_with_context
    inbound_message_created_with_context
  ].freeze
  HEADER_PARAM_PREFIX = 'header_'

  def initialize(url, payload, webhook_type)
    @original_url = url
    @payload = payload.with_indifferent_access
    @webhook_type = webhook_type
    parse_url_and_headers
  end

  def self.execute(url, payload, webhook_type)
    new(url, payload, webhook_type).execute
  end

  def execute
    perform_request
  rescue StandardError => e
    handle_error(e)
    Rails.logger.warn "Exception: Invalid webhook URL #{@original_url} : #{e.message}"
  end

  private

  def parse_url_and_headers
    uri = URI.parse(@original_url)

    @custom_headers = {}
    if uri.query
      params = URI.decode_www_form(uri.query).to_h

      header_params = params.select { |key, _| key.start_with?(HEADER_PARAM_PREFIX) }

      header_params.each do |key, value|
        header_name = key.sub(/^#{HEADER_PARAM_PREFIX}/o, '')
        @custom_headers[header_name] = value
      end

      remaining_params = params.reject { |key, _| key.start_with?(HEADER_PARAM_PREFIX) }

      uri.query = remaining_params.empty? ? nil : URI.encode_www_form(remaining_params)
    end

    @url = uri.to_s
  end

  def perform_request
    RestClient::Request.execute(
      method: :post,
      url: @url,
      payload: @payload.to_json,
      headers: request_headers,
      timeout: webhook_timeout
    )
  end

  def handle_error(error)
    return unless SUPPORTED_ERROR_HANDLE_EVENTS.include?(@payload[:event])
    return unless message

    case @webhook_type
    when :agent_bot_webhook
      conversation = message.conversation
      return unless conversation&.pending?

      conversation.open!
      create_agent_bot_error_activity(conversation)
    when :api_inbox_webhook
      update_message_status(error)
    end
  end

  def create_agent_bot_error_activity(conversation)
    content = I18n.t('conversations.activity.agent_bot.error_moved_to_open')
    Conversations::ActivityMessageJob.perform_later(conversation, activity_message_params(conversation, content))
  end

  def activity_message_params(conversation, content)
    {
      account_id: conversation.account_id,
      inbox_id: conversation.inbox_id,
      message_type: :activity,
      content: content
    }
  end

  def update_message_status(error)
    Messages::StatusUpdateService.new(message, 'failed', error.message).perform
  end

  def message
    return if message_id.blank?

    @message ||= Message.find_by(id: message_id)
  end

  def message_id
    @payload[:id]
  end

  def request_headers
    headers = { content_type: :json, accept: :json }.merge(@custom_headers)
    token = webhook_bearer_token
    if token.present?
      headers['X-Chatwoot-Bearer-Token'] = token
      headers[:'X-Chatwoot-Bearer-Token'] = token
    end
    headers
  end

  def webhook_bearer_token
    return unless should_attach_chatwoot_token?

    token = ChatwootExtra::BearerTokenService.encrypted_token_for_account(account_id)
    if token.present?
      Rails.logger.debug(
        "[Webhooks::Trigger] Attached Chatwoot Extra bearer token for account #{account_id}"
      )
      return token
    else
      Rails.logger.warn(
        "[Webhooks::Trigger] Unable to attach Chatwoot Extra bearer token for account #{account_id}"
      )
    end
    nil
  rescue StandardError => e
    Rails.logger.warn "[Webhooks::Trigger] Failed to attach bearer token for account #{account_id}: #{e.message}"
    nil
  end

  def should_attach_chatwoot_token?
    SUPPORTED_CHATWOOT_EXTRA_EVENTS.include?(@payload[:event]) && account_id.present?
  end

  def account_id
    account_details = @payload[:account]
    return if account_details.blank?

    account_details[:id] || account_details['id']
  end

  def webhook_timeout
    raw_timeout = GlobalConfig.get_value('WEBHOOK_TIMEOUT')
    timeout = raw_timeout.presence&.to_i

    timeout&.positive? ? timeout : 5
  end
end

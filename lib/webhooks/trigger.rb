class Webhooks::Trigger
  SUPPORTED_ERROR_HANDLE_EVENTS = %w[message_created message_updated].freeze
  HEADER_PARAM_PREFIX = 'header_'

  def initialize(url, payload, webhook_type)
    @original_url = url
    @payload = payload
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
        header_name = key.sub(/^#{HEADER_PARAM_PREFIX}/, '')
        @custom_headers[header_name] = value
      end

      remaining_params = params.reject { |key, _| key.start_with?(HEADER_PARAM_PREFIX) }

      uri.query = remaining_params.empty? ? nil : URI.encode_www_form(remaining_params)
    end

    @url = uri.to_s
  end

  def perform_request
    headers = { content_type: :json, accept: :json }.merge(@custom_headers)

    RestClient::Request.execute(
      method: :post,
      url: @url,
      payload: @payload.to_json,
      headers: headers,
      timeout: 5
    )
  end

  def handle_error(error)
    return unless should_handle_error?
    return unless message

    update_message_status(error)
  end

  def should_handle_error?
    @webhook_type == :api_inbox_webhook && SUPPORTED_ERROR_HANDLE_EVENTS.include?(@payload[:event])
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
end

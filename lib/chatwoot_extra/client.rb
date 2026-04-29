# frozen_string_literal: true

require 'openssl'
require 'httparty'

class ChatwootExtra::Client
  class PermanentError < StandardError; end
  class TransientError < StandardError; end

  FORWARD_PATH = '/webhooks/telegram-voice'
  REQUEST_TIMEOUT = 30

  def self.forward_voice(payload)
    new.forward_voice(payload)
  end

  def forward_voice(payload)
    raise 'CHATWOOT_EXTRA_API_URL missing' if base_url.blank?
    raise 'CHATWOOT_EXTRA_WEBHOOK_SECRET missing' if secret.blank?

    body = payload.to_json
    timestamp = Time.now.to_i.to_s

    response = HTTParty.post(
      "#{base_url}#{FORWARD_PATH}",
      headers: {
        'Content-Type' => 'application/json',
        'X-Signature' => sign(timestamp, body),
        'X-Request-Timestamp' => timestamp
      },
      body: body,
      timeout: REQUEST_TIMEOUT
    )

    return if response.code.between?(200, 299)

    raise PermanentError, error_message(response) if response.code.between?(400, 499)

    raise TransientError, error_message(response)
  end

  private

  def base_url
    @base_url ||= ENV.fetch('CHATWOOT_EXTRA_API_URL', nil)&.delete_suffix('/')
  end

  def secret
    @secret ||= ENV.fetch('CHATWOOT_EXTRA_WEBHOOK_SECRET', nil)
  end

  def sign(timestamp, body)
    digest = OpenSSL::HMAC.hexdigest('sha256', secret, "#{timestamp}.#{body}")
    "sha256=#{digest}"
  end

  def error_message(response)
    "chatwoot-extra #{response.code}: #{response.body.to_s[0, 500]}"
  end
end

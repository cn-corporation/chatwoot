module Telegram::ApiConcern
  extend ActiveSupport::Concern

  MAX_429_RETRIES = 3
  THROTTLE_SLOT_SECONDS = 1
  THROTTLE_WAIT_BACKOFF = 0.2

  private

  def with_chat_throttle(chat_id, &)
    return yield if chat_id.blank?

    key = format(Redis::RedisKeys::TELEGRAM_CHAT_THROTTLE, chat_id: chat_id)
    sleep THROTTLE_WAIT_BACKOFF until Redis::Alfred.set(key, '1', nx: true, ex: THROTTLE_SLOT_SECONDS)

    yield
  end

  def with_429_retry(attempt: 1, &)
    response = yield
    return response unless rate_limited?(response)
    return response if attempt > MAX_429_RETRIES

    retry_after = [response.parsed_response.dig('parameters', 'retry_after').to_i, 1].max
    Rails.logger.warn("Telegram 429 (attempt #{attempt}/#{MAX_429_RETRIES}), sleeping #{retry_after}s")
    sleep retry_after
    with_429_retry(attempt: attempt + 1, &)
  end

  def rate_limited?(response)
    return false unless response.respond_to?(:parsed_response)

    parsed = response.parsed_response
    parsed.is_a?(Hash) && parsed['error_code'].to_i == 429
  end
end

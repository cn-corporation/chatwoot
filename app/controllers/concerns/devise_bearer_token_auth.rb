module DeviseBearerTokenAuth
  extend ActiveSupport::Concern

  included do
    before_action :decode_bearer_token_if_present
  end

  private

  def decode_bearer_token_if_present
    return unless request.headers['Authorization']&.start_with?('Bearer ')

    bearer_token = request.headers['Authorization'].sub(/^Bearer\s+/, '')

    begin
      decoded_data = JSON.parse(Base64.decode64(bearer_token))

      # Check if this is devise_token_auth data (has access-token, client, uid)
      if decoded_data['access-token'] && decoded_data['client'] && decoded_data['uid']
        # Set the devise_token_auth headers from the decoded data
        request.headers['access-token'] = decoded_data['access-token']
        request.headers['client'] = decoded_data['client']
        request.headers['uid'] = decoded_data['uid']
        request.headers['expiry'] = decoded_data['expiry']
        request.headers['token-type'] = decoded_data['token-type'] || 'Bearer'
      end
    rescue JSON::ParserError, ArgumentError
      # If decoding fails, just continue - might be a different type of Bearer token
      nil
    end
  end
end

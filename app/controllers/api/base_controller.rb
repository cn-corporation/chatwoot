class Api::BaseController < ApplicationController
  include AccessTokenAuthHelper
  respond_to :json
  before_action :authenticate_access_token!, if: :authenticate_by_access_token?
  before_action :validate_bot_access_token!, if: :authenticate_by_access_token?
  before_action :authenticate_user!, unless: :authenticate_by_access_token?

  private

  def authenticate_by_access_token?
    return true if request.headers[:api_access_token].present?
    return true if request.headers[:HTTP_API_ACCESS_TOKEN].present?

    # Check if Authorization: Bearer is present
    if request.headers[:Authorization].present? && request.headers[:Authorization].start_with?('Bearer ')
      bearer_token = request.headers[:Authorization].sub(/^Bearer\s+/, '')

      begin
        # Try to decode as base64 JSON
        decoded_data = JSON.parse(Base64.decode64(bearer_token))

        # If it has devise_token_auth fields, it's NOT an access token
        return false if decoded_data['access-token'] && decoded_data['client'] && decoded_data['uid']
      rescue JSON::ParserError, ArgumentError
        # If decoding fails, assume it's an access token
        return true
      end

      # If we got here, it's a Bearer token but not devise_token_auth, so it's an access token
      return true
    end

    false
  end

  def check_authorization(model = nil)
    model ||= controller_name.classify.constantize

    authorize(model)
  end

  def check_admin_authorization?
    raise Pundit::NotAuthorizedError unless Current.account_user.administrator?
  end
end

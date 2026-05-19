module ChatwootExtra
  class ApiClient
    include HTTParty

    class ApiError < StandardError
      attr_reader :code, :response

      def initialize(message = nil, code = nil, response = nil)
        @code = code
        @response = response
        super(message)
      end
    end

    def initialize
      @base_uri = ENV.fetch('CHATWOOT_EXTRA_API_URL', 'http://localhost:3001')
      @api_key = ENV.fetch('CHATWOOT_EXTRA_API_KEY', '')
    end

    def get_automation_sources(chatwoot_automation_id)
      get("/api/automations/#{chatwoot_automation_id}")
    end

    def get_all_automations
      get('/api/automations')
    end

    def mark_conversation_unread(account_id, conversation_id)
      bearer_token = ChatwootExtra::BearerTokenService.encrypted_token_for_account(account_id)
      return if bearer_token.blank?

      post(
        '/api/operator-notifications/mark-unread',
        { conversationId: conversation_id.to_s },
        { 'X-Chatwoot-Bearer-Token' => bearer_token }
      )
    end

    private

    def get(path)
      full_url = URI.join(@base_uri, path).to_s
      response = self.class.get(full_url, headers: headers)
      handle_response(response)
    end

    def post(path, body, extra_headers = {})
      full_url = URI.join(@base_uri, path).to_s
      response = self.class.post(full_url, headers: headers.merge(extra_headers), body: body.to_json)
      handle_response(response)
    end

    def headers
      {
        'Content-Type' => 'application/json',
        'X-API-Key' => @api_key
      }
    end

    def handle_response(response)
      case response.code
      when 200..299
        parse_response(response)
      when 404
        nil
      else
        error_message = "ChatwootExtra API error: #{response.code} - #{response.body}"
        Rails.logger.error error_message
        raise ApiError.new(error_message, response.code, response)
      end
    end

    def parse_response(response)
      response.parsed_response
    rescue JSON::ParserError, TypeError => e
      error_message = "Failed to parse ChatwootExtra API response: #{e.message}"
      raise ApiError.new(error_message, response.code, response)
    end
  end
end

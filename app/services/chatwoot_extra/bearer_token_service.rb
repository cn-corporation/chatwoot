require 'base64'

module ChatwootExtra
  class BearerTokenService
    CACHE_NAMESPACE = 'chatwoot-extra:bearer-token'.freeze
    DEFAULT_CACHE_TTL = 30.minutes
    DEFAULT_CACHE_SCOPE = 'auto'.freeze

    # in-memory fallback cache
    @memory_cache = {}
    @memory_cache_mutex = Mutex.new

    def self.encrypted_token_for_account(account_id)
      account = Account.find_by(id: account_id)
      return if account.blank?

      new(account).encrypted_token
    end

    def initialize(account)
      @account = account
    end

    def encrypted_token
      key = cache_key
      ttl = cache_ttl

      # Try Rails cache first
      token = Rails.cache.read(key)
      if token.present?
        Rails.logger.debug { "[ChatwootExtra] Cache HIT for #{key}" }
        return token
      else
        Rails.logger.debug { "[ChatwootExtra] Cache MISS for #{key}" }
      end

      # Fallback: try memory cache
      token = fetch_from_memory_cache(key)
      if token.present?
        Rails.logger.debug { "[ChatwootExtra] Memory cache HIT for #{key}" }
        return token
      else
        Rails.logger.debug { "[ChatwootExtra] Memory cache MISS for #{key}" }
      end

      # Generate a new token if no cache hit
      token = build_encrypted_token

      if token.present?
        Rails.logger.debug { "[ChatwootExtra] Caching new token for #{key} (TTL: #{ttl}s)" }
        Rails.cache.write(key, token, expires_in: ttl)
        store_in_memory_cache(key, token, ttl)
      end

      token
    rescue StandardError => e
      Rails.logger.error("[ChatwootExtra] Failed to build bearer token for account #{@account.id}: #{e.message}")
      nil
    end

    private

    def cache_key
      case cache_scope
      when 'global'
        CACHE_NAMESPACE
      when 'account'
        "#{CACHE_NAMESPACE}:#{@account.id}"
      else
        single_account_instance? ? CACHE_NAMESPACE : "#{CACHE_NAMESPACE}:#{@account.id}"
      end
    end

    def cache_scope
      ENV.fetch('CHATWOOT_EXTRA_BEARER_TOKEN_CACHE_SCOPE', DEFAULT_CACHE_SCOPE).to_s.downcase
    end

    def single_account_instance?
      Account.count <= 1
    end

    def cache_ttl
      ttl = ENV.fetch('CHATWOOT_EXTRA_BEARER_TOKEN_CACHE_TTL', nil)
      ttl_value = ttl.to_i
      ttl_value.positive? ? ttl_value : DEFAULT_CACHE_TTL
    end

    # --- in-memory fallback cache helpers ---
    def fetch_from_memory_cache(key)
      self.class.instance_variable_get(:@memory_cache_mutex).synchronize do
        cache = self.class.instance_variable_get(:@memory_cache)
        entry = cache[key]
        return nil unless entry

        value, expires_at = entry
        if Time.current < expires_at
          value
        else
          cache.delete(key)
          nil
        end
      end
    end

    def store_in_memory_cache(key, value, ttl)
      self.class.instance_variable_get(:@memory_cache_mutex).synchronize do
        cache = self.class.instance_variable_get(:@memory_cache)
        cache[key] = [value, Time.current + ttl]
      end
    end
    # ---------------------------------------

    def build_encrypted_token
      user = service_user
      unless user
        Rails.logger.warn("[ChatwootExtra] No eligible user found for account #{@account.id} to issue webhook bearer token")
        return
      end

      token = user.access_token&.token
      unless token
        Rails.logger.warn("[ChatwootExtra] No access token found for user #{user.id} in account #{@account.id}")
        return
      end

      payload = {
        accountId: @account.id,
        bearerToken: token
      }

      encrypted = ChatwootExtra::Encryption.encrypt(payload.to_json)
      Rails.logger.debug { "[ChatwootExtra] Generated encrypted bearer token for account #{@account.id}" }
      encrypted
    end

    def service_user
      return @service_user if defined?(@service_user)

      admin_user = @account.account_users.administrator.includes(:user).first&.user
      @service_user = admin_user || @account.users.order(:id).first
    end
  end
end

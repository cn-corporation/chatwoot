require 'openssl'
require 'base64'
require 'securerandom'

module ChatwootExtra
  module Encryption
    ALGORITHM = 'aes-256-gcm'.freeze
    IV_LENGTH = 16
    SALT_LENGTH = 32
    TAG_LENGTH = 16
    KEY_LENGTH = 32
    ITERATIONS = 100_000
    DEFAULT_KEY = 'default-encryption-key-change-in-production'.freeze

    class << self
      def encrypt(text)
        salt = SecureRandom.random_bytes(SALT_LENGTH)
        iv = SecureRandom.random_bytes(IV_LENGTH)
        cipher = OpenSSL::Cipher.new(ALGORITHM)
        cipher.encrypt
        cipher.iv_len = IV_LENGTH
        cipher.key = derive_key(salt)
        cipher.iv = iv

        encrypted = cipher.update(text) + cipher.final
        tag = cipher.auth_tag

        Base64.strict_encode64(salt + iv + tag + encrypted)
      end

      def decrypt(encrypted_text)
        buffer = Base64.decode64(encrypted_text)

        salt = buffer.byteslice(0, SALT_LENGTH)
        iv = buffer.byteslice(SALT_LENGTH, IV_LENGTH)
        tag = buffer.byteslice(SALT_LENGTH + IV_LENGTH, TAG_LENGTH)
        ciphertext = buffer.byteslice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH, buffer.bytesize)

        cipher = OpenSSL::Cipher.new(ALGORITHM)
        cipher.decrypt
        cipher.iv_len = IV_LENGTH
        cipher.key = derive_key(salt)
        cipher.iv = iv
        cipher.auth_tag = tag

        cipher.update(ciphertext) + cipher.final
      end

      private

      def derive_key(salt)
        OpenSSL::PKCS5.pbkdf2_hmac(
          encryption_key,
          salt,
          ITERATIONS,
          KEY_LENGTH,
          OpenSSL::Digest::SHA256.new
        )
      end

      def encryption_key
        key = ENV['ENCRYPTION_KEY']
        key.nil? || key.empty? ? DEFAULT_KEY : key
      end
    end
  end
end

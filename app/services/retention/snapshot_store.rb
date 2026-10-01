class Retention::SnapshotStore
  class Unavailable < StandardError; end
  class NotFound < StandardError; end

  def self.source_id
    ENV.fetch('RETENTION_SOURCE_ID', 'chatwoot')
  end

  def self.signature(method, path, timestamp, body)
    secret = ENV.fetch('CHATWOOT_RETENTION_SECRET', '')
    raise Unavailable, 'Retention service secret is not configured' if secret.blank?

    OpenSSL::HMAC.hexdigest('SHA256', secret, [method, path, timestamp, Digest::SHA256.hexdigest(body)].join("\n"))
  end

  def self.valid_request?(request)
    timestamp = request.headers['X-Retention-Timestamp'].to_s
    provided = request.headers['X-Retention-Signature'].to_s
    return false unless timestamp.match?(/\A\d+\z/) && (Time.current.to_i - timestamp.to_i).abs <= 300
    return false unless provided.match?(/\A[a-f0-9]{64}\z/)

    ActiveSupport::SecurityUtils.secure_compare(provided, signature(request.method, request.path, timestamp, request.raw_post))
  rescue Unavailable
    false
  end

  def prepare(session, snapshot)
    json = Retention::SnapshotBuilder.serialize(snapshot)
    checksum = Digest::SHA256.hexdigest(json)
    receipt = post('/snapshots/prepare', { account_id: session.account_id, payload_json: json, digest: checksum })
    raise Unavailable, 'Retention snapshot receipt does not match' unless receipt['digest'] == checksum && uuid?(receipt['id'])

    receipt
  end

  def commit(session)
    post('/snapshots/commit', { account_id: session.account_id, id: session.snapshot_id, session_id: session.id, digest: session.snapshot_digest })
  end

  def history(account_id:, inbox_ids:, page:, query:)
    post('/snapshots/history', { account_id: account_id, inbox_ids: inbox_ids, page: page, q: query })
  end

  def read(account_id:, inbox_ids:, id:)
    post('/snapshots/read', { account_id: account_id, inbox_ids: inbox_ids, id: id })
  end

  def file(account_id:, inbox_ids:, id:, file_id:)
    post('/snapshots/file', { account_id: account_id, inbox_ids: inbox_ids, id: id, file_id: file_id }, binary: true)
  end

  private

  def uuid?(value)
    value.to_s.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
  end

  def post(path, data, binary: false)
    path = "/internal/retention#{path}"
    body = data.merge(source_id: self.class.source_id).to_json
    uri = URI.join(ENV.fetch('CHATWOOT_EXTRA_API_URL', 'http://localhost:3001'), path)
    response = HTTParty.post(uri.to_s, headers: signed_headers(path, body), body: body, timeout: 60, follow_redirects: false)
    raise NotFound if response.code.to_i == 404
    raise Unavailable, "Retention storage returned #{response.code}" unless response.code.to_i.between?(200, 299)

    binary ? response.body.b : JSON.parse(response.body)
  rescue IOError, SystemCallError, Timeout::Error, SocketError, JSON::ParserError, OpenSSL::SSL::SSLError, HTTParty::Error => e
    # Never log snapshot content, response bodies or service credentials.
    raise Unavailable, "Retention storage request failed (#{e.class})"
  end

  def signed_headers(path, body)
    timestamp = Time.current.to_i.to_s
    {
      'Content-Type' => 'application/json', 'X-Retention-Timestamp' => timestamp,
      'X-Retention-Signature' => self.class.signature('POST', path, timestamp, body)
    }
  end
end

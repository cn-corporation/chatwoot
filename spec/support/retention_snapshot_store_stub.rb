class RetentionSnapshotStoreStub
  include WebMock::API
  attr_reader :snapshots, :files
  attr_accessor :fail_prepare, :fail_commit

  def initialize
    @snapshots = {}
    @files = {}
    @captures = {}
    stub_request(:post, %r{http://retention-extra.test/internal/retention/}).to_return { |request| handle(request) }
  end

  def payload(session)
    snapshots.fetch(session.reload.snapshot_id).fetch('snapshot')
  end

  private

  def handle(request)
    data = JSON.parse(request.body)
    timestamp = request.headers.fetch('X-Retention-Timestamp')
    expected = Retention::SnapshotStore.signature('POST', request.uri.path, timestamp, request.body)
    raise 'Snapshot request was not authenticated' unless request.headers['X-Retention-Signature'] == expected

    if request.uri.path == '/internal/retention/snapshots/file'
      stored = snapshots[data['id']]
      bytes = stored && stored['committed'] && permitted?(stored, data) && files[data['file_id']]
      return { status: bytes ? 200 : 404, body: bytes || '', headers: { 'Content-Type' => 'application/octet-stream' } }
    end
    result = dispatch(request.uri.path, data)
    { status: result ? 200 : 404, body: (result || {}).to_json, headers: { 'Content-Type' => 'application/json' } }
  end

  def dispatch(path, data)
    case path
    when '/internal/retention/files'
      bytes = Base64.strict_decode64(data.fetch('data_base64'))
      raise 'Wrong file checksum' unless Digest::SHA256.hexdigest(bytes) == data['sha256']

      id = SecureRandom.uuid
      files[id] = bytes
      { id: id, sha256: data['sha256'], byte_size: bytes.bytesize }
    when '/internal/retention/snapshots/prepare'
      raise Net::ReadTimeout if fail_prepare

      prepare(data)
    when '/internal/retention/snapshots/commit'
      raise Net::ReadTimeout if fail_commit

      stored = snapshots.fetch(data['id'])
      stored['committed'] = true
      { id: data['id'], digest: stored['digest'], session: stored['session'] }
    when '/internal/retention/snapshots/read'
      stored = snapshots[data['id']]
      stored&.fetch('committed') && permitted?(stored, data) ? stored.except('committed') : nil
    when '/internal/retention/snapshots/history'
      rows = snapshots.values.select { |stored| stored['committed'] && permitted?(stored, data) }
      { sessions: rows.map { |stored| stored['session'] }, has_more: false }
    when '/internal/retention/snapshots/file'
      nil
    end
  end

  def prepare(data)
    checksum = Digest::SHA256.hexdigest(data.fetch('payload_json'))
    raise 'Wrong snapshot checksum' unless checksum == data['digest']

    id = @captures[checksum] ||= SecureRandom.uuid
    payload = JSON.parse(data['payload_json'])
    summary = { 'id' => id, 'source_session_id' => payload['session_id'], 'conversation_id' => payload.dig('conversation', 'display_id'),
                'contact' => payload['contact'], 'inbox' => payload['inbox'], 'completed_at' => payload['completed_at'] }
    snapshots[id] ||= { 'session' => summary, 'snapshot' => payload, 'payload_json' => data['payload_json'],
                        'digest' => checksum, 'committed' => false }
    { id: id, digest: checksum, session: summary }
  end

  def permitted?(stored, data)
    stored.dig('snapshot', 'account_id') == data['account_id'] && data.fetch('inbox_ids').include?(stored.dig('snapshot', 'inbox', 'id'))
  end
end

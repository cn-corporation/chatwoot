class Retention::SnapshotBuilder
  def self.digest(snapshot)
    Digest::SHA256.hexdigest(serialize(snapshot))
  end

  def self.serialize(snapshot)
    canonicalize(snapshot.as_json).to_json
  end

  def self.canonicalize(value)
    case value
    when Hash then value.sort.to_h.transform_values { |item| canonicalize(item) }
    when Array then value.map { |item| canonicalize(item) }
    else value
    end
  end
  private_class_method :canonicalize

  def initialize(session)
    @session = session
    @conversation = session.conversation
  end

  def build(completed_by: nil, completed_at: Time.current)
    {
      schema_version: 3, transcript_scope: 'retention_session', attachment_storage: 'chatwoot',
      captured_at: Time.current.iso8601(6), session_id: @session.id,
      started_at: @session.created_at, completed_at: completed_at, completed_by: completed_by&.slice(:id, :name),
      account_id: @session.account_id, conversation: @conversation.attributes,
      contact: @conversation.contact.attributes, inbox: @conversation.inbox.slice(:id, :name, :channel_type),
      entry_source: @session.entry_source, entry_parameter: @session.entry_parameter,
      started_by: @session.started_by&.slice(:id, :name) || { id: nil, type: @session.entry_source },
      messages: @session.messages.reorder(:created_at, :id).includes(:sender, attachments: { file_attachment: :blob }).map do |message|
        snapshot_message(message)
      end
    }.deep_stringify_keys
  end

  private

  def snapshot_message(message)
    message.attributes.merge(
      'sender' => message.sender&.slice(:id, :name),
      'session_message' => message.retention_session_id == @session.id,
      'attachments' => message.attachments.map do |attachment|
        data = attachment.attributes
        if attachment.file.attached?
          blob = attachment.file.blob
          data = data.merge('blob_id' => blob.id, 'filename' => blob.filename.to_s, 'content_type' => blob.content_type,
                            'byte_size' => blob.byte_size, 'checksum' => blob.checksum, 'checksum_algorithm' => 'md5_base64',
                            'blob_metadata' => blob.metadata, 'storage' => 'chatwoot_active_storage')
        end
        data
      end
    )
  end
end

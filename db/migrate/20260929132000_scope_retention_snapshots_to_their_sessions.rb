class ScopeRetentionSnapshotsToTheirSessions < ActiveRecord::Migration[7.1]
  class SnapshotRecord < ActiveRecord::Base
    self.table_name = 'retention_sessions'
  end

  def up
    SnapshotRecord.where.not(completed_at: nil).find_each do |record|
      record.with_lock { restrict_snapshot(record) }
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Excluded historical messages cannot be reconstructed from mutable live rows.'
  end

  private

  def restrict_snapshot(record)
    snapshot = record.snapshot.deep_dup
    messages = snapshot.fetch('messages').select { |message| message['retention_session_id'].to_s == record.id.to_s }
    return if snapshot['transcript_scope'] == 'retention_session' && messages == snapshot['messages']

    snapshot['messages'] = messages
    snapshot['transcript_scope'] = 'retention_session'
    # This data correction intentionally bypasses application-level snapshot immutability.
    record.update_columns(snapshot: snapshot, snapshot_digest: Digest::SHA256.hexdigest(canonicalize(snapshot).to_json)) # rubocop:disable Rails/SkipsModelValidations
    release_unrelated_files(record, messages)
  end

  def release_unrelated_files(record, messages)
    blob_ids = messages.flat_map { |message| message.fetch('attachments', []).filter_map { |attachment| attachment['blob_id'] } }
    # Release only the snapshot's unused references. Never purge source messages, attachments or blobs.
    ActiveStorage::Attachment.where(record_type: 'RetentionSession', record_id: record.id, name: 'files').where.not(blob_id: blob_ids).delete_all
  end

  def canonicalize(value)
    case value
    when Hash then value.sort.to_h.transform_values { |item| canonicalize(item) }
    when Array then value.map { |item| canonicalize(item) }
    else value
    end
  end
end

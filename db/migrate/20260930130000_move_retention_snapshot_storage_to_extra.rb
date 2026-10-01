class MoveRetentionSnapshotStorageToExtra < ActiveRecord::Migration[7.1]
  def up
    add_column :retention_sessions, :snapshot_id, :uuid
    add_column :retention_sessions, :snapshot_synced_at, :datetime
    add_index :retention_sessions, :snapshot_id, unique: true
    # The user authorized discarding the old archive. Keep session/message attribution and workflow history intact.
    ActiveRecord::Base.connection.execute("DELETE FROM active_storage_attachments WHERE record_type = 'RetentionSession' AND name = 'files'")
    ActiveRecord::Base.connection.execute('UPDATE retention_sessions SET snapshot_digest = NULL WHERE completed_at IS NOT NULL')
    remove_column :retention_sessions, :snapshot, :jsonb
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Legacy snapshots were explicitly discarded when Extra became the archive owner.'
  end
end

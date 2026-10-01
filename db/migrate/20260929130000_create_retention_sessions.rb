class CreateRetentionSessions < ActiveRecord::Migration[7.1]
  def change
    create_table :retention_sessions do |t|
      t.references :account, null: false, foreign_key: true
      t.references :conversation, null: false, foreign_key: true
      t.bigint :started_by_id, null: false
      t.bigint :completed_by_id
      t.datetime :completed_at
      t.jsonb :snapshot
      t.string :snapshot_digest
      t.timestamps
    end
    add_index :retention_sessions, :conversation_id, unique: true,
                                                     where: 'completed_at IS NULL', name: 'index_retention_sessions_one_active'
    add_index :retention_sessions, [:account_id, :completed_at]

    add_reference :conversations, :active_retention_session, foreign_key: { to_table: :retention_sessions }
    add_column :conversations, :workflow_epoch, :integer, null: false, default: 0
    add_column :conversations, :retention_archived_at, :datetime
    add_column :conversations, :support_started_at, :datetime

    add_reference :messages, :retention_session, foreign_key: true
    add_column :messages, :workflow_epoch, :integer, null: false, default: 0
    add_column :messages, :retention_request_id, :uuid
    add_index :messages, [:account_id, :retention_request_id], unique: true,
                                                               where: 'retention_request_id IS NOT NULL', name: 'index_messages_retention_request'
  end
end

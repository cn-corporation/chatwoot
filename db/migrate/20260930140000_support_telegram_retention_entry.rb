class SupportTelegramRetentionEntry < ActiveRecord::Migration[7.1]
  def change
    change_column_null :retention_sessions, :started_by_id, true
    add_column :retention_sessions, :entry_source, :string, null: false, default: 'manual'
    add_column :retention_sessions, :entry_parameter, :string
  end
end

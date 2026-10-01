class AddRetentionMemberToAccountUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :account_users, :retention_member, :boolean, default: false, null: false
  end
end

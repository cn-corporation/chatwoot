class AddBlockedUntilToContacts < ActiveRecord::Migration[7.0]
  def change
    add_column :contacts, :blocked_until, :datetime, default: nil
  end
end

class CreateSupportDeliveryLeases < ActiveRecord::Migration[7.1]
  def change
    create_table :support_delivery_leases, id: :uuid do |t|
      t.references :conversation, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :expires_at, null: false
    end
    add_index :support_delivery_leases, :expires_at
  end
end

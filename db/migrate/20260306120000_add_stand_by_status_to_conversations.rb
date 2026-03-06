class AddStandByStatusToConversations < ActiveRecord::Migration[7.0]
  def up
    # stand_by = 4 added to conversation status enum
    # No schema change needed - Rails integer enum, new value 4 is just recognized by the model
  end

  def down
    # Reset any stand_by conversations back to open
    Conversation.where(status: 4).update_all(status: 0) # rubocop:disable Rails/SkipsModelValidations
  end
end

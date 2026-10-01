class Retention::RealtimeService
  def self.broadcast(message)
    return unless message.conversation.active_retention_session_id == message.retention_session_id

    users = message.account.account_users.where(retention_member: true).includes(:user).filter_map do |membership|
      user = membership.user
      next unless Retention::Access.new(message.account, user).inbox_ids.include?(message.inbox_id)

      user.pubsub_token
    end
    return if users.empty?

    ActionCableBroadcastJob.perform_later(users, 'retention.changed',
                                          account_id: message.account_id, conversation_id: message.conversation.display_id)
  end
end

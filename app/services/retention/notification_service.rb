class Retention::NotificationService
  def self.unread_conversation_ids(account, user)
    user.notifications.visible_to(user, account).where(read_at: nil, snoozed_until: nil)
        .where(primary_actor_type: 'Conversation')
        .joins('INNER JOIN conversations ON conversations.id = notifications.primary_actor_id')
        .where("notifications.meta->>'retention_session_id' = CAST(conversations.active_retention_session_id AS TEXT)")
        .distinct.pluck('conversations.display_id')
  end

  def initialize(message)
    @message = message
  end

  def perform
    return unless @message.incoming? && @message.retention_session_id.present?

    conversation = @message.conversation
    conversation.account.account_users.where(retention_member: true).includes(:user).find_each do |membership|
      membership.with_lock do
        next unless membership.retention_member?
        next unless Retention::Access.new(conversation.account, membership.user).conversations.exists?(conversation.id)

        Notification.find_or_create_by!(account: conversation.account, user: membership.user,
                                        notification_type: :participating_conversation_new_message,
                                        primary_actor: conversation, secondary_actor: @message) do |notification|
          notification.meta = { retention_session_id: @message.retention_session_id }
        end
      end
    end
  end
end

class Retention::Access
  def initialize(account, user)
    @account = account
    @user = user
  end

  def member?
    @user.is_a?(User) && @user.confirmed? && @account.account_users.exists?(user_id: @user.id, retention_member: true)
  end

  def conversations
    return @account.conversations.none unless member?

    # Retention membership grants the shared workspace. Inbox access still applies.
    @account.conversations.where(inbox_id: inbox_ids)
  end

  def inbox_ids
    return [] unless member?

    @user.inboxes.where(account: @account, channel_type: 'Channel::Telegram').pluck(:id)
  end
end

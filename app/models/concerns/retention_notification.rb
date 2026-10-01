module RetentionNotification
  extend ActiveSupport::Concern

  class_methods do
    def visible_to(user, account)
      scope = where(account_id: account.id)
      active_ids = account.conversations.where.not(active_retention_session_id: nil).select(:id)
      normal = scope.where("NOT (COALESCE(notifications.meta, '{}'::jsonb) ? 'retention_session_id')")
                    .where('primary_actor_type != ? OR primary_actor_id NOT IN (?)', 'Conversation', active_ids)
      inbox_ids = Retention::Access.new(account, user).inbox_ids
      return normal if inbox_ids.empty?

      retention = scope.where("notifications.meta ? 'retention_session_id'")
                       .where(primary_actor_type: 'Conversation', primary_actor_id: account.conversations.where(inbox_id: inbox_ids).select(:id))
      normal.or(retention)
    end
  end

  def retention_notification?
    meta&.key?('retention_session_id')
  end

  def delivery_allowed?
    return !conversation&.retention_active? unless retention_notification?

    Retention::Access.new(account, user).conversations.exists?(primary_actor_id)
  end

  def retention_url
    session = RetentionSession.find_by(id: meta['retention_session_id'], account_id: account_id)
    query = session&.snapshot_id ? { snapshot: session.snapshot_id } : { conversation: conversation.display_id }
    "/app/accounts/#{account_id}/retention?#{query.to_query}"
  end

  private

  def retention_actor_data
    {
      id: conversation.display_id, inbox_id: conversation.inbox_id,
      meta: { sender: conversation.contact.push_event_data, assignee: nil },
      retention_url: retention_url
    }
  end
end

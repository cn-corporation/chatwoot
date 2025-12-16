Warden::Manager.after_set_user do |user, auth, opts|
  scope = opts[:scope]
  auth.cookies.signed["#{scope}.id"] = user.id
  auth.cookies.signed["#{scope}.expires_at"] = 30.minutes.from_now
end

Warden::Manager.before_logout do |user, auth, opts|
  scope = opts[:scope]
  auth.cookies.signed["#{scope}.id"] = nil
  auth.cookies.signed["#{scope}.expires_at"] = nil

  # Unassign all conversations when user logs out
  if user && scope == :user
    conversations_to_unassign = user.assigned_conversations.open
    conversation_ids = conversations_to_unassign.pluck(:id)

    if conversation_ids.any? && defined?(AGENT_ASSIGNMENT_LOGGER)
      log_data = {
        timestamp: Time.current.iso8601,
        source: 'Warden::Manager.before_logout',
        triggered_by: {
          user_id: user.id,
          user_name: user.name,
          user_email: user.email
        },
        operation: 'bulk_unassignment',
        trigger: 'user_logout',
        logout_user_id: user.id,
        logout_user_name: user.name,
        logout_user_email: user.email,
        conversation_ids: conversation_ids,
        conversation_count: conversation_ids.size,
        assignee_before: { id: user.id, name: user.name, email: user.email },
        assignee_after: nil,
        backtrace: caller(2, 15)
      }
      AGENT_ASSIGNMENT_LOGGER.info(JSON.pretty_generate(log_data))
    end

    conversations_to_unassign.update_all(assignee_id: nil)
  end
end

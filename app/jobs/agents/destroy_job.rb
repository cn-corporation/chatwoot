class Agents::DestroyJob < ApplicationJob
  queue_as :low

  def perform(account, user)
    ActiveRecord::Base.transaction do
      destroy_notification_setting(account, user)
      remove_user_from_teams(account, user)
      remove_user_from_inboxes(account, user)
      unassign_conversations(account, user)
    end
  end

  private

  def remove_user_from_inboxes(account, user)
    inboxes = account.inboxes.all
    inbox_members = user.inbox_members.where(inbox_id: inboxes.pluck(:id))
    inbox_members.destroy_all
  end

  def remove_user_from_teams(account, user)
    teams = account.teams.all
    team_members = user.team_members.where(team_id: teams.pluck(:id))
    team_members.destroy_all
  end

  def destroy_notification_setting(account, user)
    setting = user.notification_settings.find_by(account_id: account.id)
    setting&.destroy!
  end

  def unassign_conversations(account, user)
    conversations_to_unassign = user.assigned_conversations.where(account: account)
    conversation_ids = conversations_to_unassign.pluck(:id)

    if conversation_ids.any? && defined?(AGENT_ASSIGNMENT_LOGGER)
      triggered_by = if Current.user
                       {
                         user_id: Current.user.id,
                         user_name: Current.user.name,
                         user_email: Current.user.email,
                         account_id: account.id
                       }
                     end

      log_data = {
        timestamp: Time.current.iso8601,
        source: 'Agents::DestroyJob#unassign_conversations',
        triggered_by: triggered_by,
        operation: 'bulk_unassignment',
        trigger: 'agent_deletion',
        account_id: account.id,
        deleted_user_id: user.id,
        deleted_user_name: user.name,
        deleted_user_email: user.email,
        conversation_ids: conversation_ids,
        conversation_count: conversation_ids.size,
        assignee_before: { id: user.id, name: user.name, email: user.email },
        assignee_after: nil,
        backtrace: caller(2, 15)
      }
      AGENT_ASSIGNMENT_LOGGER.info(JSON.pretty_generate(log_data))
    end

    # rubocop:disable Rails/SkipsModelValidations
    conversations_to_unassign.in_batches.update_all(assignee_id: nil)
    # rubocop:enable Rails/SkipsModelValidations
  end
end

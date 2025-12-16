# frozen_string_literal: true

module AgentAssignmentLogger
  extend ActiveSupport::Concern

  def log_agent_assignment(source:, assignee_before:, assignee_after:, context: {})
    return unless defined?(AGENT_ASSIGNMENT_LOGGER)

    assignee_before_info = format_assignee_info(assignee_before)
    assignee_after_info = format_assignee_info(assignee_after)

    log_data = {
      timestamp: Time.current.iso8601,
      source: source,
      triggered_by: format_triggered_by_user,
      conversation_id: id,
      account_id: account_id,
      inbox_id: inbox_id,
      contact_id: contact_id,
      team_id: team_id,
      status: status,
      assignee_before: assignee_before_info,
      assignee_after: assignee_after_info,
      context: context,
      backtrace: caller(2, 15)
    }

    AGENT_ASSIGNMENT_LOGGER.info(JSON.pretty_generate(log_data))
  end

  class_methods do
    def log_bulk_agent_assignment(source:, conversation_ids:, assignee_id:, context: {})
      return unless defined?(AGENT_ASSIGNMENT_LOGGER)

      log_data = {
        timestamp: Time.current.iso8601,
        source: source,
        triggered_by: format_triggered_by_user_info,
        operation: 'bulk_assignment',
        conversation_ids: conversation_ids,
        conversation_count: conversation_ids.size,
        assignee_id: assignee_id,
        context: context,
        backtrace: caller(2, 15)
      }

      AGENT_ASSIGNMENT_LOGGER.info(JSON.pretty_generate(log_data))
    end

    def format_triggered_by_user_info
      return nil unless Current.user

      {
        user_id: Current.user.id,
        user_name: Current.user.name,
        user_email: Current.user.email,
        account_id: Current.user.account_users&.first&.account_id
      }
    end
  end

  private

  def format_triggered_by_user
    return nil unless Current.user

    {
      user_id: Current.user.id,
      user_name: Current.user.name,
      user_email: Current.user.email,
      account_id: Current.user.account_users&.first&.account_id
    }
  end

  def format_assignee_info(assignee)
    return nil if assignee.nil?
    return { id: nil, name: 'Unassigned' } if assignee.blank?

    if assignee.is_a?(User)
      {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
        availability_status: assignee.availability_status
      }
    else
      { id: assignee }
    end
  end
end

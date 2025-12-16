module AssignmentHandler
  extend ActiveSupport::Concern
  include Events::Types

  included do
    before_save :ensure_assignee_is_from_team
    after_commit :notify_assignment_change, :process_assignment_changes
  end

  private

  def ensure_assignee_is_from_team
    return unless team_id_changed?

    validate_current_assignee_team
    assign_from_team_if_needed
  end

  def assign_from_team_if_needed
    return if assignee.present?

    new_assignee = find_assignee_from_team
    return unless new_assignee

    log_agent_assignment(
      source: 'AssignmentHandler#ensure_assignee_is_from_team',
      assignee_before: assignee,
      assignee_after: new_assignee,
      context: {
        trigger: 'team_change',
        team_id: team_id,
        team_name: team&.name,
        team_allow_auto_assign: team&.allow_auto_assign,
        team_members_with_capacity: inbox.member_ids_with_assignment_capacity & team.members.ids
      }
    )

    self.assignee = new_assignee
  end

  def validate_current_assignee_team
    return unless team&.members&.exclude?(assignee)

    assignee_before = assignee

    log_agent_assignment(
      source: 'AssignmentHandler#validate_current_assignee_team',
      assignee_before: assignee_before,
      assignee_after: nil,
      context: {
        trigger: 'team_change_validation',
        team_id: team_id,
        team_name: team&.name,
        reason: 'assignee_not_in_team',
        previous_assignee_id: assignee_before&.id,
        team_member_ids: team&.members&.ids
      }
    )

    self.assignee_id = nil
  end

  def find_assignee_from_team
    return if team&.allow_auto_assign.blank?

    team_members_with_capacity = inbox.member_ids_with_assignment_capacity & team.members.ids
    ::AutoAssignment::AgentAssignmentService.new(conversation: self, allowed_agent_ids: team_members_with_capacity).find_assignee
  end

  def notify_assignment_change
    {
      ASSIGNEE_CHANGED => -> { saved_change_to_assignee_id? },
      TEAM_CHANGED => -> { saved_change_to_team_id? }
    }.each do |event, condition|
      condition.call && dispatcher_dispatch(event, previous_changes)
    end
  end

  def process_assignment_changes
    process_assignment_activities
  end

  def process_assignment_activities
    user_name = Current.user.name if Current.user.present?
    if saved_change_to_team_id?
      create_team_change_activity(user_name)
    elsif saved_change_to_assignee_id?
      create_assignee_change_activity(user_name)
    end
  end

  def self_assign?(assignee_id)
    assignee_id.present? && Current.user&.id == assignee_id
  end
end

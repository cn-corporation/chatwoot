class Retention::EntryService
  def initialize(conversation)
    @conversation = conversation
  end

  def perform(started_by: nil, source: 'manual', parameter: nil)
    @conversation.with_lock do
      next @conversation.active_retention_session if @conversation.retention_active?

      validate_entry!

      session = @conversation.retention_sessions.create!(account: @conversation.account, started_by: started_by,
                                                         entry_source: source, entry_parameter: parameter)
      # Entry bypasses support assignment/status callbacks while holding the ingress lock.
      @conversation.update_columns( # rubocop:disable Rails/SkipsModelValidations
        active_retention_session_id: session.id, workflow_epoch: @conversation.workflow_epoch + 1,
        status: Conversation.statuses[:resolved], assignee_id: nil, assignee_agent_bot_id: nil,
        team_id: nil, waiting_since: nil, snoozed_until: nil, updated_at: Time.current
      )
      @conversation.association(:active_retention_session).reset
      session
    end
  end

  private

  def validate_entry!
    if SupportDeliveryLease.live.exists?(conversation_id: @conversation.id)
      raise Retention::Workflow::Conflict, I18n.t('retention.errors.automation_busy')
    end

    canonical_id = @conversation.contact_inbox.conversations.order(:id).pick(:id)
    raise Retention::Workflow::Conflict, I18n.t('retention.errors.canonical') unless canonical_id == @conversation.id
  end
end

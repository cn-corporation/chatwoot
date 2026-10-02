module SupportWorkflowLock
  extend ActiveSupport::Concern

  included do
    around_action :with_support_workflow
    rescue_from Retention::Workflow::Conflict do |error|
      render json: { error: error.message }, status: :conflict
    end
  end

  private

  def with_support_workflow
    display_id = params[:conversation_id] || params[:id]
    return yield unless display_id

    record = Current.account.conversations.find_by!(display_id: display_id)
    record.with_lock do
      raise Retention::Workflow::Conflict, I18n.t('retention.errors.active') if record.retention_active?

      validate_support_epoch!(record)
      @conversation = record
      yield
    end
  end

  def validate_support_epoch!(record)
    expected = request.headers['X-Chatwoot-Workflow-Epoch']
    stale = expected.present? && expected.to_i != record.workflow_epoch
    missing = Current.user.is_a?(AgentBot) && record.workflow_epoch.positive? && expected.blank?
    raise Retention::Workflow::Conflict, I18n.t('retention.errors.changed') if stale || missing
  end
end

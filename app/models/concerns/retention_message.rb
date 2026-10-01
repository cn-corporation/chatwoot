module RetentionMessage
  extend ActiveSupport::Concern

  included do
    belongs_to :retention_session, optional: true
    attr_accessor :retention_authorized, :retention_ingress

    scope :support, -> { where(retention_session_id: nil) }
    around_create :assign_retention_workflow
    after_commit :broadcast_retention_activity, on: [:create, :update], if: :retention_session_id?
  end

  private

  def broadcast_retention_activity
    Retention::RealtimeService.broadcast(self)
  end

  def assign_retention_workflow
    # Serialize ingress and sends with start/completion, including incoming webhooks.
    locked = Conversation.find(conversation_id)
    locked.with_lock do
      validate_retention_workflow!(locked)
      self.retention_session_id = locked.active_retention_session_id if locked.retention_active?
      self.workflow_epoch = locked.workflow_epoch
      self.conversation = locked if conversation.workflow_epoch != locked.workflow_epoch || locked.retention_active?
      yield
    end
  end

  def validate_retention_workflow!(locked)
    if locked.retention_active?
      raise Retention::Workflow::Conflict, I18n.t('retention.errors.active') unless allowed_in_retention?(locked)
    else
      stale = !incoming? && conversation.workflow_epoch != locked.workflow_epoch
      raise Retention::Workflow::Conflict, I18n.t('retention.errors.changed') if retention_session_id.present? || stale
    end
  end

  def allowed_in_retention?(locked)
    incoming? || retention_ingress || (retention_authorized && retention_session_id == locked.active_retention_session_id)
  end
end

class Api::V1::Accounts::Retention::LeasesController < Api::V1::Accounts::BaseController
  before_action :authorize_integration

  def create
    leases = Conversation.transaction do
      conversations.order(:id).lock.map { |conversation| acquire_lease(conversation) }
    end
    render json: { leases: leases }
  rescue Retention::Workflow::Conflict => e
    render json: { error: e.message }, status: :conflict
  end

  def update
    # Renewal locks the conversations too, so an expired lease cannot be revived across takeover.
    lease = account_leases.find(params[:id])
    renewed = lease.conversation.with_lock do
      next false if lease.reload.expires_at <= Time.current || lease.conversation.retention_active?

      lease.update!(expires_at: 2.minutes.from_now)
    end
    head(renewed ? :ok : :conflict)
  end

  def destroy
    account_leases.find_by(id: params[:id])&.destroy!
    head :ok
  end

  private

  def conversations
    scope = Current.account.conversations
    scope = if params[:conversation_id].present?
              scope.where(display_id: params[:conversation_id])
            else
              scope.joins(:contact_inbox).where(contact_inboxes: { source_id: params.require(:telegram_id).to_s })
            end
    params[:inbox_id].present? ? scope.where(inbox_id: params[:inbox_id]) : scope
  end

  def acquire_lease(conversation)
    stale = params[:workflow_epoch].present? && params[:workflow_epoch].to_i != conversation.workflow_epoch
    raise Retention::Workflow::Conflict, I18n.t('retention.errors.active') if conversation.retention_active? || stale

    SupportDeliveryLease.where(conversation: conversation).where(expires_at: ..Time.current).delete_all
    SupportDeliveryLease.create!(conversation: conversation, expires_at: 2.minutes.from_now).id
  end

  def authorize_integration
    raise Pundit::NotAuthorizedError unless Current.user.is_a?(AgentBot) || Current.account_user&.administrator?
  end

  def account_leases
    SupportDeliveryLease.where(conversation_id: Current.account.conversations.select(:id))
  end
end

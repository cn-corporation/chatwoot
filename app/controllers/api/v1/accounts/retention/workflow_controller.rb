# Metadata-only endpoint for server-side integration guards. It never exposes messages.
class Api::V1::Accounts::Retention::WorkflowController < Api::V1::Accounts::BaseController
  def show
    states = conversations.pluck(:display_id, :active_retention_session_id, :workflow_epoch)
    render json: { blocked: states.any? { |state| state[1].present? },
                   conversations: states.map { |id, active_id, epoch| { id: id, retention_active: active_id.present?, workflow_epoch: epoch } } }
  end

  private

  def conversations
    scope = Current.account.conversations
    if params[:conversation_id].present?
      scope = scope.where(display_id: params[:conversation_id])
    else
      scope = scope.joins(:contact_inbox).where(contact_inboxes: { source_id: params.require(:telegram_id).to_s })
      scope = scope.where(inbox_id: params[:inbox_id]) if params[:inbox_id].present?
    end
    scope
  end
end

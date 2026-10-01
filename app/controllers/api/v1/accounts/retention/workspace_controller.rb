class Api::V1::Accounts::Retention::WorkspaceController < Api::V1::Accounts::BaseController
  before_action :authorize_member, except: :capabilities
  rescue_from Retention::Workflow::Conflict do |error|
    render json: { error: error.message }, status: :conflict
  end
  rescue_from Retention::Workflow::ProviderError do |error|
    render json: { error: error.message }, status: :bad_gateway
  end
  rescue_from Retention::SnapshotStore::Unavailable do
    render json: { error: I18n.t('retention.errors.storage_unavailable') }, status: :service_unavailable
  end
  rescue_from Retention::SnapshotStore::NotFound do
    head :not_found
  end

  def capabilities
    render json: { member: access.member?,
                   unread_conversation_ids: Retention::NotificationService.unread_conversation_ids(Current.account, Current.user) }
  end

  def read
    conversation.with_lock do
      authorize_member
      read_notifications
    end
    head :ok
  end

  def index
    scope = access.conversations.includes(:contact, :inbox, :active_retention_session)
    scope = params[:q].present? ? search(scope) : scope.where.not(active_retention_session_id: nil)
    order = Arel.sql('COALESCE(retention_sessions.updated_at, conversations.last_activity_at) DESC')
    records = scope.left_joins(:active_retention_session).order(order)
                   .order(id: :desc).limit(51).offset(page_offset)
    render json: { conversations: records.first(50).map { |record| summary(record) }, has_more: records.size > 50 }
  end

  def show
    scope = conversation.messages
    scope = scope.where('id < ?', params[:before].to_i) if params[:before].present?
    records = scope.reorder(id: :desc).includes(:sender, attachments: { file_attachment: :blob }).limit(101).to_a
    presenter = Retention::MediaPresenter.new(Current.account, Current.user)
    render json: { conversation: summary(conversation), messages: records.first(100).reverse.map { |message| presenter.message(message) },
                   has_more: records.size > 100 }
  end

  def send_message
    Retention::Workflow.new(conversation, Current.user).send_message(
      content: params[:content], request_id: params.require(:request_id), session_id: params[:session_id], attachments: params[:attachments] || []
    )
    show
  end

  def complete
    session = Retention::Workflow.new(conversation, Current.user).complete(session_id: params.require(:session_id))
    # The capture is already durable in Extra; this acknowledgment only publishes it to history.
    Retention::FinalizeSnapshotJob.perform_now(session.id)
    render json: { session: session.summary, snapshot_pending: session.reload.snapshot_synced_at.nil? }
  end

  def retry_message
    Retention::Workflow.new(conversation, Current.user).retry_message(message_id: params.require(:message_id))
    show
  end

  def edit_message
    message = Retention::Workflow.new(conversation, Current.user).edit_message(
      message_id: params.require(:message_id), session_id: params.require(:session_id),
      content: params[:content], expected_content: expected_content
    )
    render json: { message: Retention::MediaPresenter.new(Current.account, Current.user).message(message.reload) }
  end

  def delete_message
    message = Retention::Workflow.new(conversation, Current.user).delete_message(
      message_id: params.require(:message_id), session_id: params.require(:session_id),
      expected_content: expected_content
    )
    render json: { message: Retention::MediaPresenter.new(Current.account, Current.user).message(message.reload) }
  end

  def history
    data = Retention::SnapshotStore.new.history(account_id: Current.account.id, inbox_ids: access.inbox_ids,
                                                page: [params[:page].to_i, 1].max, query: params[:q].to_s)
    authorize_member
    render json: data
  end

  def snapshot
    data = Retention::SnapshotStore.new.read(account_id: Current.account.id, inbox_ids: access.inbox_ids, id: params[:id])
    Retention::MediaPresenter.new(Current.account, Current.user).snapshot(data.fetch('snapshot'), params[:id])
    data.fetch('snapshot').fetch('messages').flat_map { |message| message['attachments'] }.each { |attachment| add_file_url(attachment) }
    authorize_member
    render json: data.except('payload_json')
  end

  private

  def expected_content
    params.fetch(:expected_content) { raise ActionController::ParameterMissing, :expected_content }
  end

  def read_notifications
    session_id = params.require(:session_id).to_i
    raise ActiveRecord::RecordNotFound unless session_id == conversation.active_retention_session_id

    message = conversation.messages.where(retention_session_id: session_id).find(params.require(:last_message_id))
    Current.user.notifications.where(account: Current.account, primary_actor: conversation, read_at: nil, secondary_actor_type: 'Message')
           .where('meta @> ?', { retention_session_id: session_id }.to_json)
           .where('secondary_actor_id <= ?', message.id).find_each { |notification| notification.update!(read_at: Time.current) }
  end

  def add_file_url(attachment)
    return unless attachment['file_id']

    token = Rails.application.message_verifier(:retention_snapshot_file).generate(
      { 'account_id' => Current.account.id, 'user_id' => Current.user.id, 'snapshot_id' => params[:id], 'file_id' => attachment['file_id'] },
      purpose: 'retention_snapshot_file', expires_in: 15.minutes
    )
    attachment['data_url'] = retention_snapshot_file_path(token: token)
  end

  def access
    @access ||= Retention::Access.new(Current.account, Current.user)
  end

  def authorize_member
    raise Pundit::NotAuthorizedError unless access.member?
  end

  def conversation
    @conversation ||= access.conversations.find_by!(display_id: params[:id])
  end

  def page_offset
    ([params[:page].to_i, 1].max - 1) * 50
  end

  def search(scope)
    query = params[:q].to_s.strip.delete_prefix('@').first(200)
    pattern = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
    scope.joins(:contact, :contact_inbox).where(
      "contacts.name ILIKE :pattern OR contacts.additional_attributes->>'username' ILIKE :pattern " \
      "OR contacts.additional_attributes->>'social_telegram_user_name' ILIKE :pattern " \
      'OR contact_inboxes.source_id = :query OR CAST(conversations.display_id AS TEXT) = :query',
      pattern: pattern, query: query
    ).where('conversations.id = (SELECT MIN(c.id) FROM conversations c WHERE c.contact_inbox_id = conversations.contact_inbox_id)')
  end

  def summary(record)
    {
      id: record.display_id, contact: record.contact.slice(:id, :name, :additional_attributes),
      inbox: record.inbox.slice(:id, :name, :channel_type), session_id: record.active_retention_session_id,
      started_at: record.active_retention_session&.created_at, status: record.status,
      last_activity_at: record.active_retention_session&.updated_at || record.last_activity_at
    }
  end
end

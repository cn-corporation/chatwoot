class Api::V1::Accounts::ConversationsController < Api::V1::Accounts::BaseController
  include Events::Types
  include DateRangeHelper
  include HmacConcern

  before_action :conversation, except: [:index, :meta, :search, :create, :filter, :sidebar_counts]
  before_action :inbox, :contact, :contact_inbox, only: [:create]

  ATTACHMENT_RESULTS_PER_PAGE = 100

  def index
    result = conversation_finder.perform
    @conversations = result[:conversations]
    @conversations_count = result[:count]
  end

  def meta
    result = conversation_finder.perform
    @conversations_count = result[:count]
  end

  def search
    result = conversation_finder.perform
    @conversations = result[:conversations]
    @conversations_count = result[:count]
  end

  def sidebar_counts
    inbox_ids = Current.user.assigned_inboxes.pluck(:id)
    scope = Current.account.conversations
                   .where(inbox_id: inbox_ids)
                   .where(status: %i[open pending stand_by])

    scope = Conversations::PermissionFilterService.new(scope, Current.user, Current.account).perform

    unread_sql = Arel.sql(
      'COALESCE((SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conversations.id ' \
      'AND m.message_type = 0 ' \
      'AND (conversations.agent_last_seen_at IS NULL OR m.created_at > conversations.agent_last_seen_at)), 0)'
    )

    records = scope.pluck(
      :display_id, :status, :inbox_id, :team_id, :assignee_id,
      :first_reply_created_at, :waiting_since, :cached_label_list, unread_sql
    )

    render json: records.map { |row|
      {
        id: row[0],
        status: row[1].is_a?(Integer) ? Conversation.statuses.key(row[1]) : row[1],
        inbox_id: row[2],
        team_id: row[3],
        assignee_id: row[4],
        first_reply_created_at: row[5],
        waiting_since: row[6],
        labels: (row[7] || '').split(',').map(&:strip).reject(&:empty?),
        unread_count: row[8].to_i
      }
    }
  end

  def attachments
    @attachments_count = @conversation.attachments.count
    @attachments = @conversation.attachments
                                .includes(:message)
                                .order(created_at: :desc)
                                .page(attachment_params[:page])
                                .per(ATTACHMENT_RESULTS_PER_PAGE)
  end

  def show; end

  def create
    ActiveRecord::Base.transaction do
      @conversation = ConversationBuilder.new(params: params, contact_inbox: @contact_inbox).perform
      Messages::MessageBuilder.new(Current.user, @conversation, params[:message]).perform if params[:message].present?
    end
  end

  def update
    @conversation.update!(permitted_update_params)
  end

  def filter
    result = ::Conversations::FilterService.new(params.permit!, current_user, current_account).perform
    @conversations = result[:conversations]
    @conversations_count = result[:count]
  rescue CustomExceptions::CustomFilter::InvalidAttribute,
         CustomExceptions::CustomFilter::InvalidOperator,
         CustomExceptions::CustomFilter::InvalidQueryOperator,
         CustomExceptions::CustomFilter::InvalidValue => e
    render_could_not_create_error(e.message)
  end

  def mute
    @conversation.mute!
    head :ok
  end

  def unmute
    @conversation.unmute!
    head :ok
  end

  def block_contact
    @conversation.block_for!(params[:duration].to_i)
    head :ok
  end

  def unblock_contact
    @conversation.unblock!
    head :ok
  end

  def transcript
    render json: { error: 'email param missing' }, status: :unprocessable_entity and return if params[:email].blank?

    ConversationReplyMailer.with(account: @conversation.account).conversation_transcript(@conversation, params[:email])&.deliver_later
    head :ok
  end

  def toggle_status
    # FIXME: move this logic into a service object
    Current.executed_by = Current.user
    if pending_to_open_by_bot?
      @conversation.bot_handoff!
    elsif params[:status].present?
      set_conversation_status
      @status = @conversation.save!
    else
      @status = @conversation.toggle_status
    end
  end

  def pending_to_open_by_bot?
    return false unless Current.user.is_a?(AgentBot)

    @conversation.status == 'pending' && params[:status] == 'open'
  end

  def toggle_priority
    @conversation.toggle_priority(params[:priority])
    head :ok
  end

  def toggle_typing_status
    typing_status_manager = ::Conversations::TypingStatusManager.new(@conversation, current_user, params)
    typing_status_manager.toggle_typing_status
    head :ok
  end

  def update_last_seen
    update_last_seen_on_conversation(DateTime.now.utc, assignee?)
  end

  def unread
    last_incoming_message = @conversation.messages.incoming.last
    last_seen_at = last_incoming_message.created_at - 1.second if last_incoming_message.present?
    update_last_seen_on_conversation(last_seen_at, true)
    propagate_unread_to_chatwoot_extra
  end

  def custom_attributes
    @conversation.custom_attributes = params.permit(custom_attributes: {})[:custom_attributes]
    @conversation.save!
  end

  def destroy
    authorize @conversation, :destroy?
    ::DeleteObjectJob.perform_later(@conversation, Current.user, request.ip)
    head :ok
  end

  private

  def permitted_update_params
    # TODO: Move the other conversation attributes to this method and remove specific endpoints for each attribute
    params.permit(:priority)
  end

  def attachment_params
    params.permit(:page)
  end

  def propagate_unread_to_chatwoot_extra
    ChatwootExtra::ApiClient.new.mark_conversation_unread(Current.account.id, @conversation.display_id)
  rescue StandardError => e
    Rails.logger.warn("[ChatwootExtra] Failed to propagate mark-unread for conversation #{@conversation.display_id}: #{e.message}")
  end

  def update_last_seen_on_conversation(last_seen_at, update_assignee)
    # rubocop:disable Rails/SkipsModelValidations
    @conversation.update_column(:agent_last_seen_at, last_seen_at)
    @conversation.update_column(:assignee_last_seen_at, last_seen_at) if update_assignee.present?
    # rubocop:enable Rails/SkipsModelValidations
  end

  def set_conversation_status
    @conversation.status = params[:status]
    @conversation.snoozed_until = parse_date_time(params[:snoozed_until].to_s) if params[:snoozed_until]
    # Set resolution reason when closing conversation
    if params[:resolution_reason].present?
      @conversation.resolution_reason = params[:resolution_reason]
      remove_custom_resolution_reason
    elsif params[:status] == 'resolved' && params[:custom_resolution_reason].present?
      set_custom_resolution_reason(params[:custom_resolution_reason])
    elsif params[:status] == 'resolved'
      remove_custom_resolution_reason
    end

    set_resolution_custom_attributes if params[:status] == 'resolved'

    # Clear resolution reason when reopening conversation
    return unless params[:status] == 'open'

    @conversation.clear_resolution_attributes
  end

  def set_custom_resolution_reason(reason)
    @conversation.custom_attributes = @conversation.custom_attributes.merge('custom_resolution_reason' => reason)
  end

  def set_resolution_custom_attributes
    attrs = {}
    attrs['close_topics'] = params[:close_topics] if params[:close_topics].present?
    attrs['resolved_at'] = Time.current.iso8601 if attrs.any? || params[:resolution_reason].present? || params[:custom_resolution_reason].present?
    @conversation.custom_attributes = @conversation.custom_attributes.merge(attrs) if attrs.any?
  end

  def remove_custom_resolution_reason
    return if @conversation.custom_attributes.blank?

    @conversation.custom_attributes = @conversation.custom_attributes.except('custom_resolution_reason')
  end

  def conversation
    @conversation ||= Current.account.conversations.find_by!(display_id: params[:id])
    authorize @conversation, :show?
  end

  def inbox
    return if params[:inbox_id].blank?

    @inbox = Current.account.inboxes.find(params[:inbox_id])
    authorize @inbox, :show?
  end

  def contact
    return if params[:contact_id].blank?

    @contact = Current.account.contacts.find(params[:contact_id])
  end

  def contact_inbox
    @contact_inbox = build_contact_inbox

    # fallback for the old case where we do look up only using source id
    # In future we need to change this and make sure we do look up on combination of inbox_id and source_id
    # and deprecate the support of passing only source_id as the param
    @contact_inbox ||= ::ContactInbox.find_by!(source_id: params[:source_id])
    authorize @contact_inbox.inbox, :show?
  rescue ActiveRecord::RecordNotUnique
    render json: { error: 'source_id should be unique' }, status: :unprocessable_entity
  end

  def build_contact_inbox
    return if @inbox.blank? || @contact.blank?

    ContactInboxBuilder.new(
      contact: @contact,
      inbox: @inbox,
      source_id: params[:source_id],
      hmac_verified: hmac_verified?
    ).perform
  end

  def conversation_finder
    @conversation_finder ||= ConversationFinder.new(Current.user, params)
  end

  def assignee?
    @conversation.assignee_id? && Current.user == @conversation.assignee
  end
end

Api::V1::Accounts::ConversationsController.prepend_mod_with('Api::V1::Accounts::ConversationsController')

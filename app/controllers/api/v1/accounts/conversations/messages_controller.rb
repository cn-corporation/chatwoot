class Api::V1::Accounts::Conversations::MessagesController < Api::V1::Accounts::Conversations::BaseController
  before_action :ensure_api_inbox, only: [:update], if: :status_update?

  def index
    @messages = message_finder.perform
  end

  def create
    user = Current.user || @resource
    mb = Messages::MessageBuilder.new(user, @conversation, params)
    @message = mb.perform
  rescue StandardError => e
    render_could_not_create_error(e.message)
  end

  def update
    if permitted_params[:content].present?
      update_message_content
    elsif permitted_params[:status].present?
      update_message_status
    elsif permitted_params[:content_type].present? || !permitted_params[:content_attributes].nil?
      update_message_type_and_attributes
    else
      render json: { error: 'No content or status provided' }, status: :unprocessable_entity
    end
  end

  def destroy
    ActiveRecord::Base.transaction do
      original_content = message.content
      sender_name = Current.user&.name || 'Unknown User'

      message.update!(content: I18n.t('conversations.messages.deleted'), content_type: :text, content_attributes: { deleted: true })
      message.attachments.destroy_all

      create_deletion_tracking_note(sender_name, original_content)
    end
  end

  def retry
    return if message.blank?

    service = Messages::StatusUpdateService.new(message, 'sent')
    service.perform
    message.update!(content_attributes: {})
    ::SendReplyJob.perform_later(message.id)
  rescue StandardError => e
    render_could_not_create_error(e.message)
  end

  def translate
    return head :ok if already_translated_content_available?

    translated_content = Integrations::GoogleTranslate::ProcessorService.new(
      message: message,
      target_language: permitted_params[:target_language]
    ).perform

    if translated_content.present?
      translations = {}
      translations[permitted_params[:target_language]] = translated_content
      translations = message.translations.merge!(translations) if message.translations.present?
      message.update!(translations: translations)
    end

    render json: { content: translated_content }
  end

  private

  def message
    @message ||= @conversation.messages.find(permitted_params[:id])
  end

  def message_finder
    @message_finder ||= MessageFinder.new(@conversation, params)
  end

  def permitted_params
    params.permit(:id, :target_language, :status, :external_error, :content, :content_type, content_attributes: {})
  end

  def already_translated_content_available?
    message.translations.present? && message.translations[permitted_params[:target_language]].present?
  end

  def status_update?
    permitted_params[:status].present?
  end

  def update_message_type_and_attributes
    updates = {}
    updates[:content_type] = permitted_params[:content_type] if permitted_params[:content_type].present?
    updates[:content_attributes] = permitted_params[:content_attributes] unless permitted_params[:content_attributes].nil?
    message.update!(updates)
    @message = message
  end

  def update_message_content
    if message.private?
      update_private_note_content
    else
      update_outgoing_message_content
    end
  end

  def update_private_note_content
    if message.additional_attributes&.dig('original_message_id').present?
      render json: { error: 'Cannot edit message history notes' }, status: :forbidden
      return
    end

    new_content = permitted_params[:content]
    message.update!(content: new_content)
    @message = message
  end

  def update_outgoing_message_content
    unless message.outgoing?
      render json: { error: 'Only outgoing messages can be edited' }, status: :forbidden
      return
    end

    if message.source_id.blank?
      render json: { error: 'Cannot edit messages without source_id' }, status: :forbidden
      return
    end

    original_content = message.content
    new_content = permitted_params[:content]
    sender_name = Current.user&.name || 'Unknown User'

    message.update!(content: new_content)

    create_edit_tracking_note(sender_name, original_content, new_content)

    @message = message
  end

  def update_message_status
    Messages::StatusUpdateService.new(message, permitted_params[:status], permitted_params[:external_error]).perform
    @message = message
  end

  # API inbox check
  def ensure_api_inbox
    # Only API inboxes can update messages
    render json: { error: 'Message status update is only allowed for API inboxes' }, status: :forbidden unless @conversation.inbox.api?
  end

  def create_edit_tracking_note(sender_name, old_content, _new_content)
    note_content = "#{sender_name} edited message: \"#{old_content}\""
    create_private_note(note_content, message.id)
  end

  def create_deletion_tracking_note(sender_name, deleted_content)
    note_content = "#{sender_name} deleted message: \"#{deleted_content}\""
    create_private_note(note_content, message.id)
  end

  def create_private_note(content, original_message_id)
    original_message = @conversation.messages.find(original_message_id)
    params = {
      content: content,
      private: true,
      additional_attributes: { original_message_id: original_message_id },
      external_created_at: (original_message.created_at - 1.second)
    }
    Messages::MessageBuilder.new(Current.user, @conversation, params).perform
  end
end

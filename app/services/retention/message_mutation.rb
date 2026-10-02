class Retention::MessageMutation
  Conflict = Retention::Workflow::Conflict
  ProviderError = Retention::Workflow::ProviderError

  def initialize(conversation, user)
    @conversation = conversation
    @user = user
  end

  def edit_message(message_id:, session_id:, content:, expected_content:)
    @conversation.with_lock do
      message = mutable_message!(message_id, session_id, expected_content)
      next message if message.content == content

      validate_edit!(message, content)
      edit_on_telegram!(message, content) if message.source_id.present?
      message.update!(content: content, content_attributes: revised_attributes(message, :edit))
      message
    end
  end

  def delete_message(message_id:, session_id:, expected_content:)
    @conversation.with_lock do
      message = mutable_message!(message_id, session_id, expected_content)
      delete_on_telegram!(message) if message.source_id.present?

      message.update!(content: nil, content_attributes: revised_attributes(message, :delete).merge('deleted' => true))
      message.attachments.destroy_all
      message
    end
  end

  private

  def mutable_message!(message_id, session_id, expected_content)
    authorize!
    session = @conversation.active_retention_session
    raise Conflict, I18n.t('retention.errors.changed') unless session&.id == session_id.to_i

    message = @conversation.messages.find(message_id)
    raise Conflict, I18n.t('retention.errors.changed') unless mutable?(message, session, expected_content)

    message
  end

  def mutable?(message, session, expected_content)
    message.retention_session_id == session.id && message.outgoing? && message.sender_type == 'User' &&
      (message.source_id.present? || message.failed?) && !message.content_attributes['deleted'] &&
      message.content == expected_content
  end

  def authorize!
    membership = @conversation.account.account_users.lock.find_by(user_id: @user.id)
    raise Pundit::NotAuthorizedError unless membership&.retention_member?

    allowed = Retention::Access.new(@conversation.account, @user).conversations.exists?(@conversation.id)
    raise Pundit::NotAuthorizedError unless allowed
  end

  def validate_edit!(message, content)
    raise Conflict, I18n.t('retention.errors.empty_message') if content.to_s.strip.blank? && message.attachments.empty?
    raise Conflict, I18n.t('retention.errors.message_too_long') if content.to_s.length > 150_000
  end

  def edit_on_telegram!(message, content)
    channel = @conversation.inbox.channel
    args = telegram_message_args(message)
    perform_telegram_request(:edit) do
      if message.attachments.exists?
        channel.edit_message_caption_on_telegram(**args, caption: content.to_s)
      else
        channel.edit_message_on_telegram(**args, text: content.to_s)
      end
    end
  end

  def delete_on_telegram!(message)
    perform_telegram_request(:delete) do
      @conversation.inbox.channel.delete_message_on_telegram(**telegram_message_args(message))
    end
  end

  def telegram_message_args(message)
    { chat_id: @conversation.additional_attributes['chat_id'], message_id: message.source_id,
      business_connection_id: @conversation.additional_attributes['business_connection_id'] }
  end

  def perform_telegram_request(action)
    response = yield
    return if response.success? && response.parsed_response['ok'] == true

    raise ProviderError, I18n.t("retention.errors.telegram_#{action}")
  rescue StandardError => e
    raise if e.is_a?(ProviderError)

    Rails.logger.error "Retention Telegram #{action} failed: #{e.class}: #{e.message}"
    raise ProviderError, I18n.t("retention.errors.telegram_#{action}")
  end

  def revised_attributes(message, action)
    history = Array(message.content_attributes['retention_revisions'])
    revision = { 'action' => action.to_s, 'at' => Time.current.iso8601(6),
                 'by' => { 'id' => @user.id, 'name' => @user.name }, 'previous_content' => message.content }
    revision['removed_attachments'] = removed_attachments(message) if action == :delete
    message.content_attributes.merge('retention_revisions' => history + [revision])
  end

  def removed_attachments(message)
    message.attachments.includes(file_attachment: :blob).map do |attachment|
      blob = attachment.file.blob if attachment.file.attached?
      attachment.attributes.merge('filename' => blob&.filename&.to_s, 'content_type' => blob&.content_type,
                                  'byte_size' => blob&.byte_size, 'checksum' => blob&.checksum,
                                  'checksum_algorithm' => 'md5_base64', 'blob_metadata' => blob&.metadata)
    end
  end
end

class Retention::Workflow
  include FileTypeHelper
  class Conflict < StandardError; end
  class ProviderError < StandardError; end

  def initialize(conversation, user)
    @conversation = conversation
    @user = user
  end

  def send_message(content:, request_id:, session_id:, attachments: [])
    validate_message!(content, request_id, attachments)
    fingerprint = Retention::Uploads.fingerprint(content, attachments)

    @conversation.with_lock do
      authorize!
      previous = @conversation.messages.find_by(retention_request_id: request_id)
      next previous if duplicate?(previous, content, attachments, fingerprint)
      raise Conflict, I18n.t('retention.errors.changed') if previous

      session = session_for_send(session_id)
      create_messages(session, content, request_id, attachments, fingerprint)
    end
  end

  def complete(session_id:)
    store = Retention::SnapshotStore.new
    @conversation.with_lock do
      authorize!
      session = @conversation.retention_sessions.find(session_id)
      if session.completed_at?
        raise Conflict, I18n.t('retention.errors.changed') if session.snapshot_id.blank?

        next session
      end
      raise Conflict, I18n.t('retention.errors.changed') unless @conversation.active_retention_session_id == session.id

      capture_snapshot!(session, store)
      archive_conversation!(session)
      session
    end
  end

  def retry_message(message_id:)
    @conversation.with_lock do
      authorize!
      message = @conversation.messages.find(message_id)
      unless message.outgoing? && message.retention_session_id.present? && message.retention_session_id == @conversation.active_retention_session_id
        raise Conflict, I18n.t('retention.errors.changed')
      end
      raise Conflict, I18n.t('retention.errors.changed') if message.content_attributes['deleted']
      next message unless message.failed?

      message.update!(status: :sent, external_error: nil)
      SendReplyJob.perform_later(message.id)
      message
    end
  end

  def edit_message(message_id:, session_id:, content:, expected_content:)
    Retention::MessageMutation.new(@conversation, @user).edit_message(
      message_id: message_id, session_id: session_id, content: content, expected_content: expected_content
    )
  end

  def delete_message(message_id:, session_id:, expected_content:)
    Retention::MessageMutation.new(@conversation, @user).delete_message(
      message_id: message_id, session_id: session_id, expected_content: expected_content
    )
  end

  private

  def create_messages(session, content, request_id, attachments, fingerprint)
    # Each Telegram file has its own delivery/retry state; the whole batch is committed atomically.
    (attachments.presence || [nil]).each_with_index.map do |upload, index|
      message = @conversation.messages.build(
        account_id: @conversation.account_id, inbox_id: @conversation.inbox_id,
        sender: @user, message_type: :outgoing, content: index.zero? ? content : nil, content_type: :text,
        retention_session: session, retention_request_id: index.zero? ? request_id : SecureRandom.uuid,
        retention_authorized: true, additional_attributes: { retention_upload_fingerprint: fingerprint }
      )
      message.attachments.build(account_id: @conversation.account_id, file: upload, file_type: file_type(upload.content_type)) if upload
      message.save!
      message
    end.first
  end

  def validate_message!(content, request_id, attachments)
    Retention::Uploads.validate!(attachments)
    raise Conflict, I18n.t('retention.errors.empty_message') if content.to_s.strip.blank? && attachments.empty?
    return if request_id.to_s.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)

    raise Conflict, I18n.t('retention.errors.invalid_request')
  end

  def duplicate?(previous, content, attachments, fingerprint)
    return false unless previous && previous.sender_type == 'User' && previous.sender_id == @user.id

    saved = previous.additional_attributes['retention_upload_fingerprint']
    saved ? saved == fingerprint : attachments.empty? && previous.attachments.empty? && previous.content == content
  end

  def session_for_send(session_id)
    session = @conversation.active_retention_session
    expected = session_id.present? ? session_id.to_i : nil
    raise Conflict, I18n.t('retention.errors.changed') unless session&.id == expected

    session || start_session
  end

  def capture_snapshot!(session, store)
    raise Conflict, I18n.t('retention.errors.delivery_pending') if session.messages.outgoing.where(source_id: nil).where.not(status: :failed).exists?

    completed_at = Time.current
    snapshot = Retention::SnapshotBuilder.new(session).build(completed_by: @user, completed_at: completed_at)
    # Extra must durably own the transcript and media metadata before the chat can be released.
    # A rolled-back attempt leaves a private prepared capture in Extra; a later attempt gets its own immutable receipt.
    receipt = store.prepare(session, snapshot)
    session.update!(completed_at: completed_at, completed_by: @user, snapshot_id: receipt.fetch('id'), snapshot_digest: receipt.fetch('digest'))
  end

  def archive_conversation!(session)
    # A retention completion must bypass support resolution callbacks; the caller holds the row lock.
    @conversation.update_columns( # rubocop:disable Rails/SkipsModelValidations
      active_retention_session_id: nil, workflow_epoch: @conversation.workflow_epoch + 1,
      status: Conversation.statuses[:resolved], retention_archived_at: session.completed_at,
      support_started_at: nil, waiting_since: nil, first_reply_created_at: nil,
      assignee_id: nil, assignee_agent_bot_id: nil, team_id: nil, snoozed_until: nil,
      agent_last_seen_at: session.completed_at, updated_at: session.completed_at
    )
  end

  def authorize!
    membership = @conversation.account.account_users.lock.find_by(user_id: @user.id)
    raise Pundit::NotAuthorizedError unless membership&.retention_member?

    allowed = Retention::Access.new(@conversation.account, @user).conversations.exists?(@conversation.id)
    raise Pundit::NotAuthorizedError unless allowed
  end

  def start_session
    Retention::EntryService.new(@conversation).perform(started_by: @user)
  end
end

class Retention::MediaController < ApplicationController
  include ActiveStorage::Streaming

  def show
    attachment = authorized_attachment
    verify_snapshot!(attachment) if identity['snapshot_id']
    raise Pundit::NotAuthorizedError unless access.member?

    response.headers['Cache-Control'] = 'no-store'
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    stream_blob(attachment.file.blob)
  rescue ActiveStorage::FileNotFoundError, Retention::SnapshotStore::NotFound
    head :not_found
  rescue Retention::SnapshotStore::Unavailable
    head :service_unavailable
  end

  private

  def authorized_attachment
    raise Pundit::NotAuthorizedError unless access.member?

    attachment = Attachment.where(account: account).includes(message: :conversation, file_attachment: :blob).find(identity.fetch('attachment_id'))
    raise ActiveRecord::RecordNotFound unless attachment.file.attached? && attachment.file.blob.id == identity.fetch('blob_id')
    raise Pundit::NotAuthorizedError unless access.inbox_ids.include?(attachment.message.inbox_id)

    attachment
  end

  def stream_blob(blob)
    if request.headers['Range'].present?
      send_blob_byte_range_data(blob, request.headers['Range'])
    else
      send_blob_stream(blob)
    end
  end

  def identity
    @identity ||= Rails.application.message_verifier(:retention_media).verified(params[:token], purpose: 'retention_media')
    raise Pundit::NotAuthorizedError unless @identity

    @identity
  end

  def account
    @account ||= Account.find(identity.fetch('account_id'))
  end

  def access
    @access ||= Retention::Access.new(account, User.find(identity.fetch('user_id')))
  end

  def verify_snapshot!(attachment)
    data = Retention::SnapshotStore.new.read(account_id: account.id, inbox_ids: access.inbox_ids, id: identity.fetch('snapshot_id'))
    reference = data.fetch('snapshot').fetch('messages').flat_map { |message| message.fetch('attachments') }
                    .find { |item| item['id'] == attachment.id }
    raise ActiveRecord::RecordNotFound unless reference && Retention::MediaPresenter.matches?(attachment, reference)
  end
end

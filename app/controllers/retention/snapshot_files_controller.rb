class Retention::SnapshotFilesController < ApplicationController
  def show
    authorize_access!
    attachment = find_attachment!
    bytes = store.file(**snapshot_scope, file_id: identity.fetch('file_id'))
    # Membership may change while storage is being read.
    authorize_access!
    raise Pundit::NotAuthorizedError unless access.inbox_ids.include?(stored_snapshot.dig('session', 'inbox', 'id'))

    serve_attachment(bytes, attachment)
  rescue Retention::SnapshotStore::NotFound
    head :not_found
  rescue Retention::SnapshotStore::Unavailable
    render json: { error: I18n.t('retention.errors.storage_unavailable') }, status: :service_unavailable
  end

  private

  def serve_attachment(bytes, attachment)
    response.headers['Cache-Control'] = 'no-store'
    send_data bytes, filename: File.basename(attachment['filename'].to_s),
                     type: attachment['content_type'].presence || 'application/octet-stream', disposition: disposition(attachment)
  end

  def find_attachment!
    attachment = stored_snapshot.fetch('snapshot').fetch('messages').flat_map { |message| message.fetch('attachments') }
                                .find { |item| item['file_id'] == identity.fetch('file_id') }
    attachment || raise(ActiveRecord::RecordNotFound)
  end

  def identity
    @identity ||= Rails.application.message_verifier(:retention_snapshot_file)
                       .verified(params[:token], purpose: 'retention_snapshot_file')
    raise Pundit::NotAuthorizedError unless @identity

    @identity
  end

  def access
    @access ||= Retention::Access.new(Account.find(identity.fetch('account_id')), User.find(identity.fetch('user_id')))
  end

  def authorize_access!
    raise Pundit::NotAuthorizedError unless access.member?
  end

  def store
    @store ||= Retention::SnapshotStore.new
  end

  def snapshot_scope
    { account_id: identity.fetch('account_id'), inbox_ids: access.inbox_ids, id: identity.fetch('snapshot_id') }
  end

  def stored_snapshot
    @stored_snapshot ||= store.read(**snapshot_scope)
  end

  def disposition(attachment)
    mime = attachment['content_type'].to_s
    mime.match?(%r{\A(?:image/(?:png|jpeg|gif|webp)|audio/[^;]+|video/[^;]+)\z}) ? 'inline' : 'attachment'
  end
end

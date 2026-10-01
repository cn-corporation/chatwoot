class Retention::MediaPresenter
  include Rails.application.routes.url_helpers

  def initialize(account, user)
    @account = account
    @user = user
  end

  def message(message)
    message.attributes.merge('sender' => message.sender&.slice(:id, :name),
                             'attachments' => message.attachments.map { |attachment| live_attachment(attachment) })
  end

  def snapshot(snapshot, snapshot_id)
    items = snapshot.fetch('messages').flat_map { |message| message.fetch('attachments') }
    originals = Attachment.where(account: @account, id: items.pluck('id')).includes(file_attachment: :blob).index_by(&:id)
    items.each do |item|
      next unless item['blob_id']

      original = originals[item['id']]
      item['available'] = original.present? && matches?(original, item)
      item['data_url'] = url(original, snapshot_id: snapshot_id) if item['available']
    end
  end

  def self.matches?(attachment, reference)
    attachment && attachment.message_id == reference['message_id'] && attachment.file.attached? &&
      attachment.file.blob.id == reference['blob_id'] && attachment.file.blob.checksum == reference['checksum']
  end

  private

  def matches?(attachment, reference)
    self.class.matches?(attachment, reference)
  end

  def live_attachment(attachment)
    data = attachment.attributes
    unless attachment.file.attached?
      data['available'] = false if attachment.with_attached_file? && attachment.external_url.blank?
      return data
    end

    blob = attachment.file.blob
    data.merge('available' => true, 'data_url' => url(attachment), 'filename' => blob.filename.to_s, 'byte_size' => blob.byte_size,
               'content_type' => blob.content_type, 'blob_metadata' => blob.metadata)
  end

  def url(attachment, snapshot_id: nil)
    identity = { 'account_id' => @account.id, 'user_id' => @user.id, 'attachment_id' => attachment.id,
                 'blob_id' => attachment.file.blob.id, 'snapshot_id' => snapshot_id }.compact
    token = Rails.application.message_verifier(:retention_media).generate(identity, purpose: 'retention_media', expires_in: 15.minutes)
    retention_media_path(token: token)
  end
end

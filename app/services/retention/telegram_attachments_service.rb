class Retention::TelegramAttachmentsService < Telegram::SendAttachmentsService
  ENDPOINTS = { 'photo' => 'sendPhoto', 'audio' => 'sendAudio', 'video' => 'sendVideo', 'document' => 'sendDocument' }.freeze

  private

  def send_attachment(attachment, caption)
    # Reuse native Telegram throttling, errors and retries, but avoid dependence on a public media host.
    type = attachment_type(attachment.file_type)
    attachment.file.blob.open do |file|
      body = upload_body(attachment, caption, type, file)
      with_chat_throttle(channel.chat_id(message)) do
        with_429_retry { HTTParty.post("#{channel.telegram_api_url}/#{ENDPOINTS.fetch(type)}", body: body, multipart: true) }
      end
    end
  end

  def upload_body(attachment, caption, type, file)
    body = {
      'chat_id' => channel.chat_id(message).to_s,
      type => UploadIO.new(file.path, attachment.file.content_type, attachment.file.filename.to_s)
    }.merge(business_connection_body.stringify_keys)
    reply_id = channel.reply_to_message_id(message)
    body['reply_to_message_id'] = reply_id.to_s if reply_id.present?
    if caption.present?
      body['caption'] = caption.to_s
      body['parse_mode'] = 'HTML'
    end
    body
  end
end

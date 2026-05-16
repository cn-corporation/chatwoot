# Telegram Attachment APIs: ref: https://core.telegram.org/bots/api#inputfile

# We are using `HTTP URL` to send media attachments, telegram will directly download the media from the URL and send it to the user.
# But for documents, we need to send the file as a multipart request. as telegram only support pdf and zip for the download from the URL option.

# ref: `In sendDocument, sending by URL will currently only work for GIF, PDF and ZIP files.`
# ref: `https://core.telegram.org/bots/api#senddocument`
# ref: `https://core.telegram.org/bots/api#sendmediaGroup

# The service will terminate if any of the attachment requests fail when the message has multiple attachments.
# Each attachment is sent as its own Telegram message.
class Telegram::SendAttachmentsService
  include Telegram::ApiConcern

  pattr_initialize [:message!]

  def perform
    attachment_message_id = nil

    message.attachments.each_with_index do |attachment, index|
      response = send_attachment(attachment, caption_for(index))
      return nil unless handle_response(response)

      attachment_message_id ||= extract_attachment_message_id(response)
    end

    attachment_message_id
  end

  private

  def attachment_type(file_type)
    { 'audio' => 'audio', 'image' => 'photo', 'file' => 'document', 'video' => 'video' }[file_type] || 'document'
  end

  def send_attachment(attachment, caption)
    type = attachment_type(attachment.file_type)

    if type == 'document'
      attachment_data = { attachment: attachment, caption: caption }
      document_request(channel.chat_id(message), attachment_data, channel.reply_to_message_id(message))
    elsif type == 'photo'
      photo_request(channel.chat_id(message), attachment.download_url, caption, channel.reply_to_message_id(message))
    elsif type == 'video'
      video_request(channel.chat_id(message), attachment.download_url, caption, channel.reply_to_message_id(message))
    elsif type == 'audio'
      audio_request(channel.chat_id(message), attachment.download_url, caption, channel.reply_to_message_id(message))
    else
      attachment_data = { attachment: attachment, caption: caption }
      document_request(channel.chat_id(message), attachment_data, channel.reply_to_message_id(message))
    end
  end

  def document_request(chat_id, attachment, reply_to_message_id)
    temp_file_path = save_attachment_to_tempfile(attachment[:attachment])
    response = send_file(chat_id, temp_file_path, reply_to_message_id, attachment[:caption])
    File.delete(temp_file_path)
    response
  end

  def media_group_request(chat_id, media, reply_to_message_id)
    body = {
      'chat_id' => chat_id.to_s,
      'reply_to_message_id' => reply_to_message_id.to_s,
      'media' => media.to_json
    }

    business_connection_body.each do |key, value|
      body[key.to_s] = value.to_s
    end

    with_chat_throttle(chat_id) do
      with_429_retry do
        HTTParty.post("#{channel.telegram_api_url}/sendMediaGroup", body: body)
      end
    end
  end

  def photo_request(chat_id, photo_url, caption, reply_to_message_id)
    body = {
      'chat_id' => chat_id.to_s,
      'photo' => photo_url,
      'reply_to_message_id' => reply_to_message_id.to_s
    }
    body['caption'] = caption.to_s if caption.present?
    body['parse_mode'] = 'HTML' if caption.present?

    business_connection_body.each do |key, value|
      body[key.to_s] = value.to_s
    end

    with_chat_throttle(chat_id) do
      with_429_retry { HTTParty.post("#{channel.telegram_api_url}/sendPhoto", body: body) }
    end
  end

  def video_request(chat_id, video_url, caption, reply_to_message_id)
    body = {
      'chat_id' => chat_id.to_s,
      'video' => video_url,
      'reply_to_message_id' => reply_to_message_id.to_s
    }
    body['caption'] = caption.to_s if caption.present?
    body['parse_mode'] = 'HTML' if caption.present?

    business_connection_body.each do |key, value|
      body[key.to_s] = value.to_s
    end

    with_chat_throttle(chat_id) do
      with_429_retry { HTTParty.post("#{channel.telegram_api_url}/sendVideo", body: body) }
    end
  end

  def audio_request(chat_id, audio_url, caption, reply_to_message_id)
    body = {
      'chat_id' => chat_id.to_s,
      'audio' => audio_url,
      'reply_to_message_id' => reply_to_message_id.to_s
    }
    body['caption'] = caption.to_s if caption.present?
    body['parse_mode'] = 'HTML' if caption.present?

    business_connection_body.each do |key, value|
      body[key.to_s] = value.to_s
    end

    with_chat_throttle(chat_id) do
      with_429_retry { HTTParty.post("#{channel.telegram_api_url}/sendAudio", body: body) }
    end
  end

  # Telegram picks up the file name from original field name, so we need to save the file with the original name.
  # Hence not using Tempfile here.
  def save_attachment_to_tempfile(attachment)
    raw_data = attachment.file.download
    temp_dir = Rails.root.join('tmp/uploads')
    FileUtils.mkdir_p(temp_dir)
    temp_file_path = File.join(temp_dir, attachment.file.filename.to_s)
    File.write(temp_file_path, raw_data, mode: 'wb')
    temp_file_path
  end

  def send_file(chat_id, file_path, reply_to_message_id, caption = nil)
    # Use string keys and ensure proper encoding for multipart request
    body = {
      'chat_id' => chat_id.to_s,
      'reply_to_message_id' => reply_to_message_id.to_s
    }

    # Add business connection body with string keys
    business_connection_body.each do |key, value|
      body[key.to_s] = value.to_s
    end

    body['caption'] = caption.to_s if caption.present?
    body['parse_mode'] = 'HTML' if caption.present?

    # Use UploadIO to properly handle binary file uploads with encoding
    filename = File.basename(file_path)
    content_type = Marcel::MimeType.for(Pathname.new(file_path)) || 'application/octet-stream'
    body['document'] = UploadIO.new(file_path, content_type, filename)

    with_chat_throttle(chat_id) do
      with_429_retry do
        HTTParty.post("#{channel.telegram_api_url}/sendDocument",
                      body: body,
                      multipart: true)
      end
    end
  end

  def handle_response(response)
    return true if response.success?

    Rails.logger.error "Message Id: #{message.id}  - Error sending attachment to telegram:  #{response.parsed_response}"
    channel.process_error(message, response)
    false
  end

  def extract_attachment_message_id(response)
    return unless response.success?

    result = response.parsed_response['result']
    # response will be an array if the request for media group
    # response will be a hash if the request for document
    result.is_a?(Array) ? result.first['message_id'] : result['message_id']
  end

  def channel
    @channel ||= message.inbox.channel
  end

  def business_connection_id
    @business_connection_id ||= channel.business_connection_id(message)
  end

  def business_connection_body
    body = {}
    body[:business_connection_id] = business_connection_id if business_connection_id
    body
  end

  def caption_for(index)
    return if index.positive?
    return if message.content.blank?

    channel.convert_markdown_to_telegram_html(message.content)
  end
end

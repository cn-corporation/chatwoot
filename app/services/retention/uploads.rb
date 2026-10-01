class Retention::Uploads
  def self.validate!(uploads)
    unless uploads.is_a?(Array) && uploads.size <= Message::NUMBER_OF_PERMITTED_ATTACHMENTS &&
           uploads.all?(ActionDispatch::Http::UploadedFile)
      raise Retention::Workflow::Conflict, I18n.t('retention.errors.invalid_upload')
    end

    limit = GlobalConfigService.load('MAXIMUM_FILE_UPLOAD_SIZE', 40).to_i
    limit = 40 if limit <= 0
    return unless uploads.any? { |file| file.size > limit.megabytes }

    raise Retention::Workflow::Conflict, I18n.t('retention.errors.upload_too_large', limit: limit)
  end

  def self.fingerprint(content, uploads)
    files = uploads.map do |upload|
      [upload.original_filename, upload.content_type, upload.size, Digest::SHA256.file(upload.tempfile.path).hexdigest]
    end
    Digest::SHA256.hexdigest([content.to_s, files].to_json)
  end
end
